const Parser = require('rss-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FEED_URL = 'https://powlair.github.io/flux-rss-framework/feed.xml';
const SIGNAL_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

const tagRules = require('./tags.json');
const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'RSS Enricher 1.0' }
});

// --- Step 1: Fetch and parse feed.xml ---

async function fetchArticles() {
    console.log(`Fetching ${FEED_URL}...`);
    const feed = await parser.parseURL(FEED_URL);
    console.log(`Fetched ${feed.items.length} raw items.`);

    return feed.items.map(item => {
        const match = (item.title || '').match(/^\[(.+?)\]\s(.+)$/);
        return {
            title:       match ? match[2] : (item.title || ''),
            source:      match ? match[1] : 'Unknown',
            url:         item.link || '',
            date:        item.isoDate ? new Date(item.isoDate) : new Date(item.pubDate),
            author:      item.creator || item.author || 'Unknown',
            description: item.content || item.contentSnippet || item.summary || '',
            categories:  item.categories || [],
        };
    });
}

// --- Step 2: Deduplicate by URL ---

function deduplicate(articles) {
    const seen = new Set();
    const unique = articles.filter(article => {
        if (!article.url || seen.has(article.url)) return false;
        seen.add(article.url);
        return true;
    });
    console.log(`After deduplication: ${unique.length} articles (removed ${articles.length - unique.length} duplicates).`);
    return unique;
}

// --- Step 3: Auto-tagging ---

function detectTags(article) {
    const haystack = `${article.title} ${article.description} ${article.categories.join(' ')}`.toLowerCase();
    const foundTags = new Set();

    for (const [keyword, tag] of Object.entries(tagRules)) {
        if (haystack.includes(keyword)) {
            foundTags.add(tag);
        }
    }

    return [...foundTags];
}

// --- Step 4: Signal score ---

function computeSignal(article, allArticles) {
    return allArticles.filter(other =>
        other._tempId !== article._tempId &&
        Math.abs(other.date - article.date) < SIGNAL_WINDOW_MS &&
        other.tags.some(t => article.tags.includes(t))
    ).length;
}

// --- Step 5: Language detection ---

function detectLang(article) {
    const text = `${article.title} ${article.description}`;
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return 'ja';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
    return 'en';
}

// --- Step 6: Stable ID from URL ---

function makeId(url) {
    return crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
}

// --- Main ---

async function enrich() {
    const raw = await fetchArticles();
    const unique = deduplicate(raw);

    // Assign a temp sequential ID for signal computation before final IDs
    unique.forEach((a, i) => { a._tempId = i; });

    // Apply tagging first (needed for signal scoring)
    unique.forEach(a => { a.tags = detectTags(a); });

    // Apply signal scoring, language detection, and stable ID
    const articles = unique.map(a => ({
        id:          makeId(a.url),
        title:       a.title,
        source:      a.source,
        url:         a.url,
        date:        a.date.toISOString(),
        author:      a.author,
        description: a.description,
        tags:        a.tags,
        signal:      computeSignal(a, unique),
        lang:        detectLang(a),
    }));

    const uniqueSources = new Set(articles.map(a => a.source)).size;
    const availableTags = [...new Set(articles.flatMap(a => a.tags))].sort();

    const output = {
        meta: {
            generatedAt:   new Date().toISOString(),
            totalArticles: articles.length,
            uniqueSources,
            availableTags,
        },
        articles,
    };

    const outputDir = path.join(__dirname, 'public');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    fs.writeFileSync(
        path.join(outputDir, 'feed-enriched.json'),
        JSON.stringify(output, null, 2)
    );

    console.log(`Done. ${articles.length} articles, ${uniqueSources} sources, ${availableTags.length} tags. → public/feed-enriched.json`);
}

enrich().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});

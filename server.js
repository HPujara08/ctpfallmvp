const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { HfInference } = require('@huggingface/inference');
const cheerio = require('cheerio');
const SentimentAnalyzer = require('./modules/sentiment-analyzer');

const app = express();
const PORT = 3001;

// Initialize Hugging Face inference
const hf = new HfInference(process.env.HF_API_KEY || null); // Optional API key for rate limits

// Initialize Sentiment Analyzer
const sentimentAnalyzer = new SentimentAnalyzer();

// Train model on startup (async, non-blocking)
sentimentAnalyzer.ensureTrained().then(() => {
    console.log('✅ Sentiment analyzer ready');
}).catch(err => {
    console.error('⚠️ Sentiment analyzer training failed:', err.message);
});

// Cache for ticker analysis results (5 minutes TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

app.use(cors());
app.use(express.json());

// Yahoo Finance News API endpoint
async function fetchYahooNews(ticker) {
    const articles = [];
    
    // Primary method: Use RSS feed (more reliable)
    try {
        console.log(`Attempting RSS feed for ${ticker}...`);
        const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`;
        const rssResponse = await axios.get(rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            timeout: 5000 // Reduced timeout for faster failure
        });
        
        const rss$ = cheerio.load(rssResponse.data, { xmlMode: true });
        
        rss$('item').each((i, item) => {
            const title = rss$(item).find('title').text().trim();
            const link = rss$(item).find('link').text().trim();
            const pubDate = rss$(item).find('pubDate').text();
            const description = rss$(item).find('description').text().trim();
            
            if (title && link) {
                let formattedDate = 'Recent';
                let dateObj = new Date(); // Default to now if no date
                
                if (pubDate) {
                    try {
                        dateObj = new Date(pubDate);
                        formattedDate = dateObj.toLocaleDateString();
                    } catch (e) {
                        formattedDate = pubDate;
                    }
                }
                
                articles.push({
                    title,
                    link,
                    date: formattedDate,
                    dateObj: dateObj, // Store Date object for sorting
                    description: description || ''
                });
            }
        });
        
        // Sort by date (most recent first) and limit to 10
        articles.sort((a, b) => b.dateObj - a.dateObj);
        articles = articles.slice(0, 10);
        
        // Remove dateObj before returning (clean up)
        articles = articles.map(({ dateObj, ...article }) => article);
        
        if (articles.length > 0) {
            console.log(`Successfully fetched ${articles.length} articles from RSS feed (sorted by most recent)`);
            return articles;
        }
    } catch (rssError) {
        console.error('RSS feed error:', rssError.message);
        // Continue to fallback method
    }

    // Fallback: Try scraping Yahoo Finance page
    try {
        console.log(`Attempting web scraping for ${ticker}...`);
        const url = `https://finance.yahoo.com/quote/${ticker}/news`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 5000 // Reduced timeout for faster failure
        });

        const $ = cheerio.load(response.data);
        
        // Try multiple selectors as Yahoo Finance structure may vary
        const selectors = [
            'h3 a[data-module="StreamItem"]',
            'h3 a',
            'a[data-test-locator="stream-item"]',
            '.js-stream-content a'
        ];
        
        for (const selector of selectors) {
            $(selector).each((i, elem) => {
                const title = $(elem).text().trim();
                let link = $(elem).attr('href');
                
                if (title && link) {
                    const fullLink = link.startsWith('http') ? link : `https://finance.yahoo.com${link}`;
                    const dateElem = $(elem).closest('div').find('time, span[data-test-locator]');
                    const dateText = dateElem.first().text().trim() || 'Recent';
                    
                    // Try to parse date from text
                    let dateObj = new Date();
                    try {
                        // Try to parse relative dates like "2h ago", "1d ago", etc.
                        const dateMatch = dateText.match(/(\d+)\s*(h|hour|d|day|m|min)/i);
                        if (dateMatch) {
                            const value = parseInt(dateMatch[1]);
                            const unit = dateMatch[2].toLowerCase();
                            dateObj = new Date();
                            if (unit === 'h' || unit === 'hour') {
                                dateObj.setHours(dateObj.getHours() - value);
                            } else if (unit === 'd' || unit === 'day') {
                                dateObj.setDate(dateObj.getDate() - value);
                            } else if (unit === 'm' || unit === 'min') {
                                dateObj.setMinutes(dateObj.getMinutes() - value);
                            }
                        } else {
                            // Try parsing as absolute date
                            dateObj = new Date(dateText);
                            if (isNaN(dateObj.getTime())) {
                                dateObj = new Date(); // Fallback to now
                            }
                        }
                    } catch (e) {
                        dateObj = new Date(); // Fallback to now
                    }
                    
                    // Avoid duplicates
                    if (!articles.find(a => a.title === title)) {
                        articles.push({
                            title,
                            link: fullLink,
                            date: dateText,
                            dateObj: dateObj
                        });
                    }
                }
            });
            
            if (articles.length > 0) break;
        }
        
        // Sort by date (most recent first) and limit to 10
        articles.sort((a, b) => b.dateObj - a.dateObj);
        articles = articles.slice(0, 10);
        
        // Remove dateObj before returning
        articles = articles.map(({ dateObj, ...article }) => article);
        
        if (articles.length > 0) {
            console.log(`Successfully scraped ${articles.length} articles from web page (sorted by most recent)`);
            return articles;
        }
    } catch (scrapeError) {
        console.error('Web scraping error:', scrapeError.message);
        // If both methods fail, return empty array
    }

    // If no articles found, return empty array (don't throw error)
    console.warn(`No articles found for ${ticker} using any method`);
    return articles;
}

// Fast summary generation (no AI, instant)
function generateFastSummary(articles) {
    if (!articles || articles.length === 0) {
        return 'No recent news articles found for this ticker.';
    }

    const topArticles = articles.slice(0, 3);
    const topics = topArticles.map(a => a.title).join('; ');
    
    return `Recent news highlights: ${topArticles.length > 0 ? topics : 'No recent updates'}. Check the articles below for more details.`;
}

// Summarize articles using Hugging Face model (slower, but more intelligent)
async function summarizeArticlesWithAI(articles) {
    if (!articles || articles.length === 0) {
        return 'No recent news articles found for this ticker.';
    }

    // Combine article titles and create a text to summarize
    const newsText = articles
        .slice(0, 5) // Use top 5 articles
        .map((article, idx) => `${idx + 1}. ${article.title}`)
        .join('\n');

    // If text is too short, add more context
    if (newsText.length < 50) {
        return generateFastSummary(articles);
    }

    try {
        // Use distilbart-cnn-12-6 model for summarization
        const textToSummarize = newsText.length > 1024 ? newsText.substring(0, 1024) : newsText;
        
        console.log('Calling Hugging Face API for summarization...');
        const summary = await hf.summarization({
            model: 'sshleifer/distilbart-cnn-12-6',
            inputs: textToSummarize,
            parameters: {
                max_length: 150,
                min_length: 50,
                do_sample: false
            }
        });

        // Handle different response formats
        let summaryText = '';
        if (typeof summary === 'string') {
            summaryText = summary;
        } else if (summary.summary_text) {
            summaryText = summary.summary_text;
        } else if (Array.isArray(summary) && summary[0]?.summary_text) {
            summaryText = summary[0].summary_text;
        } else if (summary[0] && typeof summary[0] === 'string') {
            summaryText = summary[0];
        } else {
            console.warn('Unexpected summary format:', summary);
            summaryText = 'Summary generated successfully.';
        }

        return summaryText || 'Summary generated successfully.';
    } catch (error) {
        console.error('Summarization error:', error.message);
        // Fallback to fast summary
        return generateFastSummary(articles);
    }
}

// Cache helper functions
function getCachedResult(ticker) {
    const cached = cache.get(ticker);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`✅ Cache HIT for ${ticker}`);
        return cached.data;
    }
    if (cached) {
        // Expired, remove it
        cache.delete(ticker);
    }
    console.log(`❌ Cache MISS for ${ticker}`);
    return null;
}

function setCachedResult(ticker, data) {
    cache.set(ticker, {
        data,
        timestamp: Date.now()
    });
    console.log(`💾 Cached result for ${ticker}`);
}

// Clean up expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ticker, cached] of cache.entries()) {
        if (now - cached.timestamp >= CACHE_TTL) {
            cache.delete(ticker);
            console.log(`🗑️  Removed expired cache for ${ticker}`);
        }
    }
}, 60000); // Clean up every minute

// Main API endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const { ticker } = req.body;

        if (!ticker) {
            return res.status(400).json({ error: 'Ticker symbol is required' });
        }

        // Clean and validate ticker
        const cleanTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
        
        if (!cleanTicker || cleanTicker.length === 0) {
            return res.status(400).json({ error: 'Invalid ticker symbol' });
        }

        // Check cache first
        const cachedResult = getCachedResult(cleanTicker);
        if (cachedResult) {
            console.log(`⚡ Returning cached result for ${cleanTicker}`);
            return res.json(cachedResult);
        }

        console.log(`\n=== Fetching news for ticker: ${cleanTicker} ===`);

        // Fetch news articles
        let articles;
        try {
            articles = await fetchYahooNews(cleanTicker);
        } catch (fetchError) {
            console.error('Error in fetchYahooNews:', fetchError);
            return res.status(500).json({ 
                error: `Failed to fetch news: ${fetchError.message}` 
            });
        }

        if (articles.length === 0) {
            console.log(`No articles found for ${cleanTicker}`);
            const result = {
                ticker: cleanTicker,
                summary: `No recent news articles found for ${cleanTicker}. The ticker may be invalid or there may be no recent news. Please verify the ticker symbol is correct.`,
                articles: []
            };
            // Cache empty results too (shorter TTL could be used, but keeping it simple)
            setCachedResult(cleanTicker, result);
            return res.json(result);
        }

        console.log(`Found ${articles.length} articles, generating summary...`);

        // Use fast summary (instant) instead of AI summarization for speed
        // Set USE_AI_SUMMARY=true in environment to enable AI summarization
        const useAISummary = process.env.USE_AI_SUMMARY === 'true';
        
        let summary;
        if (useAISummary) {
            try {
                summary = await summarizeArticlesWithAI(articles);
                console.log('AI Summary generated successfully');
            } catch (summaryError) {
                console.error('Error in AI summarization:', summaryError);
                summary = generateFastSummary(articles);
            }
        } else {
            // Fast mode - instant summary
            summary = generateFastSummary(articles);
            console.log('Fast summary generated');
        }

        // Perform sentiment analysis
        let sentimentResult = null;
        let metrics = null;
        try {
            console.log('Analyzing sentiment...');
            sentimentResult = await sentimentAnalyzer.analyzeArticles(articles);
            metrics = await sentimentAnalyzer.getMetrics();
            console.log(`Sentiment: ${sentimentResult.sentiment} (confidence: ${sentimentResult.confidence})`);
        } catch (sentimentError) {
            console.error('Error in sentiment analysis:', sentimentError);
            // Continue without sentiment if it fails
        }

        const result = {
            ticker: cleanTicker,
            summary,
            articles,
            sentiment: sentimentResult,
            metrics: metrics
        };

        // Cache the result
        setCachedResult(cleanTicker, result);

        res.json(result);
    } catch (error) {
        console.error('Unexpected error in /api/analyze:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: error.message || 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Test endpoint for debugging
app.get('/api/test/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        console.log(`Test endpoint called for ticker: ${ticker}`);
        
        const articles = await fetchYahooNews(ticker);
        res.json({
            ticker,
            articleCount: articles.length,
            articles: articles.slice(0, 3), // Return first 3 for testing
            message: 'Test successful'
        });
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Trading Assistant backend server running on http://localhost:${PORT}`);
    console.log(`⚡ Fast mode enabled - AI summarization disabled for speed`);
    console.log(`📝 To enable AI summarization, set USE_AI_SUMMARY=true environment variable`);
    console.log(`📝 Add HF_API_KEY environment variable for better rate limits on Hugging Face API`);
});


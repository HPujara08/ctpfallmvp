const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { HfInference } = require('@huggingface/inference');
const cheerio = require('cheerio');

const app = express();
const PORT = 3001;

// Initialize Hugging Face inference
const hf = new HfInference(process.env.HF_API_KEY || null); // Optional API key for rate limits

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
            timeout: 10000
        });
        
        const rss$ = cheerio.load(rssResponse.data, { xmlMode: true });
        
        rss$('item').each((i, item) => {
            if (i < 10) {
                const title = rss$(item).find('title').text().trim();
                const link = rss$(item).find('link').text().trim();
                const pubDate = rss$(item).find('pubDate').text();
                const description = rss$(item).find('description').text().trim();
                
                if (title && link) {
                    let formattedDate = 'Recent';
                    if (pubDate) {
                        try {
                            formattedDate = new Date(pubDate).toLocaleDateString();
                        } catch (e) {
                            formattedDate = pubDate;
                        }
                    }
                    
                    articles.push({
                        title,
                        link,
                        date: formattedDate,
                        description: description || ''
                    });
                }
            }
        });
        
        if (articles.length > 0) {
            console.log(`Successfully fetched ${articles.length} articles from RSS feed`);
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
            timeout: 10000
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
                if (i < 10 && articles.length < 10) {
                    const title = $(elem).text().trim();
                    let link = $(elem).attr('href');
                    
                    if (title && link) {
                        const fullLink = link.startsWith('http') ? link : `https://finance.yahoo.com${link}`;
                        const dateElem = $(elem).closest('div').find('time, span[data-test-locator]');
                        const date = dateElem.first().text().trim() || 'Recent';
                        
                        // Avoid duplicates
                        if (!articles.find(a => a.title === title)) {
                            articles.push({
                                title,
                                link: fullLink,
                                date
                            });
                        }
                    }
                }
            });
            
            if (articles.length > 0) break;
        }
        
        if (articles.length > 0) {
            console.log(`Successfully scraped ${articles.length} articles from web page`);
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

// Summarize articles using Hugging Face model
async function summarizeArticles(articles) {
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
        return `Recent news highlights: ${articles.slice(0, 3).map(a => a.title).join('; ')}.`;
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
        console.error('Error details:', error.response?.data || error);
        
        // Fallback: Create a simple summary from titles
        const fallbackSummary = `Recent news highlights: ${articles.slice(0, 3).map(a => a.title).join('; ')}.`;
        
        if (error.message.includes('API key') || error.message.includes('rate limit') || error.message.includes('401')) {
            return `${fallbackSummary} Note: For full AI summarization, add your Hugging Face API key to the environment variable HF_API_KEY.`;
        }
        
        if (error.message.includes('503') || error.message.includes('timeout')) {
            return `${fallbackSummary} (AI summarization temporarily unavailable)`;
        }
        
        // If model fails, return a basic summary
        return fallbackSummary;
    }
}

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
            return res.json({
                ticker: cleanTicker,
                summary: `No recent news articles found for ${cleanTicker}. The ticker may be invalid or there may be no recent news. Please verify the ticker symbol is correct.`,
                articles: []
            });
        }

        console.log(`Found ${articles.length} articles, generating summary...`);

        // Summarize the news
        let summary;
        try {
            summary = await summarizeArticles(articles);
            console.log('Summary generated successfully');
        } catch (summaryError) {
            console.error('Error in summarizeArticles:', summaryError);
            // Still return articles even if summarization fails
            summary = `Found ${articles.length} recent news articles. Check the list below for details.`;
        }

        res.json({
            ticker: cleanTicker,
            summary,
            articles
        });
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
    console.log(`📝 Note: Add HF_API_KEY environment variable for better rate limits on Hugging Face API`);
});


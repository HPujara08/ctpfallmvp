const tickerInput = document.getElementById('tickerInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const closeBtn = document.getElementById('closeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');
const tickerTitle = document.getElementById('tickerTitle');
const sentiment = document.getElementById('sentiment');
const summary = document.getElementById('summary');
const articles = document.getElementById('articles');
const watchModeToggle = document.getElementById('watchModeToggle');
const watchModeStatus = document.getElementById('watchModeStatus');

// Initialize watch mode status
window.electronAPI.getWatchMode().then(enabled => {
    watchModeToggle.checked = enabled;
    updateWatchModeStatus(enabled);
});

// Watch mode toggle
watchModeToggle.addEventListener('change', async () => {
    const enabled = await window.electronAPI.toggleWatchMode();
    updateWatchModeStatus(enabled);
});

// Listen for watch mode changes from main process
window.electronAPI.onWatchModeChanged((enabled) => {
    watchModeToggle.checked = enabled;
    updateWatchModeStatus(enabled);
});

function updateWatchModeStatus(enabled) {
    if (enabled) {
        watchModeStatus.textContent = 'Active - Copy tickers to analyze!';
        watchModeStatus.classList.add('active');
    } else {
        watchModeStatus.textContent = 'Off';
        watchModeStatus.classList.remove('active');
    }
}

// Listen for ticker captured from clipboard shortcut
window.electronAPI.onTickerCaptured((ticker) => {
    tickerInput.value = ticker;
    analyzeTicker(ticker);
});

// Handle analyze button click
analyzeBtn.addEventListener('click', () => {
    const ticker = tickerInput.value.trim().toUpperCase();
    if (ticker) {
        analyzeTicker(ticker);
    }
});

// Handle Enter key in input
tickerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (ticker) {
            analyzeTicker(ticker);
        }
    }
});

// Close button - hide the overlay window
closeBtn.addEventListener('click', () => {
    window.electronAPI.hideOverlay();
});

// Function to detect and make ticker symbols clickable
function makeTickersClickable(container) {
    console.log('Making tickers clickable in container:', container);
    const tickerPattern = /\b[A-Z]{1,5}(?:\.[A-Z])?\b/g;
    
    // Get all text content and process it
    const processElement = (element) => {
        // Skip if already processed or is a link/button
        if (element.classList && element.classList.contains('clickable-ticker')) {
            return;
        }
        if (element.tagName === 'A' || element.tagName === 'BUTTON') {
            return;
        }
        
        // Process child nodes
        Array.from(element.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                const text = child.textContent;
                const matches = [...text.matchAll(tickerPattern)];
                
                if (matches.length > 0) {
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;
                    
                    matches.forEach(match => {
                        // Add text before match
                        if (match.index > lastIndex) {
                            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                        }
                        
                        // Create clickable ticker
                        const tickerSpan = document.createElement('span');
                        tickerSpan.className = 'clickable-ticker';
                        tickerSpan.textContent = match[0];
                        tickerSpan.title = `Click to analyze ${match[0]}`;
                        tickerSpan.style.cursor = 'pointer';
                        tickerSpan.style.color = '#4A90E2';
                        tickerSpan.style.textDecoration = 'underline';
                        tickerSpan.style.fontWeight = 'bold';
                        tickerSpan.style.userSelect = 'none';
                        tickerSpan.style.margin = '0 2px';
                        tickerSpan.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(`🖱️ Clicked on ticker: ${match[0]}`);
                            analyzeTicker(match[0]);
                        });
                        tickerSpan.addEventListener('mouseenter', () => {
                            tickerSpan.style.color = '#2E5C8A';
                            tickerSpan.style.backgroundColor = '#E8F4FD';
                        });
                        tickerSpan.addEventListener('mouseleave', () => {
                            tickerSpan.style.color = '#4A90E2';
                            tickerSpan.style.backgroundColor = 'transparent';
                        });
                        
                        fragment.appendChild(tickerSpan);
                        lastIndex = match.index + match[0].length;
                    });
                    
                    // Add remaining text
                    if (lastIndex < text.length) {
                        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                    }
                    
                    // Replace the text node
                    if (child.parentNode) {
                        child.parentNode.replaceChild(fragment, child);
                    }
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                processElement(child);
            }
        });
    };
    
    processElement(container);
    console.log('Finished making tickers clickable');
}

async function analyzeTicker(ticker) {
    // Hide previous results and errors
    results.classList.add('hidden');
    error.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        const data = await window.electronAPI.analyzeTicker(ticker);
        
        loading.classList.add('hidden');

        if (data.error) {
            error.textContent = `Error: ${data.error}`;
            error.classList.remove('hidden');
            return;
        }

        // Display results
        tickerTitle.textContent = `${ticker} News Summary`;
        
        // Display sentiment analysis
        if (data.sentiment && data.metrics) {
            const sentimentValue = data.sentiment.sentiment.toLowerCase();
            let sentimentClass = 'neutral';
            let sentimentEmoji = '➡️';
            let sentimentColor = '#f59e0b';
            
            if (sentimentValue === 'positive') {
                sentimentClass = 'positive';
                sentimentEmoji = '📈';
                sentimentColor = '#10b981';
            } else if (sentimentValue === 'negative') {
                sentimentClass = 'negative';
                sentimentEmoji = '📉';
                sentimentColor = '#ef4444';
            } else {
                sentimentClass = 'neutral';
                sentimentEmoji = '➡️';
                sentimentColor = '#f59e0b';
            }
            
            sentiment.innerHTML = `
                <div class="sentiment-box ${sentimentClass}">
                    <div class="sentiment-header">
                        <h4>${sentimentEmoji} Sentiment: <span style="color: ${sentimentColor}">${data.sentiment.sentiment.toUpperCase()}</span></h4>
                        <p class="sentiment-confidence">Confidence: ${(data.sentiment.confidence * 100).toFixed(1)}%</p>
                    </div>
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <span class="metric-label">Accuracy:</span>
                            <span class="metric-value">${(data.metrics.accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Precision:</span>
                            <span class="metric-value">${(data.metrics.precision * 100).toFixed(1)}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Recall:</span>
                            <span class="metric-value">${(data.metrics.recall * 100).toFixed(1)}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">F1 Score:</span>
                            <span class="metric-value">${(data.metrics.f1_score * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            sentiment.innerHTML = '';
        }
        
        // Display summary
        summary.innerHTML = `
            <div class="summary-box">
                <h4>📊 Summary</h4>
                <p>${data.summary || 'No summary available'}</p>
            </div>
        `;
        
        // Make tickers in summary clickable too (wait a bit for DOM to update)
        setTimeout(() => {
            console.log('Making summary tickers clickable...');
            makeTickersClickable(summary);
        }, 100);

        // Display articles
        if (data.articles && data.articles.length > 0) {
            articles.innerHTML = `
                <div class="articles-list">
                    ${data.articles.map(article => `
                        <div class="article-item">
                            <h5>${article.title}</h5>
                            <a href="${article.link}" target="_blank">Read more →</a>
                            ${article.date ? `<div class="article-date">${article.date}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Make ticker symbols in article titles clickable (wait a bit for DOM to update)
            setTimeout(() => {
                console.log('Making article tickers clickable...');
                makeTickersClickable(articles);
            }, 100);
        } else {
            articles.innerHTML = '<p>No articles found.</p>';
        }

        results.classList.remove('hidden');
    } catch (err) {
        loading.classList.add('hidden');
        error.textContent = `Error: ${err.message}`;
        error.classList.remove('hidden');
    }
}


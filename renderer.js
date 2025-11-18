const tickerInput = document.getElementById('tickerInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const closeBtn = document.getElementById('closeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');
const tickerTitle = document.getElementById('tickerTitle');
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
        watchModeStatus.textContent = 'Active - Monitoring clipboard';
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
        
        // Display summary
        summary.innerHTML = `
            <div class="summary-box">
                <h4>📊 Summary</h4>
                <p>${data.summary || 'No summary available'}</p>
            </div>
        `;

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


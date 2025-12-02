const popupTicker = document.getElementById('popupTicker');
const closePopupBtn = document.getElementById('closePopupBtn');
const popupLoading = document.getElementById('popupLoading');
const popupSentiment = document.getElementById('popupSentiment');
const popupSummary = document.getElementById('popupSummary');
const popupArticles = document.getElementById('popupArticles');

// Listen for data from main process
window.popupAPI.onPopupData((data) => {
    const { ticker, summary, articles, sentiment, metrics } = data;
    
    popupTicker.textContent = `${ticker} News`;
    popupLoading.classList.add('hidden');
    
    // Display sentiment
    if (sentiment && metrics) {
        const sentimentValue = sentiment.sentiment.toLowerCase();
        let sentimentClass = 'neutral';
        let sentimentEmoji = '➡️';
        
        if (sentimentValue === 'positive') {
            sentimentClass = 'positive';
            sentimentEmoji = '📈';
        } else if (sentimentValue === 'negative') {
            sentimentClass = 'negative';
            sentimentEmoji = '📉';
        } else {
            sentimentClass = 'neutral';
            sentimentEmoji = '➡️';
        }
        
        popupSentiment.innerHTML = `
            <div class="sentiment-box-small ${sentimentClass}">
                <h4>${sentimentEmoji} ${sentiment.sentiment.toUpperCase()} (${(sentiment.confidence * 100).toFixed(1)}%)</h4>
                <div class="metrics-inline">
                    <span>A: ${(metrics.accuracy * 100).toFixed(0)}%</span>
                    <span>P: ${(metrics.precision * 100).toFixed(0)}%</span>
                    <span>R: ${(metrics.recall * 100).toFixed(0)}%</span>
                    <span>F1: ${(metrics.f1_score * 100).toFixed(0)}%</span>
                </div>
            </div>
        `;
        popupSentiment.classList.remove('hidden');
    }
    
    // Display summary
    if (summary) {
        popupSummary.innerHTML = `
            <h4>📊 Summary</h4>
            <p>${summary}</p>
        `;
        popupSummary.classList.remove('hidden');
    }
    
    // Display articles
    if (articles && articles.length > 0) {
        popupArticles.innerHTML = articles.slice(0, 5).map(article => `
            <div class="article-item-small">
                <h5>${article.title}</h5>
                <a href="${article.link}" target="_blank">Read more →</a>
            </div>
        `).join('');
        popupArticles.classList.remove('hidden');
    }
});

// Close button
closePopupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.popupAPI.closePopup();
});


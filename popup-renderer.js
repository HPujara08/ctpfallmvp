const popupTicker = document.getElementById('popupTicker');
const closePopupBtn = document.getElementById('closePopupBtn');
const popupLoading = document.getElementById('popupLoading');
const popupSummary = document.getElementById('popupSummary');
const popupArticles = document.getElementById('popupArticles');

// Listen for data from main process
window.popupAPI.onPopupData((data) => {
    const { ticker, summary, articles } = data;
    
    popupTicker.textContent = `${ticker} News`;
    popupLoading.classList.add('hidden');
    
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


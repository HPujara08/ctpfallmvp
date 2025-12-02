const axios = require('axios');

/**
 * Ticker Analyzer Module
 * Handles ticker analysis and API communication
 */

class TickerAnalyzer {
  constructor(apiUrl = 'http://localhost:3001/api/analyze') {
    this.apiUrl = apiUrl;
    this.isAnalyzing = false;
    this.pendingTickers = [];
    this.onAnalysisComplete = null;
    this.onError = null;
  }

  /**
   * Set callback for when analysis completes
   * @param {Function} callback - Called with (ticker, data)
   */
  setAnalysisCallback(callback) {
    this.onAnalysisComplete = callback;
  }

  /**
   * Set callback for errors
   * @param {Function} callback - Called with (error)
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Analyze a ticker symbol
   * @param {string} ticker - Ticker symbol to analyze
   * @returns {Promise<Object>}
   */
  async analyze(ticker) {
    // Prevent concurrent analysis
    if (this.isAnalyzing) {
      console.log(`Analysis in progress, queuing ticker: ${ticker}`);
      this.pendingTickers.push(ticker);
      return;
    }

    this.isAnalyzing = true;
    const tickerUpper = ticker.trim().toUpperCase();

    try {
      console.log(`Starting analysis for ticker: ${tickerUpper}`);

      const response = await axios.post(this.apiUrl, {
        ticker: tickerUpper
      }, {
        timeout: 30000 // 30 second timeout
      });

      const data = response.data;

      if (data.error) {
        console.error('Error analyzing ticker:', data.error);
        if (this.onError) {
          this.onError(new Error(data.error));
        }
        return null;
      }

      // Call completion callback
      if (this.onAnalysisComplete) {
        this.onAnalysisComplete(tickerUpper, data);
      }

      return data;
    } catch (error) {
      console.error('Error in analyzeTicker:', error.message);

      if (error.code === 'ECONNREFUSED') {
        const errMsg = 'Backend server is not running. Please restart the app.';
        console.error(errMsg);
        if (this.onError) {
          this.onError(new Error(errMsg));
        }
      } else if (error.code === 'ETIMEDOUT') {
        const errMsg = 'Request timed out. The backend may be slow or unresponsive.';
        console.error(errMsg);
        if (this.onError) {
          this.onError(new Error(errMsg));
        }
      } else {
        if (this.onError) {
          this.onError(error);
        }
      }

      return null;
    } finally {
      this.isAnalyzing = false;

      // Process pending tickers
      if (this.pendingTickers.length > 0) {
        const nextTicker = this.pendingTickers.shift();
        console.log(`Processing pending ticker: ${nextTicker}`);
        // Small delay before processing next ticker
        setTimeout(() => {
          this.analyze(nextTicker);
        }, 500);
      }
    }
  }

  /**
   * Validate ticker symbol format
   * @param {string} text - Text to validate
   * @returns {boolean}
   */
  isValidTicker(text) {
    if (!text) return false;

    const cleaned = text.trim().toUpperCase();

    // Ticker pattern: 1-5 uppercase letters/numbers, optionally with dots
    const tickerPattern = /^[A-Z0-9]{1,5}(\.[A-Z])?$/;
    const simplePattern = /^[A-Z]{1,5}$/;

    return tickerPattern.test(cleaned) || simplePattern.test(cleaned);
  }
}

module.exports = TickerAnalyzer;



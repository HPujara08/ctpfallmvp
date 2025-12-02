const { exec } = require('child_process');
const { clipboard } = require('electron');
const TextExtractor = require('./text-extractor');

/**
 * Click Detector Module
 * Handles global mouse click detection and text extraction at cursor position
 */

class ClickDetector {
  constructor() {
    this.isMonitoring = false;
    this.clickHandler = null;
    this.lastClickTime = 0;
    this.debounceDelay = 1000; // ms - increased to prevent loops
    this.onTickerDetected = null;
    this.textExtractor = new TextExtractor();
    this.lastProcessedTicker = '';
    this.isExtracting = false; // Prevent concurrent extractions
  }

  /**
   * Start monitoring for mouse clicks
   * @param {Function} callback - Called when a ticker is detected at click position
   */
  start(onTickerDetected) {
    if (this.isMonitoring) {
      console.log('Click detector already monitoring');
      return;
    }

    this.onTickerDetected = onTickerDetected;
    this.isMonitoring = true;
    
    console.log('🖱️ Starting click detection...');
    
    // Use a polling approach to detect clicks
    // On macOS, we'll use AppleScript to detect mouse clicks
    this._startMacOSClickDetection();
  }

  /**
   * Stop monitoring for mouse clicks
   */
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.clickHandler) {
      clearInterval(this.clickHandler);
      this.clickHandler = null;
    }
    
    console.log('🖱️ Stopped click detection');
  }

  /**
   * macOS-specific click detection using system APIs
   */
  _startMacOSClickDetection() {
    // Monitor clipboard changes and also try to get selected text
    let lastClipboard = clipboard.readText();
    let lastCheckTime = Date.now();
    
    this.clickHandler = setInterval(async () => {
      if (!this.isMonitoring || this.isExtracting) return;
      
      const now = Date.now();
      
      // Check clipboard changes (when user copies text)
      const currentClipboard = clipboard.readText();
      if (currentClipboard && currentClipboard !== lastClipboard) {
        lastClipboard = currentClipboard;
        
        // Process clipboard content
        setTimeout(() => {
          if (!this.isExtracting) {
            this._processText(currentClipboard.trim());
          }
        }, 100);
      }
      
      // Also periodically try to get selected text (every 500ms)
      // This catches cases where text is selected but not copied
      if (now - lastCheckTime > 500) {
        lastCheckTime = now;
        this._tryGetSelectedText();
      }
    }, 200); // Check every 200ms
  }
  
  /**
   * Try to get selected text without causing loops
   */
  _tryGetSelectedText() {
    if (this.isExtracting) return;
    
    this.isExtracting = true;
    
    // Use text extractor to get selected text
    this.textExtractor.getSelectedText().then((text) => {
      if (text && text.trim()) {
        // Only process if it's different from what we last processed
        const trimmed = text.trim();
        if (trimmed !== this.lastProcessedTicker) {
          this._processText(trimmed);
        }
      }
      this.isExtracting = false;
    }).catch(() => {
      this.isExtracting = false;
    });
  }

  /**
   * Get currently selected text using AppleScript
   * NOTE: This method is not used in the interval to prevent infinite loops
   * It's kept for manual invocation if needed
   */
  _getSelectedText() {
    if (process.platform !== 'darwin') return;
    
    // This method is disabled to prevent infinite loops
    // Simulating Cmd+C changes the clipboard, which triggers detection again
    // Use clipboard monitoring instead
    return;
  }

  /**
   * Process text to check if it contains a ticker
   * @param {string} text - Text to process
   */
  _processText(text) {
    if (!text || !this.onTickerDetected) return;
    
    const now = Date.now();
    // Debounce to prevent rapid processing
    if (now - this.lastClickTime < this.debounceDelay) {
      return;
    }
    
    // Extract potential ticker symbols from text
    const tickers = this.textExtractor.extractTickers(text);
    
    if (tickers && tickers.length > 0) {
      // Use the first valid ticker found
      const ticker = tickers[0];
      
      // Only process if it's different from the last one
      if (ticker !== this.lastProcessedTicker) {
        this.lastClickTime = now;
        this.lastProcessedTicker = ticker;
        console.log(`🖱️ Detected ticker: ${ticker}`);
        this.onTickerDetected(ticker);
      }
    }
  }

  /**
   * Check if text is a valid ticker symbol
   * @param {string} text - Text to validate
   * @returns {boolean}
   */
  _isValidTicker(text) {
    if (!text) return false;
    
    const cleaned = text.trim().toUpperCase();
    
    // Ticker pattern: 1-5 uppercase letters/numbers, optionally with dots
    const tickerPattern = /^[A-Z0-9]{1,5}(\.[A-Z])?$/;
    const simplePattern = /^[A-Z]{1,5}$/;
    
    return tickerPattern.test(cleaned) || simplePattern.test(cleaned);
  }

  /**
   * Get text at specific screen coordinates (for future use)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Promise<string>}
   */
  async getTextAtPosition(x, y) {
    // This would require OCR or accessibility APIs
    // For now, we'll use the clipboard approach
    return new Promise((resolve) => {
      // Simulate copy at position
      exec(`osascript -e "tell application \\"System Events\\" to keystroke \\"c\\" using command down"`, (error) => {
        if (error) {
          resolve('');
          return;
        }
        
        setTimeout(() => {
          const text = clipboard.readText();
          resolve(text || '');
        }, 150);
      });
    });
  }
}

module.exports = ClickDetector;


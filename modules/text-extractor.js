const { exec } = require('child_process');
const { clipboard } = require('electron');

/**
 * Text Extractor Module
 * Handles extracting text at cursor position or from selections
 */

class TextExtractor {
  constructor() {
    this.platform = process.platform;
  }

  /**
   * Get text at current cursor position
   * @returns {Promise<string>}
   */
  async getTextAtCursor() {
    if (this.platform === 'darwin') {
      return this._getTextAtCursorMacOS();
    } else if (this.platform === 'win32') {
      return this._getTextAtCursorWindows();
    } else {
      return this._getTextAtCursorLinux();
    }
  }

  /**
   * Get currently selected text
   * @returns {Promise<string>}
   */
  async getSelectedText() {
    if (this.platform === 'darwin') {
      return this._getSelectedTextMacOS();
    } else if (this.platform === 'win32') {
      return this._getSelectedTextWindows();
    } else {
      return this._getSelectedTextLinux();
    }
  }

  /**
   * macOS: Get text at cursor using AppleScript
   */
  _getTextAtCursorMacOS() {
    return new Promise((resolve) => {
      // Try to copy text at cursor
      const previousClipboard = clipboard.readText();
      
      exec('osascript -e "tell application \\"System Events\\" to keystroke \\"c\\" using command down"', (error) => {
        if (error) {
          resolve('');
          return;
        }
        
        setTimeout(() => {
          const text = clipboard.readText().trim();
          // Only return if clipboard changed
          if (text && text !== previousClipboard) {
            resolve(text);
          } else {
            resolve('');
          }
        }, 150);
      });
    });
  }

  /**
   * macOS: Get selected text using AppleScript
   */
  _getSelectedTextMacOS() {
    return new Promise((resolve) => {
      exec('osascript -e "try\n  tell application \\"System Events\\"\n    set frontApp to first application process whose frontmost is true\n    set selectedText to value of attribute \\"AXSelectedText\\" of frontApp\n    return selectedText\n  end tell\nend try"', (error, stdout) => {
        if (error || !stdout) {
          // Fallback to clipboard method
          this._getTextAtCursorMacOS().then(resolve);
          return;
        }
        
        let text = stdout.trim();
        text = text.replace(/^"|"$/g, ''); // Remove quotes
        resolve(text || '');
      });
    });
  }

  /**
   * Windows: Get text at cursor
   */
  _getTextAtCursorWindows() {
    return new Promise((resolve) => {
      const previousClipboard = clipboard.readText();
      
      exec('powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\\"^c\\")"', (error) => {
        if (error) {
          resolve('');
          return;
        }
        
        setTimeout(() => {
          const text = clipboard.readText().trim();
          if (text && text !== previousClipboard) {
            resolve(text);
          } else {
            resolve('');
          }
        }, 150);
      });
    });
  }

  /**
   * Windows: Get selected text
   */
  _getSelectedTextWindows() {
    // Windows doesn't have a direct way, use clipboard
    return this._getTextAtCursorWindows();
  }

  /**
   * Linux: Get text at cursor using xclip
   */
  _getTextAtCursorLinux() {
    return new Promise((resolve) => {
      exec('xclip -selection clipboard -o 2>/dev/null', (error, stdout) => {
        if (error || !stdout) {
          resolve('');
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Linux: Get selected text using primary selection
   */
  _getSelectedTextLinux() {
    return new Promise((resolve) => {
      exec('xclip -selection primary -o 2>/dev/null || xsel -p 2>/dev/null', (error, stdout) => {
        if (error || !stdout) {
          resolve('');
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Extract ticker symbols from text
   * @param {string} text - Text to extract tickers from
   * @returns {string[]} - Array of potential ticker symbols
   */
  extractTickers(text) {
    if (!text) return [];
    
    const tickerPattern = /\b[A-Z]{1,5}(?:\.[A-Z])?\b/g;
    const matches = text.match(tickerPattern);
    
    if (!matches) return [];
    
    // Filter to only valid tickers
    return matches.filter(ticker => this._isValidTicker(ticker));
  }

  /**
   * Check if text is a valid ticker
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
}

module.exports = TextExtractor;



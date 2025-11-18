# Quick Start Guide

## First Time Setup

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/
   - Verify: `node --version` and `npm --version`

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Optional: Add Hugging Face API Key** (recommended for better performance)
   ```bash
   export HF_API_KEY="your-huggingface-api-key"
   ```
   Get your free API key at: https://huggingface.co/settings/tokens

## Running the Application

1. **Start the app:**
   ```bash
   npm start
   ```

2. **The overlay window will appear** - you can drag it anywhere on your screen

3. **Try it out:**
   - Type a ticker like "AAPL" or "TSLA" and click "Analyze"
   - Or copy a ticker to clipboard and press `⌘+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux)

## Keyboard Shortcuts

- **⌘/Ctrl + Shift + T**: Toggle overlay visibility
- **⌘/Ctrl + Shift + C**: Capture ticker from clipboard and analyze

## Troubleshooting

**Backend server not starting?**
- Make sure port 3001 is not in use
- Check console for error messages

**No news found?**
- Verify the ticker symbol is correct (e.g., AAPL, not Apple)
- Yahoo Finance structure may have changed - the RSS feed fallback should help

**Summarization not working?**
- Without an API key, you'll get basic summaries
- Add `HF_API_KEY` environment variable for full AI summarization
- The app will still work with a fallback summary

## Example Workflow

1. Open TradingView in your browser
2. Find a stock you're interested in (e.g., TSLA)
3. Copy the ticker symbol
4. Press `⌘+Shift+C` in the overlay
5. Get instant AI-summarized news!


# Trading Assistant - News Summary Overlay

A desktop application that provides real-time news summaries for stock tickers. The app features an Electron overlay that floats above your trading applications, allowing you to quickly get AI-summarized news for any stock.

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Optional: Add Hugging Face API Key** (for better rate limits):
   ```bash
   export HF_API_KEY="your-api-key-here"
   ```
   Or create a `.env` file:
   ```
   HF_API_KEY=your-api-key-here
   ```

## Usage

1. **Start the application:**
   ```bash
   npm start
   ```

2. **The overlay will appear on your screen.** You can:
   - Type a ticker symbol (e.g., AAPL, TSLA, MSFT) and click "Analyze"
   - Use `⌘+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux) to capture ticker from clipboard
   - Use `⌘+Shift+T` (Mac) or `Ctrl+Shift+T` (Windows/Linux) to toggle overlay visibility

3. **Workflow:**
   - Go to TradingView or any trading website
   - Copy a stock ticker (or type it manually)
   - Use the shortcut or paste it in the overlay
   - Get instant AI-summarized news!

## How It Works

1. **Electron Main Process** (`main.js`): Creates the overlay window and handles global shortcuts
2. **Backend Server** (`server.js`): Express server that:
   - Fetches news from Yahoo Finance
   - Summarizes articles using Hugging Face models
   - Returns structured data to the frontend
3. **Frontend** (`index.html`, `renderer.js`, `styles.css`): Reacts to user input and displays results

## Keyboard Shortcuts

- `⌘/Ctrl + Shift + T`: Toggle overlay visibility
- `⌘/Ctrl + Shift + C`: Capture ticker from clipboard and analyze

## Project Structure

```
ctpp1-demo/
├── main.js           # Electron main process
├── preload.js        # Preload script for secure IPC
├── index.html        # Overlay UI
├── renderer.js       # Frontend logic
├── styles.css        # Styling
├── server.js         # Backend Express server
├── package.json      # Dependencies
└── README.md         # This file
```

## Technical Details

- **Electron**: For cross-platform desktop overlay
- **Express**: Backend API server
- **Hugging Face Inference**: For AI-powered news summarization
- **Cheerio**: Web scraping for Yahoo Finance news
- **Axios**: HTTP client for API requests

## Troubleshooting

- **No news found**: The ticker might be invalid or Yahoo Finance structure may have changed
- **Summarization errors**: Add your Hugging Face API key to avoid rate limits
- **Backend not starting**: Make sure port 3001 is available

## Future Enhancements

- Browser extension for automatic ticker detection
- Support for multiple news sources
- Caching for frequently accessed tickers
- Customizable overlay position and size
- Multiple model options for summarization

## License

MIT


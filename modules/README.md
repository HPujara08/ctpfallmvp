# Modules

This directory contains modular components for the Trading Assistant application.

## click-detector.js

Handles global mouse click detection and text extraction at cursor position.

**Features:**
- Monitors for mouse clicks and text selections
- Extracts ticker symbols from clicked/selected text
- Cross-platform support (macOS, Windows, Linux)
- Debouncing to prevent duplicate detections

**Usage:**
```javascript
const ClickDetector = require('./modules/click-detector');
const detector = new ClickDetector();

detector.start((ticker) => {
  console.log('Ticker detected:', ticker);
});

// Later...
detector.stop();
```

## text-extractor.js

Handles extracting text at cursor position or from selections across different platforms.

**Features:**
- Platform-specific text extraction (macOS, Windows, Linux)
- Gets text at cursor position
- Gets currently selected text
- Extracts ticker symbols from text

**Usage:**
```javascript
const TextExtractor = require('./modules/text-extractor');
const extractor = new TextExtractor();

const text = await extractor.getSelectedText();
const tickers = extractor.extractTickers(text);
```

## ticker-analyzer.js

Handles ticker analysis and API communication with the backend server.

**Features:**
- Analyzes ticker symbols via API
- Queues multiple ticker requests
- Error handling and callbacks
- Ticker validation

**Usage:**
```javascript
const TickerAnalyzer = require('./modules/ticker-analyzer');
const analyzer = new TickerAnalyzer();

analyzer.setAnalysisCallback((ticker, data) => {
  console.log('Analysis complete:', ticker, data);
});

analyzer.setErrorCallback((error) => {
  console.error('Error:', error);
});

analyzer.analyze('AAPL');
```



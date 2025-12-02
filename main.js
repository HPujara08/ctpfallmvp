const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, Notification, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

// Import modular components
const TickerAnalyzer = require('./modules/ticker-analyzer');

let overlayWindow = null;
let popupWindow = null;
let backendServer = null;
let watchModeEnabled = false;
let clipboardMonitor = null;
let lastClipboardText = '';

// Initialize ticker analyzer
const tickerAnalyzer = new TickerAnalyzer();

// Set up ticker analyzer callbacks
tickerAnalyzer.setAnalysisCallback((ticker, data) => {
  createPopupWindow(ticker, data);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('ticker-captured', ticker);
  }
});

tickerAnalyzer.setErrorCallback((error) => {
  console.error('Ticker analysis error:', error.message);
});

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 500,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  overlayWindow.loadFile('index.html');
  
  // Ensure window stays on top of all windows including browser
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Make window visible on all spaces/desktops (macOS)
  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createPopupWindow(ticker, data) {
  try {
    // Close existing popup if any
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close();
      popupWindow = null;
    }

    const screen = require('electron').screen;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    popupWindow = new BrowserWindow({
      width: 450,
      height: 500,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      x: width - 470,
      y: 20,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'popup-preload.js')
      }
    });

    popupWindow.loadFile('popup.html');
    
    // Ensure window stays on top of all windows including browser
    popupWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    
    // Make window visible on all spaces/desktops (macOS)
    if (process.platform === 'darwin') {
      popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    
    // Send data to popup when ready
    popupWindow.webContents.once('did-finish-load', () => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.webContents.send('popup-data', { ticker, ...data });
      }
    });

    popupWindow.on('closed', () => {
      popupWindow = null;
    });

    // Handle errors during window creation
    popupWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Popup window failed to load:', errorCode, errorDescription);
    });

    // Auto-close after 30 seconds
    setTimeout(() => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
      }
    }, 30000);
  } catch (error) {
    console.error('Error creating popup window:', error);
    popupWindow = null;
  }
}

// Handle close popup IPC
ipcMain.on('close-popup', () => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
});

// Handle hide overlay
ipcMain.on('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide();
  }
});

// Handle window dragging
ipcMain.on('start-drag', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    const [x, y] = window.getPosition();
    const startPos = { x, y };
    let isDragging = false;
    
    // This will be handled by CSS -webkit-app-region: drag
    // But we can also add programmatic dragging if needed
  }
});

// Helper function for backward compatibility
function isTickerSymbol(text) {
  return tickerAnalyzer.isValidTicker(text);
}


function startClipboardMonitoring() {
  if (clipboardMonitor) {
    console.log('⚠️ Clipboard monitoring already active');
    return; // Already monitoring
  }
  
  // Initialize with trimmed clipboard content
  const initialClipboard = clipboard.readText() || '';
  lastClipboardText = initialClipboard.trim();
  let lastProcessTime = 0;
  
  console.log('📋 Starting clipboard monitoring...');
  console.log(`📋 Initial clipboard: "${lastClipboardText}"`);
  
  clipboardMonitor = setInterval(() => {
    try {
      const currentText = clipboard.readText() || '';
      const trimmedText = currentText.trim();
      const lastTrimmed = lastClipboardText.trim();
      
      // Only process if clipboard changed
      if (trimmedText && trimmedText !== lastTrimmed) {
        console.log(`📋 Clipboard changed from "${lastTrimmed}" to "${trimmedText}"`);
        
        // Update lastClipboardText immediately to prevent re-processing
        lastClipboardText = trimmedText;
        
        // Check if it's a valid ticker
        const isValid = tickerAnalyzer.isValidTicker(trimmedText);
        console.log(`📋 Is valid ticker: ${isValid}`);
        
        if (isValid) {
          const now = Date.now();
          // Debounce: only process once every 2 seconds
          if (now - lastProcessTime > 2000) {
            lastProcessTime = now;
            console.log(`✅ Detected ticker in clipboard: ${trimmedText}`);
            tickerAnalyzer.analyze(trimmedText);
          } else {
            const secondsAgo = Math.floor((now - lastProcessTime) / 1000);
            console.log(`⏸️ Debouncing - last processed ${secondsAgo}s ago (need 2s)`);
          }
        } else {
          console.log(`⚠️ "${trimmedText}" is not a valid ticker symbol`);
        }
      }
    } catch (error) {
      // Ignore clipboard read errors
      console.error('❌ Clipboard monitoring error:', error.message);
    }
  }, 500); // Check every 500ms
}

function stopClipboardMonitoring() {
  if (clipboardMonitor) {
    clearInterval(clipboardMonitor);
    clipboardMonitor = null;
  }
}

// Function to capture ticker from clipboard (for shortcut)
function captureTickerFromClipboard() {
  const clipboardText = clipboard.readText().trim();
  
  if (clipboardText && tickerAnalyzer.isValidTicker(clipboardText)) {
    console.log(`✅ Analyzing ticker from clipboard: ${clipboardText}`);
    tickerAnalyzer.analyze(clipboardText);
  } else if (clipboardText) {
    console.log(`⚠️ Clipboard contains "${clipboardText}" which is not a valid ticker`);
  } else {
    console.log('⚠️ Clipboard is empty');
  }
}

function startBackendServer() {
  // Start the Express backend server
  backendServer = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  backendServer.on('error', (err) => {
    console.error('Failed to start backend server:', err);
  });
}

app.whenReady().then(() => {
  // Start backend server
  startBackendServer();

  // Create overlay window
  createOverlayWindow();

  // Register global shortcut to toggle overlay (Cmd+Shift+T)
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        overlayWindow.show();
      }
    }
  });

  // Register shortcut to capture ticker from clipboard (Cmd+Shift+C)
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    const clipboardText = clipboard.readText().trim();
    if (clipboardText && overlayWindow) {
      overlayWindow.webContents.send('ticker-captured', clipboardText);
    }
  });
  
  // Register shortcut to toggle watch mode (Cmd+Shift+W)
  globalShortcut.register('CommandOrControl+Shift+W', () => {
    watchModeEnabled = !watchModeEnabled;
    if (watchModeEnabled) {
      startClipboardMonitoring();
      if (overlayWindow) {
        overlayWindow.webContents.send('watch-mode-changed', true);
      }
      console.log('✅ Watch mode enabled!');
      console.log('💡 Just copy any ticker symbol (Cmd+C) and it will be analyzed automatically');
    } else {
      stopClipboardMonitoring();
      if (overlayWindow) {
        overlayWindow.webContents.send('watch-mode-changed', false);
      }
      console.log('⏸️ Watch mode disabled');
    }
  });
  

  // Register shortcut to analyze ticker from clipboard (Cmd+Shift+X)
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+X', () => {
    console.log('⌨️ Shortcut Cmd+Shift+X pressed!');
    captureTickerFromClipboard();
  });
  
  if (shortcutRegistered) {
    console.log('✅ Shortcut Cmd+Shift+X registered successfully');
    console.log('💡 Copy a ticker (Cmd+C), then press Cmd+Shift+X to analyze it');
  } else {
    console.error('❌ Failed to register shortcut Cmd+Shift+X - it may already be in use');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOverlayWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopClipboardMonitoring();
  if (backendServer) {
    backendServer.kill();
  }
});

// IPC handlers
ipcMain.handle('get-clipboard', () => {
  return clipboard.readText();
});

ipcMain.handle('analyze-ticker', async (event, ticker) => {
  try {
    const response = await axios.post('http://localhost:3001/api/analyze', {
      ticker
    });
    return response.data;
  } catch (error) {
    console.error('Error analyzing ticker:', error);
    return { error: error.message || 'Failed to connect to backend server' };
  }
});

// Handler to capture selected text and analyze if it's a ticker
ipcMain.handle('capture-selected-text', () => {
  return new Promise((resolve) => {
    captureSelectedTextAndAnalyze();
    // Return immediately - the analysis happens asynchronously
    resolve({ success: true, message: 'Capturing selected text...' });
  });
});

ipcMain.handle('toggle-watch-mode', () => {
  watchModeEnabled = !watchModeEnabled;
  if (watchModeEnabled) {
    startClipboardMonitoring();
    console.log('✅ Watch mode enabled!');
    console.log('💡 Copy any ticker (Cmd+C) and it will be analyzed automatically');
  } else {
    stopClipboardMonitoring();
    console.log('⏸️ Watch mode disabled');
  }
  return watchModeEnabled;
});

ipcMain.handle('get-watch-mode', () => {
  return watchModeEnabled;
});


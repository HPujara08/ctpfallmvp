const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

let overlayWindow = null;
let popupWindow = null;
let backendServer = null;
let watchModeEnabled = false;
let clipboardMonitor = null;
let lastClipboardText = '';

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
  // Close existing popup if any
  if (popupWindow) {
    popupWindow.close();
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
    popupWindow.webContents.send('popup-data', { ticker, ...data });
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
  });

  // Auto-close after 30 seconds
  setTimeout(() => {
    if (popupWindow) {
      popupWindow.close();
    }
  }, 30000);
}

// Handle close popup IPC
ipcMain.on('close-popup', () => {
  if (popupWindow) {
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

// Ticker detection pattern: 1-5 uppercase letters/numbers, optionally with dots
function isTickerSymbol(text) {
  if (!text) return false;
  
  // Remove whitespace
  const cleaned = text.trim().toUpperCase();
  
  // Check if it's 1-5 characters, alphanumeric, possibly with dots
  // Common patterns: AAPL, TSLA, BRK.B, etc.
  const tickerPattern = /^[A-Z0-9]{1,5}(\.[A-Z])?$/;
  
  // Also check if it's just uppercase letters (common ticker format)
  const simplePattern = /^[A-Z]{1,5}$/;
  
  return tickerPattern.test(cleaned) || simplePattern.test(cleaned);
}

function startClipboardMonitoring() {
  if (clipboardMonitor) return; // Already monitoring
  
  lastClipboardText = clipboard.readText();
  
  clipboardMonitor = setInterval(() => {
    try {
      const currentText = clipboard.readText().trim();
      
      // Only process if clipboard changed and looks like a ticker
      if (currentText && currentText !== lastClipboardText && isTickerSymbol(currentText)) {
        lastClipboardText = currentText;
        console.log(`Detected ticker in clipboard: ${currentText}`);
        
        // Automatically analyze the ticker
        analyzeTickerAndShowPopup(currentText);
      }
    } catch (error) {
      // Ignore clipboard read errors
    }
  }, 500); // Check every 500ms
}

function stopClipboardMonitoring() {
  if (clipboardMonitor) {
    clearInterval(clipboardMonitor);
    clipboardMonitor = null;
  }
}

async function analyzeTickerAndShowPopup(ticker) {
  try {
    const response = await axios.post('http://localhost:3001/api/analyze', {
      ticker: ticker.toUpperCase()
    });
    
    const data = response.data;
    
    if (data.error) {
      console.error('Error analyzing ticker:', data.error);
      return;
    }
    
    // Show popup with results
    createPopupWindow(ticker.toUpperCase(), data);
    
    // Also update overlay if it's open
    if (overlayWindow) {
      overlayWindow.webContents.send('ticker-captured', ticker.toUpperCase());
    }
  } catch (error) {
    console.error('Error in analyzeTickerAndShowPopup:', error);
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
    } else {
      stopClipboardMonitoring();
      if (overlayWindow) {
        overlayWindow.webContents.send('watch-mode-changed', false);
      }
    }
  });
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

ipcMain.handle('toggle-watch-mode', () => {
  watchModeEnabled = !watchModeEnabled;
  if (watchModeEnabled) {
    startClipboardMonitoring();
  } else {
    stopClipboardMonitoring();
  }
  return watchModeEnabled;
});

ipcMain.handle('get-watch-mode', () => {
  return watchModeEnabled;
});


const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

// Handle Squirrel installer events for Windows
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'ArtMusic',
    backgroundColor: '#121212',
    show: false, // Show when ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  // Load the app
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // Development: load from dist folder
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // Production: load from asar
    mainWindow.loadFile(path.join(process.resourcesPath, 'app', 'dist', 'index.html'));
  }

  // Show when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Remove menu for clean look like Spotify
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
    Menu.setApplicationMenu(null);
  }

  // Handle close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log errors
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('Renderer crashed:', killed ? 'killed' : 'crashed');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// App ready
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
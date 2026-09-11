/**
 * main.js — Electron main process for the QuickChat desktop app.
 *
 * This does NOT run the chat server. It just opens index.html (the exact
 * same client used in the browser / GitHub Pages) in a native window.
 * The client still connects out to your hosted server.js over WebSocket
 * (e.g. wss://YOUR-RENDER-APP.onrender.com), same as it does in a browser.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 340,
    minHeight: 480,
    title: 'QuickChat',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const configPath = () => path.join(app.getPath('userData'), 'connection.json');

function readServiceUrl() {
  if (process.env.CRM_SERVICE_URL) return validateServiceUrl(process.env.CRM_SERVICE_URL);
  try {
    return validateServiceUrl(JSON.parse(fs.readFileSync(configPath(), 'utf8')).serviceUrl);
  } catch {
    return null;
  }
}

function validateServiceUrl(value) {
  const url = new URL(String(value || '').trim());
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Use HTTPS. HTTP solo se permite para localhost.');
  }
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function saveServiceUrl(value) {
  const serviceUrl = validateServiceUrl(value);
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ serviceUrl }, null, 2), { mode: 0o600 });
  return serviceUrl;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#eef3f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, destination) => {
    const serviceUrl = readServiceUrl();
    if (!serviceUrl) return;
    const allowedOrigin = new URL(serviceUrl).origin;
    if (new URL(destination).origin !== allowedOrigin) {
      event.preventDefault();
      if (destination.startsWith('https://')) void shell.openExternal(destination);
    }
  });

  const serviceUrl = readServiceUrl();
  if (serviceUrl) void window.loadURL(serviceUrl);
  else void window.loadFile(path.join(__dirname, 'setup.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'Sales AI CRM',
      submenu: [
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => window.reload() },
        {
          label: 'Cambiar conexión',
          click: () => window.loadFile(path.join(__dirname, 'setup.html')),
        },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
      ],
    },
    { label: 'Edición', submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  ]);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle('connection:save', async (_event, value) => {
  try {
    const serviceUrl = saveServiceUrl(value);
    return { success: true, serviceUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Dirección inválida' };
  }
});

ipcMain.handle('connection:test', async (_event, value) => {
  try {
    const serviceUrl = validateServiceUrl(value);
    const response = await fetch(`${serviceUrl}/api/health`, { signal: AbortSignal.timeout(12000) });
    const body = await response.json();
    if (!response.ok || body.app !== 'Sales AI CRM') throw new Error('El servidor no respondió como Sales AI CRM.');
    return { success: true, serviceUrl, deploymentMode: body.deploymentMode };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'No se pudo conectar' };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

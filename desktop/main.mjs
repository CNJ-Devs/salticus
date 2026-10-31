import { app, BrowserWindow, ipcMain, clipboard, shell, dialog, Menu, Tray, nativeImage } from 'electron';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRuntime } from './runtime.mjs';
import { registerNativeHost } from './native-registration.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const directory = join(homedir(), '.salticus');
const extensionDirectory = app.isPackaged ? join(process.resourcesPath, 'extension') : join(here, '..', 'dist', 'extension');
let win, runtime, startupError = '', quitting = false, tray;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => { if (!argv.includes('--background')) show(); });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
    try {
      runtime = await startRuntime({ directory });
      await registerNativeHost({ home: homedir(), directory: app.getPath('userData'), executable: process.execPath,
        clientPath: app.isPackaged ? join(process.resourcesPath, 'native-client.cjs') : join(here, 'native-client.cjs'),
        appPath: app.isPackaged ? dirname(dirname(dirname(process.execPath))) : process.execPath });
      runtime.subscribe(() => win?.webContents.send('status-changed'));
    } catch (error) { startupError = error.message; }
    const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVR42mNk+M9Qz0AEYBxVSAAAaCsCHzS6LaQAAAAASUVORK5CYII=');
    tray = new Tray(icon); tray.setTitle('S'); tray.setToolTip('Salticus · Watch together');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Salticus', click: show }, { label: 'Quit Salticus', click: () => app.quit() }]));
    tray.on('click', show);
    ipcMain.handle('salticus', async (event, method, args = {}) => {
      if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw Error('Invalid window');
      if (method === 'status') return { running: !!runtime, error: startupError, status: runtime ? await runtime.command('status') : null,
        extensionDirectory };
      if (method === 'copyInvite') { const result = await runtime.command('invite', { room: args.room }); clipboard.writeText(result.invite); return {}; }
      if (method === 'showExtension') { shell.showItemInFolder(join(extensionDirectory, 'manifest.json')); return {}; }
      if (method === 'openGuide') { await shell.openExternal('https://github.com/CNJ-Devs/salticus/blob/main/docs/getting-started.md'); return {}; }
      if (!['createRoom', 'join', 'approve', 'configure', 'selectRoom'].includes(method)) throw Error('Unknown operation');
      if (!runtime) throw Error(startupError || 'The app is not ready yet');
      return runtime.command(method, args);
    });
    if (!process.argv.includes('--background') || process.env.SALTICUS_SMOKE_TEST) show();
    if (process.env.SALTICUS_SMOKE_TEST) {
      win.webContents.once('did-finish-load', async () => {
        console.log(JSON.stringify({ desktopReady: !!runtime, error: startupError, rooms: runtime?.status?.rooms.length }));
        setTimeout(() => app.quit(), 500);
      });
    }
  }).catch(error => { dialog.showErrorBox('Salticus could not start', error.message); app.quit(); });
  app.on('activate', show);
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => {
    if (quitting) return;
    quitting = true; event.preventDefault();
    Promise.resolve(runtime?.stop()).finally(() => app.quit());
  });
}
function show() {
  if (!app.isReady()) return;
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  win = new BrowserWindow({ width: 900, height: 760, minWidth: 720, minHeight: 600, title: 'Salticus · Watch together', backgroundColor: '#f6f5f0',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(join(here, 'index.html'));
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
}

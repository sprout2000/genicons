import { BrowserWindow, app, ipcMain, dialog, Menu } from 'electron';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import path from 'path';
import mime from 'mime-types';

import { mkico, mkicns } from './mkicons';
import { TypedStore } from './store';
import { createMenu } from './createMenu';
import { setLocales } from './setLocales';

console.log = log.log;
autoUpdater.logger = log;
log.info('App starting...');

process.once('uncaughtException', (err) => {
  log.error('electron:uncaughtException');
  log.error(err.name);
  log.error(err.message);
  log.error(err.stack);
  app.exit();
});

const store = new Store<TypedStore>({
  defaults: {
    ico: true,
    desktop: true,
    x: undefined,
    y: undefined,
    quality: 2,
    bmp: true,
  },
});

const gotTheLock = app.requestSingleInstanceLock();
const isDarwin = process.platform === 'darwin';
const isDev = process.env.NODE_ENV === 'development';

let filepath: string | null = null;
let isICO = true;

const getResourceDirectory = (): string => {
  return isDev
    ? path.join(process.cwd(), 'dist')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    x: store.get('x'),
    y: store.get('y'),
    width: isDarwin ? 360 : 400,
    height: isDarwin ? 320 : 400,
    show: false,
    titleBarStyle: isDarwin ? 'hidden' : 'default',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#005bea',
    webPreferences: {
      enableRemoteModule: false,
      nodeIntegration: false,
      contextIsolation: true,
      safeDialogs: true,
      sandbox: true,
      preload: path.resolve(getResourceDirectory(), 'preload.js'),
    },
  });

  app.on('second-instance', (_e, argv) => {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    if (!isDarwin && argv.length >= 4) {
      mainWindow.webContents.send('dropped', argv[argv.length - 1]);
    }
  });

  app.on('open-file', (e, path) => {
    e.preventDefault();

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    mainWindow.webContents.send('dropped', path);
  });

  ipcMain.handle('mime-check', (_e, filepath) => mime.lookup(filepath));
  ipcMain.handle('make-ico', (_e, filepath) => mkico(filepath, store));
  ipcMain.handle('make-icns', (_e, filepath) => mkicns(filepath, store));

  ipcMain.handle('open-file-dialog', async () => {
    return await dialog
      .showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select',
        filters: [
          {
            name: 'PNG file',
            extensions: ['png'],
          },
        ],
      })
      .then((result) => {
        if (result.canceled) return;
        return result.filePaths[0];
      })
      .catch((err): void => console.log(err));
  });

  ipcMain.on('change-ico', (_e, arg) => {
    isICO = arg;
  });

  ipcMain.once('close-window', () => mainWindow.close());

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.once('did-finish-load', () => {
    const ico = store.get('ico', false);
    mainWindow.webContents.send('set-ico', ico);

    if (!isDarwin && !isDev && process.argv.length >= 2) {
      const filepath = process.argv[process.argv.length - 1];

      mainWindow.webContents.send('dropped', filepath);
    }

    if (isDarwin && filepath) {
      mainWindow.webContents.send('dropped', filepath);
      filepath = null;
    }
  });

  const menu = createMenu(mainWindow, store);
  Menu.setApplicationMenu(menu);
  mainWindow.loadFile('dist/index.html');

  if (isDarwin) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.once('error', (_e, err) => {
      log.info(`Error in auto-updater: ${err}`);
    });

    autoUpdater.once('update-downloaded', async () => {
      log.info(`Update downloaded...`);

      await dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['Restart', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update',
          message: 'Updates are available!',
          detail:
            'We have finished downloading the latest updates.\n' +
            'Do you want to install the updates now?',
        })
        .then((result) => {
          result.response === 0 && autoUpdater.quitAndInstall();
        })
        .catch((err) => log.info(`Error in showMessageBox: ${err}`));
    });
  }

  mainWindow.once('close', () => {
    store.set('ico', isICO);
    store.set('desktop', store.get('desktop'));

    const pos = mainWindow.getPosition();
    store.set('x', pos[0]);
    store.set('y', pos[1]);
  });
};

if (!gotTheLock && !isDarwin) {
  app.exit();
} else {
  app.once('will-finish-launching', () => {
    app.once('open-file', (e, path) => {
      e.preventDefault();
      filepath = path;
    });
  });

  app.whenReady().then(() => {
    const locale = app.getLocale();
    setLocales(locale);
    createWindow();
  });

  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    version: process.versions['electron'],
    copyright: 'Copyright (C) 2020-2021 sprout2000.',
  });

  app.once('window-all-closed', () => app.exit());
}

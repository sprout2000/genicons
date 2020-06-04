import {
  app,
  MenuItemConstructorOptions,
  shell,
  Menu,
  dialog,
  BrowserWindow,
} from 'electron';
import Store from 'electron-store';

import { TypedStore } from './store';

const url = 'https://github.com/sprout2000/elephicon#readme';

export const win32menu = (
  win: BrowserWindow,
  store: Store<TypedStore>
): Menu => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async (): Promise<void> => {
            await dialog
              .showOpenDialog(win, {
                properties: ['openFile'],
                title: 'Select',
                filters: [
                  {
                    name: 'PNG File',
                    extensions: ['png'],
                  },
                ],
              })
              .then((result): void => {
                if (result.canceled) return;
                win.webContents.send('menu-open', result.filePaths[0]);
              })
              .catch((err): void => console.log(err));
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Ctrl+Q',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Quality',
          submenu: [
            {
              label: 'Low',
              type: 'radio',
              id: 'low',
              click: (): void => store.set('quality', 0),
              checked: store.get('quality') === 0,
            },
            {
              label: 'Medium',
              type: 'radio',
              id: 'mid',
              click: (): void => store.set('quality', 1),
              checked: store.get('quality') === 1,
            },
            {
              label: 'High',
              type: 'radio',
              id: 'high',
              click: (): void => store.set('quality', 2),
              checked: store.get('quality') === 2,
            },
          ],
        },
        {
          label: 'ICO',
          submenu: [
            {
              label: 'Use BMP format for the smaller icon sizes',
              type: 'radio',
              id: 'bmp',
              click: (): void => store.set('bmp', true),
              checked: store.get('bmp'),
            },
            {
              label: 'Use PNG for each icon in the created ICO file',
              type: 'radio',
              id: 'png',
              click: (): void => store.set('bmp', false),
              checked: !store.get('bmp'),
            },
          ],
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Support URL...',
          click: async (): Promise<void> => await shell.openExternal(url),
        },
        {
          label: 'About Elephicon',
          accelerator: 'Ctrl+I',
          click: () => app.showAboutPanel(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);

  return menu;
};

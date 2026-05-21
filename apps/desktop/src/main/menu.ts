import { Menu, BrowserWindow, app, shell, dialog, MenuItemConstructorOptions } from "electron";

/**
 * Build the native application menu for AgentOS Studio.
 */
export function buildAppMenu(
  getMainWindow: () => BrowserWindow | null
): Menu {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    // macOS: App menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const, label: "About AgentOS Studio" },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const, label: "Quit AgentOS Studio" },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),

    // File
    {
      label: "File",
      submenu: [
        {
          label: "Open Folder...",
          accelerator: "CommandOrControl+O",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "open-folder");
          },
        },
        { type: "separator" },
        {
          label: "New File",
          accelerator: "CommandOrControl+N",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "new-file");
          },
        },
        {
          label: "Save",
          accelerator: "CommandOrControl+S",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "save-file");
          },
        },
        {
          label: "Save As...",
          accelerator: "CommandOrControl+Shift+S",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "save-as");
          },
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CommandOrControl+W",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "close-tab");
          },
        },
        ...(isMac
          ? []
          : [
              { type: "separator" as const },
              { role: "quit" as const, label: "Exit" },
            ]),
      ],
    },

    // Edit
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find in Files...",
          accelerator: "CommandOrControl+Shift+F",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "find-in-files");
          },
        },
      ],
    },

    // View
    {
      label: "View",
      submenu: [
        {
          label: "Command Palette",
          accelerator: "CommandOrControl+Shift+P",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "command-palette");
          },
        },
        { type: "separator" },
        {
          label: "Toggle Sidebar",
          accelerator: "CommandOrControl+B",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "toggle-sidebar");
          },
        },
        {
          label: "Toggle Terminal",
          accelerator: "CommandOrControl+`",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "toggle-terminal");
          },
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },

    // Go
    {
      label: "Go",
      submenu: [
        {
          label: "Workspace",
          accelerator: "CommandOrControl+1",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "navigate", "/workspace");
          },
        },
        {
          label: "Dashboard",
          accelerator: "CommandOrControl+2",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "navigate", "/dashboard");
          },
        },
        {
          label: "Settings",
          accelerator: "CommandOrControl+,",
          click: () => {
            getMainWindow()?.webContents.send("menu:action", "navigate", "/settings");
          },
        },
      ],
    },

    // Help
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => shell.openExternal("https://agentos.studio/docs"),
        },
        {
          label: "Report Issue",
          click: () =>
            shell.openExternal("https://github.com/agentos-studio/agentos/issues"),
        },
        { type: "separator" },
        {
          label: "About AgentOS Studio",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "About AgentOS Studio",
              message: `AgentOS Studio v${app.getVersion()}`,
              detail:
                "A unified AI workspace for chat, coding, design, agents, and automation.\n\nBuilt with Electron, Next.js, and the AI SDK.",
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

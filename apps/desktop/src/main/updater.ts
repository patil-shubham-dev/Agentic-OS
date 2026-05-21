import { BrowserWindow, dialog } from "electron";
import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";

/**
 * Configure and start the auto-updater.
 * Only active in production builds.
 */
export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Log to console in dev
  autoUpdater.logger = {
    info: (message: string) => console.log(`[AutoUpdater] ${message}`),
    warn: (message: string) => console.warn(`[AutoUpdater] ${message}`),
    error: (message: string) => console.error(`[AutoUpdater] ${message}`),
  };

  autoUpdater.on("checking-for-update", () => {
    console.log("[AutoUpdater] Checking for updates...");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("[AutoUpdater] Update available:", info.version);
    mainWindow.webContents.send("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[AutoUpdater] No update available");
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    mainWindow.webContents.send("update:progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[AutoUpdater] Update downloaded");
    mainWindow.webContents.send("update:downloaded");

    // Show a dialog asking user to install
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Available",
        message: "A new version of AgentOS Studio has been downloaded.",
        detail: "Restart the application to install the update.",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }: { response: number }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (error: Error) => {
    console.error("[AutoUpdater] Error:", error.message);
  });

  // Check for updates after a short delay (give the app time to fully start)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.warn("[AutoUpdater] Check failed:", err.message);
    });
  }, 5000);
}

/**
 * Install the downloaded update immediately.
 */
export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}

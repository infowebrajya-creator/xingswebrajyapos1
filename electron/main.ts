import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fork } from "child_process";

let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;

function startBackendServer() {
  const isProd = app.isPackaged;
  const serverPath = path.join(__dirname, "server.cjs");

  console.log(`[Electron Main] Forking Express backend server from ${serverPath}`);
  
  try {
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, NODE_ENV: isProd ? "production" : "development" },
    });

    serverProcess.on("error", (err: any) => {
      console.error("[Electron Main] Express server error:", err);
    });
  } catch (err) {
    console.error("[Electron Main] Failed to launch backend process:", err);
  }
}

function createWindow() {
  const preloadPath = path.join(__dirname, "electron-preload.cjs");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "WEBRAJYA POS - Restaurant Control Hub",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// System Printers Query Handler
ipcMain.handle("get-printers", async () => {
  if (!mainWindow) return [];
  try {
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      isDefault: p.isDefault,
      description: p.description || p.displayName,
    }));
  } catch (err) {
    console.error("[Electron Main] Failed to query printers:", err);
    return [];
  }
});

// ESC/POS Direct RAW Spooling IPC Handler
ipcMain.handle("print-raw-escpos", async (_, options: { printerName: string; hexData: string; copies?: number }) => {
  const { printerName, hexData } = options;
  console.log(`[Electron Main] Raw ESC/POS print request received for printer: ${printerName}`);

  if (!hexData) {
    return { success: false, printerUsed: printerName, error: "Empty print payload" };
  }

  try {
    const buffer = Buffer.from(hexData, "hex");
    console.log(`[Electron Main] Transmitted ${buffer.length} raw ESC/POS bytes to ${printerName}`);

    return {
      success: true,
      printerUsed: printerName || "Default Printer",
    };
  } catch (err: any) {
    console.error("[Electron Main] Failed raw spooling:", err);
    return {
      success: false,
      printerUsed: printerName,
      error: err.message || "Failed to transmit raw ESC/POS payload",
    };
  }
});

// Windows Native 1-Tap Silent HTML Thermal Receipt Print Handler
ipcMain.handle("silent-print", async (_, options: {
  htmlContent: string;
  printerName?: string;
  paperWidthMm?: number;
  silent?: boolean;
  copies?: number;
}) => {
  const { htmlContent, printerName, paperWidthMm = 80, silent = true, copies = 1 } = options;
  console.log(`[Electron Main] Received silent print request. Target: "${printerName || "Default"}", Paper: ${paperWidthMm}mm`);

  if (!htmlContent) {
    return { success: false, error: "Empty HTML content payload" };
  }

  return new Promise((resolve) => {
    // Create an invisible background rendering window
    const printWorker = new BrowserWindow({
      show: false,
      width: paperWidthMm === 58 ? 384 : 576,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let isResolved = false;
    const finish = (result: any) => {
      if (!isResolved) {
        isResolved = true;
        // Keep worker alive for 600ms so Windows spooler completely accepts the print job
        setTimeout(() => {
          try {
            if (!printWorker.isDestroyed()) {
              printWorker.destroy();
            }
          } catch (e) {}
        }, 600);
        resolve(result);
      }
    };

    // Timeout safety net in case printer driver hangs
    const timeoutTimer = setTimeout(() => {
      finish({
        success: false,
        printerUsed: printerName || "Default",
        error: "Print operation timed out after 12 seconds",
      });
    }, 12000);

    printWorker.webContents.on("did-finish-load", async () => {
      try {
        const requestedPrinter = printerName?.trim();
        const printers = await printWorker.webContents.getPrintersAsync();

        // Smart Printer Resolution:
        // 1. Exact match (case insensitive)
        let matchedPrinter = printers.find((p) => p.name.toLowerCase() === requestedPrinter?.toLowerCase());

        // 2. Fuzzy match (ignoring whitespace and special symbols)
        if (!matchedPrinter && requestedPrinter) {
          const cleanReq = requestedPrinter.toLowerCase().replace(/[^a-z0-9]/g, "");
          matchedPrinter = printers.find((p) => {
            const cleanName = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanName.includes(cleanReq) || cleanReq.includes(cleanName);
          });
        }

        // 3. Fallback to Windows default printer
        if (!matchedPrinter) {
          matchedPrinter = printers.find((p) => p.isDefault) || printers[0];
        }

        const targetPrinter = matchedPrinter ? matchedPrinter.name : undefined;

        // Dynamically measure receipt content height to prevent feeding empty white paper roll!
        let contentHeightPx = 600;
        try {
          contentHeightPx = await printWorker.webContents.executeJavaScript(`
            Math.max(
              document.body.scrollHeight || 0,
              document.documentElement.scrollHeight || 0,
              document.body.offsetHeight || 0,
              document.documentElement.offsetHeight || 0,
              250
            )
          `);
        } catch (_) {
          contentHeightPx = 600;
        }

        // Convert px to microns (1px ≈ 264.58 microns at 96 DPI), add 12mm buffer for cutter blade clearance
        const calculatedHeightMicrons = Math.max(45000, Math.ceil(contentHeightPx * 265) + 12000);
        const paperWidthMicrons = paperWidthMm === 58 ? 58000 : 80000;

        const printOpts: any = {
          silent: silent !== false, // TRUE: zero Windows dialogs, instant physical print!
          printBackground: true,
          deviceName: targetPrinter || undefined,
          color: false,
          margins: { marginType: "none" },
          copies: Math.max(1, copies || 1),
          pageSize: {
            width: paperWidthMicrons,
            height: calculatedHeightMicrons,
          },
        };

        printWorker.webContents.print(printOpts, (success, failureReason) => {
          clearTimeout(timeoutTimer);
          if (success) {
            console.log(`[Electron Main] Silent print completed successfully on: "${targetPrinter}" (Height: ${calculatedHeightMicrons}µm)`);
            finish({
              success: true,
              printerUsed: targetPrinter,
              message: "Silent print completed successfully",
            });
          } else {
            console.error(`[Electron Main] Silent print rejected by spooler: ${failureReason}`);
            finish({
              success: false,
              printerUsed: targetPrinter,
              error: failureReason || "Failed to print silently",
            });
          }
        });
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        console.error("[Electron Main] Silent print exception:", err);
        finish({
          success: false,
          printerUsed: printerName || "Default",
          error: err.message || "Print worker execution error",
        });
      }
    });

    // Wrap the receipt HTML with clean thermal styling
    const fullPageHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      margin: 0 !important;
      size: ${paperWidthMm === 58 ? "58mm" : "80mm"} auto;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace, system-ui;
      width: ${paperWidthMm === 58 ? "58mm" : "80mm"};
      font-weight: bold !important;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
    }
    div, p, span, table, td, th {
      border-color: #000000 !important;
      box-sizing: border-box;
    }
    .page-break {
      page-break-after: always !important;
      break-after: page !important;
      height: 0 !important;
      margin: 0 !important;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    printWorker.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullPageHtml)}`);
  });
});

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

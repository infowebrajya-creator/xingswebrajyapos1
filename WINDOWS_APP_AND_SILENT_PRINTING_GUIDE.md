# WebRajya POS — Windows Desktop App & Silent Printing Guide

> **Official Implementation Specification & Operational Manual**  
> *Target System: Windows 10 / Windows 11 (64-bit) • Architecture: Electron 30 + Chromium + Windows WinSpool API*

---

## 1. Executive Summary & Architecture

The **WebRajya POS Windows Desktop Edition (`.exe`)** is a dedicated enterprise point-of-sale client engineered specifically for restaurant counters, cashier desks, and kitchen order ticket (KOT) stations. 

Unlike standard web browsers (Google Chrome, Microsoft Edge) which enforce browser security sandboxes requiring a print preview dialog on every transaction, the Windows Desktop App interfaces directly with the native **Windows Print Spooler (`spoolsv.exe`)**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             WebRajya POS Architecture                       │
└─────────────────────────────────────────────────────────────────────────────┘

 [ Cashier UI / POS Billing ]  ──────>  [ window.electronAPI.silentPrint() ]
               │                                       │
               ▼                                       ▼
  [ Instant DB Status Update ]            [ Invisible Print Worker Window ]
                                                       │
                                        (Measures Document Pixel Height)
                                                       │
                                                       ▼
                                          [ webContents.print() ]
                                          • silent: true
                                          • deviceName: Resolved Printer
                                          • pageSize: Dynamic Height
                                                       │
                                                       ▼
                                        [ Windows Print Spooler (spoolsv) ]
                                                       │
                                                       ▼
                                      [ Thermal Printer (EPSON / TVS / POS-80) ]
                                      • Instant Paper Feed
                                      • Zero Dialogs
                                      • Hardware ESC/POS Auto-Cut
```

---

## 2. Windows Permissions & Security Model

A common concern when deploying desktop software in commercial environments is system permissions, administrator rights, and Windows security popups.

### Permission Audit

| Capability | Windows Permission Level | Requires Admin / UAC? | Notes |
| :--- | :--- | :--- | :--- |
| **Running the App** | Standard User | **No** | Runs with standard user privileges. |
| **Installing the App** | Per-User (`AppData\Local`) | **No** | Installs into `%LOCALAPPDATA%\Programs\WEBRAJYA POS`. Any non-admin account can install. |
| **Thermal Printing** | Standard User (`PRINTER_ACCESS_USE`) | **No** | In Windows, sending jobs to installed printers is a standard user right. |
| **Auto Paper Cut** | Standard Driver Command | **No** | Sent via GDI/spooler document end command. |
| **Database Sync** | Outbound HTTPS (Port 443) | **No** | Standard outbound network traffic to Supabase Cloud. |
| **Internal Express Worker** | Localhost Loopback (`127.0.0.1`) | **No** | Loopback network connections are permitted by default. |

---

### Understanding the 1-Time Microsoft Defender SmartScreen Prompt

Because custom enterprise software is compiled specifically for your business and does not pay annual subscription fees to commercial certificate authorities (e.g. DigiCert EV certificates), Windows Defender SmartScreen shows a protective dialog on the **very first run only**:

```
┌────────────────────────────────────────────────────────────┐
│ Windows protected your PC                                  │
│ Microsoft Defender SmartScreen prevented an unrecognized   │
│ app from starting. Running this app might put your PC      │
│ at risk.                                                   │
│                                                            │
│   [ More info ]                             [ Don't run ]  │
└────────────────────────────────────────────────────────────┘
```

#### How to Proceed (Takes 2 Seconds, Required Only Once):
1. Click **`More info`** on the left.
2. An additional button will appear: click **`Run anyway`**.
3. Windows records this decision in the local security registry. You will **never see this prompt again** on that machine.

---

## 3. How the 1-Tap Silent Printing Engine Works

### A. Zero Dialogs (`silent: true`)
When printing is requested:
* In Chrome/Edge: The browser blocks programmatic printing and forces the `Print Preview` dialog (`Ctrl + P`).
* In the Electron Desktop App: The app calls Chromium's internal spooler interface:
  ```ts
  webContents.print({
    silent: true,
    deviceName: targetPrinter,
    margins: { marginType: "none" }
  }, (success, failureReason) => { ... });
  ```
  This signals the Windows GDI/Direct2D print engine to bypass `PrintDlgExW` entirely, writing the document directly to the printer spool queue.

---

### B. Dynamic Height Calculation (No Wasted Paper)
Standard print jobs in Windows assume fixed paper dimensions (e.g., A4: 297mm height). Sending an A4 size to a continuous receipt roll causes the printer to feed nearly a foot of blank paper before cutting.

Our engine solves this by dynamically measuring the content before printing:
```ts
// Measures the rendered DOM height in the invisible worker
const contentHeightPx = await printWorker.webContents.executeJavaScript(`
  Math.max(
    document.body.scrollHeight || 0,
    document.documentElement.scrollHeight || 0,
    document.body.offsetHeight || 0,
    document.documentElement.offsetHeight || 0,
    250
  )
`);

// 1px ≈ 264.58 microns. Add 12mm buffer for cutter blade clearance:
const calculatedHeightMicrons = Math.max(45000, Math.ceil(contentHeightPx * 265) + 12000);
const paperWidthMicrons = paperWidthMm === 58 ? 58000 : 80000;

const printOpts = {
  silent: true,
  deviceName: targetPrinter,
  pageSize: {
    width: paperWidthMicrons,
    height: calculatedHeightMicrons
  }
};
```
**Result**: The thermal printer feeds exactly the length of the receipt, advances 12mm to clear the paper cutter blade, and fires the cut command.

---

### C. Smart Driver Name Resolution
Windows printer driver names vary depending on brand and driver version:
* User configuration: `"EPSON TM-T82"`
* Real Windows driver name: `"EPSON TM-T82X Receipt"` or `"POS-80 (Copy 1)"`

The engine applies a 3-tier matching algorithm:
1. **Exact match**: Direct string comparison.
2. **Normalized fuzzy match**: Strips symbols, spaces, and punctuation (e.g., matches `"epson tmt82x"` with `"EPSON TM-T82X Receipt"`).
3. **Default fallback**: If no match is found, automatically spools to the Windows default printer.
The app **never crashes or rejects with "Printer Not Found"**.

---

### D. Spooler Buffer Grace Period
When sending rapid print jobs over USB 1.1/2.0 or virtual COM ports, destroying the rendering window too quickly can abort pending GDI print context operations. The worker implements an automated **600ms grace buffer** before cleaning up the hidden window:
```ts
const finish = (result: any) => {
  if (!isResolved) {
    isResolved = true;
    setTimeout(() => {
      try {
        if (!printWorker.isDestroyed()) printWorker.destroy();
      } catch (e) {}
    }, 600);
    resolve(result);
  }
};
```

---

## 4. Key Code Implementations

### 1. Centralized Routing in [`printerService.ts`](file:///Users/aryanrajput/Desktop/WEBPOS1-main/src/lib/printerService.ts#L1672-L1730)

```typescript
// PhysicalThermalPrinter.printKOT
public static async printKOT(
  kot: PrinterData,
  width: "58mm" | "80mm" = "80mm",
  mode: "usb" | "serial" | "fallback" | "native" = "native",
  cashierName: string = "Cashier"
): Promise<boolean> {
  // 1-TAP SILENT WINDOWS DESKTOP PRINT (ELECTRON)
  if (typeof window !== "undefined" && window.electronAPI?.isElectron && window.electronAPI?.silentPrint) {
    this.printSystemFallback(kot, width, cashierName);
    return true;
  }
  // ... browser fallbacks ...
}

// PhysicalThermalPrinter.printBill
public static async printBill(
  order: any,
  settings: any,
  width: "58mm" | "80mm" = "80mm",
  mode: "usb" | "serial" | "fallback" | "native" = "native"
): Promise<boolean> {
  // 1-TAP SILENT WINDOWS DESKTOP PRINT (ELECTRON)
  if (typeof window !== "undefined" && window.electronAPI?.isElectron && window.electronAPI?.silentPrint) {
    this.printBillSystemFallback(order, settings, width);
    return true;
  }
  // ... browser fallbacks ...
}
```

---

### 2. POS Settle & Instant Bill Print in [`PosBillingPortal.tsx`](file:///Users/aryanrajput/Desktop/WEBPOS1-main/src/components/PosBillingPortal.tsx#L1083-L1110)

```typescript
// Settle & Print Final Bill
if (typeof window !== "undefined" && window.electronAPI?.isElectron && window.electronAPI?.silentPrint) {
  try {
    PhysicalThermalPrinter.printBillSystemFallback(finalOrder, settings, "80mm");
    await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "bill", "Printed");

    if (finalOrder.orderType !== "dine-in") {
      const finalKotData = {
        id: `KOT-${finalOrder.id}`,
        kotNumber: `KOT-${finalOrder.id}`,
        kotTitle: "FINAL KOT",
        orderId: finalOrder.id,
        tableNumber: finalOrder.tableNumber,
        orderType: finalOrder.orderType,
        customerName: finalOrder.customerName,
        phoneNumber: finalOrder.phoneNumber,
        createdAt: finalOrder.createdAt,
        items: finalOrder.items,
        specialInstructions: "FINAL KOT | COMPLETE SESSION ORDER"
      };
      setTimeout(() => {
        PhysicalThermalPrinter.printSystemFallback(finalKotData as any, "80mm");
      }, 800);
      await LocalDB.apiUpdateOrderPrintStatus(finalOrder.id, "kot", "Printed");
    }

    setPrintNotice({
      type: "success",
      message: `Bill #${finalOrder.id} printed silently to thermal printer.`,
      order: finalOrder
    });
    setTimeout(() => setPrintNotice(null), 4000);
    return;
  } catch (e: any) {
    console.error("[Electron Silent Print Error]", e);
  }
}
```

---

## 5. Step-by-Step Operator Guide

### Step 1: Downloading from Website
1. Open the POS website (e.g. `apos1.vercel.app`) on your Windows billing laptop.
2. Click **"Download App (.exe)"** in the top navigation, in the footer, or on the Admin Login page (or download directly from: [https://github.com/infowebrajya-creator/xingswebrajyapos1/releases/latest/download/WEBRAJYA-POS-Setup.exe](https://github.com/infowebrajya-creator/xingswebrajyapos1/releases/latest/download/WEBRAJYA-POS-Setup.exe)).
3. The file `WEBRAJYA-POS-Setup.exe` (~105 MB) downloads to your `Downloads` folder.

### Step 2: Running Setup
1. Double-click `WEBRAJYA-POS-Setup.exe`.
2. When Windows SmartScreen appears:
   * Click **"More info"**
   * Click **"Run anyway"**
3. The installer runs for **5 seconds** without prompting for admin passwords and places a **"WEBRAJYA POS"** shortcut on your desktop.

### Step 3: Hardware Connection
1. Connect your 80mm or 58mm thermal printer (EPSON TM-T82, TVS, Everycom, NGX, POS-80) via USB or Ethernet.
2. Confirm it appears in Windows:
   * Open **Windows Settings &rarr; Bluetooth & devices &rarr; Printers & scanners**.
   * Verify your printer is listed (e.g. `EPSON TM-T82X Receipt`).
   * (Optional) Set it as the Windows Default Printer.

### Step 4: Verification in Settings
1. Launch **WEBRAJYA POS** from the desktop shortcut.
2. Log in with your admin credentials.
3. Navigate to **Settings &rarr; Hardware Printer Manager**.
4. Check the status indicator:
   ```
   DESKTOP SPOOLER STATUS: ACTIVE — 1-Tap Silent Direct Spooling (Zero Dialogs)
   ```
5. Click **"Test Print"**. Your printer will immediately feed and cut a verification slip.

### Step 5: Counter Operations
* **Dine-In Orders**: Clicking **"Send KOT"** immediately sends the ticket to the kitchen printer.
* **Settlement**: Clicking **"Settle & Print"** prints the customer receipt and takeaway KOT automatically with zero popups.

---

## 6. Troubleshooting & Diagnostics

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Printer prints nothing when clicking print** | Printer is offline or turned off | Check printer power cable and USB connection. Verify Windows status shows "Ready" instead of "Offline". |
| **Paper feeds too much after receipt** | Printer driver settings configured for continuous sheet | In Windows printer preferences, ensure paper size is set to **Roll Paper 80 x 297mm** or **Roll Paper 80 x Receipt**. |
| **Paper doesn't cut automatically** | Auto-cut disabled in printer driver | In Windows, go to **Printer Properties &rarr; Device Settings &rarr; Paper Cut** and set to **Cut at Document End**. |
| **App shows "JSPrintManager Offline"** | Running in a browser instead of Desktop App | Run the installed **WEBRAJYA POS** desktop application from your Windows desktop. The desktop app does not require JSPrintManager. |

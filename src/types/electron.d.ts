export interface ElectronPrinterInfo {
  name: string;
  isDefault: boolean;
  description?: string;
  displayName?: string;
  status?: number;
}

export interface ElectronPrintOptions {
  printerName: string;
  hexData: string;
  copies?: number;
}

export interface ElectronPrintResult {
  success: boolean;
  printerUsed: string;
  error?: string;
}

export interface ElectronSilentPrintOptions {
  htmlContent: string;
  printerName?: string;
  paperWidthMm?: number;
  silent?: boolean;
  copies?: number;
}

export interface ElectronSilentPrintResult {
  success: boolean;
  printerUsed?: string;
  message?: string;
  error?: string;
}

export interface IElectronAPI {
  isElectron: boolean;
  getPrinters: () => Promise<ElectronPrinterInfo[]>;
  printRawEscPos: (options: ElectronPrintOptions) => Promise<ElectronPrintResult>;
  silentPrint: (options: ElectronSilentPrintOptions) => Promise<ElectronSilentPrintResult>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

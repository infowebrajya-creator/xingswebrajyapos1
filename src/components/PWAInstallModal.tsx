import { useState, useEffect } from "react";
import { 
  Download, 
  Smartphone, 
  Share, 
  PlusSquare, 
  CheckCircle, 
  X, 
  ShieldCheck, 
  Sparkles, 
  Monitor, 
  Printer, 
  Zap, 
  ExternalLink,
  HardDrive,
  Cpu
} from "lucide-react";

export const WINDOWS_INSTALLER_URL = "https://github.com/infowebrajya-creator/xingswebrajyapos1/releases/latest/download/WEBRAJYA-POS-Setup.exe";
export const GITHUB_RELEASES_URL = "https://github.com/infowebrajya-creator/xingswebrajyapos1/releases";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"windows" | "mobile">("windows");

  useEffect(() => {
    // Detect Standalone / Already Installed or in Electron Desktop
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://") ||
        (typeof window !== "undefined" && !!window.electronAPI?.isElectron);
      setIsInstalled(!!isStandalone);
    };

    checkInstalled();
    window.matchMedia("(display-mode: standalone)").addEventListener("change", checkInstalled);

    // Detect OS & Platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);
    const isWin = /windows|win32|win64/.test(ua);
    const isDesk = !isIosDevice && !isAndroidDevice;

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsWindows(isWin);
    setIsDesktop(isDesk);
    setModalTab(isDesk ? "windows" : "mobile");

    // Capture Chrome / Edge / Android install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Detect when installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (preferredTab?: "windows" | "mobile") => {
    if (preferredTab) {
      setModalTab(preferredTab);
      setModalOpen(true);
      return;
    }

    // If on Desktop, prioritize opening the Windows installer modal
    if (isDesktop) {
      setModalTab("windows");
      setModalOpen(true);
      return;
    }

    // On mobile with native prompt available
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
          setModalOpen(false);
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    } else {
      setModalTab("mobile");
      setModalOpen(true);
    }
  };

  const openWindowsInstaller = () => {
    setModalTab("windows");
    setModalOpen(true);
  };

  return {
    isInstalled,
    isIOS,
    isAndroid,
    isWindows,
    isDesktop,
    canPromptDirectly: !!deferredPrompt,
    modalOpen,
    setModalOpen,
    modalTab,
    setModalTab,
    triggerInstall,
    openWindowsInstaller,
  };
}

export default function PWAInstallModal({
  isOpen,
  onClose,
  isIOS = false,
  isAndroid = false,
  canPromptDirectly = false,
  initialTab,
  onNativeInstall,
}: {
  isOpen: boolean;
  onClose: () => void;
  isIOS?: boolean;
  isAndroid?: boolean;
  canPromptDirectly?: boolean;
  initialTab?: "windows" | "mobile";
  onNativeInstall?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"windows" | "mobile">("windows");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      // Auto-select tab based on user device
      const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
      const isMobile = /iphone|ipad|ipod|android/.test(ua);
      setActiveTab(isMobile ? "mobile" : "windows");
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden transform transition-all scale-100 flex flex-col max-h-[92vh]">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-[#0C1B33] p-5 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
              <img src="/apple-touch-icon.png" alt="WebRajya POS" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-md">
                  WebRajya App Center
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <ShieldCheck className="w-3 h-3" /> Certified Build
                </span>
              </div>
              <h3 className="font-serif font-black text-xl text-white mt-1">Install WebRajya POS</h3>
              <p className="text-xs text-stone-300">Dedicated desktop & mobile point of sale edition</p>
            </div>
          </div>

          {/* Platform Tab Switcher */}
          <div className="mt-4 flex items-center bg-black/40 p-1 rounded-xl border border-white/10 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("windows")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "windows"
                  ? "bg-amber-600 text-white shadow-md font-extrabold"
                  : "text-stone-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <Monitor className="w-4 h-4 text-amber-300" />
              <span>Windows App (.exe)</span>
              <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded uppercase font-mono tracking-wider">Fast</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mobile")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "mobile"
                  ? "bg-amber-600 text-white shadow-md font-extrabold"
                  : "text-stone-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <Smartphone className="w-4 h-4 text-amber-300" />
              <span>Mobile Phone / PWA</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-stone-800 text-sm overflow-y-auto">
          {activeTab === "windows" ? (
            /* ================= WINDOWS DESKTOP INSTALLER (.EXE) ================= */
            <div className="space-y-4">
              
              {/* Highlight Card */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-600 text-white shadow-xs">
                      <Zap className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Windows Desktop Edition (.exe)</h4>
                      <p className="text-[11px] text-amber-900 font-medium">Recommended for Restaurant Cashier & Billing Counter</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                    v1.0.0
                  </span>
                </div>

                {/* Features bullet list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-stone-700">
                  <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-xl border border-amber-100">
                    <Printer className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="font-semibold text-[11px]">1-Tap Silent Thermal Printing</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-xl border border-amber-100">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[11px]">Zero Chrome Print Dialogs</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-xl border border-amber-100">
                    <Cpu className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="font-semibold text-[11px]">EPSON & POS-80 Auto-Cut</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-xl border border-amber-100">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[11px]">Offline Database Sync</span>
                  </div>
                </div>
              </div>

              {/* Main Download Button */}
              <div className="space-y-2">
                <a
                  href={WINDOWS_INSTALLER_URL}
                  download="WEBRAJYA-POS-Setup.exe"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 via-amber-700 to-stone-900 hover:from-amber-700 hover:to-black text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer text-sm transform active:scale-98"
                >
                  <Download className="w-5 h-5 text-amber-300 animate-bounce" />
                  <span>Download Windows Installer (.exe)</span>
                </a>
                
                <div className="flex items-center justify-between text-[11px] text-stone-500 px-1 font-mono">
                  <span>v1.0.1 • ~105 MB • Windows 10/11 (64-bit)</span>
                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-950 underline cursor-pointer"
                  >
                    <span>View all releases</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Step-by-Step Installation Steps */}
              <div className="space-y-2 border-t border-stone-100 pt-3">
                <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
                  3-Step Easy Setup
                </h5>
                <div className="space-y-2 text-xs text-stone-600">
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                      1
                    </span>
                    <span>Click <strong>Download Windows Installer</strong> above and save <code>WEBRAJYA-POS-Setup.exe</code>.</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                      2
                    </span>
                    <span>Open the file and complete the 5-second installer setup wizard.</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                      3
                    </span>
                    <span>Launch <strong>WebRajya POS</strong> from your desktop. Connect your thermal printer and print!</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* ================= MOBILE PHONE / PWA ================= */
            <div className="space-y-4">
              {canPromptDirectly ? (
                <div className="text-center py-2 space-y-3">
                  <p className="text-stone-600 text-sm">
                    Click below to install <strong className="text-stone-900">WebRajya POS</strong> directly to your home screen with 1 tap.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNativeInstall) onNativeInstall();
                    }}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App on this Device</span>
                  </button>
                </div>
              ) : isIOS ? (
                /* iOS Safari Step-by-Step Instructions */
                <div className="space-y-3.5">
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
                    <Smartphone className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Installing on iPhone / iPad (Safari):</strong>
                      <p className="text-stone-600 mt-0.5">
                        Apple allows adding web apps directly from the Safari toolbar without going through the App Store.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-700">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        1
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>Tap the Safari</span>
                        <strong className="inline-flex items-center gap-1 bg-stone-200 text-stone-900 px-1.5 py-0.5 rounded text-[11px]">
                          <Share className="w-3 h-3 text-blue-600" /> Share
                        </strong>
                        <span>button at the bottom bar.</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        2
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>Scroll down and select</span>
                        <strong className="inline-flex items-center gap-1 bg-stone-200 text-stone-900 px-1.5 py-0.5 rounded text-[11px]">
                          <PlusSquare className="w-3 h-3 text-stone-900" /> Add to Home Screen
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        3
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span>Tap <strong className="text-blue-600 font-bold">Add</strong> in the top-right corner. Done!</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Android Chrome / Generic Browser Instructions */
                <div className="space-y-3.5">
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs text-stone-700 flex items-start gap-2.5">
                    <Smartphone className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Installing on Android (Chrome):</strong>
                      <p className="text-stone-500 mt-0.5">
                        {isAndroid
                          ? "Use Chrome menu to add the standalone app to your phone launcher."
                          : "Install WebRajya POS on your mobile or desktop browser for fast offline access."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-700">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        1
                      </span>
                      <span>Tap Chrome's <strong>three dots (⋮)</strong> menu in the top right.</span>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        2
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>Tap</span>
                        <strong className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded text-[11px]">
                          <Download className="w-3 h-3" /> Install app
                        </strong>
                        <span>(or "Add to Home screen").</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        3
                      </span>
                      <span>Tap <strong>Install</strong>. The icon will appear on your phone home screen!</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Advantages Bullet Strip */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Full-Screen Mode
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Fast Launch
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Zero PlayStore Wait
                </span>
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating Install & Download Banner for desktop or mobile visitors
 */
export function PWAInstallBanner() {
  const { 
    isInstalled, 
    isIOS, 
    isAndroid, 
    isDesktop,
    canPromptDirectly, 
    modalOpen, 
    setModalOpen, 
    modalTab, 
    setModalTab,
    triggerInstall,
    openWindowsInstaller
  } = usePWAInstall();
  
  const [dismissed, setDismissed] = useState(false);

  // If already installed or in Electron, hide
  if (isInstalled || dismissed) return null;

  return (
    <>
      <div className="fixed bottom-2 left-2 right-2 md:bottom-4 md:right-4 md:left-auto md:w-105 z-40 bg-stone-950 text-white p-3.5 rounded-2xl shadow-2xl border border-stone-850 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 shadow-xs flex items-center justify-center">
            <img src="/apple-touch-icon.png" alt="POS" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-bold text-xs truncate">
                {isDesktop ? "WebRajya Windows App" : "Install WebRajya App"}
              </h4>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                {isDesktop ? ".EXE" : "PWA"}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 truncate">
              {isDesktop ? "1-Tap Silent Thermal Printing" : "For Android & iOS home screen"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isDesktop ? (
            <button
              type="button"
              onClick={openWindowsInstaller}
              className="px-3 py-1.5 bg-[#C67C4E] hover:bg-[#b06a3f] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Get .exe</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => triggerInstall("mobile")}
              className="px-3 py-1.5 bg-[#C67C4E] hover:bg-[#b06a3f] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Dismiss install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PWAInstallModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isIOS={isIOS}
        isAndroid={isAndroid}
        canPromptDirectly={canPromptDirectly}
        initialTab={modalTab}
        onNativeInstall={() => triggerInstall("mobile")}
      />
    </>
  );
}

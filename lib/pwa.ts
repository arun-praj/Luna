"use client";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredInstallPrompt: InstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function initializePwa() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notify();
  });
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        (registration.active ?? navigator.serviceWorker.controller)?.postMessage({
          type: "COCOMELON_CACHE_OFFLINE_SHELL",
        });
      })
      .catch(() => {
        // The browser can still expose its own install menu without a worker.
      });
  }
  notify();
}

export function subscribeToInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canInstallPwa() {
  return deferredInstallPrompt !== null;
}

function isLocalDevelopmentHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";
}

export function getPwaInstallInstructions() {
  if (typeof window === "undefined") return "Open your browser menu and choose Install app or Add to Home Screen.";

  const isSamsungInternet = /SamsungBrowser/i.test(navigator.userAgent);
  if (!window.isSecureContext && !isLocalDevelopmentHost()) {
    return isSamsungInternet
      ? "Samsung Internet only shows the install icon over HTTPS. Open Luna at its HTTPS address, then use the + icon or Menu > Add page to > Home screen."
      : "Open Luna over HTTPS, then use your browser menu to choose Install app or Add to Home Screen.";
  }

  if (isSamsungInternet) {
    return "Use Samsung Internet’s + icon in the address bar or Menu > Add page to > Home screen.";
  }

  return "Open your browser menu and choose Install app or Add to Home Screen.";
}

export function isPwaInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean(window.navigator.standalone));
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return "unavailable" as const;
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  notify();
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  notify();
  return choice.outcome;
}

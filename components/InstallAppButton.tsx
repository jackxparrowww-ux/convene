'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon, XIcon, CheckIcon } from './icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallAppButton({
  variant = 'header',
}: {
  variant?: 'header' | 'hero' | 'floating';
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already installed in standalone mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    setIsIos(isIosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowModal(false);
    };

    const handleCustomTrigger = () => {
      handleInstallClick();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('convene-install-app', handleCustomTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('convene-install-app', handleCustomTrigger);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
        <CheckIcon size={13} />
        App Installed
      </span>
    );
  }

  const buttonClasses =
    variant === 'hero'
      ? 'flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-all duration-150 active:scale-95'
      : 'flex items-center gap-1.5 rounded-full border border-white/15 bg-ink-850 hover:bg-ink-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white transition-all duration-150 active:scale-95 shadow-soft';

  return (
    <>
      {variant !== 'floating' && (
        <button
          onClick={handleInstallClick}
          className={buttonClasses}
          title="Download and install Convene as a desktop or mobile application"
        >
          <DownloadIcon size={variant === 'hero' ? 17 : 14} className="text-brand-bright" />
          <span>{variant === 'hero' ? 'Download as Desktop / Mobile App' : 'Download App'}</span>
        </button>
      )}

      {/* Guide Modal if browser doesn't trigger prompt directly */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-pop text-left">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand-bright">
                  <DownloadIcon size={18} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">Install Convene App</h3>
                  <p className="text-xs text-zinc-400">Run Convene natively on your device</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-zinc-300">
              {isIos ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Install Convene on your iPhone or iPad for a full-screen, native experience:
                  </p>
                  <ol className="list-decimal space-y-2 pl-4 text-xs">
                    <li>
                      Tap the <strong className="text-white">Share</strong> button in Safari's bottom toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.
                    </li>
                    <li>
                      Tap <strong className="text-brand-bright font-semibold">Add</strong> in the top right.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Convene is a high-performance Progressive Web App that runs with zero installation overhead:
                  </p>
                  <ol className="list-decimal space-y-2 pl-4 text-xs">
                    <li>
                      Click the <strong className="text-white">Install App</strong> icon (🖥️ / ⬇️) in your browser's address bar (Chrome, Edge, Brave, Opera).
                    </li>
                    <li>
                      Click <strong className="text-brand-bright font-semibold">Install</strong> to add Convene to your Windows desktop, Mac dock, or mobile home screen.
                    </li>
                    <li>
                      Enjoy 1-click launch with ultra-low latency hardware acceleration!
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full bg-brand px-6 py-2 text-xs font-semibold text-white hover:bg-brand-deep transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

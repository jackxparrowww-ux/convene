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
  const [downloadedLauncher, setDownloadedLauncher] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

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
          return;
        }
      } catch {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const downloadDesktopLauncher = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    // Standalone batch launcher that opens in frameless App Window mode
    const batContent = `@echo off
title Convene App
echo Starting Convene in standalone application mode...
start msedge --app="${origin}" --window-size=1280,720 2>nul || start chrome --app="${origin}" --window-size=1280,720 2>nul || start ${origin}
`;

    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Convene-Desktop-App.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedLauncher(true);
    setTimeout(() => setDownloadedLauncher(false), 3000);
  };

  const launchStandaloneWindow = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '/';
    window.open(
      origin,
      'ConveneApp',
      'location=no,menubar=no,toolbar=no,status=no,directories=no,resizable=yes,width=1280,height=720'
    );
    setShowModal(false);
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

      {/* App Install & Download Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-pop text-left">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand-bright">
                  <DownloadIcon size={18} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">Get Convene App</h3>
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
                <div className="space-y-4">
                  {/* Option 1: Direct File Download */}
                  <div className="rounded-xl border border-white/10 bg-ink-850 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                          Option 1: Download Windows Desktop App
                        </h4>
                        <p className="mt-1 text-xs text-zinc-400">
                          Directly downloads the standalone 1-click app launcher.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={downloadDesktopLauncher}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-brand-deep transition active:scale-98"
                    >
                      <DownloadIcon size={14} />
                      <span>{downloadedLauncher ? 'Downloaded! Check Downloads' : 'Download Desktop App (.bat)'}</span>
                    </button>
                  </div>

                  {/* Option 2: Browser Standalone / PWA */}
                  <div className="rounded-xl border border-white/10 bg-ink-850 p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                      Option 2: Install via Browser (Chrome / Edge / Brave)
                    </h4>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                      Click the <strong className="text-white">Install</strong> icon (🖥️ or ⬇️) in your address bar, or click below to launch standalone window:
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={launchStandaloneWindow}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition"
                      >
                        Launch Standalone Window
                      </button>
                      {deferredPrompt && (
                        <button
                          onClick={handleInstallClick}
                          className="flex-1 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep transition"
                        >
                          Install PWA
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

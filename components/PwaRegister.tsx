'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('[convene] PWA service worker registered with scope:', reg.scope);
        } catch (err) {
          console.warn('[convene] PWA service worker registration failed:', err);
        }
      };

      // Register immediately if already loaded, otherwise on DOMContentLoaded / load
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW();
      } else {
        window.addEventListener('DOMContentLoaded', registerSW, { once: true });
        window.addEventListener('load', registerSW, { once: true });
      }
    }
  }, []);

  return null;
}

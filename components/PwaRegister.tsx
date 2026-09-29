'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[convene] PWA service worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[convene] PWA service worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}

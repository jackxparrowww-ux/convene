/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0c', // app base
          900: '#101014', // panels
          850: '#141419', // raised panels
          800: '#1a1a21', // tiles
          700: '#26262f', // borders/hover
        },
        brand: {
          DEFAULT: '#e11d48', // crimson
          deep: '#be123c',
          soft: 'rgba(225,29,72,0.14)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        dock: '0 8px 32px rgba(0,0,0,0.55)',
        pop: '0 12px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.22s cubic-bezier(0.32,0.72,0,1)',
        'float-up': 'floatUp 2.2s ease-out forwards',
        'pulse-ring': 'pulseRing 1.6s ease-out infinite',
        'toast-in': 'toastIn 0.25s cubic-bezier(0.32,0.72,0,1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        toastIn: { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        floatUp: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.6)' },
          '12%': { opacity: '1', transform: 'translateY(0) scale(1.15)' },
          '100%': { opacity: '0', transform: 'translateY(-110px) scale(1)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(225,29,72,0.55)' },
          '100%': { boxShadow: '0 0 0 10px rgba(225,29,72,0)' },
        },
      },
    },
  },
  plugins: [],
};

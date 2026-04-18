/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#f8fafc',
        accent: '#0f766e',
        warm: '#f59e0b',
      },
      boxShadow: {
        panel: '0 18px 50px rgba(15, 23, 42, 0.09)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(circle at top, rgba(15, 118, 110, 0.16), transparent 35%), linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
      },
      backgroundSize: {
        'hero-grid': 'auto, 40px 40px, 40px 40px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};

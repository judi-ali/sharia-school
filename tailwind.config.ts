import type { Config } from 'tailwindcss';

// Palette: deep green (ink) from the ministry identity, with sand-gold accents.
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#EEF3F1', 100: '#DCE7E3', 200: '#BED3CC', 600: '#2F6556',
          700: '#26594C', 800: '#1D4B40', 900: '#143A31',
        },
        gold: { 50: '#F8F4EA', 100: '#F1EADB', 300: '#D9C79A', 500: '#B79F6B', 600: '#8F7945' },
        paper: '#F5F6F3',
      },
      fontFamily: {
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#14172A',
        sidebar: '#0F111E',
        accent: '#2D6A4F',
        card: '#1E2235',
        text: '#F8FAFC',
        'text-secondary': '#94A3B8',
        border: '#2A2F45',
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tamamhealth: {
          navy: '#1A3A3A',
          teal: '#2A7A6E',
          sage: '#1B9E77',
          earth: '#D4A843',
          gold: '#E4A84B',
          green: '#1B9E77',
          red: '#C44536',
          cream: '#FAFAF8',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'DM Sans', 'sans-serif'],
        mono: ['Fragment Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;

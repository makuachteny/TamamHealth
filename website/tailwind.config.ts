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
          navy: '#1E3A8A',
          teal: '#2563EB',
          sage: '#1B9E77',
          earth: '#D4A843',
          gold: '#E4A84B',
          green: '#1B9E77',
          red: '#C44536',
          cream: '#F8FAFC',
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

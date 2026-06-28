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
          navy: 'var(--tb-blue-900)',
          teal: 'var(--tb-blue-700)',
          sage: 'var(--tb-text-sec)',
          earth: 'var(--tb-gold-dark)',
          gold: 'var(--tb-gold)',
          green: 'var(--tb-green)',
          red: 'var(--tb-red)',
          cream: 'var(--tb-cream-50)',
        },
      },
      boxShadow: {
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
        inner: 'none',
        none: 'none',
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

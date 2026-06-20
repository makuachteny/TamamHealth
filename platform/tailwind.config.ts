import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tamamhealth: {
          navy: '#1E3A8A',
          teal: '#3b82f6',
          sage: '#1B9E77',
          earth: '#D4A843',
          gold: '#E4A84B',
          green: '#1B9E77',
          red: '#C44536',
          cream: '#F8FAFC',
        },
        ss: {
          black: '#0F172A',
          red: '#C44536',
          green: '#1B9E77',
          teal: '#3b82f6',
          yellow: '#E4A84B',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.72)',
          light: 'rgba(255, 255, 255, 0.55)',
          medium: 'rgba(255, 255, 255, 0.35)',
          dark: 'rgba(30, 58, 138, 0.65)',
        },
        accent: {
          DEFAULT: '#3b82f6',
          light: '#60A5FA',
          dark: '#1E40AF',
          glow: 'rgba(59, 130, 246, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Untitled Sans', 'Arial', 'sans-serif'],
        display: ['Untitled Sans', 'Arial', 'sans-serif'],
        mono: ['Fragment Mono', 'monospace'],
      },
      borderRadius: {
        'none': '0px',
        'sm': '2px',
        DEFAULT: '3px',
        'md': '3px',
        'lg': '4px',
        'xl': '5px',
        '2xl': '6px',
        '3xl': '8px',
        'glass': '6px',
        // `full` kept fully round for pills, avatars, and circular badges.
        'full': '9999px',
      },
      backdropBlur: {
        'glass': '24px',
      },
      boxShadow: {
        'glass': '0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04), 0 8px 32px rgba(0, 0, 0, 0.03)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.06), 0 12px 48px rgba(0, 0, 0, 0.04)',
        'accent': '0 2px 8px rgba(59, 130, 246, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out both',
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'fade-in-down': 'fadeInDown 0.4s ease-out both',
        'slide-in-left': 'slideInLeft 0.5s ease-out both',
        'slide-in-right': 'slideInRight 0.5s ease-out both',
        'scale-in': 'scaleIn 0.4s ease-out both',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;

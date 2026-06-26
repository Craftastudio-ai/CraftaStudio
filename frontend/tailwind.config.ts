// CraftaStudio — tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /** Primary brand colours — sourced from CSS variables */
        brand: {
          primary: 'hsl(var(--color-primary) / <alpha-value>)',
          accent: 'hsl(var(--color-accent) / <alpha-value>)',
          purple: '#7c6fee',
          bright: '#9d8ff5',
          glow:   '#c4bcfa',
          dim:    '#4a3fa0',
          mid:    '#6355d4',
        },
        surface: {
          DEFAULT: 'hsl(var(--color-surface) / <alpha-value>)',
          raised: 'hsl(var(--color-surface-raised) / <alpha-value>)',
          overlay: 'hsl(var(--color-surface-overlay) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--color-border) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-fast': 'pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':  'spin 4s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '.5' },
        },
      },
    },
  },
  plugins: [],
}

export default config

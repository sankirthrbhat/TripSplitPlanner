/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f1f5f7',
          100: '#dce5e9',
          200: '#baccd4',
          300: '#94aeb9',
          400: '#6e8c99',
          500: '#53717f',
          600: '#485C66',
          700: '#2E4957',
          800: '#1D3949',
          900: '#142C3A',
          950: '#0D1E28',
        },
        ink: {
          DEFAULT: '#142C3A',
          body: '#485C66',
          muted: '#596D78',
        },
        canvas: {
          DEFAULT: '#F7F6F2',
          subtle: '#F1EFE9',
          border: '#E4E9E7',
        },
        coral: {
          DEFAULT: '#F27A62',
          soft: '#FDF0ED',
          border: '#F7C6BC',
          ink: '#8C2F1D',
        },
        sunshine: {
          DEFAULT: '#F4C95D',
          soft: '#FEF8E8',
          border: '#F7DF9B',
          ink: '#6B4B06',
        },
      },
      boxShadow: {
        card: '0 2px 10px -3px rgba(20, 44, 58, 0.06), 0 1px 3px -1px rgba(20, 44, 58, 0.04)',
        'card-hover': '0 10px 24px -6px rgba(20, 44, 58, 0.10), 0 3px 8px -2px rgba(20, 44, 58, 0.05)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};


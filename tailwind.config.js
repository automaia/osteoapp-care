/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E5F2FF',
          100: '#CCE5FF',
          200: '#99CAFF',
          300: '#66B0FF',
          400: '#3395FF',
          500: '#0A84FF', // Apple Blue
          600: '#0969C6',
          700: '#074F9E',
          800: '#053566',
          900: '#021A33',
        },
        secondary: {
          50: '#E7F9F0',
          100: '#CFF3E0',
          200: '#9FE7C2',
          300: '#6FDBA3',
          400: '#3FCF85',
          500: '#30D158', // Apple Green
          600: '#26A746',
          700: '#1D7D35',
          800: '#135423',
          900: '#0A2A12',
        },
        accent: {
          50: '#FFF1E5',
          100: '#FFE3CC',
          200: '#FFC799',
          300: '#FFAB66',
          400: '#FF8F33',
          500: '#FF9500', // Apple Orange
          600: '#CC7600',
          700: '#995700',
          800: '#663A00',
          900: '#331D00',
        },
        success: '#30D158', // Apple Green
        warning: '#FF9F0A', // Apple Yellow
        error: '#FF453A',   // Apple Red
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 24px rgba(0, 0, 0, 0.12)',
      },
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      height: {
        'screen-small': '100vh',
        'screen-large': 'calc(var(--vh, 1vh) * 100)',
      },
    },
  },
  plugins: [],
};
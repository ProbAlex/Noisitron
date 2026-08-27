/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0b0c10',
          925: '#0e1015',
          900: '#111318',
          850: '#161922',
          800: '#1c202b',
          700: '#272c3a',
          600: '#383f52'
        },
        accent: {
          DEFAULT: '#7c5cff',
          hover: '#8f72ff',
          soft: '#332a5e',
          glow: '#a78bfa'
        }
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        'pop-in': 'pop-in 120ms ease-out',
        'fade-in': 'fade-in 150ms ease-out'
      }
    }
  },
  plugins: []
}

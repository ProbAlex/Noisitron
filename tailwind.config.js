/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0b0c10',
          900: '#111318',
          850: '#161922',
          800: '#1c202b',
          700: '#272c3a',
          600: '#383f52'
        },
        accent: {
          DEFAULT: '#7c5cff',
          hover: '#8f72ff',
          soft: '#332a5e'
        }
      }
    }
  },
  plugins: []
}

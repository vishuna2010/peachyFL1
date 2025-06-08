/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

export default {
  content: [
    './app.vue',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#6b46c1', // Example: A purple shade
        'brand-secondary': '#f0e6ff', // Example: A light purple/lavender
        'brand-accent': '#ff8c00',   // Example: Dark orange for accents
        'neutral-light': '#f7fafc',
        'neutral-medium': '#e2e8f0',
        'neutral-dark': '#a0aec0',
        'text-primary': '#2d3748',
        'text-secondary': '#4a5568',
      },
    },
    fontFamily: {
      sans: ['Poppins', ...defaultTheme.fontFamily.sans],
    },
  },
  plugins: [],
}

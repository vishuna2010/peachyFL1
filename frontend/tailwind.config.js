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
        'venus-background': '#ffffff',
        'venus-text-primary': '#1a1a1a',
        'venus-text-secondary': '#555555',
        'venus-accent-gold': '#b08d57',
        'venus-accent-sale': '#e73387',
        'venus-neutral-light': '#f5f5f5',
        'venus-neutral-medium': '#e0e0e0',
        'venus-neutral-dark': '#333333',
      },
      fontFamily: {
        sans: ['Lato', 'Poppins', ...defaultTheme.fontFamily.sans],
        serif: ['Playfair Display', ...defaultTheme.fontFamily.serif],
      },
    },
  },
  plugins: [],
}

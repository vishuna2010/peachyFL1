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
        'peach-pink': '#FC7099',
        'sky-blue': '#26A7E2',
        'lemon-yellow': '#F9D849',
        'fresh-green': '#5BAA41',
        'orange-gold': '#F6A03C',
        'venus-background': '#FFF5F8', // Using light pastel pink as suggested
        'venus-text-primary': '#1a1a1a', // Keeping existing text colors for now
        'venus-text-secondary': '#555555', // Keeping existing text colors for now
        'venus-neutral-light': '#FAFAFA', // Using suggested neutral
        'venus-neutral-medium': '#e0e0e0', // Keeping for now, can be reviewed
        'venus-neutral-dark': '#333333', // Keeping for now, can be reviewed
      },
      fontFamily: {
        sans: ['Lato', 'Poppins', ...defaultTheme.fontFamily.sans],
        serif: ['Playfair Display', ...defaultTheme.fontFamily.serif],
      },
    },
  },
  plugins: [],
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      // Ensure this matches your backend server's address
      backendBaseUrl: process.env.NUXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:3000',
    }
  },
  css: ['~/assets/css/main.css'],
  modules: [
    // Other modules can be added here if needed
  ],
  postcss: { // Add this section for PostCSS with Tailwind
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
})

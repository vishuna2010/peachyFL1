// frontend/nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  devServer: {
    port: 3001
  },
  runtimeConfig: {
    public: {
      backendBaseUrl: process.env.NUXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:3000',
    }
  },
  css: ['~/assets/css/main.css'],
  modules: [
    // Other modules
  ],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  app: {
    head: {
      // ... your head config ...
    }
  },

  // Add this section for the proxy
  vite: {
    server: {
      proxy: {
        '/api': { // Proxies requests starting with /api
          target: 'http://localhost:3000', // Your backend server address
          changeOrigin: true, // Recommended for most setups
          // If your backend API routes do NOT include /api (e.g. backend expects /products instead of /api/products),
          // you might need a rewrite. But based on your backend setup, it seems your backend routes DO expect /api.
          // So, a rewrite like the one below is likely NOT needed for you if your Express routes start with /api.
          // rewrite: (path) => path.replace(/^\/api/, '')
        },
      },
    },
  },
})
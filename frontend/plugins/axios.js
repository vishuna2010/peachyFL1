import axios from 'axios';

export default defineNuxtPlugin((nuxtApp) => {
  const instance = axios.create({
    baseURL: 'http://localhost:3000/api', // Your backend API
    // You can add other default settings here, like headers
  });

  // Make it available throughout your app
  nuxtApp.provide('axios', instance);
  // Also make it available via $axios (legacy) or directly if needed
  // nuxtApp.$axios = instance; // For options API or if you prefer $axios
});

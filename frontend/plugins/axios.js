import axios from 'axios';
import { defineNuxtPlugin, useRuntimeConfig } from '#app'; // Explicit import for clarity

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const backendBaseUrl = config.public.backendBaseUrl || 'http://localhost:3000'; // Fallback if not set
  const baseURL = `${backendBaseUrl}/api`;

  const instance = axios.create({
    baseURL: baseURL,
    // You can add other default settings here, like headers
  });

  // Make it available throughout your app
  nuxtApp.provide('axios', instance);
  // Also make it available via $axios (legacy) or directly if needed
  // nuxtApp.$axios = instance; // For options API or if you prefer $axios
});

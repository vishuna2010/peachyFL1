import axios from 'axios';
import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app'; // Explicit import for clarity, added useState

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const backendBaseUrl = config.public.backendBaseUrl || 'http://localhost:3000'; // Fallback if not set
  const baseURL = `${backendBaseUrl}/api`;

  const instance = axios.create({
    baseURL: baseURL,
    // You can add other default settings here, like headers
  });

  // Add a request interceptor
  instance.interceptors.request.use(
    (config) => {
      const authTokenState = useState('authToken');
      const token = authTokenState.value;

      console.log('[Axios Interceptor] Current Token:', token ? 'Token Present' : 'Token Missing/Null');
      console.log('[Axios Interceptor] Request URL:', config.url);

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[Axios Interceptor] Authorization header SET');
      } else {
        console.log('[Axios Interceptor] Authorization header NOT SET (no token)');
      }
      return config;
    },
    (error) => {
      console.error('[Axios Interceptor] Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Make it available throughout your app
  nuxtApp.provide('axios', instance);
  // Also make it available via $axios (legacy) or directly if needed
  // nuxtApp.$axios = instance; // For options API or if you prefer $axios
});

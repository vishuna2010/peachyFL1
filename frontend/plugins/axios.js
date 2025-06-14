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
      // Access the authToken state directly
      const authTokenState = useState('authToken'); // Default value (null) can be set in useAuth
      const token = authTokenState.value;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Make it available throughout your app
  nuxtApp.provide('axios', instance);
  // Also make it available via $axios (legacy) or directly if needed
  // nuxtApp.$axios = instance; // For options API or if you prefer $axios
});

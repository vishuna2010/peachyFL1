import axios from 'axios';
import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app'; // Explicit import for clarity, added useState

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const backendBaseUrl = config.public.backendBaseUrl || 'http://localhost:3000'; // Fallback if not set
  const baseURL = `${backendBaseUrl}/api`;

  // Initialize useState hooks in the main plugin scope
  const authTokenState = useState('authToken');
  const authUserState = useState('authUser'); // Assuming user state is also managed by useState

  const instance = axios.create({
    baseURL: baseURL,
    // You can add other default settings here, like headers
  });

  // Add a request interceptor
  instance.interceptors.request.use(
    (config) => {
      // Use authTokenState from the outer scope
      const token = authTokenState.value;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      // It's useful to keep this log for identifying request setup issues.
      console.error('[Axios Interceptor] Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Add a response interceptor
  instance.interceptors.response.use(
    (response) => {
      // Any status code that lie within the range of 2xx cause this function to trigger
      return response;
    },
    async (error) => { // Made async to allow await for navigateTo if needed
      // Any status codes that falls outside the range of 2xx cause this function to trigger
      if (error.response && error.response.status === 401) {
        // Removed console.error for 401 as it's a handled condition.
        // Use authTokenState and authUserState from the outer scope
        if (process.client) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
        }
        authTokenState.value = null;
        authUserState.value = null;

        // Also clear the default header on the instance if it was set,
        // though interceptor should prevent it from being set again without token.
        delete instance.defaults.headers.common['Authorization'];


        // Redirect to login
        if (process.client) {
          // Need to ensure navigateTo is available and used correctly in plugin context
          // nuxtApp.$router might be available depending on Nuxt version and setup
          const router = nuxtApp.$router; // Attempt to get router instance
          if (router && router.currentRoute.value.path !== '/login') {
             try {
                // Using nuxtApp.runWithContext for navigateTo is a good practice from plugins
                await nuxtApp.runWithContext(() => navigateTo('/login', { replace: true }));
             } catch (e) {
                // Fallback if navigateTo within runWithContext fails or is not available
                // Log retained as this indicates a more significant issue with navigation.
                console.error('[Axios Response Interceptor] Error during navigation to login, attempting fallback:', e);
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
             }
          } else if (!router) {
            // Log retained as this indicates an issue with router availability.
            console.warn('[Axios Response Interceptor] Nuxt router not available on nuxtApp.$router. Falling back to window.location for redirect.');
             if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                 window.location.href = '/login';
             }
          }
        }
      }
      return Promise.reject(error);
    }
  );

  // Make it available throughout your app
  nuxtApp.provide('axios', instance);
  // Also make it available via $axios (legacy) or directly if needed
  // nuxtApp.$axios = instance; // For options API or if you prefer $axios
});

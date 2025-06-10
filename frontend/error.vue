<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-neutral-light text-center px-6 py-12 sm:px-8">
    <div v-if="error && error.statusCode === 404">
      <!-- Optional: SVG/Image Illustration Placeholder -->
      <!-- <img src="/path/to/404-illustration.svg" alt="Page not found illustration" class="w-64 h-64 mb-8" /> -->
      <h1 class="text-5xl sm:text-7xl font-extrabold text-brand-primary tracking-tight">404</h1>
      <p class="mt-3 text-2xl sm:text-3xl font-semibold text-text-primary">Page Not Found</p>
      <p class="mt-4 text-base text-text-secondary max-w-md">
        We're sorry, but the page you were looking for couldn't be found. It might have been removed, had its name changed, or is temporarily unavailable.
      </p>
    </div>
    <div v-else>
      <!-- Optional: SVG/Image Illustration Placeholder for general error -->
      <!-- <img src="/path/to/error-illustration.svg" alt="Error illustration" class="w-64 h-64 mb-8" /> -->
      <h1 class="text-4xl sm:text-5xl font-extrabold text-red-600 tracking-tight">Error {{ error ? error.statusCode : '' }}</h1>
      <p class="mt-3 text-xl sm:text-2xl font-semibold text-text-primary">Oops! Something went wrong.</p>
      <p class="mt-4 text-base text-text-secondary max-w-md">
        {{ error && error.message ? error.message : 'An unexpected error occurred on our end. Please try again later or contact support if the issue persists.' }}
      </p>
    </div>
    <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
      <NuxtLink
        to="/"
        class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-brand-primary text-white text-base font-medium rounded-md shadow-sm hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
      >
        Go Back Home
      </NuxtLink>
      <button
        v-if="error && error.statusCode !== 404"
        @click="handleErrorClear"
        class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-neutral-dark text-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue'; // Added computed
import { useRouter, useError, useHead, clearError } from '#app'; // useError for clearError, added clearError

const props = defineProps({
  error: Object
});

const pageTitle = computed(() =>
  props.error?.statusCode === 404
    ? '404 - Page Not Found'
    : `Error ${props.error?.statusCode || 'Occurred'}`
);

const pageDescription = computed(() =>
  props.error?.statusCode === 404
    ? "The page you are looking for does not exist."
    : (props.error?.message || "An unexpected error occurred.")
);

useHead({
  title: pageTitle.value,
  meta: [
    { name: 'description', content: pageDescription.value }
  ]
});

// const router = useRouter(); // Not explicitly used in this version of handleErrorClear
// const nuxtError = useError(); // Not explicitly used if clearError is imported directly

const handleErrorClear = () => {
  clearError({ redirect: '/' });
};
</script>

<template>
  <div class="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))] bg-venus-background">
    <h2 class="text-2xl sm:text-3xl font-serif font-bold text-venus-text-primary mb-8 text-center">Setup Two-Factor Authentication (2FA)</h2>

    <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-medium">
      <h3 class="text-xl font-serif font-semibold text-venus-text-primary mb-4">2FA Setup Page</h3>
      <p class="text-venus-text-secondary mb-4">This is a simplified version of the 2FA setup page.</p>
      
      <div class="space-y-4">
        <NuxtLink
          to="/profile"
          class="inline-block px-6 py-3 border border-neutral-medium text-venus-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors"
        >
          Back to Profile
        </NuxtLink>
        
        <button
          @click="testFunction"
          class="ml-4 inline-block px-6 py-3 bg-peach-pink text-white rounded-md hover:bg-peach-pink/90 transition-colors"
        >
          Test Button
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const testFunction = () => {
  // Test function - can be removed in production
};
</script>

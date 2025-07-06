<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))] bg-venus-background">
    <h1 class="text-3xl sm:text-4xl font-serif font-bold text-venus-text-primary mb-10 text-center">Test Page</h1>
    
    <div class="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-neutral-medium">
      <h2 class="text-2xl font-serif font-semibold text-venus-text-primary mb-6">This is a test page</h2>
      <p class="text-venus-text-secondary mb-4">If you can see this, the routing is working correctly.</p>
      
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
  // Test function removed
};
</script> 
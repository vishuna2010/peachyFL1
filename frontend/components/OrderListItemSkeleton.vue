<template>
  <div class="bg-white shadow-md rounded-lg p-4 sm:p-6 border border-neutral-medium animate-pulse">
    <!-- Top section -->
    <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-3 pb-3 border-b border-neutral-light">
      <div>
        <!-- Order ID Placeholder -->
        <div class="h-6 bg-gray-300 rounded w-32 sm:w-40 mb-2"></div>
        <!-- Date Placeholder -->
        <div class="h-3 bg-gray-300 rounded w-40 sm:w-48"></div>
      </div>
      <!-- Status Placeholder -->
      <div class="h-6 bg-gray-300 rounded-full w-20 sm:w-24 mt-2 sm:mt-0 self-start sm:self-center"></div>
    </div>

    <!-- Middle section -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
      <!-- Total Amount Placeholder -->
      <div class="h-4 bg-gray-300 rounded w-4/5 sm:w-3/5"></div>
      <!-- Item Count Placeholder -->
      <div class="h-4 bg-gray-300 rounded w-3/5 sm:w-2/5"></div>
    </div>

    <!-- Bottom section -->
    <div class="text-right mt-3">
      <!-- View Details Button Placeholder -->
      <div class="h-9 w-28 bg-gray-300 rounded-md inline-block"></div>
    </div>
  </div>
</template>

<script setup>
// No script logic needed for this simple skeleton component
</script>

<style scoped>
/* All styling is handled by Tailwind CSS utility classes */
</style>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
    <div class="md:grid md:grid-cols-5 lg:grid-cols-2 gap-8 lg:gap-12">
      <!-- Image Column Skeleton -->
      <div class="md:col-span-3 lg:col-span-1">
        <div class="w-full h-[400px] md:h-[550px] bg-gray-300 rounded-lg aspect-[4/5]"></div>
        <!-- Thumbnail Gallery Skeleton -->
        <div class="mt-4 flex items-center justify-center space-x-2 sm:space-x-3 py-2 px-1">
          <div class="h-16 w-16 sm:h-20 sm:w-20 bg-gray-300 rounded-md"></div>
          <div class="h-16 w-16 sm:h-20 sm:w-20 bg-gray-300 rounded-md"></div>
          <div class="h-16 w-16 sm:h-20 sm:w-20 bg-gray-300 rounded-md"></div>
          <div class="h-16 w-16 sm:h-20 sm:w-20 bg-gray-300 rounded-md hidden sm:block"></div>
        </div>
      </div>

      <!-- Details Column Skeleton -->
      <div class="md:col-span-2 lg:col-span-1 py-4 md:py-0">
        <!-- Product Title Skeleton -->
        <div class="h-10 bg-gray-300 rounded w-3/4 mb-3"></div>
        <!-- SKU Skeleton -->
        <div class="h-4 bg-gray-300 rounded w-1/4 mb-6"></div>

        <!-- Description Skeleton -->
        <div class="space-y-2 mb-6">
          <div class="h-4 bg-gray-300 rounded w-full"></div>
          <div class="h-4 bg-gray-300 rounded w-full"></div>
          <div class="h-4 bg-gray-300 rounded w-5/6"></div>
          <div class="h-4 bg-gray-300 rounded w-3/4"></div>
        </div>

        <!-- Price Skeleton -->
        <div class="h-10 bg-gray-300 rounded w-1/3 mb-8"></div>

        <!-- Category & Tags Skeleton -->
        <div class="h-4 bg-gray-300 rounded w-1/2 mb-3"></div>
        <div class="flex space-x-2 mb-6">
          <div class="h-5 bg-gray-300 rounded-full w-16"></div>
          <div class="h-5 bg-gray-300 rounded-full w-20"></div>
          <div class="h-5 bg-gray-300 rounded-full w-12"></div>
        </div>

        <!-- Product Options Skeleton (Simplified) -->
        <div class="space-y-4 mb-6">
          <div class="h-6 bg-gray-300 rounded w-1/4 mb-2"></div> <!-- Option Label -->
          <div class="flex flex-wrap gap-2">
            <div class="h-10 w-16 bg-gray-300 rounded-md"></div>
            <div class="h-10 w-20 bg-gray-300 rounded-md"></div>
            <div class="h-10 w-12 bg-gray-300 rounded-md"></div>
          </div>
          <div class="h-6 bg-gray-300 rounded w-1/4 mb-2 mt-4"></div> <!-- Another Option Label -->
           <div class="flex flex-wrap gap-2">
            <div class="h-10 w-16 bg-gray-300 rounded-md"></div>
            <div class="h-10 w-20 bg-gray-300 rounded-md"></div>
          </div>
        </div>

        <!-- Stock Status Skeleton -->
        <div class="h-10 bg-gray-300 rounded-md w-1/2 mb-6"></div>

        <!-- Quantity & Add to Cart Skeleton -->
        <div class="flex items-center gap-4 my-6">
          <div class="w-20 h-12 bg-gray-300 rounded-md"></div> <!-- Quantity Input -->
          <div class="flex-grow h-12 bg-gray-300 rounded-lg"></div> <!-- Add to Cart Button -->
        </div>

        <!-- Back Link Skeleton -->
        <div class="h-5 bg-gray-300 rounded w-1/3 mt-8"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
// No script logic needed for a pure skeleton component
</script>

<style scoped>
/* All styling is handled by Tailwind CSS utility classes */
</style>

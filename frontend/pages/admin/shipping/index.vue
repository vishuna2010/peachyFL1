<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Shipping Management</h1>
      <p class="text-gray-600">Manage shipping couriers, methods, and options</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Couriers Card -->
      <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div class="flex items-center mb-4">
          <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v.958m12.013 0v11.177m-12.013 0v-11.177" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900">Couriers</h3>
        </div>
        <p class="text-gray-600 mb-4">Manage shipping couriers and their contact information</p>
        <NuxtLink 
          to="/admin/shipping/couriers"
          class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          Manage Couriers
          <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <!-- Methods Card -->
      <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div class="flex items-center mb-4">
          <div class="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
            <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900">Shipping Methods</h3>
        </div>
        <p class="text-gray-600 mb-4">Configure shipping methods and their rates</p>
        <NuxtLink 
          to="/admin/shipping/methods"
          class="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
        >
          Manage Methods
          <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <!-- Options Card -->
      <div class="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div class="flex items-center mb-4">
          <div class="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
            <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900">Shipping Options</h3>
        </div>
        <p class="text-gray-600 mb-4">Set up shipping options and preferences</p>
        <NuxtLink 
          to="/admin/shipping/options"
          class="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
        >
          Manage Options
          <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'admin'
})
</script> 
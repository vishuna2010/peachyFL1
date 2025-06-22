<template>
  <header class="bg-white shadow-md sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
      <!-- Logo -->
      <NuxtLink to="/" class="text-2xl font-serif text-peach-pink flex items-center">
        <img v-if="logoUrl" :src="logoUrl" alt="Site Logo" class="h-10 mr-2" />
        <span v-else>YOUR_LOGO</span> <!-- Fallback text if logo URL isn't loaded -->
      </NuxtLink>

      <!-- Navigation Links -->
      <nav class="hidden md:flex space-x-6 items-center">
        <NuxtLink to="#" class="text-venus-text-primary hover:text-peach-pink relative group font-medium transition-colors duration-200 ease-in-out">
          <span>New</span>
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-peach-pink scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out origin-left"></span>
        </NuxtLink>
        <NuxtLink to="#" class="text-venus-text-primary hover:text-peach-pink relative group font-medium transition-colors duration-200 ease-in-out">
          <span>Tops</span>
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-peach-pink scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out origin-left"></span>
        </NuxtLink>
        <NuxtLink to="#" class="text-venus-text-primary hover:text-peach-pink relative group font-medium transition-colors duration-200 ease-in-out">
          <span>Dresses</span>
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-peach-pink scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out origin-left"></span>
        </NuxtLink>
        <NuxtLink to="#" class="text-venus-text-primary hover:text-peach-pink relative group font-medium transition-colors duration-200 ease-in-out">
          <span>Swim</span>
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-peach-pink scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out origin-left"></span>
        </NuxtLink>
        <NuxtLink to="#" class="text-orange-gold hover:text-peach-pink relative group font-bold transition-colors duration-200 ease-in-out">
          <span>Sale</span>
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-peach-pink scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out origin-left"></span>
        </NuxtLink>
      </nav>

      <!-- Action Icons -->
      <div class="flex items-center space-x-4">
        <button aria-label="Search" class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </button>
        <NuxtLink to="/profile" aria-label="My Account" class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </NuxtLink>
        <NuxtLink to="/cart" aria-label="Cart" class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp } from '#app';

const { $axios } = useNuxtApp();
const logoUrl = ref(null);
const siteName = ref('Venus'); // Default site name, can also be fetched if needed

onMounted(async () => {
  try {
    const response = await $axios.get('/settings/logo');
    if (response.data && response.data.logoUrl) {
      logoUrl.value = response.data.logoUrl;
    } else {
      console.warn('Logo URL not found in API response, using default or placeholder text.');
      // Optionally set a local placeholder if the API fails or S3 URL is invalid
      // logoUrl.value = '/path/to/local/placeholder_logo.svg';
    }
  } catch (error) {
    console.error('Failed to fetch logo URL:', error);
    // Optionally set a local placeholder on error
    // logoUrl.value = '/path/to/local/placeholder_logo.svg';
  }
});

// You can also fetch other settings like siteName if you add them to the /api/settings/all endpoint
// onMounted(async () => {
//   try {
//     const response = await $axios.get('/settings/all'); // Example if you have an /all endpoint
//     if (response.data) {
//       logoUrl.value = response.data.logoUrl;
//       siteName.value = response.data.siteName || 'My Store';
//     }
//   } catch (error) {
//     console.error('Failed to fetch settings:', error);
//   }
// });
</script>

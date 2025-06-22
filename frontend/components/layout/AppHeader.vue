<template>
  <header class="bg-white shadow-md sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
      <!-- Logo -->
      <NuxtLink to="/" class="text-2xl font-serif text-peach-pink">
        YOUR_LOGO <!-- Placeholder for actual logo/name -->
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
// No complex script needed for this simplified version
</script>

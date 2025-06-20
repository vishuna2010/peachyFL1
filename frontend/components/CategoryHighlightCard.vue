<template>
  <NuxtLink :to="categoryLink" class="block group relative rounded-sm overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
    <img :src="imageUrl" :alt="categoryName" class="w-full h-80 object-cover transform group-hover:scale-105 transition-transform duration-300" />
    <div class="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-colors duration-300 flex items-end">
      <div class="p-6">
        <h3 class="text-white text-2xl font-serif font-semibold group-hover:underline">{{ categoryName }}</h3>
        <p class="text-venus-neutral-light text-sm mt-1 opacity-90 group-hover:opacity-100">Shop Now &rarr;</p>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
defineProps({
  categoryName: { type: String, required: true },
  imageUrl: { type: String, required: true },
  categoryLink: { type: String, required: true }
});
</script>

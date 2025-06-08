<template>
  <div class="relative bg-neutral-dark overflow-hidden text-white min-h-[300px] md:min-h-[400px] flex items-center justify-center">
    <!-- Background Image -->
    <img
      :src="imageUrl"
      :alt="title || 'Hero background'"
      class="absolute inset-0 w-full h-full object-cover z-0"
    />
    <!-- Overlay for contrast -->
    <div class="absolute inset-0 bg-black bg-opacity-50 z-10"></div>

    <!-- Content -->
    <div class="relative z-20 text-center p-6 md:p-8">
      <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight" v-if="title">
        {{ title }}
      </h1>
      <p class="text-lg sm:text-xl md:text-2xl text-neutral-light mb-8 max-w-2xl mx-auto" v-if="subtitle">
        {{ subtitle }}
      </p>
      <NuxtLink
        v-if="buttonText && buttonLink"
        :to="buttonLink"
        class="bg-brand-primary hover:bg-opacity-80 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-300 shadow-lg hover:shadow-xl"
      >
        {{ buttonText }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  buttonText: {
    type: String,
    required: true
  },
  buttonLink: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  }
});
</script>

<style scoped>
/* Scoped styles could be added here if needed for very specific effects,
   but Tailwind utilities are preferred. For example, complex text shadows
   or custom animations. */
</style>

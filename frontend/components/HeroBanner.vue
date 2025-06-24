<template>
  <div class="bg-peach-pink text-white overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center justify-center">
    <!-- Content -->
    <div class="text-center p-6 md:p-8">
      <h1 ref="titleRef" class="text-4xl sm:text-5xl md:text-6xl font-bold font-serif mb-4 leading-tight opacity-0 translate-y-5 transition-all duration-1000 ease-in-out" v-if="title">
        {{ title }}
      </h1>
      <p ref="subtitleRef" class="text-lg sm:text-xl md:text-2xl text-white mb-8 max-w-2xl mx-auto opacity-0 translate-y-5 transition-all duration-1000 ease-in-out delay-300" v-if="subtitle">
        {{ subtitle }}
      </p>
      <NuxtLink
        ref="buttonRef"
        v-if="buttonText && buttonLink"
        :to="buttonLink"
        class="bg-white text-peach-pink hover:bg-gray-100 font-sans font-semibold py-3 px-8 rounded-md text-base transition-colors duration-300 shadow-md hover:shadow-lg opacity-0 translate-y-5 transition-all duration-1000 ease-in-out delay-500"
      >
        {{ buttonText }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';

// imageUrl prop is no longer used directly in the template for background
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
  imageUrl: { // Kept for prop compatibility, though not used in this version
    type: String,
    // required: true // No longer required if we go full color background
  }
});

const titleRef = ref(null);
const subtitleRef = ref(null);
const buttonRef = ref(null);
// backgroundImageRef is no longer needed

onMounted(() => {
  nextTick(() => {
    if (titleRef.value) {
      titleRef.value.classList.remove('opacity-0', 'translate-y-5');
      titleRef.value.classList.add('opacity-100', 'translate-y-0');
    }
    if (subtitleRef.value) {
      subtitleRef.value.classList.remove('opacity-0', 'translate-y-5');
      subtitleRef.value.classList.add('opacity-100', 'translate-y-0');
    }
    if (buttonRef.value && buttonRef.value.$el) {
      buttonRef.value.$el.classList.remove('opacity-0', 'translate-y-5');
      buttonRef.value.$el.classList.add('opacity-100', 'translate-y-0');
    }
    // Animation for backgroundImageRef removed
  });
});
</script>

<style scoped>
/* Scoped styles could be added here if needed for very specific effects,
   but Tailwind utilities are preferred. For example, complex text shadows
   or custom animations. */
</style>

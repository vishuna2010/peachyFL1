<template>
  <div class="relative bg-neutral-dark overflow-hidden text-white min-h-[300px] md:min-h-[400px] flex items-center justify-center">
    <!-- Background Image -->
    <img
      ref="backgroundImageRef"
      :src="imageUrl"
      :alt="title || 'Hero background'"
      class="absolute inset-0 w-full h-full object-cover z-0 scale-110 transform transition-transform duration-[7000ms] ease-out"
    />
    <!-- Overlay for contrast -->
    <div class="absolute inset-0 bg-black bg-opacity-50 z-10"></div>

    <!-- Content -->
    <div class="relative z-20 text-center p-6 md:p-8">
      <h1 ref="titleRef" class="text-4xl sm:text-5xl md:text-6xl font-bold font-serif mb-4 leading-tight opacity-0 translate-y-5 transition-all duration-1000 ease-in-out" v-if="title">
        {{ title }}
      </h1>
      <p ref="subtitleRef" class="text-lg sm:text-xl md:text-2xl text-neutral-light mb-8 max-w-2xl mx-auto opacity-0 translate-y-5 transition-all duration-1000 ease-in-out delay-300" v-if="subtitle">
        {{ subtitle }}
      </p>
      <NuxtLink
        ref="buttonRef"
        v-if="buttonText && buttonLink"
        :to="buttonLink"
        class="bg-venus-text-primary text-white hover:bg-venus-accent-gold font-sans font-semibold py-3 px-8 rounded-sm text-base transition-colors duration-300 shadow-md hover:shadow-lg opacity-0 translate-y-5 transition-all duration-1000 ease-in-out delay-500"
      >
        {{ buttonText }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';

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

const titleRef = ref(null);
const subtitleRef = ref(null);
const buttonRef = ref(null);
const backgroundImageRef = ref(null);

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
    if (buttonRef.value) {
      buttonRef.value.classList.remove('opacity-0', 'translate-y-5');
      buttonRef.value.classList.add('opacity-100', 'translate-y-0');
    }
    if (backgroundImageRef.value) {
      backgroundImageRef.value.classList.remove('scale-110');
      backgroundImageRef.value.classList.add('scale-100');
    }
  });
});
</script>

<style scoped>
/* Scoped styles could be added here if needed for very specific effects,
   but Tailwind utilities are preferred. For example, complex text shadows
   or custom animations. */
</style>

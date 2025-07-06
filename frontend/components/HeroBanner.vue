<template>
  <div
    v-if="isLoading"
    class="bg-gray-200 text-gray-500 overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center"
  >
    Loading promotions...
  </div>
  <div
    v-else-if="error"
    class="bg-red-100 text-red-700 overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center p-4"
  >
    <p>Error: {{ error }}</p>
  </div>
  <div
    v-else-if="currentBanner"
    :style="{ backgroundImage: currentBanner.imageUrl ? `url(${currentBanner.imageUrl})` : '' }"
    class="relative bg-peach-pink text-white overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center bg-cover bg-center"
  >
    <!-- Overlay for better text readability if using a background image -->
    <div class="absolute inset-0 bg-black opacity-30" v-if="currentBanner.imageUrl"></div>

    <!-- Content -->
    <div class="relative text-center p-6 md:p-8 z-10">
      <h1
        ref="titleRef"
        class="text-4xl sm:text-5xl md:text-6xl font-bold font-serif mb-4 leading-tight opacity-0 translate-y-5 transition-all duration-1000 ease-in-out"
        v-if="currentBanner.title"
      >
        {{ currentBanner.title }}
      </h1>
      <p
        ref="subtitleRef"
        class="text-lg sm:text-xl md:text-2xl text-white mb-8 max-w-2xl mx-auto opacity-0 translate-y-5 transition-all duration-1000 ease-in-out delay-300"
        v-if="currentBanner.subtitle"
      >
        {{ currentBanner.subtitle }}
      </p>
      <NuxtLink
        ref="buttonRef"
        v-if="currentBanner.buttonText && currentBanner.buttonLink"
        :to="currentBanner.buttonLink"
        class="bg-white text-peach-pink hover:bg-gray-100 font-sans font-semibold py-3 px-8 rounded-md text-base transition-colors duration-300 shadow-md hover:shadow-lg opacity-0 translate-y-5 transition-all duration-1000 ease-in-out delay-500"
      >
        {{ currentBanner.buttonText }}
      </NuxtLink>
    </div>

    <!-- Navigation Arrows (only show if multiple banners) -->
    <div v-if="banners.length > 1" class="absolute inset-x-0 top-1/2 transform -translate-y-1/2 flex justify-between items-center px-4 z-20">
      <button
        @click="prevBanner"
        class="bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-full transition-all duration-300 transform hover:scale-110"
        aria-label="Previous banner"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>
      <button
        @click="nextBanner"
        class="bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-full transition-all duration-300 transform hover:scale-110"
        aria-label="Next banner"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    </div>

    <!-- Indicators (only show if multiple banners) -->
    <div v-if="banners.length > 1" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
      <button
        v-for="(banner, index) in banners"
        :key="index"
        @click="goToBanner(index)"
        :class="[
          'w-3 h-3 rounded-full transition-all duration-300',
          currentBannerIndex === index 
            ? 'bg-white scale-125' 
            : 'bg-white bg-opacity-50 hover:bg-opacity-75'
        ]"
        :aria-label="`Go to banner ${index + 1}`"
      ></button>
    </div>

    <!-- Pause/Play Button (only show if multiple banners) -->
    <div v-if="banners.length > 1" class="absolute top-4 right-4 z-20">
      <button
        @click="toggleAutoPlay"
        class="bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-full transition-all duration-300"
        :aria-label="isAutoPlaying ? 'Pause slideshow' : 'Play slideshow'"
      >
        <svg v-if="isAutoPlaying" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path>
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </button>
    </div>
  </div>
  <div
    v-else
    class="bg-gray-100 text-gray-600 overflow-hidden min-h-[400px] md:min-h-[600px] flex items-center justify-center p-4"
  >
    No current promotions. Check back soon!
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, onUnmounted, watch } from 'vue';
import { useNuxtApp } from '#app';

const { $axios } = useNuxtApp();

const banners = ref([]);
const currentBannerIndex = ref(0);
const isLoading = ref(true);
const error = ref(null);
const isAutoPlaying = ref(true);
const autoPlayInterval = ref(null);

// Refs for animation targets
const titleRef = ref(null);
const subtitleRef = ref(null);
const buttonRef = ref(null);

const currentBanner = computed(() => {
  if (banners.value.length > 0 && banners.value[currentBannerIndex.value]) {
    return banners.value[currentBannerIndex.value];
  }
  return null;
});

const fetchBanners = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    // TODO: Replace with actual API endpoint if different
    const response = await $axios.get('/cms/hero-banners/active');
    if (response.data && Array.isArray(response.data.banners)) {
      banners.value = response.data.banners;
      if (banners.value.length === 0) {
        // No active banners fetched from API
      }
    } else {
      banners.value = [];
    }
  } catch (err) {
    error.value = 'Failed to load promotional content. Please try again later.';
    banners.value = [];
  } finally {
    isLoading.value = false;
  }
};

const applyAnimations = () => {
  nextTick(() => {
    if (titleRef.value) {
      titleRef.value.classList.remove('opacity-0', 'translate-y-5');
      titleRef.value.classList.add('opacity-100', 'translate-y-0');
    }
    if (subtitleRef.value) {
      subtitleRef.value.classList.remove('opacity-0', 'translate-y-5');
      subtitleRef.value.classList.add('opacity-100', 'translate-y-0');
    }
    const buttonElement = buttonRef.value?.$el || buttonRef.value;
    if (buttonElement) {
        buttonElement.classList.remove('opacity-0', 'translate-y-5');
        buttonElement.classList.add('opacity-100', 'translate-y-0');
    }
  });
};

const nextBanner = () => {
  if (banners.value.length > 1) {
    currentBannerIndex.value = (currentBannerIndex.value + 1) % banners.value.length;
    applyAnimations();
  }
};

const prevBanner = () => {
  if (banners.value.length > 1) {
    currentBannerIndex.value = currentBannerIndex.value === 0 
      ? banners.value.length - 1 
      : currentBannerIndex.value - 1;
    applyAnimations();
  }
};

const goToBanner = (index) => {
  if (index >= 0 && index < banners.value.length) {
    currentBannerIndex.value = index;
    applyAnimations();
  }
};

const toggleAutoPlay = () => {
  isAutoPlaying.value = !isAutoPlaying.value;
  if (isAutoPlaying.value) {
    startAutoPlay();
  } else {
    stopAutoPlay();
  }
};

const startAutoPlay = () => {
  if (banners.value.length > 1) {
    stopAutoPlay(); // Clear any existing interval
    autoPlayInterval.value = setInterval(() => {
      nextBanner();
    }, 5000); // Change banner every 5 seconds
  }
};

const stopAutoPlay = () => {
  if (autoPlayInterval.value) {
    clearInterval(autoPlayInterval.value);
    autoPlayInterval.value = null;
  }
};

// Watch for banner changes to restart autoplay if needed
watch(() => banners.value.length, (newLength) => {
  if (newLength > 1 && isAutoPlaying.value) {
    startAutoPlay();
  } else {
    stopAutoPlay();
  }
});

onMounted(async () => {
  await fetchBanners();
  if (currentBanner.value) {
    applyAnimations();
    
    // Start autoplay if multiple banners
    if (banners.value.length > 1) {
      startAutoPlay();
    }
  }
});

onUnmounted(() => {
  stopAutoPlay();
});
</script>

<style scoped>
/* Scoped styles could be added here if needed for very specific effects,
   but Tailwind utilities are preferred. For example, complex text shadows
   or custom animations. */
</style>

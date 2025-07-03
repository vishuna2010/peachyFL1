<template>
  <div
    v-if="isLoading"
    class="bg-gray-200 text-gray-500 overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center justify-center"
  >
    Loading promotions...
  </div>
  <div
    v-else-if="error"
    class="bg-red-100 text-red-700 overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center justify-center p-4"
  >
    <p>Error: {{ error }}</p>
  </div>
  <div
    v-else-if="currentBanner"
    :style="{ backgroundImage: currentBanner.imageUrl ? `url(${currentBanner.imageUrl})` : '' }"
    class="bg-peach-pink text-white overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center justify-center bg-cover bg-center"
  >
   

    <!-- Content -->
    <div class="relative text-center p-6 md:p-8 z-10"> {/* Added z-10 here */}
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
  </div>
  <div
    v-else
    class="bg-gray-100 text-gray-600 overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center justify-center p-4"
  >
    No current promotions. Check back soon!
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import { useNuxtApp } from '#app';

const { $axios } = useNuxtApp();

const banners = ref([]);
const currentBannerIndex = ref(0);
const isLoading = ref(true);
const error = ref(null);

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
        console.log('HeroBanner: No active banners fetched from API.');
        // Optional: set a specific message or let the template handle empty state
      }
    } else {
      console.warn('HeroBanner: Unexpected API response structure or no banners array.', response.data);
      banners.value = []; // Ensure banners is an array
    }
  } catch (err) {
    console.error('HeroBanner: Error fetching banners:', err);
    error.value = 'Failed to load promotional content. Please try again later.';
    banners.value = []; // Ensure banners is an array on error
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
    // For NuxtLink, $el might not be immediately available if it's a component wrapper.
    // Accessing the actual DOM element might require a more robust approach if issues arise.
    // For now, assuming buttonRef.value is the direct DOM element or $el is reliable.
    const buttonElement = buttonRef.value?.$el || buttonRef.value;
    if (buttonElement) {
        buttonElement.classList.remove('opacity-0', 'translate-y-5');
        buttonElement.classList.add('opacity-100', 'translate-y-0');
    }
  });
};


onMounted(async () => {
  await fetchBanners();
  if (currentBanner.value) {
    console.log('HeroBanner: Current Banner Data for Link:', JSON.parse(JSON.stringify(currentBanner.value))); // Log the banner data
    // Apply animations once the first banner is loaded
    // A watcher on currentBanner might be more robust if we implement a carousel
    applyAnimations();
  } else {
    console.log('HeroBanner: No current banner to display after fetch.');
  }
});

// TODO: Implement carousel logic if multiple banners (nextBanner, prevBanner functions)
// For now, it will just show the first banner.
// If implementing carousel, call applyAnimations() whenever currentBanner changes.

</script>

<style scoped>
/* Scoped styles could be added here if needed for very specific effects,
   but Tailwind utilities are preferred. For example, complex text shadows
   or custom animations. */
</style>

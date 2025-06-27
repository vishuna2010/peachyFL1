<template>
  <div v-if="isVisible" class="fixed inset-0 z-[60] overflow-y-auto bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all p-6">
      <div class="flex justify-between items-center mb-4">
        <h4 class="text-lg font-medium text-gray-900">Choose an Image from Product Gallery</h4>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div v-if="isLoading" class="text-center py-10">
        <p class="text-gray-500">Loading gallery images...</p>
        <!-- Spinner can be added -->
      </div>
      <div v-else-if="error" class="my-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg">
        <p>Error: {{ error }}</p>
      </div>
      <div v-else-if="galleryImages.length === 0" class="text-center py-10 text-gray-500">
        <p>No images found in the product gallery.</p>
        <p class="text-xs mt-1">Upload images to the main product gallery first.</p>
      </div>
      <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto p-1">
        <div
          v-for="image in galleryImages"
          :key="image.id"
          @click="selectImage(image.image_url)"
          class="cursor-pointer border-2 border-transparent hover:border-indigo-500 focus:border-indigo-500 rounded-md p-1 transition-all duration-150"
          tabindex="0"
          @keypress.enter="selectImage(image.image_url)"
        >
          <img :src="image.image_url" :alt="image.alt_text || 'Gallery image'" class="w-full h-28 object-cover rounded-md" />
          <p v-if="image.is_primary" class="mt-1 text-center text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded-full">Primary</p>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button @click="$emit('close')" type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, toRefs } from 'vue';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true,
  },
  isVisible: {
    type: Boolean,
    default: false,
  }
});

const emit = defineEmits(['image-selected', 'close']);

const { productId, isVisible } = toRefs(props);
const { $axios } = useNuxtApp();
const toast = useToast();

const galleryImages = ref([]);
const isLoading = ref(false);
const error = ref(null);

async function fetchGalleryImages() {
  if (!productId.value) {
    galleryImages.value = [];
    error.value = "Product ID is missing.";
    return;
  }
  isLoading.value = true;
  error.value = null;
  try {
    const response = await $axios.get(`/admin/products/${productId.value}/images`);
    galleryImages.value = response.data;
  } catch (err) {
    console.error('Error fetching gallery images for picker:', err);
    error.value = err.response?.data?.message || 'Could not load gallery images.';
    toast.error(error.value);
    galleryImages.value = []; // Clear on error
  } finally {
    isLoading.value = false;
  }
}

function selectImage(imageUrl) {
  emit('image-selected', imageUrl);
  emit('close'); // Automatically close after selection
}

watch(isVisible, (newValue) => {
  if (newValue && productId.value) {
    fetchGalleryImages();
  } else if (!newValue) {
    // Optional: Clear images when modal is hidden to save memory or ensure fresh load next time
    // galleryImages.value = [];
    // error.value = null;
  }
}, { immediate: true }); // Immediate true might try to fetch if initially visible and productId is set

watch(productId, (newProductId) => {
    if (isVisible.value && newProductId) {
        fetchGalleryImages();
    }
});

</script>

<style scoped>
/* Scoped styles if needed */
</style>

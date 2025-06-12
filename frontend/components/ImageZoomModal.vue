<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black bg-opacity-80 transition-opacity duration-300 ease-in-out"
    @click.self="closeModal"
    aria-labelledby="image-zoom-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="relative bg-white p-2 sm:p-3 rounded-lg shadow-xl max-w-4xl w-auto max-h-[90vh] flex flex-col items-center">
      <button
        @click="closeModal"
        class="absolute -top-3 -right-3 sm:top-2 sm:right-2 z-10 p-1.5 bg-gray-700 text-white rounded-full hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white transition-colors"
        aria-label="Close image zoom modal"
      >
        <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      <img
        :src="imageUrl"
        alt="Zoomed product image"
        class="block object-contain max-w-full max-h-[calc(90vh-4rem)] sm:max-h-[calc(90vh-5rem)] rounded"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
  isOpen: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close']);

const closeModal = () => {
  emit('close');
};

const handleEscapeKey = (event) => {
  if (event.key === 'Escape' && props.isOpen) {
    closeModal();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscapeKey);
});
</script>

<style scoped>
/* Ensure the modal appears above other content */
.fixed {
  z-index: 1050; /* Bootstrap's modal z-index is often 1050, ensure it's high enough */
}
</style>

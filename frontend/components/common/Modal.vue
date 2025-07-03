<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center"
    @click.self="handleOverlayClick"
  >
    <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-auto my-8 p-6">
      <!-- Modal Header -->
      <div class="flex items-start justify-between mb-4">
        <h3 v-if="title" class="text-xl font-semibold text-gray-800">
          {{ title }}
        </h3>
        <button
          @click="closeModal"
          class="text-gray-400 hover:text-gray-600 transition-colors ml-auto p-1 rounded-full hover:bg-gray-100"
          aria-label="Close modal"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="text-sm text-gray-700">
        <slot>Default modal content.</slot>
      </div>

      <!-- Modal Footer (optional, can be part of the slot) -->
      <div v-if="$slots.footer" class="mt-6">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  closeOnOverlayClick: {
    type: Boolean,
    default: true, // Standard behavior
  }
});

const emit = defineEmits(['close']);

const closeModal = () => {
  emit('close');
};

const handleOverlayClick = () => {
  if (props.closeOnOverlayClick) {
    closeModal();
  }
};

// Handle Escape key to close modal
const handleEsc = (event) => {
  if (event.key === 'Escape' && props.isOpen) {
    closeModal();
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  } else {
    document.body.style.overflow = '';
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleEsc);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc);
  document.body.style.overflow = ''; // Ensure body scroll is restored
});
</script>

<style scoped>
/* Add any specific modal styling if needed */
.fixed {
  /* Ensure it covers the whole screen */
}
</style>

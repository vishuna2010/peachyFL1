<template>
  <div class="bg-white p-5 rounded-lg shadow-md border border-neutral-200 flex items-start space-x-4 transition-all duration-300 ease-in-out hover:shadow-lg">
    <div v-if="iconName"
         class="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full text-brand-primary"
         :class="iconBackgroundClass"
         >
      <!-- Simple text icon from first letter, or placeholder for actual SVG icon -->
      <span class="text-xl font-bold">{{ iconName.charAt(0).toUpperCase() }}</span>
      <!-- Example for actual SVG: <component :is="dynamicIconComponent" class="h-6 w-6" /> -->
    </div>
    <div class="flex-grow">
      <p class="text-sm font-medium text-text-secondary truncate group-hover:text-text-primary">{{ title }}</p>
      <p v-if="isLoading" class="text-2xl sm:text-3xl font-bold text-gray-400 animate-pulse">...</p>
      <p v-else class="text-2xl sm:text-3xl font-bold text-text-primary group-hover:text-brand-primary">{{ value }}</p>
      <div v-if="trend && !isLoading" class="text-xs mt-1 flex items-center" :class="trendDirection === 'up' ? 'text-green-600' : trendDirection === 'down' ? 'text-red-600' : 'text-text-secondary'">
        <svg v-if="trendDirection === 'up'" class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
        <svg v-if="trendDirection === 'down'" class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
        <span>{{ trend }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  iconName: { // Could be a simple name like 'Sales', 'Users', or a specific icon identifier later
    type: String,
    default: ''
  },
  isLoading: { // New prop for loading state
    type: Boolean,
    default: false
  },
  trend: {
    type: String,
    default: ''
  },
  trendDirection: { // 'up', 'down', or other for neutral
    type: String,
    default: 'neutral' // 'neutral' or empty string for no arrow
  },
  // Optional: A class for the icon background, can be passed based on the stat type
  iconBackgroundClass: {
     type: String,
     default: 'bg-brand-secondary' // Default background for the icon
  }
});

// If we had actual SVG icon components:
// const dynamicIconComponent = computed(() => {
//   if (!props.iconName) return null;
//   // Logic to map iconName to an imported SVG component
//   // e.g., if (props.iconName === 'SalesIcon') return defineAsyncComponent(() => import('~/components/icons/SalesIcon.vue'));
//   return null;
// });
</script>

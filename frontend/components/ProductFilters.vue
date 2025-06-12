<template>
  <div class="p-4 lg:p-0"> {/* Adjusted padding for desktop vs mobile use */}
    <h3
      class="text-lg font-semibold text-gray-800 mb-4 lg:mb-3"
      :class="{'sticky top-0 bg-white py-3 border-b border-gray-200 px-4 -mx-4 z-10': isMobile }"
    >
      Filters
    </h3>
    <div class="space-y-6">
      <!-- Search Term (Placeholder for now, will be added from index.vue) -->
      <div>
        <label for="filter-search" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          type="text"
          id="filter-search"
          :value="localSearchTerm"
          @input="localSearchTerm = $event.target.value"
          placeholder="Product name..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <!-- Category Filter -->
      <div>
        <label for="filter-category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          id="filter-category"
          v-model="localSelectedCategoryId"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white pr-8"
        >
          <option :value="null">All Categories</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>

      <!-- Price Range (Placeholder for now) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
        <div class="flex space-x-2">
            <input type="number" :value="localMinPrice" @input="localMinPrice = $event.target.value ? parseFloat($event.target.value) : null" placeholder="Min" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
            <input type="number" :value="localMaxPrice" @input="localMaxPrice = $event.target.value ? parseFloat($event.target.value) : null" placeholder="Max" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
        </div>
      </div>

      <!-- Sort By (Placeholder for now) -->
      <div>
        <label for="filter-sortby" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
        <select
            id="filter-sortby"
            v-model="localSortBy"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white pr-8"
        >
              <option value="created_at_desc">Newest</option>
              <option value="created_at_asc">Oldest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A-Z</option>
              <option value="name_desc">Name: Z-A</option>
        </select>
      </div>

      <div class="pt-2 space-y-3">
        <button
          @click="handleApplyFilters"
          class="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Apply Filters
        </button>
        <button
          @click="handleResetFilters"
          class="w-full px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Reset Filters
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  initialSelectedCategoryId: {
    type: [String, Number],
    default: null
  },
  initialSearchTerm: {
    type: String,
    default: ''
  },
  initialMinPrice: {
    type: Number,
    default: null
  },
  initialMaxPrice: {
    type: Number,
    default: null
  },
  initialSortBy: {
    type: String,
    default: 'created_at_desc'
  },
  isMobile: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['applyFilters', 'resetFilters', 'closeMobileFilters']);

const localSelectedCategoryId = ref(props.initialSelectedCategoryId);
const localSearchTerm = ref(props.initialSearchTerm);
const localMinPrice = ref(props.initialMinPrice);
const localMaxPrice = ref(props.initialMaxPrice);
const localSortBy = ref(props.initialSortBy);

watch(() => props.initialSelectedCategoryId, (newVal) => {
  localSelectedCategoryId.value = newVal;
});
watch(() => props.initialSearchTerm, (newVal) => {
  localSearchTerm.value = newVal;
});
watch(() => props.initialMinPrice, (newVal) => {
  localMinPrice.value = newVal;
});
watch(() => props.initialMaxPrice, (newVal) => {
  localMaxPrice.value = newVal;
});
watch(() => props.initialSortBy, (newVal) => {
  localSortBy.value = newVal;
});


const handleApplyFilters = () => {
  emit('applyFilters', {
    selectedCategoryId: localSelectedCategoryId.value,
    searchTerm: localSearchTerm.value,
    minPrice: localMinPrice.value,
    maxPrice: localMaxPrice.value,
    sortBy: localSortBy.value,
  });
  if (props.isMobile) {
    emit('closeMobileFilters');
  }
};

const handleResetFilters = () => {
  localSelectedCategoryId.value = null;
  localSearchTerm.value = '';
  localMinPrice.value = null;
  localMaxPrice.value = null;
  localSortBy.value = 'created_at_desc';
  // Emit reset so parent can clear and refetch
  emit('resetFilters');
  if (props.isMobile) {
    emit('closeMobileFilters');
  }
};

</script>

<style scoped>
/* If specific styles are needed that Tailwind can't easily handle */
</style>

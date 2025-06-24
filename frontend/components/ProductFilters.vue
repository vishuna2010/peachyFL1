<template>
  <div class="p-4 lg:p-0"> {/* Adjusted padding for desktop vs mobile use */}
    <h3
      class="text-lg font-semibold font-serif text-venus-text-primary mb-4 lg:mb-3"
      :class="{'sticky top-0 bg-venus-background py-3 border-b border-venus-neutral-medium px-4 -mx-4 z-10': isMobile }"
    >
      Filters
    </h3>
    <div class="space-y-6">
      <!-- Search Term (Placeholder for now, will be added from index.vue) -->
      <div>
        <label for="filter-search" class="block text-sm font-medium text-venus-text-primary mb-1">Search</label>
        <input
          type="text"
          id="filter-search"
          :value="localSearchTerm"
          @input="localSearchTerm = $event.target.value"
          placeholder="Product name..."
          class="w-full px-3 py-2 border border-gray-300 text-venus-text-secondary rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink"
        />
      </div>

      <!-- Category Filter -->
      <div>
        <label for="filter-category" class="block text-sm font-medium text-venus-text-primary mb-1">Category</label>
        <select
          id="filter-category"
          v-model="localSelectedCategoryId"
          class="w-full px-3 py-2 border border-gray-300 text-venus-text-secondary rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink bg-white pr-8"
        >
          <option :value="null">All Categories</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>

      <!-- Color Swatch Filter -->
      <div v-if="isLoadingOptions">
        <label class="block text-sm font-medium text-venus-text-primary mb-1">Color</label>
        <div class="h-8 bg-gray-200 rounded w-full animate-pulse"></div>
      </div>
      <div v-else-if="colorOption && colorOptionValues.length > 0">
        <label class="block text-sm font-medium text-venus-text-primary mb-1">{{ colorOption.name }}</label>
        <div class="flex flex-wrap gap-2 mt-1">
          <button
            v-for="colorValObj in colorOptionValues"
            :key="colorValObj.id"
            type="button"
            @click="selectColor(colorValObj.id)"
            :class="[
              'p-1.5 border flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-venus-accent-gold/50 transition-all duration-150 rounded-md', // Base classes, added rounded-md here
              localSelectedColorValueId === colorValObj.id
                ? 'border-venus-accent-gold ring-2 ring-venus-accent-gold/50 shadow-md' // Selected state
                : 'border-venus-neutral-medium hover:border-gray-400 hover:shadow-sm' // Default state for non-selected
            ]"
            :aria-pressed="localSelectedColorValueId === colorValObj.id"
          >
            <span
              class="w-5 h-5 sm:w-6 sm:h-6 rounded-md border border-gray-400 inline-block"
              :style="{ backgroundColor: colorValObj.value.toLowerCase() }"
              :title="`Select ${colorOption.name}: ${colorValObj.value}`"
            ></span>
            <span class="text-sm text-venus-text-secondary pr-1">{{ colorValObj.value }}</span>
          </button>
        </div>
      </div>

      <!-- Price Range -->
      <div>
        <label class="block text-sm font-medium text-venus-text-primary mb-1">Price Range</label>
        <div class="flex items-center space-x-2">
            <input
              type="number"
              :value="localMinPrice"
              @input="localMinPrice = $event.target.value === '' ? null : parseFloat($event.target.value)"
              placeholder="Min"
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 text-venus-text-secondary rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink"
            />
            <span class="text-gray-500">-</span>
            <input
              type="number"
              :value="localMaxPrice"
              @input="localMaxPrice = $event.target.value === '' ? null : parseFloat($event.target.value)"
              placeholder="Max"
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border border-gray-300 text-venus-text-secondary rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink"
            />
        </div>
        <p v-if="priceError" class="text-xs text-red-500 mt-1">{{ priceError }}</p>
      </div>

      <!-- Sort By -->
      <div>
        <label for="filter-sortby" class="block text-sm font-medium text-venus-text-primary mb-1">Sort By</label>
        <select
            id="filter-sortby"
            v-model="localSortBy"
            class="w-full px-3 py-2 border border-gray-300 text-venus-text-secondary rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink bg-white pr-8"
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
          class="w-full px-4 py-2 bg-peach-pink text-white text-sm font-medium rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
        >
          Apply Filters
        </button>
        <button
          @click="handleResetFilters"
          class="w-full px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink border border-gray-300"
        >
          Reset Filters
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useToast } from 'vue-toastification';

const toast = useToast();
const priceError = ref(null); // For displaying price range validation error

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
  initialSelectedColorValueId: { // New prop for pre-selecting a color
    type: [String, Number],
    default: null
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
const localSelectedColorValueId = ref(props.initialSelectedColorValueId);

// New state for fetching global color options
const allGlobalOptions = ref([]); // Not strictly needed if only fetching "Color"
const colorOption = ref(null); // Stores the {id, name} of the "Color" global option
const colorOptionValues = ref([]); // Stores values for the "Color" option
const isLoadingOptions = ref(false);
const optionsFetchError = ref(null);

const { $axios } = useNuxtApp(); // Get $axios instance

watch(() => props.initialSelectedCategoryId, (newVal) => { localSelectedCategoryId.value = newVal; });
watch(() => props.initialSearchTerm, (newVal) => { localSearchTerm.value = newVal; });
watch(() => props.initialMinPrice, (newVal) => { localMinPrice.value = newVal; });
watch(() => props.initialMaxPrice, (newVal) => { localMaxPrice.value = newVal; });
watch(() => props.initialSortBy, (newVal) => { localSortBy.value = newVal; });
watch(() => props.initialSelectedColorValueId, (newVal) => { localSelectedColorValueId.value = newVal; });

const selectColor = (valueId) => {
  if (localSelectedColorValueId.value === valueId) {
    localSelectedColorValueId.value = null; // Toggle off
  } else {
    localSelectedColorValueId.value = valueId;
  }
  // Note: Applying filters immediately on color click might be an option too,
  // but current design uses a main "Apply Filters" button.
};

async function fetchGlobalOptionsAndColorValues() {
  // For now, we will not fetch global options from an admin endpoint
  // in a public component. This prevents 401 errors for non-admin users.
  // A proper public API for filterable options should be created.
  isLoadingOptions.value = true;
  optionsFetchError.value = null;
  try {
    // Placeholder: In the future, this should call a public API endpoint
    // that provides filterable options like "Color" and its values.
    // For example:
    // const response = await $axios.get('/api/public/filter-options');
    // const allPublicOptions = response.data.data || [];
    // Corrected path: removed leading '/api' as $axios instance likely has it as baseURL
    const response = await $axios.get('/options/public-filters');
    const allPublicOptions = response.data || []; // Assuming response.data is the array

    allGlobalOptions.value = allPublicOptions; // Store all fetched options if needed elsewhere

    const foundColorOption = allPublicOptions.find(opt => opt.option_name && opt.option_name.toLowerCase() === 'color');

    if (foundColorOption) {
      colorOption.value = { id: foundColorOption.option_id, name: foundColorOption.option_name };
      // Ensure values are structured correctly, mapping value_id to id and value_name to value for template compatibility
      colorOptionValues.value = (foundColorOption.values || []).map(v => ({ id: v.value_id, value: v.value_name }));
    } else {
      console.warn('Public "Color" option type not found in /api/options/public-filters response.');
      colorOption.value = null;
      colorOptionValues.value = [];
    }

  } catch (err) {
    console.error('Error fetching public filter options from /api/options/public-filters:', err);
    optionsFetchError.value = err.response?.data?.message || err.message || 'Failed to load filter options.';
    toast.error(optionsFetchError.value || 'Could not load filter options.');
    colorOption.value = null;
    colorOptionValues.value = [];
    allGlobalOptions.value = [];
  } finally {
    isLoadingOptions.value = false;
  }
}

onMounted(() => {
  // Categories are passed via props.
  // Fetching global options like color is currently problematic as it uses an admin endpoint.
  // We will call the modified function which now avoids the admin endpoint.
  fetchGlobalOptionsAndColorValues();
});

const validatePriceRange = () => {
  priceError.value = null; // Reset error
  const min = localMinPrice.value;
  const max = localMaxPrice.value;

  if (min !== null && (isNaN(min) || min < 0)) {
    priceError.value = 'Min price must be a positive number.';
    return false;
  }
  if (max !== null && (isNaN(max) || max < 0)) {
    priceError.value = 'Max price must be a positive number.';
    return false;
  }
  if (min !== null && max !== null && min > max) {
    priceError.value = 'Min price cannot be greater than max price.';
    return false;
  }
  return true;
};

const handleApplyFilters = () => {
  if (!validatePriceRange()) {
    // Toast error can also be used, but inline error is often better for forms
    // toast.error(priceError.value);
    return;
  }
  emit('applyFilters', {
    selectedCategoryId: localSelectedCategoryId.value,
    searchTerm: localSearchTerm.value,
    minPrice: localMinPrice.value,
    maxPrice: localMaxPrice.value,
    sortBy: localSortBy.value,
    selectedColorValueId: localSelectedColorValueId.value, // Add color to emitted filters
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
  localSelectedColorValueId.value = null; // Reset color selection
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

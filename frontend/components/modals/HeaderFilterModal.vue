<template>
  <Modal :is-open="isOpen" title="Advanced Filters" @close="closeModal" :close-on-overlay-click="true">
    <div class="p-4">
      <ProductFilters
        :categories="categories"
        :initial-selected-category-id="currentFilters.selectedCategoryId"
        :initial-search-term="currentFilters.searchTerm"
        :initial-min-price="currentFilters.minPrice"
        :initial-max-price="currentFilters.maxPrice"
        :initial-sort-by="currentFilters.sortBy"
        :initial-selected-color-value-id="currentFilters.selectedColorValueId"
        @apply-filters="onApplyFilters"
        @reset-filters="onResetFilters"
        :is-mobile="true" <!-- Use mobile styling for compactness if desired, or make it responsive -->
      />
    </div>
    <template #footer>
      <div class="flex justify-end p-4 bg-gray-50 border-t">
        <button @click="closeModal" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">
          Cancel
        </button>
        <!-- Apply button is within ProductFilters, or could be moved here -->
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import Modal from '~/components/common/Modal.vue';
import ProductFilters from '~/components/ProductFilters.vue';
import { useNuxtApp, useRoute } from '#app';

const props = defineProps({
  isOpen: Boolean,
});
const emit = defineEmits(['close', 'apply-header-filters', 'reset-header-filters']);

const { $axios } = useNuxtApp();
const route = useRoute();

const categories = ref([]);
const currentFilters = reactive({
  searchTerm: '',
  selectedCategoryId: null,
  minPrice: null,
  maxPrice: null,
  sortBy: 'created_at_desc',
  selectedColorValueId: null,
});

async function fetchCategoriesForFilter() {
  try {
    const response = await $axios.get('/categories'); // Endpoint returns { id, name, slug }
    categories.value = response.data || [];
  } catch (err) {
    console.error('Error fetching categories for filter modal:', err);
    categories.value = [];
  }
}

function updateCurrentFiltersFromRoute() {
  currentFilters.searchTerm = route.query.searchTerm || '';
  currentFilters.selectedCategoryId = route.query.category || null;
  currentFilters.minPrice = route.query.minPrice ? parseFloat(route.query.minPrice) : null;
  currentFilters.maxPrice = route.query.maxPrice ? parseFloat(route.query.maxPrice) : null;
  currentFilters.sortBy = route.query.sortBy || 'created_at_desc';
  currentFilters.selectedColorValueId = route.query.color || null;
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    updateCurrentFiltersFromRoute();
    if (categories.value.length === 0) { // Fetch categories only if not already fetched
        fetchCategoriesForFilter();
    }
  }
});

// onMounted(() => {
  // Initial load if modal starts open (less likely for header) or pre-fetch.
  // Categories are fetched when modal opens and if not already present.
// });

const onApplyFilters = (filtersFromComponent) => {
  emit('apply-header-filters', filtersFromComponent);
  // closeModal(); // ProductFilters' own apply button will be the primary trigger, modal should close after navigation.
};

const onResetFilters = () => {
  // ProductFilters internally resets its local state and emits 'resetFilters'
  // We then tell the header to navigate with no filters.
  emit('reset-header-filters');
  // closeModal(); // Modal should close after navigation.
};

const closeModal = () => {
  emit('close');
};
</script>

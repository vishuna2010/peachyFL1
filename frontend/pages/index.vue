<template>
  <div class="pb-8">
    <HeroBanner v-bind="heroData" />

    <div class="p-4 md:p-8">
      <h1 class="text-3xl font-bold text-text-primary mb-8 text-center" id="products">Featured Products</h1>

      <!-- Mobile Filters Toggle Button -->
      <div class="lg:hidden mb-4 text-center">
        <button
          @click="toggleMobileFilters"
          class="inline-flex items-center justify-center px-6 py-3 border border-neutral-dark rounded-md shadow-sm text-base font-medium text-text-primary bg-white hover:bg-neutral-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors duration-200"
          aria-label="Show filters"
          :aria-expanded="isMobileFiltersOpen.toString()"
        >
          <FilterIcon class="w-5 h-5 mr-2" />
          Filters
        </button>
      </div>

      <div class="lg:grid lg:grid-cols-4 lg:gap-x-6 xl:gap-x-8">
        <!-- Desktop Filter Sidebar -->
        <aside class="hidden lg:block lg:col-span-1 lg:sticky lg:top-24 self-start pt-2 h-screen-minus-nav overflow-y-auto">
          <ProductFilters
            :categories="categories"
            :initialSearchTerm="searchTerm"
            :initialSelectedCategoryId="selectedCategoryId"
            :initialSelectedColorValueId="selectedColorValueId"
            :initialMinPrice="minPrice"
            :initialMaxPrice="maxPrice"
            :initialSortBy="sortBy"
            @apply-filters="handleFiltersUpdate"
            @reset-filters="resetFiltersAndNavigate"
          />
        </aside>

        <!-- Mobile Filter Modal/Drawer -->
        <div v-if="isMobileFiltersOpen" class="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div class="fixed inset-0 bg-black bg-opacity-50" @click="isMobileFiltersOpen = false" aria-hidden="true"></div>
          <div class="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out"
               :class="isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'">
            <div class="absolute top-0 right-0 -mr-12 pt-2 z-50">
              <button
                type="button"
                class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white text-white hover:text-gray-200"
                @click="isMobileFiltersOpen = false"
                aria-label="Close filter panel"
              >
                <CloseIcon class="h-6 w-6" />
              </button>
            </div>
            <div class="flex-1 h-0 pt-2 pb-4 overflow-y-auto">
              <ProductFilters
                :categories="categories"
                :initialSearchTerm="searchTerm"
                :initialSelectedCategoryId="selectedCategoryId"
                :initialSelectedColorValueId="selectedColorValueId"
                :initialMinPrice="minPrice"
                :initialMaxPrice="maxPrice"
                :initialSortBy="sortBy"
                @apply-filters="handleFiltersUpdate"
                @reset-filters="resetFiltersAndNavigate"
                :isMobile="true"
                @close-mobile-filters="isMobileFiltersOpen = false"
              />
            </div>
          </div>
        </div>

        <div class="lg:col-span-3">
          <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <ProductCardSkeleton v-for="n in limit" :key="`skeleton-${n}`" />
          </div>
          <div v-else-if="fetchError" class="text-center py-10">
            <p class="text-lg text-red-600">Error fetching products: {{ fetchError.message || 'Unknown error' }}</p>
            <button @click="() => fetchProducts(currentPage)" class="mt-4 px-4 py-2 bg-brand-primary text-white rounded hover:bg-opacity-90 font-semibold transition-all duration-200 ease-in-out hover:scale-105 transform">Try Again</button>
          </div>
          <div v-else-if="!products.length" class="text-center py-10">
            <p class="text-lg text-text-secondary">No products found matching your criteria.</p>
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <ProductCard v-for="product in products" :key="product.id" :product="product" />
          </div>

          <div class="mt-8 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && products.length > 0 && paginationData.totalPages > 1">
            <button
              @click="changePage(currentPage - 1)"
              :disabled="!paginationData.hasPrevPage"
              class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Previous
            </button>
            <span class="text-sm text-text-secondary">
              Page {{ paginationData.page }} of {{ paginationData.totalPages }}
            </span>
            <button
              @click="changePage(currentPage + 1)"
              :disabled="!paginationData.hasNextPage"
              class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useCart } from '~/composables/useCart';
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig, useHead } from '#app';
import ProductCard from '~/components/ProductCard.vue';
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue';
import ProductFilters from '~/components/ProductFilters.vue';
import HeroBanner from '~/components/HeroBanner.vue';
import FilterIcon from '~/components/icons/FilterIcon.vue';
import CloseIcon from '~/components/icons/CloseIcon.vue';

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart();

const heroData = ref({
  title: 'Summer Collection is Here!',
  subtitle: 'Discover the latest trends and refresh your wardrobe.',
  buttonText: 'Shop Now',
  buttonLink: '#products',
  imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80'
});

const products = ref([]);

// Filter state
const searchTerm = ref(route.query.search_term || '');
const selectedCategoryId = ref(route.query.category_id ? parseInt(route.query.category_id) : null);
const selectedColorValueId = ref(route.query.optionValueId ? parseInt(route.query.optionValueId) : null);
const minPrice = ref(route.query.min_price ? parseFloat(route.query.min_price) : null);
const maxPrice = ref(route.query.max_price ? parseFloat(route.query.max_price) : null);
const sortBy = ref(route.query.sort_by || 'created_at_desc');
const currentPage = ref(route.query.page ? parseInt(route.query.page) : 1);
const limit = ref(12);

const categories = ref([]); // For ProductFilters prop
const paginationData = ref({
  total: 0,
  page: currentPage.value,
  limit: limit.value,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
});
const isLoading = ref(true);
const fetchError = ref(null);

const isMobileFiltersOpen = ref(false);
const toggleMobileFilters = () => {
  isMobileFiltersOpen.value = !isMobileFiltersOpen.value;
};

async function fetchCategories() {
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data.data || response.data;
  } catch (err) {
    console.error('Failed to fetch categories:', err);
  }
}

async function fetchProducts(pageToFetch = currentPage.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const params = {
      page: pageToFetch,
      limit: limit.value,
      search_term: searchTerm.value || undefined,
      category_id: selectedCategoryId.value || undefined,
      optionValueId: selectedColorValueId.value || undefined, // Include in API call
      min_price: minPrice.value || undefined,
      max_price: maxPrice.value || undefined,
      sort_by: sortBy.value || undefined
    };
    const response = await $axios.get('/products', { params });
    products.value = response.data.products;
    const backendPagination = response.data.pagination;
    paginationData.value = {
      total: backendPagination.total_products,
      page: backendPagination.current_page,
      limit: backendPagination.limit,
      totalPages: backendPagination.total_pages,
      hasNextPage: backendPagination.current_page < backendPagination.total_pages,
      hasPrevPage: backendPagination.current_page > 1,
    };
    currentPage.value = backendPagination.current_page;

    // No need to push to router here, this function is called WHEN router query changes (or on initial load)
  } catch (err) {
    console.error('Failed to fetch products:', err);
    fetchError.value = err.response?.data || err;
    products.value = [];
    paginationData.value = { total: 0, page: 1, limit: limit.value, totalPages: 1, hasNextPage: false, hasPrevPage: false };
  } finally {
    isLoading.value = false;
  }
}

const handleFiltersUpdate = (filtersFromChild) => {
  searchTerm.value = filtersFromChild.searchTerm;
  selectedCategoryId.value = filtersFromChild.selectedCategoryId;
  selectedColorValueId.value = filtersFromChild.selectedColorValueId;
  minPrice.value = filtersFromChild.minPrice;
  maxPrice.value = filtersFromChild.maxPrice;
  sortBy.value = filtersFromChild.sortBy;

  applyFiltersAndNavigate();
};

function applyFiltersAndNavigate() {
  currentPage.value = 1;
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value) query.category_id = selectedCategoryId.value;
  if (selectedColorValueId.value) query.optionValueId = selectedColorValueId.value; // Add to query
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value && sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value;
  // Page will be 1, so don't include it unless it's > 1 (which it isn't here)

  router.push({ path: '/', query });
  // Mobile filters are closed by ProductFilters component itself by emitting 'closeMobileFilters'
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    selectedColorValueId.value = null; // Reset color
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
    // Mobile filters are closed by ProductFilters component itself
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= paginationData.value.totalPages && newPage !== currentPage.value) {
    // currentPage.value will be updated by the watcher reacting to route.query.page change
    const query = { ...route.query };
    if (newPage > 1) {
      query.page = newPage;
    } else {
      delete query.page;
    }
    router.push({ query });
  }
}

onMounted(async () => {
  // Initialize filter states from URL query on mount
  // This is now largely handled by the watcher's immediate:true and its logic
  await fetchCategories();
  // Initial product fetch is handled by the watcher on route.query
});

watch(
  () => route.query,
  (newQuery, oldQuery = {}) => {
    searchTerm.value = newQuery.search_term || '';
    selectedCategoryId.value = newQuery.category_id ? parseInt(newQuery.category_id) : null;
    selectedColorValueId.value = newQuery.optionValueId ? parseInt(newQuery.optionValueId) : null; // Update from route
    minPrice.value = newQuery.min_price ? parseFloat(newQuery.min_price) : null;
    maxPrice.value = newQuery.max_price ? parseFloat(newQuery.max_price) : null;
    sortBy.value = newQuery.sort_by || 'created_at_desc';
    const newPage = newQuery.page ? parseInt(newQuery.page) : 1;

    // Only update currentPage if it's different, to avoid potential loop with fetchProducts updating route
    if (currentPage.value !== newPage) {
        currentPage.value = newPage;
    }
    fetchProducts(currentPage.value); // Fetch products based on (potentially updated) filters from URL
  },
  { deep: true, immediate: true } // immediate:true to fetch on initial load based on URL
);

useHead({
  title: 'E-Commerce Home - Featured Products',
});
</script>

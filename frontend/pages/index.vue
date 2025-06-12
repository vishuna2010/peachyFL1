<template>
  <div class="pb-8">
    <HeroBanner v-bind="heroData" />

    <div class="p-4 md:p-8">
      <h1 class="text-3xl font-bold text-text-primary mb-8 text-center">Featured Products</h1>

      <!-- Mobile Filters Toggle Button -->
      <div class="lg:hidden mb-4 text-center">
        <button
          @click="toggleMobileFilters"
          class="inline-flex items-center justify-center px-6 py-3 border border-neutral-dark rounded-md shadow-sm text-base font-medium text-text-primary bg-white hover:bg-neutral-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
          aria-label="Show filters"
          :aria-expanded="isMobileFiltersOpen.toString()"
        >
          <FilterIcon class="w-5 h-5 mr-2" />
          Filters
        </button>
      </div>

      <div class="lg:grid lg:grid-cols-4 lg:gap-x-6 xl:gap-x-8">
        <!-- Desktop Filter Sidebar -->
        <aside class="hidden lg:block lg:col-span-1 lg:sticky lg:top-24 self-start pt-2">
          <ProductFilters
            :categories="categories"
            :initialSearchTerm="searchTerm"
            :initialSelectedCategory="selectedCategoryId"
            :initialMinPrice="minPrice"
            :initialMaxPrice="maxPrice"
            :initialSortBy="sortBy"
            @apply-filters="applyFiltersFromComponent"
            @reset-filters="resetFiltersAndNavigate"
          />
        </aside>

        <!-- Mobile Filter Modal/Drawer -->
        <div v-if="isMobileFiltersOpen" class="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <!-- Overlay -->
          <div class="fixed inset-0 bg-black bg-opacity-50" @click="isMobileFiltersOpen = false" aria-hidden="true"></div>

          <div class="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out"
               :class="isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'">
            <div class="absolute top-0 right-0 -mr-12 pt-2 z-50"> {/* Ensure close button is accessible */}
              <button
                type="button"
                class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white text-white hover:text-gray-200"
                @click="isMobileFiltersOpen = false"
                aria-label="Close filter panel"
              >
                <CloseIcon class="h-6 w-6" />
              </button>
            </div>
            <div class="flex-1 h-0 pt-2 pb-4 overflow-y-auto"> {/* Added pt-2 for spacing from top */}
              <ProductFilters
                :categories="categories"
                :initialSearchTerm="searchTerm"
                :initialSelectedCategory="selectedCategoryId"
                :initialMinPrice="minPrice"
                :initialMaxPrice="maxPrice"
                :initialSortBy="sortBy"
                @apply-filters="applyFiltersFromComponent"
                @reset-filters="resetFiltersAndNavigate"
                :isMobile="true"
                @close-mobile-filters="isMobileFiltersOpen = false"
              />
            </div>
          </div>
        </div>

        <!-- Products Column -->
        <div class="lg:col-span-3">
          <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6"> {/* Adjusted lg/xl cols */}
            <ProductCardSkeleton v-for="n in limit" :key="`skeleton-${n}`" />
          </div>
          <div v-else-if="fetchError" class="text-center py-10">
            <p class="text-lg text-red-600">Error fetching products: {{ fetchError.message || 'Unknown error' }}</p>
            <button @click="() => fetchProducts(currentPage)" class="mt-4 px-4 py-2 bg-brand-primary text-white rounded hover:bg-opacity-90">Try Again</button>
          </div>
          <div v-else-if="!products.length" class="text-center py-10">
            <p class="text-lg text-text-secondary">No products found matching your criteria.</p>
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6"> {/* Adjusted lg/xl cols */}
            <ProductCard v-for="product in products" :key="product.id" :product="product" />
          </div>

          <div class="mt-8 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && products.length > 0 && paginationData.totalPages > 1">
            <button
              @click="changePage(currentPage - 1)"
              :disabled="!paginationData.hasPrevPage"
              class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span class="text-sm text-text-secondary">
              Page {{ paginationData.page }} of {{ paginationData.totalPages }}
            </span>
            <button
              @click="changePage(currentPage + 1)"
              :disabled="!paginationData.hasNextPage"
              class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed"
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
import ProductFilters from '~/components/ProductFilters.vue'; // Import ProductFilters
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
  buttonLink: '#products', // Link to product section or a category
  imageUrl: 'https://via.placeholder.com/1200x500.png?text=Dynamic+Hero+Image'
});

const products = ref([]);

const searchTerm = ref(route.query.search_term || '');
const selectedCategoryId = ref(route.query.category_id ? parseInt(route.query.category_id) : null);
const minPrice = ref(route.query.min_price ? parseFloat(route.query.min_price) : null);
const maxPrice = ref(route.query.max_price ? parseFloat(route.query.max_price) : null);
const sortBy = ref(route.query.sort_by || 'created_at_desc');
const currentPage = ref(route.query.page ? parseInt(route.query.page) : 1);
const limit = ref(12); // Number of products per page / skeletons to show

const categories = ref([]);
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

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

async function fetchCategories() {
  try {
    const response = await $axios.get('/categories'); // Assuming a public endpoint for categories
    categories.value = response.data.data || response.data; // Adjust if API structure differs
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    // categories.value will remain empty, filters might not show categories
  }
}

async function fetchProducts(pageToFetch = currentPage.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/products', { // Public products endpoint
      params: {
        page: pageToFetch,
        limit: limit.value,
        search_term: searchTerm.value || undefined,
        category_id: selectedCategoryId.value || undefined,
        min_price: minPrice.value || undefined,
        max_price: maxPrice.value || undefined,
        sort_by: sortBy.value || undefined
      }
    });
    products.value = response.data.products;
    // Assuming pagination structure from backend is { total_products, current_page, total_pages, limit }
    // and we adapt it to { total, page, limit, totalPages, hasNextPage, hasPrevPage }
    const backendPagination = response.data.pagination;
    paginationData.value = {
      total: backendPagination.total_products,
      page: backendPagination.current_page,
      limit: backendPagination.limit,
      totalPages: backendPagination.total_pages,
      hasNextPage: backendPagination.current_page < backendPagination.total_pages,
      hasPrevPage: backendPagination.current_page > 1,
    };
    currentPage.value = backendPagination.current_page; // Ensure local currentPage is synced

    // Update router query if page is different, to keep URL in sync
    if (String(route.query.page || 1) !== String(currentPage.value)) {
        router.push({ query: { ...route.query, page: currentPage.value > 1 ? currentPage.value : undefined } });
    }

  } catch (err) {
    console.error('Failed to fetch products:', err);
    fetchError.value = err.response?.data || err;
    products.value = [];
    paginationData.value = { total: 0, page: 1, limit: limit.value, totalPages: 1, hasNextPage: false, hasPrevPage: false };
  } finally {
    isLoading.value = false;
  }
}

// This function is called when ProductFilters component emits 'apply-filters'
const applyFiltersFromComponent = (filters) => {
  searchTerm.value = filters.searchTerm;
  selectedCategoryId.value = filters.selectedCategoryId;
  minPrice.value = filters.minPrice;
  maxPrice.value = filters.maxPrice;
  sortBy.value = filters.sortBy;

  applyFiltersAndNavigate(); // Use the existing navigation logic
};

function applyFiltersAndNavigate() {
  currentPage.value = 1; // Reset to first page for new filter set
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value !== null && selectedCategoryId.value !== undefined) query.category_id = selectedCategoryId.value;
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value;
  // page will be handled by the watch or fetchProducts directly
  router.push({ path: '/', query });
  if (isMobileFiltersOpen.value) toggleMobileFilters(); // Close mobile filter panel
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
    if (isMobileFiltersOpen.value) toggleMobileFilters();
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= paginationData.value.totalPages && newPage !== currentPage.value) {
    currentPage.value = newPage; // Update reactive currentPage
    // Build query based on current filters and new page
    const query = { ...route.query };
    if (newPage > 1) {
      query.page = newPage;
    } else {
      delete query.page; // Remove page from query if it's page 1
    }
    router.push({ query }); // This will trigger the watch on route.query
  }
}

onMounted(async () => {
  // Initialize filter states from URL query on mount
  const query = route.query;
  searchTerm.value = query.search_term || '';
  selectedCategoryId.value = query.category_id ? parseInt(query.category_id) : null;
  minPrice.value = query.min_price ? parseFloat(query.min_price) : null;
  maxPrice.value = query.max_price ? parseFloat(query.max_price) : null;
  sortBy.value = query.sort_by || 'created_at_desc';
  currentPage.value = query.page ? parseInt(query.page) : 1;

  await fetchCategories(); // Fetch categories for the filter dropdown
  await fetchProducts(currentPage.value); // Fetch initial products
});

watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    // Determine if it's just a page change or a filter change
    const newPage = newQuery.page ? parseInt(newQuery.page) : 1;
    const oldPage = oldQuery?.page ? parseInt(oldQuery.page) : 1;

    const filtersChanged =
        (newQuery.search_term || '') !== (oldQuery?.search_term || '') ||
        (newQuery.category_id ? parseInt(newQuery.category_id) : null) !== (oldQuery?.category_id ? parseInt(oldQuery.category_id) : null) ||
        (newQuery.min_price ? parseFloat(newQuery.min_price) : null) !== (oldQuery?.min_price ? parseFloat(oldQuery.min_price) : null) ||
        (newQuery.max_price ? parseFloat(newQuery.max_price) : null) !== (oldQuery?.max_price ? parseFloat(oldQuery.max_price) : null) ||
        (newQuery.sort_by || 'created_at_desc') !== (oldQuery?.sort_by || 'created_at_desc');

    if (filtersChanged) {
        // If filters changed, reset to page 1 and fetch
        currentPage.value = 1; // Update reactive currentPage
        await fetchProducts(1);
    } else if (newPage !== oldPage || newPage !== currentPage.value) {
        // If only page changed, or currentPage ref is out of sync with route
        currentPage.value = newPage; // Update reactive currentPage
        await fetchProducts(newPage);
    } else if (!products.value.length && !isLoading.value && !fetchError.value && newPage === currentPage.value && !Object.keys(newQuery).length) {
        // Edge case: initial load, no query params, no products, not loading, no error -> try fetching
        await fetchProducts(newPage);
    }
  },
  { deep: true }
);

useHead({
  title: 'E-Commerce Home - Featured Products',
});
</script>

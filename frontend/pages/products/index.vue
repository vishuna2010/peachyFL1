<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold font-serif text-venus-text-primary">Our Products</h1>
      <!-- Breadcrumbs or other context can go here -->
    </div>

    <div class="lg:grid lg:grid-cols-4 lg:gap-8">
      <!-- Filters Column (Desktop) -->
      <aside class="hidden lg:block lg:col-span-1">
        <ProductFilters
          :categories="categories"
          :initial-selected-category-id="filters.selectedCategoryId"
          :initial-search-term="filters.searchTerm"
          :initial-min-price="filters.minPrice"
          :initial-max-price="filters.maxPrice"
          :initial-sort-by="filters.sortBy"
          :initial-selected-color-value-id="filters.selectedColorValueId"
          @apply-filters="applyFilters"
          @reset-filters="resetFiltersAndFetch"
        />
      </aside>

      <!-- Products Grid Column -->
      <main class="lg:col-span-3">
        <!-- Mobile Filter Trigger -->
        <div class="lg:hidden mb-4">
          <button
            @click="showMobileFilters = !showMobileFilters"
            class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-venus-text-primary bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
          >
            <FilterIcon class="w-5 h-5 mr-2 text-venus-text-secondary" />
            <span>{{ showMobileFilters ? 'Hide' : 'Show' }} Filters</span>
          </button>
        </div>

        <!-- Mobile Filters Panel -->
        <div v-if="showMobileFilters" class="lg:hidden mb-6 bg-white shadow-lg rounded-lg border border-gray-200">
          <ProductFilters
            :categories="categories"
            :initial-selected-category-id="filters.selectedCategoryId"
            :initial-search-term="filters.searchTerm"
            :initial-min-price="filters.minPrice"
            :initial-max-price="filters.maxPrice"
            :initial-sort-by="filters.sortBy"
            :initial-selected-color-value-id="filters.selectedColorValueId"
            @apply-filters="applyFilters"
            @reset-filters="resetFiltersAndFetch"
            @close-mobile-filters="showMobileFilters = false"
            :is-mobile="true"
          />
        </div>

        <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <ProductCardSkeleton v-for="n in 6" :key="`skeleton-${n}`" />
        </div>
        <div v-else-if="error" class="text-center py-10">
          <p class="text-red-500 text-lg">Error loading products: {{ error.message || 'Please try again later.' }}</p>
        </div>
        <div v-else-if="products.length === 0" class="text-center py-10">
          <p class="text-venus-text-secondary text-lg">No products found matching your criteria.</p>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            @open-quick-view="openQuickViewModal"
          />
        </div>

        <!-- Pagination -->
        <div v-if="!pending && !error && products.length > 0 && pagination.totalPages > 1" class="mt-10 flex justify-center items-center space-x-3">
          <button
            @click="changePage(pagination.currentPage - 1)"
            :disabled="pagination.currentPage <= 1"
            class="px-4 py-2 border border-gray-300 text-sm font-medium text-venus-text-secondary hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="text-sm text-venus-text-secondary">
            Page {{ pagination.currentPage }} of {{ pagination.totalPages }}
          </span>
          <button
            @click="changePage(pagination.currentPage + 1)"
            :disabled="pagination.currentPage >= pagination.totalPages"
            class="px-4 py-2 border border-gray-300 text-sm font-medium text-venus-text-secondary hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </main>
    </div>

    <!-- Quick View Modal -->
    <ProductQuickView
      :is-open="isQuickViewOpen"
      :product-summary="selectedProductForQuickView"
      @close="closeQuickViewModal"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter, useNuxtApp, useHead } from '#app';
import ProductFilters from '~/components/ProductFilters.vue';
import ProductCard from '~/components/ProductCard.vue';
import ProductQuickView from '~/components/products/ProductQuickView.vue'; // Import the new component
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue'; // Assuming this exists
import FilterIcon from '~/components/icons/FilterIcon.vue'; // Assuming this exists

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const products = ref([]);
const categories = ref([]);
const pending = ref(true);
const error = ref(null);
const showMobileFilters = ref(false);

const filters = reactive({
  searchTerm: route.query.searchTerm || '',
  selectedCategoryId: route.query.category || null,
  minPrice: route.query.minPrice ? parseFloat(route.query.minPrice) : null,
  maxPrice: route.query.maxPrice ? parseFloat(route.query.maxPrice) : null,
  sortBy: route.query.sortBy || 'created_at_desc',
  selectedColorValueId: route.query.color || null,
  onSaleOnly: route.query.on_sale === 'true', // Added for sales filter
  page: route.query.page ? parseInt(route.query.page) : 1,
});

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  pageSize: 12, // Default page size
});

// For QuickView
const selectedProductForQuickView = ref(null);
const isQuickViewOpen = ref(false);

const openQuickViewModal = (product) => {
  selectedProductForQuickView.value = product;
  isQuickViewOpen.value = true;
};

const closeQuickViewModal = () => {
  isQuickViewOpen.value = false;
  selectedProductForQuickView.value = null;
};

async function fetchProducts() {
  pending.value = true;
  error.value = null;
  try {
    const params = {
      page: filters.page,
      limit: pagination.pageSize,
      category_id: filters.selectedCategoryId,
      search: filters.searchTerm,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      sort_by: filters.sortBy.split('_')[0], // e.g. price
      sort_order: filters.sortBy.split('_')[1], // e.g. asc
      color_value_id: filters.selectedColorValueId,
      on_sale: filters.onSaleOnly ? true : undefined, // Add on_sale to API params
    };

    // Remove null/undefined params
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });

    const response = await $axios.get('/products', { params });
    products.value = response.data.products || [];
    if (response.data.pagination) {
      pagination.currentPage = response.data.pagination.currentPage;
      pagination.totalPages = response.data.pagination.totalPages;
      pagination.totalItems = response.data.pagination.totalItems;
      pagination.pageSize = response.data.pagination.pageSize;
    } else {
      // Fallback if pagination is not in response
      pagination.currentPage = 1;
      pagination.totalPages = 1;
      pagination.totalItems = products.value.length;
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    error.value = err.response?.data || err;
    products.value = [];
  } finally {
    pending.value = false;
  }
}

async function fetchCategories() {
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data.categories || response.data || []; // Adjust based on actual API response
  } catch (err) {
    console.error('Error fetching categories:', err);
    // Handle error, maybe show a toast
  }
}

function updateQueryParameters() {
  const query = {};
  if (filters.searchTerm) query.searchTerm = filters.searchTerm;
  if (filters.selectedCategoryId) query.category = filters.selectedCategoryId;
  if (filters.minPrice !== null) query.minPrice = filters.minPrice;
  if (filters.maxPrice !== null) query.maxPrice = filters.maxPrice;
  if (filters.sortBy !== 'created_at_desc') query.sortBy = filters.sortBy;
  if (filters.selectedColorValueId) query.color = filters.selectedColorValueId;
  if (filters.onSaleOnly) query.on_sale = 'true'; // Add on_sale to URL query
  if (filters.page > 1) query.page = filters.page;

  router.push({ path: route.path, query });
}

function applyFilters(newFilters) {
  filters.searchTerm = newFilters.searchTerm;
  filters.selectedCategoryId = newFilters.selectedCategoryId;
  filters.minPrice = newFilters.minPrice;
  filters.maxPrice = newFilters.maxPrice;
  filters.sortBy = newFilters.sortBy;
  filters.selectedColorValueId = newFilters.selectedColorValueId;
  filters.page = 1; // Reset to first page when filters change

  updateQueryParameters();
  fetchProducts();
  if (showMobileFilters.value) {
    showMobileFilters.value = false;
  }
}

function resetFiltersAndFetch() {
  filters.searchTerm = '';
  filters.selectedCategoryId = null;
  filters.minPrice = null;
  filters.maxPrice = null;
  filters.sortBy = 'created_at_desc';
  filters.selectedColorValueId = null;
  filters.onSaleOnly = false; // Reset sale filter
  filters.page = 1;

  updateQueryParameters(); // This will clear the query params
  fetchProducts();
  if (showMobileFilters.value) {
    showMobileFilters.value = false;
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.totalPages) {
    filters.page = newPage;
    updateQueryParameters();
    fetchProducts();
    // Scroll to top of product list
    const productListElement = document.querySelector('main'); // Adjust selector if needed
    if (productListElement) {
      productListElement.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

onMounted(() => {
  fetchCategories();
  fetchProducts(); // Initial fetch based on query params or defaults
});

// Watch for route query changes if user navigates with browser back/forward
watch(() => route.query, (newQuery) => {
    filters.searchTerm = newQuery.searchTerm || '';
    filters.selectedCategoryId = newQuery.category || null;
    filters.minPrice = newQuery.minPrice ? parseFloat(newQuery.minPrice) : null;
    filters.maxPrice = newQuery.maxPrice ? parseFloat(newQuery.maxPrice) : null;
    filters.sortBy = newQuery.sortBy || 'created_at_desc';
    filters.selectedColorValueId = newQuery.color || null;
    filters.onSaleOnly = newQuery.on_sale === 'true'; // Update from URL query
    filters.page = newQuery.page ? parseInt(newQuery.page) : 1;
    fetchProducts();
}, { deep: true });


useHead({
  title: 'Our Products',
  meta: [
    { name: 'description', content: 'Browse our wide selection of products.' }
  ]
});

</script>

<style scoped>
/* Additional styles if needed */
</style>

<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold font-serif text-venus-text-primary">Sale Items</h1>
      <p class="mt-1 text-sm text-venus-text-secondary">Grab these deals before they're gone!</p>
    </div>

    <div class="lg:grid lg:grid-cols-4 lg:gap-8">
      <!-- Products Grid Column - Spans full width -->
      <main class="lg:col-span-4">
        <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          <ProductCardSkeleton v-for="n in 8" :key="`skeleton-${n}`" />
        </div>
        <div v-else-if="error" class="text-center py-10">
          <p class="text-red-500 text-lg">Error loading sale items: {{ error.message || 'Please try again later.' }}</p>
        </div>
        <div v-else-if="products.length === 0" class="text-center py-10">
          <p class="text-venus-text-secondary text-lg">No items currently on sale matching your criteria.</p>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
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
import ProductCard from '~/components/ProductCard.vue';
import ProductQuickView from '~/components/products/ProductQuickView.vue';
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue';

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const products = ref([]);
const pending = ref(true);
const error = ref(null);

// Filters will be driven by URL query parameters, set by AppHeader filter modal
const filters = reactive({
  searchTerm: route.query.searchTerm || '',
  selectedCategoryId: route.query.category || null,
  minPrice: route.query.minPrice ? parseFloat(route.query.minPrice) : null,
  maxPrice: route.query.maxPrice ? parseFloat(route.query.maxPrice) : null,
  sortBy: route.query.sortBy || 'created_at_desc', // Default sort for sale items
  selectedColorValueId: route.query.color || null,
  page: route.query.page ? parseInt(route.query.page) : 1,
});

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  pageSize: 12, // Default page size for sale page
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

async function fetchSaleProducts() {
  pending.value = true;
  error.value = null;
  try {
    const params = {
      page: filters.page,
      limit: pagination.pageSize,
      category_id: filters.selectedCategoryId,
      search_term: filters.searchTerm, // Corrected to search_term
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      sort_by: filters.sortBy.split('_')[0],
      sort_order: filters.sortBy.split('_')[1],
      color_value_id: filters.selectedColorValueId,
      on_sale: 'true', // Send as string 'true' instead of boolean true
    };

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
      pagination.currentPage = 1;
      pagination.totalPages = 1;
      pagination.totalItems = products.value.length;
    }
  } catch (err) {
    console.error('Error fetching sale products:', err);
    error.value = err.response?.data || err;
    products.value = [];
  } finally {
    pending.value = false;
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
  // on_sale=true is implicit for this page, so not needed in displayed URL query for user simplicity
  if (filters.page > 1) query.page = filters.page;

  router.push({ path: '/sale', query }); // Keep path as /sale
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.totalPages) {
    filters.page = newPage;
    updateQueryParameters(); // This will trigger the watcher which calls fetchSaleProducts
  }
}

onMounted(() => {
  fetchSaleProducts(); // Initial fetch
});

// Watch for route query changes (e.g., from AppHeader filter modal)
watch(() => route.query, (newQuery) => {
    filters.searchTerm = newQuery.searchTerm || '';
    filters.selectedCategoryId = newQuery.category || null;
    filters.minPrice = newQuery.minPrice ? parseFloat(newQuery.minPrice) : null;
    filters.maxPrice = newQuery.maxPrice ? parseFloat(newQuery.maxPrice) : null;
    filters.sortBy = newQuery.sortBy || 'created_at_desc';
    filters.selectedColorValueId = newQuery.color || null;
    filters.page = newQuery.page ? parseInt(newQuery.page) : 1;
    fetchSaleProducts();
}, { deep: true });


useHead({
  title: 'Sale Items - Great Deals!',
  meta: [
    { name: 'description', content: 'Check out our products currently on sale. Limited time offers!' }
  ]
});

</script>

<style scoped>
/* Styles specific to the sale page if needed */
</style>

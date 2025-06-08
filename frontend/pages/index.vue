<template>
  <div class="pb-8"> <!-- Added padding-bottom to the main container -->
    <HeroBanner v-bind="heroData" />

    <div class="p-4 md:p-8"> <!-- Added padding for content below hero -->
      <h1 class="text-3xl font-bold text-text-primary mb-8 text-center">Featured Products</h1>

      <!-- Updated Filters UI -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3 mb-8 p-4 bg-white rounded-lg shadow border border-neutral-medium">
        <input
          type="text"
          v-model="searchTerm"
          placeholder="Search products..."
          @keyup.enter="applyFiltersAndNavigate"
          class="flex-grow min-w-[200px] sm:min-w-[250px] px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
        />
        <select
          v-model="selectedCategoryId"
          class="min-w-[150px] sm:min-w-[180px] px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary bg-white pr-8"
        >
          <option :value="null">All Categories</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <input
          type="number"
          v-model.number="minPrice"
          placeholder="Min Price"
          class="w-24 sm:w-28 px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
        />
        <input
          type="number"
          v-model.number="maxPrice"
          placeholder="Max Price"
          class="w-24 sm:w-28 px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
        />
        <select
          v-model="sortBy"
          class="min-w-[150px] sm:min-w-[180px] px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary bg-white pr-8"
        >
          <option value="created_at_desc">Newest</option>
          <option value="created_at_asc">Oldest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name_asc">Name: A-Z</option>
          <option value="name_desc">Name: Z-A</option>
        </select>
        <button
          @click="applyFiltersAndNavigate"
          class="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
        >
          Apply
        </button>
        <button
          @click="resetFiltersAndNavigate"
          class="px-4 py-2 bg-neutral-medium text-text-primary text-sm font-medium rounded-md shadow-sm hover:bg-neutral-dark hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-dark transition-colors"
        >
          Reset
        </button>
      </div>

      <!-- Loading, Error, No Products States -->
      <div v-if="isLoading" class="text-center py-10">
        <p class="text-lg text-text-secondary">Loading products...</p>
        <!-- Optional: Add a spinner here -->
      </div>
      <div v-else-if="fetchError" class="text-center py-10">
        <p class="text-lg text-red-600">Error fetching products: {{ fetchError.message || 'Unknown error' }}</p>
        <button @click="fetchProducts" class="mt-4 px-4 py-2 bg-brand-primary text-white rounded hover:bg-opacity-90">Try Again</button>
      </div>
      <div v-else-if="!products.length" class="text-center py-10">
        <p class="text-lg text-text-secondary">No products found matching your criteria.</p>
      </div>

      <!-- Product Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <ProductCard v-for="product in products" :key="product.id" :product="product" />
      </div>

      <!-- Pagination Controls -->
      <div class="mt-8 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && products.length > 0 && paginationData.total_pages > 1">
        <button
          @click="changePage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-sm text-text-secondary">
          Page {{ currentPage }} of {{ paginationData.total_pages }}
        </span>
        <button
          @click="changePage(currentPage + 1)"
          :disabled="currentPage === paginationData.total_pages"
          class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useCart } from '~/composables/useCart';
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig } from '#app';
import ProductCard from '~/components/ProductCard.vue';
import HeroBanner from '~/components/HeroBanner.vue';

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart(); // Keep this if ProductCard might emit an add-to-cart event handled here

// --- Hero Banner Data ---
const heroData = ref({
  title: 'Summer Collection is Here!',
  subtitle: 'Discover the latest trends and refresh your wardrobe.',
  buttonText: 'Shop Now',
  buttonLink: '/products',
  imageUrl: 'https://via.placeholder.com/1200x500.png?text=Dynamic+Hero+Image'
});

// --- Product Data ---
const isMockDataActive = ref(false); // Set to false to enable API fetching
const products = ref([]); // Initialize as empty array

// --- State for Filters & Data Logic ---
const searchTerm = ref(route.query.search_term || '');
const selectedCategoryId = ref(route.query.category_id ? parseInt(route.query.category_id) : null);
const minPrice = ref(route.query.min_price ? parseFloat(route.query.min_price) : null);
const maxPrice = ref(route.query.max_price ? parseFloat(route.query.max_price) : null);
const sortBy = ref(route.query.sort_by || 'created_at_desc');
const currentPage = ref(route.query.page ? parseInt(route.query.page) : 1);
const limit = ref(10); // Products per page

const categories = ref([]);
const paginationData = ref({ total_products: 0, current_page: 1, limit: limit.value, total_pages: 1 });
const isLoading = ref(true); // Start with loading true
const fetchError = ref(null);
// const productAdded = ref({}); // This was for direct add to cart button on this page, ProductCard handles its own.

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

// --- Data Fetching ---
async function fetchCategories() {
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data;
  } catch (err) {
    console.error('Failed to fetch categories:', err);
  }
}

async function fetchProducts() {
  // if (isMockDataActive.value) return; // This check is no longer needed as isMockDataActive is false

  isLoading.value = true;
  fetchError.value = null;

  const params = {
    page: currentPage.value,
    limit: limit.value,
    sort_by: sortBy.value,
  };
  if (searchTerm.value) params.search_term = searchTerm.value;
  if (selectedCategoryId.value !== null) params.category_id = selectedCategoryId.value;
  if (minPrice.value !== null && minPrice.value !== '') params.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') params.max_price = maxPrice.value;

  try {
    const response = await $axios.get('/products', { params });
    products.value = response.data.products;
    paginationData.value = response.data.pagination;
    currentPage.value = response.data.pagination.current_page; // Sync current page from API response
  } catch (err) {
    console.error('Failed to fetch products:', err);
    fetchError.value = err.response?.data || err;
    products.value = [];
    paginationData.value = { total_products: 0, current_page: 1, limit: limit.value, total_pages: 1 };
  } finally {
    isLoading.value = false;
  }
}

// --- Event Handlers & Navigation ---
function applyFiltersAndNavigate() {
  currentPage.value = 1;
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value !== null) query.category_id = selectedCategoryId.value;
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value;
  // page will be handled by watcher or set if > 1
  if (currentPage.value > 1) query.page = currentPage.value; // Should be 1 here

  router.push({ path: '/', query });
  // fetchProducts() will be triggered by the watcher on route.query
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
    // fetchProducts() will be triggered by the watcher
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= paginationData.value.total_pages && newPage !== currentPage.value) {
    currentPage.value = newPage;
    const query = { ...route.query };
    if (newPage > 1) {
      query.page = newPage;
    } else {
      delete query.page;
    }
    router.push({ query }); // Watcher will call fetchProducts
  }
}

// --- Lifecycle & Watchers ---
onMounted(async () => {
  const query = route.query;
  searchTerm.value = query.search_term || '';
  selectedCategoryId.value = query.category_id ? parseInt(query.category_id) : null;
  minPrice.value = query.min_price ? parseFloat(query.min_price) : null;
  maxPrice.value = query.max_price ? parseFloat(query.max_price) : null;
  sortBy.value = query.sort_by || 'created_at_desc';
  currentPage.value = query.page ? parseInt(query.page) : 1;

  await fetchCategories();
  await fetchProducts(); // Directly call fetchProducts
});

watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    // Only fetch if query params relevant to filtering/pagination actually changed
    // This avoids re-fetching if, for example, a non-related query param was added/changed.
    const relevantNewQuery = {
        search_term: newQuery.search_term,
        category_id: newQuery.category_id,
        min_price: newQuery.min_price,
        max_price: newQuery.max_price,
        sort_by: newQuery.sort_by,
        page: newQuery.page
    };
    const relevantOldQuery = {
        search_term: oldQuery?.search_term,
        category_id: oldQuery?.category_id,
        min_price: oldQuery?.min_price,
        max_price: oldQuery?.max_price,
        sort_by: oldQuery?.sort_by,
        page: oldQuery?.page
    };

    if (JSON.stringify(relevantNewQuery) !== JSON.stringify(relevantOldQuery)) {
        // Update local refs from new query before fetching
        searchTerm.value = newQuery.search_term || '';
        selectedCategoryId.value = newQuery.category_id ? parseInt(newQuery.category_id) : null;
        minPrice.value = newQuery.min_price ? parseFloat(newQuery.min_price) : null;
        maxPrice.value = newQuery.max_price ? parseFloat(newQuery.max_price) : null;
        sortBy.value = newQuery.sort_by || 'created_at_desc';
        currentPage.value = newQuery.page ? parseInt(newQuery.page) : 1;
        await fetchProducts();
    }
  },
  { deep: true }
);

useHead({
  title: 'Home - Featured Products',
});
</script>

<style scoped>
/* Scoped styles for filters are now replaced by Tailwind utilities.
   This block can be emptied or removed if no other scoped styles are needed. */
</style>

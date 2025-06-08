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

      <!-- New Product Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <ProductCard v-for="product in products" :key="product.id" :product="product" />
      </div>

      <!-- Original loading/error/empty states and pagination - commented out for mock data -->
      <!--
      <div v-if="isLoading" class="loading">Loading products...</div>
      <div v-if="fetchError" class="error-message">
        <p>Error fetching products: {{ fetchError.message || fetchError }}</p>
      </div>
      <div v-if="!isLoading && !fetchError && products.length === 0 && !isMockDataActive">
        <p>No products found matching your criteria.</p>
      </div>
      <div class="pagination-controls" v-if="paginationData.total_pages > 1 && !isMockDataActive">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1 || isLoading">
          Previous
        </button>
        <span>Page {{ currentPage }} of {{ paginationData.total_pages }}</span>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage === paginationData.total_pages || isLoading">
          Next
        </button>
      </div>
      -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useCart } from '~/composables/useCart';
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig } from '#app';
import ProductCard from '~/components/ProductCard.vue';
import HeroBanner from '~/components/HeroBanner.vue'; // Import HeroBanner

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart();

// --- Hero Banner Data ---
const heroData = ref({
  title: 'Summer Collection is Here!',
  subtitle: 'Discover the latest trends and refresh your wardrobe.',
  buttonText: 'Shop Now',
  buttonLink: '/products', // Can be changed to a specific category page later
  imageUrl: 'https://via.placeholder.com/1200x500.png?text=Dynamic+Hero+Image'
});

// --- Mock Product Data ---
const isMockDataActive = ref(true); // Flag to control mock data usage
const products = ref([
  { id: 1, name: 'Stylish Summer Dress', price: 49.99, image_url: 'https://via.placeholder.com/300x300.png?text=Dress+1', category_name: 'Apparel' },
  { id: 2, name: 'Classic Leather Handbag', price: 129.00, image_url: 'https://via.placeholder.com/300x300.png?text=Handbag+1', category_name: 'Accessories' },
  { id: 3, name: 'Comfortable Running Shoes', price: 89.50, image_url: 'https://via.placeholder.com/300x300.png?text=Shoes+1', category_name: 'Footwear' },
  { id: 4, name: 'Elegant Gold Necklace', price: 299.99, image_url: 'https://via.placeholder.com/300x300.png?text=Necklace+1', category_name: 'Jewelry' },
  { id: 5, name: 'Modern Smartwatch X200', price: 199.00, image_url: 'https://via.placeholder.com/300x300.png?text=Watch+1', category_name: 'Electronics' },
]);

// --- State for Filters & Original Data Logic (partially kept for filter UI) ---
const searchTerm = ref(route.query.search_term || '');
const selectedCategoryId = ref(route.query.category_id ? parseInt(route.query.category_id) : null);
const minPrice = ref(route.query.min_price ? parseFloat(route.query.min_price) : null);
const maxPrice = ref(route.query.max_price ? parseFloat(route.query.max_price) : null);
const sortBy = ref(route.query.sort_by || 'created_at_desc');
const currentPage = ref(route.query.page ? parseInt(route.query.page) : 1);
const limit = ref(10);

// const originalProducts = ref([]); // To store products from API if we switch off mock data
const categories = ref([]); // Kept for filter dropdown
const paginationData = ref({ total_products: 0, current_page: 1, limit: limit.value, total_pages: 1 });
const isLoading = ref(false); // Set to false initially when using mock data
const fetchError = ref(null);
const productAdded = ref({}); // For "Add to Cart" button feedback

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

// --- Original Data Fetching (Commented out for mock data) ---
async function fetchCategories() {
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data;
  } catch (err) {
    console.error('Failed to fetch categories:', err);
  }
}

/*
async function fetchProducts() {
  if (isMockDataActive.value) return; // Don't fetch if using mock data

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
    originalProducts.value = response.data.products; // Store in originalProducts
    paginationData.value = response.data.pagination;
    currentPage.value = response.data.pagination.current_page;
  } catch (err) {
    console.error('Failed to fetch products:', err);
    fetchError.value = err.response?.data || err;
    originalProducts.value = [];
    paginationData.value = { total_products: 0, current_page: 1, limit: limit.value, total_pages: 1 };
  } finally {
    isLoading.value = false;
  }
}
*/

// --- Event Handlers & Navigation (Kept for filter UI functionality) ---
function applyFiltersAndNavigate() {
  // This would typically refetch products or filter client-side if not using mock data.
  // For now, it just updates the URL.
  currentPage.value = 1;
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value !== null) query.category_id = selectedCategoryId.value;
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value;
  if (currentPage.value > 1) query.page = currentPage.value;
  router.push({ path: '/', query });
  // If not using mock data, fetchProducts() would be called by a watcher or here.
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
    // If not using mock data, fetchProducts() would be called by a watcher or here.
}

function changePage(newPage) {
  // This would handle pagination if not using mock data.
  if (isMockDataActive.value) return;

  if (newPage > 0 && newPage <= paginationData.value.total_pages && newPage !== currentPage.value) {
    currentPage.value = newPage;
    const query = { ...route.query };
    if (newPage > 1) query.page = newPage;
    else delete query.page;
    router.push({ query });
  }
}

const handleAddToCart = (product) => {
  addToCart(product);
  productAdded.value[product.id] = true;
  setTimeout(() => {
    productAdded.value[product.id] = false;
  }, 1000);
};

// --- Lifecycle & Watchers ---
onMounted(async () => {
  // Initialize filter states from URL query parameters
  const query = route.query;
  searchTerm.value = query.search_term || '';
  selectedCategoryId.value = query.category_id ? parseInt(query.category_id) : null;
  minPrice.value = query.min_price ? parseFloat(query.min_price) : null;
  maxPrice.value = query.max_price ? parseFloat(query.max_price) : null;
  sortBy.value = query.sort_by || 'created_at_desc';
  currentPage.value = query.page ? parseInt(query.page) : 1;

  await fetchCategories(); // Fetch categories for the dropdown, this can stay

  // if (!isMockDataActive.value) { // Original logic
  //   await fetchProducts();
  // }
});

// Watcher for route query changes (simplified for mock data context)
watch(
  () => route.query,
  async (newQuery) => {
    if (isMockDataActive.value) return; // Don't act if using mock data

    // Update local refs from new query
    searchTerm.value = newQuery.search_term || '';
    selectedCategoryId.value = newQuery.category_id ? parseInt(newQuery.category_id) : null;
    minPrice.value = newQuery.min_price ? parseFloat(newQuery.min_price) : null;
    maxPrice.value = newQuery.max_price ? parseFloat(newQuery.max_price) : null;
    sortBy.value = newQuery.sort_by || 'created_at_desc';
    currentPage.value = newQuery.page ? parseInt(newQuery.page) : 1;

    // await fetchProducts(); // Original call to fetch products
  },
  { deep: true }
);

useHead({
  title: 'Home - Featured Products', // Updated title
});
</script>

<style scoped>
/* Scoped styles for filters are now replaced by Tailwind utilities.
   This block can be emptied or removed if no other scoped styles are needed. */
/*
.filters-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}
.filter-input, .filter-select {
  padding: 0.6rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9em;
}
.search-input { flex-grow: 1; min-width: 200px; }
.category-select, .sort-select { min-width: 150px; }
.price-input { width: 100px; }

.apply-filters-button, .reset-filters-button {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 0.9em;
}
.apply-filters-button { background-color: #007bff; }
.apply-filters-button:hover { background-color: #0056b3; }
.reset-filters-button { background-color: #6c757d; }
.reset-filters-button:hover { background-color: #545b62; }
*/
</style>

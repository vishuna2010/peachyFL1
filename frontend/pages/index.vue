<template>
  <div>
    <h1>Welcome to Our E-commerce Store!</h1>

    <div class="filters-container">
      <input type="text" v-model="searchTerm" placeholder="Search products..." @keyup.enter="applyFiltersAndNavigate" class="filter-input search-input" />

      <select v-model="selectedCategoryId" class="filter-select category-select">
        <option :value="null">All Categories</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>

      <input type="number" v-model.number="minPrice" placeholder="Min Price" class="filter-input price-input" />
      <input type="number" v-model.number="maxPrice" placeholder="Max Price" class="filter-input price-input" />

      <select v-model="sortBy" class="filter-select sort-select">
        <option value="created_at_desc">Newest</option>
        <option value="created_at_asc">Oldest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="name_asc">Name: A-Z</option>
        <option value="name_desc">Name: Z-A</option>
      </select>
      <button @click="applyFiltersAndNavigate" class="apply-filters-button">Apply Filters</button>
      <button @click="resetFiltersAndNavigate" class="reset-filters-button">Reset Filters</button>
    </div>

    <div v-if="isLoading" class="loading">Loading products...</div>
    <div v-if="fetchError" class="error-message">
      <p>Error fetching products: {{ fetchError.message || fetchError }}</p>
    </div>

    <div v-if="!isLoading && !fetchError && products.length > 0" class="product-list">
      <h2>Our Products ({{ paginationData.total_products }} found)</h2>
      <ul>
        <li v-for="product in products" :key="product.id" class="product-item">
          <NuxtLink :to="`/products/${product.id}`">
            <img
              v-if="product.image_url"
              :src="`${backendUrl}${product.image_url}`"
              :alt="`Image of ${product.name}`"
              class="product-image"
            />
            <div v-else class="product-image-placeholder">No Image</div>
            <h3>{{ product.name }}</h3>
          </NuxtLink>
          <p class="product-description">{{ product.description }}</p>
          <p><strong>Price:</strong> ${{ parseFloat(product.price).toFixed(2) }}</p>
          <p v-if="product.category_name"><strong>Category:</strong> {{ product.category_name }}</p>
          <div v-if="product.tags && product.tags.length > 0" class="tags">
            <strong>Tags:</strong>
            <span v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <button @click="handleAddToCart(product)" class="add-to-cart-button">
            {{ productAdded[product.id] ? 'Added!' : 'Add to Cart' }}
          </button>
        </li>
      </ul>
      <div class="pagination-controls" v-if="paginationData.total_pages > 1">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1 || isLoading">
          Previous
        </button>
        <span>Page {{ currentPage }} of {{ paginationData.total_pages }}</span>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage === paginationData.total_pages || isLoading">
          Next
        </button>
      </div>
    </div>
    <div v-if="!isLoading && !fetchError && products.length === 0">
      <p>No products found matching your criteria.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useCart } from '~/composables/useCart';
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig } from '#app';

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart();

// --- State for Filters & Data ---
const searchTerm = ref('');
const selectedCategoryId = ref(null);
const minPrice = ref(null);
const maxPrice = ref(null);
const sortBy = ref('created_at_desc'); // Default sort
const currentPage = ref(1);
const limit = ref(10); // Or make this configurable

const products = ref([]);
const categories = ref([]);
const paginationData = ref({
  total_products: 0,
  current_page: 1,
  limit: limit.value,
  total_pages: 1,
});
const isLoading = ref(true);
const fetchError = ref(null);
const productAdded = ref({}); // For "Add to Cart" button feedback

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

// --- Data Fetching ---
async function fetchCategories() {
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data;
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    // Handle error (e.g., show a message) or allow page to load without categories
  }
}

async function fetchProducts() {
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
    products.value = []; // Clear products on error
    paginationData.value = { total_products: 0, current_page: 1, limit: limit.value, total_pages: 1 }; // Reset pagination
  } finally {
    isLoading.value = false;
  }
}

// --- Event Handlers & Navigation ---
function applyFiltersAndNavigate() {
  currentPage.value = 1; // Reset to first page when filters change
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value !== null) query.category_id = selectedCategoryId.value;
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value; // Default, so only add if different
  if (currentPage.value > 1) query.page = currentPage.value; // Only add if not first page

  router.push({ path: '/', query });
  // fetchProducts will be triggered by the watcher on route.query
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
}


function changePage(newPage) {
  if (newPage > 0 && newPage <= paginationData.value.total_pages && newPage !== currentPage.value) {
    currentPage.value = newPage;
    // Update URL, which will trigger the watcher to fetch products
    const query = { ...route.query };
    if (newPage > 1) {
      query.page = newPage;
    } else {
      delete query.page; // Remove page from query if it's the first page
    }
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
  // Initialize filters from URL query parameters
  const query = route.query;
  searchTerm.value = query.search_term || '';
  selectedCategoryId.value = query.category_id ? parseInt(query.category_id) : null;
  minPrice.value = query.min_price ? parseFloat(query.min_price) : null;
  maxPrice.value = query.max_price ? parseFloat(query.max_price) : null;
  sortBy.value = query.sort_by || 'created_at_desc';
  currentPage.value = query.page ? parseInt(query.page) : 1;

  await fetchCategories(); // Fetch categories for the dropdown
  await fetchProducts();   // Fetch initial products based on URL or defaults
});

// Watch for route query changes to refetch products if not handled by button clicks
// This is useful for back/forward navigation or direct URL changes.
watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    // Basic check to avoid re-fetching if only non-filter query params changed or if it's the initial load handled by onMounted
    // A more sophisticated check might compare specific filter params.
    // For now, if query changes and it's not just a pagination change handled by changePage, re-evaluate.
    const newPage = newQuery.page ? parseInt(newQuery.page) : 1;
    const newSearch = newQuery.search_term || '';
    // This watcher primarily ensures that if the URL is changed manually or by browser nav, data updates.
    // Filter applications via buttons already update the URL and then this watcher will see the change.
    // We need to ensure onMounted values are set before this might trigger an unnecessary fetch.
    if (
        newPage !== currentPage.value ||
        newSearch !== searchTerm.value ||
        (newQuery.category_id ? parseInt(newQuery.category_id) : null) !== selectedCategoryId.value ||
        (newQuery.min_price ? parseFloat(newQuery.min_price) : null) !== minPrice.value ||
        (newQuery.max_price ? parseFloat(newQuery.max_price) : null) !== maxPrice.value ||
        (newQuery.sort_by || 'created_at_desc') !== sortBy.value
    ) {
        // Update local refs from new query (important if URL changed externally)
        searchTerm.value = newSearch;
        selectedCategoryId.value = newQuery.category_id ? parseInt(newQuery.category_id) : null;
        minPrice.value = newQuery.min_price ? parseFloat(newQuery.min_price) : null;
        maxPrice.value = newQuery.max_price ? parseFloat(newQuery.max_price) : null;
        sortBy.value = newQuery.sort_by || 'created_at_desc';
        currentPage.value = newPage;
        await fetchProducts();
    }
  },
  { deep: true }
);

useHead({
  title: 'Home - Products',
});
</script>

<style scoped>
.loading, .error-message {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
  text-align: center;
}
.loading { background-color: #e0e0e0; }
.error-message { background-color: #ffdddd; border: 1px solid #ff0000; color: #D8000C; }

.filters-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
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


.product-list { margin-top: 1.5rem; }
.product-list h2 { margin-bottom: 1rem; }
.product-list ul { list-style-type: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; }
.product-item {
  border: 1px solid #eee;
  padding: 1rem;
  border-radius: 5px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
}
.product-image, .product-image-placeholder {
  width: 100%;
  height: 200px;
  object-fit: cover;
  margin-bottom: 0.75rem;
  border-radius: 4px;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #777;
  font-size: 0.9em;
}
.product-item h3 { margin-top: 0; margin-bottom: 0.5rem; font-size: 1.2em; }
.product-item a { text-decoration: none; color: #007bff; }
.product-item a:hover h3 { text-decoration: underline; }
.product-description { font-size: 0.9em; color: #555; flex-grow: 1; margin-bottom: 0.5rem; }
.add-to-cart-button {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  margin-top: auto;
  align-self: flex-start;
}
.add-to-cart-button:hover { background-color: #218838; }
.tags { margin-top: 0.5rem; }
.tag {
  display: inline-block;
  background-color: #007bff;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8em;
  margin-right: 0.3rem;
}
.pagination-controls {
  margin-top: 2rem;
  text-align: center;
}
.pagination-controls button {
  padding: 0.6rem 1rem;
  margin: 0 0.5rem;
  border: 1px solid #ccc;
  background-color: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
}
.pagination-controls button:disabled { cursor: not-allowed; opacity: 0.6; }
.pagination-controls span { margin: 0 0.5rem; }
</style>

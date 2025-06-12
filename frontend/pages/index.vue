<template>
  <div class="pb-8">
    <HeroBanner v-bind="heroData" />

    <div class="p-4 md:p-8">
      <h1 class="text-3xl font-bold text-text-primary mb-8 text-center">Featured Products</h1>

      <!-- Mobile Filters Toggle Button -->
      <div class="lg:hidden mb-4 text-center">
        <button
          @click="toggleFilterSidebar"
          class="inline-flex items-center justify-center px-6 py-3 border border-neutral-dark rounded-md shadow-sm text-base font-medium text-text-primary bg-white hover:bg-neutral-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
          aria-label="Show filters"
          :aria-expanded="isFilterSidebarOpen.toString()"
        >
          <FilterIcon class="w-5 h-5 mr-2" />
          Filters
        </button>
      </div>

      <div class="lg:grid lg:grid-cols-4 lg:gap-x-6 xl:gap-x-8">
        <!-- Filters Column / Mobile Sidebar -->
        <div
          class="fixed inset-0 z-40 transform transition-transform duration-300 ease-in-out lg:static lg:inset-auto lg:translate-x-0 lg:z-auto lg:col-span-1 bg-white lg:bg-transparent p-6 lg:p-0 overflow-y-auto lg:overflow-visible shadow-xl lg:shadow-none lg:border-none border-r border-neutral-medium lg:sticky lg:top-24 h-full lg:h-auto"
          :class="isFilterSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
        >
          <div class="flex justify-between items-center lg:hidden mb-4">
            <h3 class="text-lg font-semibold text-text-primary">Filters</h3>
            <button @click="toggleFilterSidebar" class="p-2 -mr-2 rounded-md hover:bg-neutral-light focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary" aria-label="Close filters">
              <CloseIcon class="w-6 h-6" />
            </button>
          </div>
          <div class="flex flex-col gap-y-4">
            <input
              type="text"
              v-model="searchTerm"
              placeholder="Search products..."
              @keyup.enter="applyFiltersAndNavigate"
              class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
            />
            <select
              v-model="selectedCategoryId"
              class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary bg-white pr-8"
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
              class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
            />
            <input
              type="number"
              v-model.number="maxPrice"
              placeholder="Max Price"
              class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
            />
            <select
              v-model="sortBy"
              class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary bg-white pr-8"
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
              class="w-full px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
            >
              Apply
            </button>
            <button
              @click="resetFiltersAndNavigate"
              class="w-full px-4 py-2 bg-neutral-medium text-text-primary text-sm font-medium rounded-md shadow-sm hover:bg-neutral-dark hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-dark transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <!-- Products Column -->
        <div class="lg:col-span-3">
          <div v-if="isLoading" class="text-center py-10">
            <p class="text-lg text-text-secondary">Loading products...</p>
          </div>
          <div v-else-if="fetchError" class="text-center py-10">
            <p class="text-lg text-red-600">Error fetching products: {{ fetchError.message || 'Unknown error' }}</p>
            <button @click="fetchProducts" class="mt-4 px-4 py-2 bg-brand-primary text-white rounded hover:bg-opacity-90">Try Again</button>
          </div>
          <div v-else-if="!products.length" class="text-center py-10">
            <p class="text-lg text-text-secondary">No products found matching your criteria.</p>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig, useHead } from '#app'; // Added useHead
import ProductCard from '~/components/ProductCard.vue';
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue'; // Import skeleton
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
  buttonLink: '/products',
  imageUrl: 'https://via.placeholder.com/1200x500.png?text=Dynamic+Hero+Image'
});

const products = ref([]);

const searchTerm = ref(route.query.search_term || '');
const selectedCategoryId = ref(route.query.category_id ? parseInt(route.query.category_id) : null);
const minPrice = ref(route.query.min_price ? parseFloat(route.query.min_price) : null);
const maxPrice = ref(route.query.max_price ? parseFloat(route.query.max_price) : null);
const sortBy = ref(route.query.sort_by || 'created_at_desc');
const currentPage = ref(route.query.page ? parseInt(route.query.page) : 1);
const limit = ref(12);

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

const isFilterSidebarOpen = ref(false);
const toggleFilterSidebar = () => {
  isFilterSidebarOpen.value = !isFilterSidebarOpen.value;
};

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

async function fetchCategories() {
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data;
  } catch (err) {
    console.error('Failed to fetch categories:', err);
  }
}

async function fetchProducts(pageToFetch = currentPage.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/products', {
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
    paginationData.value = response.data.pagination;
    currentPage.value = response.data.pagination.current_page;
    if (router && String(route.query.page || 1) !== String(currentPage.value)) {
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

function applyFiltersAndNavigate() {
  currentPage.value = 1;
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value !== null) query.category_id = selectedCategoryId.value;
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value;
  router.push({ path: '/', query });
  if (isFilterSidebarOpen.value) toggleFilterSidebar();
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
    if (isFilterSidebarOpen.value) toggleFilterSidebar();
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= paginationData.value.totalPages && newPage !== currentPage.value) {
    currentPage.value = newPage;
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
  const query = route.query;
  searchTerm.value = query.search_term || '';
  selectedCategoryId.value = query.category_id ? parseInt(query.category_id) : null;
  minPrice.value = query.min_price ? parseFloat(query.min_price) : null;
  maxPrice.value = query.max_price ? parseFloat(query.max_price) : null;
  sortBy.value = query.sort_by || 'created_at_desc';
  currentPage.value = query.page ? parseInt(query.page) : 1;

  await fetchCategories();
  await fetchProducts(currentPage.value);
});

watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    const newPage = newQuery.page ? parseInt(newQuery.page) : 1;
    const oldPage = oldQuery?.page ? parseInt(oldQuery.page) : 1;

    const filtersChanged =
        (newQuery.search_term || '') !== (oldQuery?.search_term || '') ||
        (newQuery.category_id ? parseInt(newQuery.category_id) : null) !== (oldQuery?.category_id ? parseInt(oldQuery.category_id) : null) ||
        (newQuery.min_price ? parseFloat(newQuery.min_price) : null) !== (oldQuery?.min_price ? parseFloat(oldQuery.min_price) : null) ||
        (newQuery.max_price ? parseFloat(newQuery.max_price) : null) !== (oldQuery?.max_price ? parseFloat(oldQuery.max_price) : null) ||
        (newQuery.sort_by || 'created_at_desc') !== (oldQuery?.sort_by || 'created_at_desc');

    if (filtersChanged) {
        currentPage.value = 1;
        await fetchProducts(1);
    } else if (newPage !== oldPage || newPage !== currentPage.value) {
        currentPage.value = newPage;
        await fetchProducts(newPage);
    } else if (!products.value.length && !isLoading.value && !fetchError.value && newPage === currentPage.value) {
        await fetchProducts(newPage);
    }
  },
  { deep: true }
);

useHead({
  title: 'Home - Featured Products',
});
</script>

<style scoped>
/* All styles are now handled by Tailwind utility classes. */
</style>

<template>
  <div class="pb-8">
    <HeroBanner v-bind="heroData" />

    <div class="py-6 bg-venus-background">
      <div class="container mx-auto space-y-4 px-4">
        <PromotionalBanner
          mainText="IT'S ALL ON SALE! Extra 35% off sale & outlet w/"
          linkText="HURRYANDSHOP"
          linkUrl="#"
          type="primary"
        />
        <PromotionalBanner
          title="FREE SHIPPING OVER $75+"
          mainText="No Code, Just Shop!"
          type="secondary"
        />
      </div>
    </div>

    <section class="py-12 bg-venus-background">
      <div class="container mx-auto px-4">
        <h2 class="text-3xl font-serif text-venus-text-primary text-center mb-8">Shop By Category</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <CategoryHighlightCard
            categoryName="Dresses"
            imageUrl="https://images.unsplash.com/photo-1595991209266-5ff5a3a2f020?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80"
            categoryLink="#"
          />
          <CategoryHighlightCard
            categoryName="The Swim Shop"
            imageUrl="https://images.unsplash.com/photo-1500304400269-bac1eda94035?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80"
            categoryLink="#"
          />
          <CategoryHighlightCard
            categoryName="New Arrivals"
            imageUrl="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80"
            categoryLink="#"
          />
        </div>
      </div>
    </section>

    <section class="py-12 bg-venus-neutral-light"> <!-- Using a slightly different bg for visual separation -->
      <div class="container mx-auto px-4">
        <h2 class="text-3xl font-serif text-venus-text-primary text-center mb-8">Best Sellers</h2>
        <div class="text-center text-venus-text-secondary">
          <p>Our most loved looks - this section is under construction!</p>
          <!-- Placeholder for a grid of product cards later -->
          <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 opacity-50">
            <div class="h-64 bg-venus-neutral-medium rounded-sm animate-pulse"></div>
            <div class="h-64 bg-venus-neutral-medium rounded-sm animate-pulse"></div>
            <div class="h-64 bg-venus-neutral-medium rounded-sm animate-pulse md:block hidden"></div>
            <div class="h-64 bg-venus-neutral-medium rounded-sm animate-pulse lg:block hidden"></div>
          </div>
        </div>
      </div>
    </section>

    <div class="p-4 md:p-8">
      <h1 class="text-3xl font-serif text-peach-pink mb-6 text-center" id="products">Featured Products</h1> <!-- Themed title -->

      <!-- Main Search Bar -->
      <div class="mb-8 max-w-2xl mx-auto">
        <form @submit.prevent="applyFiltersAndNavigate" class="relative">
          <input
            type="search"
            v-model="searchTerm"
            placeholder="Search products..."
            class="w-full px-4 py-3 text-lg border-gray-300 rounded-lg shadow-sm focus:ring-peach-pink focus:border-peach-pink"
          />
          <button type="submit" class="absolute right-0 top-0 bottom-0 px-6 bg-peach-pink text-white rounded-r-lg hover:bg-opacity-90 flex items-center justify-center">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path></svg>
          </button>
        </form>
      </div>

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
          <div class="relative flex-1 flex flex-col max-w-xs w-full bg-venus-background shadow-2xl transform transition-transform duration-300 ease-in-out"
               :class="isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'">
            <div class="absolute top-0 right-0 -mr-12 pt-2 z-50">
              <button
                type="button"
                class="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-venus-accent-gold/50 text-venus-text-primary hover:text-venus-accent-gold"
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
          <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6">
            <ProductCardSkeleton v-for="n in limit" :key="`skeleton-${n}`" />
          </div>
          <div v-else-if="fetchError" class="text-center py-10">
            <p class="text-lg text-red-600">Error fetching products: {{ fetchError.message || 'Unknown error' }}</p>
            <button @click="() => fetchProducts(currentPage)" class="mt-4 px-4 py-2 bg-brand-primary text-white rounded hover:bg-opacity-90 font-semibold transition-all duration-200 ease-in-out hover:scale-105 transform">Try Again</button>
          </div>
          <div v-else-if="!products.length" class="text-center py-10">
            <p class="text-lg text-venus-text-secondary">No products found matching your criteria.</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6">
            <ProductCard v-for="product in products" :key="product.id" :product="product" @open-quick-view="openQuickViewModal" />
          </div>

          <!-- QuickView Modal -->
          <div v-if="isQuickViewModalVisible && productForQuickView"
               class="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 transition-opacity duration-300 ease-in-out"
               :class="isQuickViewModalVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'">
            <div
              class="bg-neutral-bg-soft p-5 sm:p-6 rounded-lg shadow-2xl max-w-3xl w-full mx-auto overflow-y-auto max-h-[90vh] transform transition-all duration-300 ease-out"
              :class="isQuickViewModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'"
              role="dialog" aria-modal="true" :aria-labelledby="`quickview-title-${productForQuickView.id}`"
            >
              <div class="flex justify-between items-start mb-4">
                <h3 :id="`quickview-title-${productForQuickView.id}`" class="text-2xl font-semibold text-peach-pink">{{ productForQuickView.name }}</h3>
                <button @click="closeQuickViewModal" aria-label="Close quick view" class="p-1 text-venus-text-secondary hover:text-peach-pink transition-colors duration-150 rounded-full hover:bg-neutral-light focus:outline-none focus:ring-2 focus:ring-peach-pink">
                  <CloseIcon class="w-6 h-6" />
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div class="border border-neutral-light rounded-md p-2 bg-white shadow-sm">
                  <img :src="productForQuickView.image_url || 'https://via.placeholder.com/300x300.png?text=No+Image'" :alt="productForQuickView.name" class="w-full h-auto object-contain rounded max-h-80 md:max-h-96">
                </div>
                <div class="flex flex-col">
                  <p class="text-venus-text-secondary mb-3 text-sm leading-relaxed line-clamp-4">{{ productForQuickView.description }}</p>
                  <p class="text-3xl font-bold text-orange-gold my-2">
                    {{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(productForQuickView.price) }}
                  </p>
                  <div class="text-xs text-venus-text-secondary space-y-0.5 mb-3">
                    <p v-if="productForQuickView.sku">SKU: {{ productForQuickView.sku }}</p>
                    <p v-if="productForQuickView.category_name">Category: <span class="text-sky-blue">{{ productForQuickView.category_name }}</span></p>
                  </div>

                  <div v-if="productForQuickView.has_variants" class="my-3 p-3 bg-sky-blue/10 border border-sky-blue/30 rounded-md text-sm text-sky-blue">
                    This product has options (e.g., size, color). View full details to select.
                  </div>

                  <div class="mt-auto pt-4 space-y-3"> {/* Pushes buttons to bottom */}
                    <NuxtLink
                      :to="`/products/${productForQuickView.id}`"
                      @click="closeQuickViewModal"
                      class="block w-full bg-peach-pink text-white text-center py-2.5 px-4 rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink transition-all duration-200 font-semibold"
                    >
                      View Full Details
                    </NuxtLink>
                    {/* Placeholder for a direct Add to Cart if product has NO variants and is in stock */}
                    <button
                      v-if="!productForQuickView.has_variants && productForQuickView.stock_quantity > 0"
                      @click="() => { handleDirectAddToCart(productForQuickView); closeQuickViewModal(); }"
                      class="block w-full bg-fresh-green text-white text-center py-2.5 px-4 rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-fresh-green transition-all duration-200 font-semibold"
                    >
                      Add to Cart
                    </button>
                     <p v-if="!productForQuickView.has_variants && productForQuickView.stock_quantity <= 0" class="text-sm text-center text-red-500 font-medium">Out of Stock</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && products.length > 0 && paginationData.totalPages > 1">
            <button
              @click="changePage(currentPage - 1)"
              :disabled="!paginationData.hasPrevPage"
              class="px-4 py-2 border border-venus-neutral-medium text-venus-text-secondary hover:bg-venus-neutral-light hover:text-venus-text-primary rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out"
            >
              Previous
            </button>
            <span class="text-sm text-venus-text-secondary">
              Page {{ paginationData.page }} of {{ paginationData.totalPages }}
            </span>
            <button
              @click="changePage(currentPage + 1)"
              :disabled="!paginationData.hasNextPage"
              class="px-4 py-2 border border-venus-neutral-medium text-venus-text-secondary hover:bg-venus-neutral-light hover:text-venus-text-primary rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out"
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
import { useToast } from 'vue-toastification';
import { sanitizeAttributeValue } from '~/utils/sanitize';
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig, useHead } from '#app';
import ProductCard from '~/components/ProductCard.vue';
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue';
import ProductFilters from '~/components/ProductFilters.vue';
import HeroBanner from '~/components/HeroBanner.vue';
import PromotionalBanner from '~/components/PromotionalBanner.vue';
import CategoryHighlightCard from '~/components/CategoryHighlightCard.vue';
import FilterIcon from '~/components/icons/FilterIcon.vue';
import CloseIcon from '~/components/icons/CloseIcon.vue';

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart();
const toast = useToast();

const heroData = ref({
  title: 'Golden Hour Glow', // Example from venus.com text
  subtitle: 'Sunset pinks, vibrant oranges, brand-new styles. Summer nights just met their match.',
  buttonText: 'SHOP NEW ARRIVALS',
  buttonLink: '#', // Assuming a "/new" route exists
  imageUrl: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80' // A fashion/summer vibe image
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

// QuickView Modal State
const productForQuickView = ref(null);
const isQuickViewModalVisible = ref(false);

const openQuickViewModal = (product) => {
  productForQuickView.value = product;
  isQuickViewModalVisible.value = true;
  // Optional: Disable body scroll here
};

const closeQuickViewModal = () => {
  isQuickViewModalVisible.value = false;
  productForQuickView.value = null;
  // Optional: Enable body scroll here
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

const handleDirectAddToCart = (product) => {
  if (!product) {
    toast.error("Cannot add product to cart: product data is missing.");
    return;
  }

  // Use product.final_price if available, otherwise product.price
  const priceForCart = parseFloat(
    (product.final_price !== undefined && product.final_price !== null)
    ? product.final_price
    : product.price
  );

  if (!product.has_variants && product.stock_quantity && product.stock_quantity > 0 && !isNaN(priceForCart)) {
    const cartItemData = {
      id: product.id, // Use product ID as item ID if no variants
      product_id: product.id,
      variant_id: null,
      name: sanitizeAttributeValue(product.name),
      price: priceForCart,
      sku: sanitizeAttributeValue(product.sku || ''), // Ensure SKU is at least an empty string
      image_url: sanitizeAttributeValue(product.image_url || 'https://via.placeholder.com/300x300.png?text=No+Image'),
      type: 'product', // In QuickView, we are adding the base product
      tax_class_id: product.tax_class_id || null,
      tax_class_name: product.tax_class_name || null,
    };
    addToCart(cartItemData, 1);
    toast.success(`${sanitizeAttributeValue(product.name)} added to cart!`);
  } else if (product.has_variants) {
    toast.info("This product has options. Please view full details to select.");
  } else {
    toast.error("Item is out of stock or unavailable.");
  }
  // closeQuickViewModal(); // Already called in the template's @click handler
};

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

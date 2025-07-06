<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6">
      <div v-if="categoryPending" class="h-10 bg-gray-200 rounded w-1/2 animate-pulse mb-2"></div>
      <h1 v-else-if="category" class="text-3xl font-bold font-serif text-venus-text-primary">
        {{ category.name }}
      </h1>
      <p v-else-if="categoryError" class="text-2xl text-red-500">Category not found.</p>
      <p v-if="category && category.description" class="mt-2 text-venus-text-secondary">{{ category.description }}</p>
      <!-- Breadcrumbs can be added here: Home > Categories > {{ category.name }} -->
    </div>

    <div class="lg:grid lg:grid-cols-4 lg:gap-8">
      <!-- Filters Column (Desktop) - Removed -->
      <!-- <aside class="hidden lg:block lg:col-span-1"> ... </aside> -->

      <!-- Products Grid Column - Spans full width now -->
      <main class="lg:col-span-4">
        <!-- Mobile Filter Trigger - Removed -->
        <!-- <div class="lg:hidden mb-4"> ... </div> -->

        <!-- Mobile Filters Panel - Removed -->
        <!-- <div v-if="showMobileFilters" class="lg:hidden mb-6"> ... </div> -->

        <div v-if="productsPending" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <ProductCardSkeleton v-for="n in 6" :key="`skeleton-${n}`" />
        </div>
        <div v-else-if="productsError" class="text-center py-10">
          <p class="text-red-500 text-lg">Error loading products for this category: {{ productsError.message || 'Please try again later.' }}</p>
        </div>
        <div v-else-if="products.length === 0" class="text-center py-10">
          <p class="text-venus-text-secondary text-lg">No products found in this category matching your criteria.</p>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            @open-quick-view="openQuickViewModalHandler"
          />
        </div>

        <!-- Pagination -->
        <div v-if="!productsPending && !productsError && products.length > 0 && pagination.totalPages > 1" class="mt-10 flex justify-center items-center space-x-3">
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

    <ProductQuickView
      :is-open="isQuickViewOpen"
      :product-summary="selectedProductForQuickView"
      @close="closeQuickViewModalHandler"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter, useNuxtApp, useHead } from '#app';
// import ProductFilters from '~/components/ProductFilters.vue'; // Removed
import ProductCard from '~/components/ProductCard.vue';
import ProductQuickView from '~/components/products/ProductQuickView.vue';
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue';
// import FilterIcon from '~/components/icons/FilterIcon.vue'; // Removed

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const categorySlug = computed(() => route.params.slug);

const category = ref(null);
const categoryPending = ref(true);
const categoryError = ref(null);

const products = ref([]);
const productsPending = ref(true);
const productsError = ref(null);

// const allCategories = ref([]); // No longer needed for page-level filters
// const showMobileFilters = ref(false); // Removed

const filters = reactive({ // This will now be driven by AppHeader's filter via URL query
  searchTerm: route.query.searchTerm || '',
  // selectedCategoryId will be primarily driven by the page's category context,
  // but we might allow ProductFilters to still show and select other categories.
  // For now, ProductFilters will get the main category ID, but its own selection will override.
  selectedCategoryId: null, // This will be set after fetching the current category
  minPrice: route.query.minPrice ? parseFloat(route.query.minPrice) : null,
  maxPrice: route.query.maxPrice ? parseFloat(route.query.maxPrice) : null,
  sortBy: route.query.sortBy || 'created_at_desc',
  selectedColorValueId: route.query.color || null,
  onSaleOnly: route.query.on_sale === 'true',
  page: route.query.page ? parseInt(route.query.page) : 1,
});

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  pageSize: 12,
});

// QuickView State
const selectedProductForQuickView = ref(null);
const isQuickViewOpen = ref(false);

const openQuickViewModalHandler = (product) => {
  selectedProductForQuickView.value = product;
  isQuickViewOpen.value = true;
};
const closeQuickViewModalHandler = () => {
  isQuickViewOpen.value = false;
  selectedProductForQuickView.value = null;
};

async function fetchCategoryDetails() {
  categoryPending.value = true;
  categoryError.value = null;
  try {
    // Assuming an endpoint like /api/categories?slug=:slug or /api/categories/:id if slug is just id
    // For this example, let's assume the API can find by slug.
    // If the API returns an array, take the first one.
    const response = await $axios.get(`/categories/slug/${categorySlug.value}`);
    // Ensure we get a single category object
    const foundCategory = Array.isArray(response.data) ? response.data[0] : response.data;

    if (foundCategory && foundCategory.id) {
      category.value = foundCategory;
      filters.selectedCategoryId = foundCategory.id; // Pre-select this category in filters
    } else {
      category.value = null;
      // throw createError({ statusCode: 404, statusMessage: 'Category not found', fatal: true });
      categoryError.value = { message: 'Category details not found.' };
    }
  } catch (err) {
    category.value = null;
    categoryError.value = err.response?.data || err;
     if (err.response?.status === 404) {
        // Use Nuxt's error handling for 404
        // throw createError({ statusCode: 404, statusMessage: 'Category not found', fatal: true });
    }
  } finally {
    categoryPending.value = false;
  }
}

async function fetchProductsForCategory() {
  // Ensure category is loaded before fetching products
  if (categoryPending.value) {
    // If category is still loading, wait for it or handle appropriately.
    // This might involve the watcher on categorySlug to trigger this fetch once category is loaded.
    // For now, if category isn't loaded, we might not fetch or show an intermediate state.
    return;
  }

  if (!category.value && !categoryError.value) {
      productsPending.value = false;
      if(!categoryPending.value && !category.value) {
          products.value = [];
          productsError.value = { message: "Category not found, cannot load products."};
      }
      return;
  }
   if (categoryError.value) {
    productsPending.value = false;
    products.value = [];
    return;
  }

  productsPending.value = true;
  productsError.value = null;
  try {
    const params = {
      page: filters.page,
      limit: pagination.pageSize,
      category_id: category.value?.id, // Primarily use the current category ID
      // If filters.selectedCategoryId is different (e.g. user selected sub-category in filter),
      // backend should handle this. For now, assuming category_id is the primary driver.
      // If ProductFilters allows changing category, that filters.selectedCategoryId would be used.
      // For simplicity, let's assume the main category.id is the one we use.
      // A more complex setup might involve checking if filters.selectedCategoryId is a child of category.value.id
      search: filters.searchTerm,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      sort_by: filters.sortBy.split('_')[0],
      sort_order: filters.sortBy.split('_')[1],
      color_value_id: filters.selectedColorValueId,
      on_sale: filters.onSaleOnly ? 'true' : undefined,
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
    productsError.value = err.response?.data || err;
    products.value = [];
  } finally {
    productsPending.value = false;
  }
}

function updateQueryParameters() {
  const query = {};
  // We don't put category slug or ID in query, it's part of the route path
  if (filters.searchTerm) query.searchTerm = filters.searchTerm;
  if (filters.minPrice !== null) query.minPrice = filters.minPrice;
  if (filters.maxPrice !== null) query.maxPrice = filters.maxPrice;
  if (filters.sortBy !== 'created_at_desc') query.sortBy = filters.sortBy;
  if (filters.selectedColorValueId) query.color = filters.selectedColorValueId;
  if (filters.onSaleOnly) query.on_sale = 'true';
  if (filters.page > 1) query.page = filters.page;
  // If filters.selectedCategoryId is different from current category.id due to ProductFilters usage,
  // it might be useful to reflect that in query too, or navigate to that category page.
  // For now, keeping it simple: filters apply within the context of the current category page.

  router.push({ path: route.path, query }); // path already contains /categories/[slug]
}

// applyFilters and resetFiltersAndFetch are removed as filters are now global via AppHeader

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.totalPages) {
    filters.page = newPage;
    updateQueryParameters();
    fetchProductsForCategory();
    const mainElement = document.querySelector('main');
    if (mainElement) mainElement.scrollIntoView({ behavior: 'smooth' });
  }
}

onMounted(async () => {
  await fetchCategoryDetails();
  // await fetchAllCategoriesForFilter(); // Removed
  if (category.value) { // Only fetch products if category was found
    await fetchProductsForCategory();
  } else if (!categoryPending.value && !category.value) { // If category loading finished and no category
    productsPending.value = false;
    products.value = [];
  }
});

// Watch for route param changes (e.g. navigating from one category page to another)
watch(() => route.params.slug, async (newSlug, oldSlug) => {
  if (newSlug !== oldSlug) {
    // Reset states before fetching new category data
    category.value = null;
    products.value = [];
    // filters.selectedCategoryId = null; // Will be set by fetchCategoryDetails
    // Reset other filters from query or to default
    filters.searchTerm = route.query.searchTerm || '';
    filters.minPrice = route.query.minPrice ? parseFloat(route.query.minPrice) : null;
    filters.maxPrice = route.query.maxPrice ? parseFloat(route.query.maxPrice) : null;
    filters.sortBy = route.query.sortBy || 'created_at_desc';
    filters.selectedColorValueId = route.query.color || null;
    filters.onSaleOnly = route.query.on_sale === 'true';
    filters.page = route.query.page ? parseInt(route.query.page) : 1;

    await fetchCategoryDetails();
    if (category.value) {
      await fetchProductsForCategory();
    } else if (!categoryPending.value && !category.value) {
        productsPending.value = false;
        products.value = [];
    }
  }
});

// Watch for query param changes (filters, page)
watch(() => route.query, (newQuery, oldQuery) => {
    // Avoid refetch if only slug changed (handled by above watcher)
    if (route.params.slug === oldQuery?.slug) { // This check might be tricky if oldQuery doesn't have slug
        filters.searchTerm = newQuery.searchTerm || '';
        filters.minPrice = newQuery.minPrice ? parseFloat(newQuery.minPrice) : null;
        filters.maxPrice = newQuery.maxPrice ? parseFloat(newQuery.maxPrice) : null;
        filters.sortBy = newQuery.sortBy || 'created_at_desc';
        filters.selectedColorValueId = newQuery.color || null;
        filters.onSaleOnly = newQuery.on_sale === 'true';
        filters.page = newQuery.page ? parseInt(newQuery.page) : 1;

        // If category is loaded, fetch products.
        // This also handles cases where category was initially not found, but then URL query changes.
        if (category.value) {
            fetchProductsForCategory();
        } else if (!categoryPending.value && !category.value) {
            // If no category, ensure products are empty and not pending.
            products.value = [];
            productsPending.value = false;
        }
        // If category is still pending, fetchProductsForCategory will be called once category loads.
    }
}, { deep: true });


useHead(computed(() => ({
  title: categoryPending.value ? 'Loading Category...' : (category.value?.name || 'Category Not Found'),
  meta: [
    { name: 'description', content: category.value?.description || `Browse products in the ${category.value?.name || categorySlug.value} category.` }
  ]
})));

</script>

<style scoped>
/* Styles specific to this page */
</style>

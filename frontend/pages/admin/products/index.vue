<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-semibold text-gray-800">Product Management</h1>
      <NuxtLink
        to="/admin/products/new"
        class="mt-3 sm:mt-0 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Create New Product
      </NuxtLink>
    </div>

    <div
      v-if="actionMessage"
      :class="[
        'p-3 mb-4 text-sm rounded-md border',
        actionError ? 'text-red-700 bg-red-100 border-red-200' : 'text-green-700 bg-green-100 border-green-200'
      ]"
      role="alert"
    >
      {{ actionMessage }}
    </div>

    <!-- Filters -->
    <div class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <input
          type="text"
          v-model="searchTerm"
          placeholder="Search products (name, SKU)..."
          @keyup.enter="applyFilters"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <!-- Add other filters like category, stock status, etc. here if needed -->
        <div class="col-span-1 sm:col-span-2 md:col-span-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
           <button
            @click="applyFilters"
            class="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Search
          </button>
          <button
            @click="resetFilters"
            class="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Clear Search
          </button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-10 text-lg text-gray-500">
      Loading products...
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      Error fetching products: {{ fetchError.message || fetchError }}
    </div>

    <div v-else-if="products.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl mb-2">No products found.</p>
      <p class="text-sm">
        Try adjusting your search terms or
        <NuxtLink to="/admin/products/new" class="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">create a new product</NuxtLink>.
      </p>
    </div>

    <div v-else class="bg-white shadow-md rounded-lg border border-gray-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="product in products" :key="product.id" class="hover:bg-gray-50 transition-colors duration-150">
            <td class="px-6 py-4 whitespace-nowrap">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="w-12 h-12 object-cover rounded border border-gray-200"
              />
              <div v-else class="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-400 text-xs rounded border border-gray-200">N/A</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ product.name }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.sku || 'N/A' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${{ parseFloat(product.price).toFixed(2) }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.stock_quantity }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.category_name || 'N/A' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.supplier_name || 'N/A' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <NuxtLink :to="`/admin/products/edit/${product.id}`" class="text-indigo-600 hover:text-indigo-900 hover:underline">Edit</NuxtLink>
              <button @click="confirmDeleteProduct(product)" class="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50" :disabled="deletingId === product.id">
                {{ deletingId === product.id ? 'Deleting...' : 'Delete' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-6 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && products.length > 0 && pagination.total_pages > 1">
        <button @click="changePage(pagination.current_page - 1)" :disabled="pagination.current_page <= 1"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <span class="text-sm text-gray-700">
          Page {{ pagination.current_page }} of {{ pagination.total_pages }}
        </span>
        <button @click="changePage(pagination.current_page + 1)" :disabled="pagination.current_page >= pagination.total_pages"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, useRoute, useRouter, definePageMeta, useHead } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Product Management'
});

useHead({
  title: 'Admin - Product Management',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const products = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const deletingId = ref(null);
const searchTerm = ref(route.query.search_term || '');

const actionMessage = ref('');
const actionError = ref(false);

const pagination = ref({
  total_products: 0,
  current_page: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 10,
  total_pages: 1,
});

async function fetchProducts() {
  isLoading.value = true;
  fetchError.value = null;

  const params = {
    page: pagination.value.current_page,
    limit: pagination.value.limit
  };
  if (searchTerm.value) {
    params.search_term = searchTerm.value;
  }

  // try {
  //   const response = await $axios.get('/products', { params }); // Uses public /api/products
  //   products.value = response.data.products;
  //   pagination.value.total_products = response.data.pagination.total_products;
  //   pagination.value.total_pages = response.data.pagination.total_pages;
  //   pagination.value.current_page = response.data.pagination.current_page;
  // } catch (err) {
  //   console.error('Failed to fetch products:', err);
  //   fetchError.value = err.response?.data || err;
  // } finally {
  //   isLoading.value = false;
  // }
  // Simulate successful load with no data for now
  products.value = [];
  pagination.value.total_products = products.value.length;
  pagination.value.total_pages = 1;
  pagination.value.current_page = 1;
  isLoading.value = false;
  fetchError.value = null;
}

function applyFilters() {
    pagination.value.current_page = 1;
    const query = { ...route.query, page: pagination.value.current_page, limit: pagination.value.limit };
    if (searchTerm.value) {
        query.search_term = searchTerm.value;
    } else {
        delete query.search_term; // Remove search_term from query if empty
    }
    // Ensure page is 1 or undefined, not other falsy values
    if (query.page === 1) delete query.page;
    router.push({ query });
}

function resetFilters() {
    searchTerm.value = '';
    pagination.value.current_page = 1;
    router.push({ query: { limit: pagination.value.limit } }); // Only keep limit, reset page and search
}


function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.total_pages && newPage !== pagination.value.current_page) {
    const query = { ...route.query, page: newPage, limit: pagination.value.limit };
    if (searchTerm.value) query.search_term = searchTerm.value;
    if (query.page === 1) delete query.page; // Clean URL if page is 1
    router.push({ query });
  }
}

async function confirmDeleteProduct(product) {
  if (confirm(`Are you sure you want to delete product "${product.name}" (ID: ${product.id})? This action cannot be undone.`)) {
    deletingId.value = product.id;
    actionMessage.value = ''; actionError.value = false;
    try {
      await $axios.delete(`/products/${product.id}`); // Uses public /api/products/:id
      actionMessage.value = `Product "${product.name}" deleted successfully.`;
      actionError.value = false;
      if (products.value.length === 1 && pagination.value.current_page > 1) {
        // If last item on a page (not first page) is deleted, go to previous page
        changePage(pagination.value.current_page - 1);
      } else {
        fetchProducts(); // Otherwise, refresh current page
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
      actionMessage.value = `Error deleting product "${product.name}": ${err.response?.data?.message || err.message}`;
      actionError.value = true;
    } finally {
      deletingId.value = null;
      setTimeout(() => { actionMessage.value = ''; }, 5000);
    }
  }
}

onMounted(() => {
  if (route.query.created === 'success') {
    actionMessage.value = 'Product created successfully.'; actionError.value = false;
  } else if (route.query.updated === 'success') {
    actionMessage.value = 'Product updated successfully.'; actionError.value = false;
  }
  // Clean up query params from redirects
  if (route.query.created || route.query.updated) {
    const cleanedQuery = { ...route.query };
    delete cleanedQuery.created;
    delete cleanedQuery.updated;
    router.replace({ query: cleanedQuery });
  }
   setTimeout(() => { if(!actionError.value && actionMessage.value && !route.query.created && !route.query.updated) actionMessage.value = ''; }, 3000);

  // Initial fetch based on current route query
  pagination.value.current_page = parseInt(route.query.page) || 1;
  pagination.value.limit = parseInt(route.query.limit) || 10;
  searchTerm.value = route.query.search_term || '';
  fetchProducts();
});

watch(() => route.query, (newQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || pagination.value.limit;
    const newSearchTerm = newQuery.search_term || '';

    let needsRefetch = false;
    if (newPage !== pagination.value.current_page) {
        pagination.value.current_page = newPage;
        needsRefetch = true;
    }
    if (newLimit !== pagination.value.limit) {
        pagination.value.limit = newLimit;
        needsRefetch = true;
    }
    if (newSearchTerm !== searchTerm.value) {
        searchTerm.value = newSearchTerm;
        needsRefetch = true;
    }

    if (needsRefetch || products.value.length === 0 && !isLoading.value && !fetchError.value) {
        fetchProducts();
    }
}, { deep: true });

</script>

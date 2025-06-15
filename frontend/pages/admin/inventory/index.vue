<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Stock Levels</h1>

    <!-- Filter Section -->
    <div class="mb-6 p-4 border rounded-md bg-gray-50 shadow">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div>
          <label for="filter_search_term" class="block text-sm font-medium text-gray-700">Search Term</label>
          <input type="text" v-model="filters.search_term" id="filter_search_term" placeholder="Name or SKU"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_category_id" class="block text-sm font-medium text-gray-700">Category ID</label>
          <input type="number" v-model.number="filters.category_id" id="filter_category_id" placeholder="Enter Category ID"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_supplier_id" class="block text-sm font-medium text-gray-700">Supplier ID</label>
          <input type="number" v-model.number="filters.supplier_id" id="filter_supplier_id" placeholder="Enter Supplier ID"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_low_stock_only" class="block text-sm font-medium text-gray-700">Stock Status</label>
          <select v-model="filters.low_stock_only" id="filter_low_stock_only"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option :value="null">Any Stock Level</option>
            <option :value="true">Low Stock Only</option>
            <option :value="false">Not Low Stock</option>
          </select>
        </div>
        <div>
          <label for="filter_sort_by" class="block text-sm font-medium text-gray-700">Sort By</label>
          <select v-model="filters.sort_by" id="filter_sort_by"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option value="product_name">Product Name</option>
            <option value="sku">SKU</option>
            <option value="stock_quantity">Stock Quantity</option>
            <option value="reorder_threshold">Reorder Threshold</option>
          </select>
        </div>
        <div>
          <label for="filter_sort_order" class="block text-sm font-medium text-gray-700">Sort Order</label>
          <select v-model="filters.sort_order" id="filter_sort_order"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option value="ASC">Ascending</option>
            <option value="DESC">Descending</option>
          </select>
        </div>
      </div>
      <div class="mt-4 flex space-x-3 justify-end">
        <button @click="applyFilters"
                class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
          Apply Filters
        </button>
        <button @click="resetFilters"
                class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
          Reset Filters
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading stock levels...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-lg text-red-600">Could not load stock levels.</p>
      <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
      <button @click="fetchStockLevels" class="mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="stockItems.length === 0" class="text-center py-10">
      <p class="text-lg text-gray-500">No stock items found matching your criteria.</p>
    </div>

    <!-- Table Display -->
    <div v-else class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Qty</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Threshold</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="item in stockItems" :key="item.product_id + (item.variant_id || '')"
              :class="isLowStock(item) ? 'bg-red-50 hover:bg-red-100' : ''">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ item.item_name }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ item.item_sku }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">{{ item.item_type }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ item.category_name || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ item.supplier_name || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{{ item.stock_quantity }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{{ item.reorder_threshold || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
              <span v-if="isLowStock(item)"
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                Low Stock
              </span>
              <span v-else
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                OK
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination UI -->
    <div v-if="!isLoading && !fetchError && stockItems.length > 0" class="flex justify-between items-center mt-6">
      <div>
        <span class="text-sm text-gray-700">
          Page {{ currentPage }} of {{ totalPages }}. Total items: {{ totalItems }}
        </span>
      </div>
      <div class="space-x-2">
        <button @click="currentPage--" :disabled="currentPage <= 1"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <button @click="currentPage++" :disabled="currentPage >= totalPages"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, definePageMeta, useHead } from '#imports';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Stock Levels',
});

const { $axios } = useNuxtApp();

const stockItems = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(20); // Can be made configurable later
const totalItems = ref(0);

const initialFilters = {
  search_term: '',
  category_id: '',
  supplier_id: '',
  low_stock_only: null, // null for 'Any', true for 'Low Stock', false for 'Not Low Stock'
  sort_by: 'product_name',
  sort_order: 'ASC',
};
const filters = ref({ ...initialFilters });

const fetchStockLevels = async () => {
  isLoading.value = true;
  fetchError.value = null;

  const params = {
    page: currentPage.value,
    limit: limit.value,
  };

  // Add filters to params if they have values
  for (const key in filters.value) {
    const value = filters.value[key];
     // Special handling for low_stock_only: null means don't send the param
    if (key === 'low_stock_only' && value !== null) {
      params[key] = value;
    } else if (key !== 'low_stock_only' && value !== '' && value !== null) {
      if ((key === 'category_id' || key === 'supplier_id') && value) {
        params[key] = Number(value);
      } else if (value) {
        params[key] = value;
      }
    }
  }

  // Clean up any empty string params that should not be sent, or NaN for numbers
  for (const key in params) {
    if (params[key] === '' || (typeof params[key] === 'number' && isNaN(params[key]))) {
       // For sort_by and sort_order, empty strings are fine if they are part of initialFilters and meant to be default
      if (key !== 'sort_by' && key !== 'sort_order') {
        delete params[key];
      }
    }
  }
  // Ensure sort_by and sort_order are always sent if they have values (even default)
  if (filters.value.sort_by) params.sort_by = filters.value.sort_by;
  if (filters.value.sort_order) params.sort_order = filters.value.sort_order;


  try {
    const response = await $axios.get('/admin/products/stock-levels', { params });
    stockItems.value = response.data.data;
    totalPages.value = response.data.pagination.totalPages || 1;
    totalItems.value = response.data.pagination.total;
    currentPage.value = response.data.pagination.page;
  } catch (error) {
    console.error('Error fetching stock levels:', error);
    fetchError.value = error.response?.data?.message || error.message || 'An unknown error occurred.';
    stockItems.value = [];
    totalPages.value = 1;
    totalItems.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const applyFilters = () => {
  currentPage.value = 1;
  fetchStockLevels();
};

const resetFilters = () => {
  filters.value = { ...initialFilters };
  applyFilters();
};

const isLowStock = (item) => {
  return item.reorder_threshold !== null && item.stock_quantity <= item.reorder_threshold && item.reorder_threshold > 0;
};

onMounted(() => {
  fetchStockLevels();
});

watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    fetchStockLevels();
  }
});

</script>

<style scoped>
/* Add any component-specific styles here if needed */
</style>

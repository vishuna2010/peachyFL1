<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Stock Valuation Report</h1>

    <!-- Filters Section (Placeholder) -->
    <div class="mb-6 p-4 bg-white shadow rounded-lg">
      <h2 class="text-lg font-semibold text-gray-800 mb-3">Filters</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label for="filterCategory" class="block text-sm font-medium text-gray-700">Category</label>
          <select id="filterCategory" v-model="filters.categoryId" @change="debouncedFetchReportData"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="">All Categories</option>
            <!-- <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option> -->
          </select>
        </div>
        <div>
          <label for="filterSupplier" class="block text-sm font-medium text-gray-700">Supplier</label>
          <select id="filterSupplier" v-model="filters.supplierId" @change="debouncedFetchReportData"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="">All Suppliers</option>
            <!-- <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option> -->
          </select>
        </div>
        <!-- Add more filters later: Date (for historical valuation if possible) -->
      </div>
    </div>

    <!-- Loading and Error States -->
    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading stock valuation report...</p>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load report: {{ fetchError }}</p>
      <button @click="fetchReportData(pagination.currentPage)" class="mt-2 px-3 py-1.5 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
    </div>

    <!-- Report Table -->
    <div v-else-if="reportData.length > 0" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant/SKU</th>
            <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Qty</th>
            <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Price</th>
            <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="item in reportData" :key="item.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ item.product_name }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ item.sku || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{{ item.stock_quantity }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{{ formatCurrency(item.cost_price) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{{ formatCurrency(item.total_value) }}</td>
          </tr>
        </tbody>
        <tfoot v-if="reportData.length > 0" class="bg-gray-100">
          <tr>
            <td colspan="4" class="px-4 py-3 text-right text-sm font-bold text-gray-700 uppercase">Grand Total Valuation:</td>
            <td class="px-4 py-3 text-right text-sm font-bold text-gray-800">{{ formatCurrency(grandTotalValuation) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div v-else class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl">No stock data available for valuation based on current filters.</p>
      <p class="text-sm mt-1">This report relies on products having a 'cost_price' and available stock.</p>
    </div>

    <!-- Pagination -->
    <div v-if="!isLoading && !fetchError && reportData.length > 0 && pagination.totalPages > 1" class="mt-6 flex items-center justify-between">
      <p class="text-sm text-gray-700">
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }}. Total items: {{ pagination.totalItems }}
      </p>
      <div class="flex space-x-2">
        <button @click="changePage(pagination.currentPage - 1)" :disabled="pagination.currentPage <= 1 || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <button @click="changePage(pagination.currentPage + 1)" :disabled="pagination.currentPage >= pagination.totalPages || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter, useRoute } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Stock Valuation Report' });

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const reportData = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

// TODO: Populate categories and suppliers from API for filters
// const categories = ref([]);
// const suppliers = ref([]);

const filters = reactive({
  categoryId: route.query.categoryId || '',
  supplierId: route.query.supplierId || '',
});

const pagination = reactive({
  currentPage: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 20,
  totalPages: 1,
  totalItems: 0,
});

const grandTotalValuation = computed(() => {
  // This might be provided by the API directly, or calculated client-side if only one page of data.
  // For multi-page data, the API should provide the grand total across all pages with current filters.
  // For now, let's assume the API provides a grandTotal in its response or we calculate from current page.
  return reportData.value.reduce((sum, item) => sum + (parseFloat(item.total_value) || 0), 0);
});

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); // Assuming USD
};

const fetchReportData = async (page = pagination.currentPage) => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const params = {
      page,
      limit: pagination.limit,
      ...filters,
      // TODO: Add sortBy, sortOrder if backend supports it
    };
    for (const key in params) {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    }

    // SIMULATED API RESPONSE - REPLACE WITH ACTUAL API CALL
    // const response = await $axios.get('/admin/reports/stock-valuation', { params });
    // reportData.value = response.data.data;
    // pagination.currentPage = response.data.pagination.currentPage;
    // pagination.totalPages = response.data.pagination.totalPages;
    // pagination.totalItems = response.data.pagination.totalItems;
    // if (response.data.grandTotalValuation) grandTotalValuation.value = response.data.grandTotalValuation; // if API provides it

    // Simulated data for now:
    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate network delay
    if (page > 1 && filters.categoryId === 'error') { // Simulate error for testing
        throw new Error("Simulated API error on page " + page);
    }
    const sampleData = [
        { id: 'prod1_varA', product_name: 'Laptop Pro', sku: 'LP-PRO-16-512', stock_quantity: 10, cost_price: '800.00', total_value: '8000.00' },
        { id: 'prod1_varB', product_name: 'Laptop Pro', sku: 'LP-PRO-16-1TB', stock_quantity: 5, cost_price: '1000.00', total_value: '5000.00' },
        { id: 'prod2', product_name: 'Wireless Mouse', sku: 'WM-001', stock_quantity: 50, cost_price: '15.00', total_value: '750.00' },
        { id: 'prod3_varX', product_name: 'Mechanical Keyboard', sku: 'MK-RGB-BLUE', stock_quantity: 20, cost_price: '65.00', total_value: '1300.00' },
        { id: 'prod4', product_name: 'USB-C Hub', sku: 'HUB-USBC-8P', stock_quantity: 30, cost_price: '25.50', total_value: '765.00' },
    ];
    reportData.value = page === 1 ? sampleData : sampleData.slice(0,2).map(d => ({...d, id: d.id + '_p' + page})); // Simulate pagination
    pagination.currentPage = page;
    pagination.totalPages = filters.categoryId === 'empty' ? 0 : 3; // Simulate total pages
    pagination.totalItems = filters.categoryId === 'empty' ? 0 : sampleData.length * 3 - 1; // Simulate total items
    if (filters.categoryId === 'empty') reportData.value = [];


    if (Object.keys(params).length > 0) {
      router.replace({ query: { ...route.query, ...params } });
    }
    toast.info("Simulated data loaded for Stock Valuation Report. Backend integration needed.");

  } catch (error) {
    console.error('Error fetching stock valuation report:', error);
    fetchError.value = error.message || 'Could not fetch report data.';
    toast.error(fetchError.value);
    reportData.value = [];
  } finally {
    isLoading.value = false;
  }
};

let debounceTimer;
const debouncedFetchReportData = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pagination.currentPage = 1;
    fetchReportData(1);
  }, 500);
};

const changePage = (newPage) => {
  if (newPage > 0 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
    fetchReportData(newPage);
  }
};

onMounted(() => {
  // TODO: Fetch categories and suppliers for filters
  // fetchCategories();
  // fetchSuppliers();
  fetchReportData();
});

// Watch for route query changes if pagination/filters are driven by URL updates from elsewhere
// (Similar to Audit Logs page)
</script>

<style scoped>
/* Basic styling, can be enhanced with more Tailwind classes or custom CSS */
</style>

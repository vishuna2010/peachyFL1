<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Stock Movement Logs</h1>

    <!-- Filter Section -->
    <div class="mb-6 p-4 border rounded-md bg-gray-50 shadow">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div>
          <label for="product_id" class="block text-sm font-medium text-gray-700">Product ID</label>
          <input type="number" v-model.number="filters.product_id" id="product_id" placeholder="Enter Product ID"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="variant_id" class="block text-sm font-medium text-gray-700">Variant ID</label>
          <input type="number" v-model.number="filters.variant_id" id="variant_id" placeholder="Enter Variant ID"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="movement_type" class="block text-sm font-medium text-gray-700">Movement Type</label>
          <input type="text" v-model="filters.movement_type" id="movement_type" placeholder="e.g., sale, received, adjustment"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="start_date" class="block text-sm font-medium text-gray-700">Start Date</label>
          <input type="date" v-model="filters.start_date" id="start_date"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="end_date" class="block text-sm font-medium text-gray-700">End Date</label>
          <input type="date" v-model="filters.end_date" id="end_date"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="sort_by" class="block text-sm font-medium text-gray-700">Sort By</label>
          <select v-model="filters.sort_by" id="sort_by"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option value="timestamp">Timestamp</option>
            <option value="product_id">Product ID</option>
            <option value="movement_type">Movement Type</option>
          </select>
        </div>
        <div>
          <label for="sort_order" class="block text-sm font-medium text-gray-700">Sort Order</label>
          <select v-model="filters.sort_order" id="sort_order"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
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
      <p class="text-lg text-gray-500">Loading stock movement logs...</p>
      <!-- You can add a spinner here -->
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-lg text-red-600">Could not load stock movement logs.</p>
      <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
      <button @click="fetchLogs" class="mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="logs.length === 0" class="text-center py-10">
      <p class="text-lg text-gray-500">No stock movement logs found matching your criteria.</p>
    </div>

    <!-- Table Display -->
    <div v-else class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant SKU</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Changed</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Qty</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference ID</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="log in logs" :key="log.id">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ formatTimestamp(log.timestamp) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ log.product_name || 'N/A' }} (SKU: {{ log.product_sku || 'N/A' }})
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.variant_sku || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.movement_type }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm" :class="getQtyChangedClass(log.quantity_changed)">
              {{ log.quantity_changed > 0 ? '+' : '' }}{{ log.quantity_changed }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.new_quantity }}</td>
            <td class="px-4 py-3 whitespace-normal text-sm text-gray-700 max-w-xs">{{ log.reason || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.user_email || 'System' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.reference_id || 'N/A' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination UI -->
    <div v-if="!isLoading && !fetchError && logs.length > 0" class="flex justify-between items-center mt-6">
      <div>
        <span class="text-sm text-gray-700">
          Page {{ currentPage }} of {{ totalPages }}. Total logs: {{ totalLogs }}
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
import { ref, onMounted, watch, computed } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter, useRoute } from '#imports';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Stock Movement Logs',
});

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();

const logs = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(20); // For future use: items per page selector
const totalLogs = ref(0);

const initialFilters = {
  product_id: '',
  variant_id: '',
  movement_type: '',
  start_date: '',
  end_date: '',
  sort_by: 'timestamp',
  sort_order: 'DESC',
};
const filters = ref({ ...initialFilters });

const fetchLogs = async () => {
  isLoading.value = true;
  fetchError.value = null;

  const params = {
    page: currentPage.value,
    limit: limit.value,
    sort_by: filters.value.sort_by,
    sort_order: filters.value.sort_order,
  };

  for (const key in filters.value) {
    if (filters.value[key] !== '' && key !== 'sort_by' && key !== 'sort_order') {
      // Ensure product_id and variant_id are numbers if they are not empty
      if ((key === 'product_id' || key === 'variant_id') && filters.value[key]) {
         params[key] = Number(filters.value[key]);
      } else if (filters.value[key]) {
         params[key] = filters.value[key];
      }
    }
  }
   // Clean up NaN or empty string params that might have occurred
  for (const key in params) {
    if (params[key] === '' || (typeof params[key] === 'number' && isNaN(params[key]))) {
      delete params[key];
    }
  }


  try {
    const response = await $axios.get('/api/admin/stock-movement-logs', { params });
    logs.value = response.data.data;
    totalPages.value = response.data.pagination.totalPages;
    totalLogs.value = response.data.pagination.total;
    currentPage.value = response.data.pagination.page; // Ensure currentPage is updated from response
  } catch (error) {
    console.error('Error fetching stock movement logs:', error);
    fetchError.value = error.response?.data?.message || error.message || 'An unknown error occurred.';
    logs.value = []; // Clear logs on error
    totalPages.value = 1; // Reset pagination
    totalLogs.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const applyFilters = () => {
  currentPage.value = 1; // Reset to first page when filters change
  fetchLogs();
};

const resetFilters = () => {
  filters.value = { ...initialFilters };
  applyFilters();
};

// Helper functions
const formatTimestamp = (ts) => ts ? new Date(ts).toLocaleString() : 'N/A';
const getQtyChangedClass = (qty) => {
  if (qty === null || qty === undefined) return 'text-gray-500';
  return qty > 0 ? 'text-green-600 font-medium' : (qty < 0 ? 'text-red-600 font-medium' : 'text-gray-500');
};

onMounted(() => {
  // TODO: Optionally read filters and page from route.query on mount
  fetchLogs();
});

watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    fetchLogs();
  }
});

// Optional: Watch filters to update URL (more advanced, for bookmarking)
// watch(filters, (newFilters) => {
//   router.push({ query: { ...route.query, ...newFilters, page: currentPage.value } });
// }, { deep: true });

</script>

<style scoped>
/* Add any component-specific styles here if needed */
input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.6;
}
input[type="date"]::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
}
</style>

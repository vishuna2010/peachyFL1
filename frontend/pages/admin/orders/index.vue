<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Order Management</h1>
      <!-- Optional: Add New Order button here if needed in future -->
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading orders...</p>
    </div>
    <div v-else-if="fetchError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
      <span class="font-medium">Error fetching orders:</span> {{ fetchError.message || fetchError }}
    </div>
    <div v-else-if="orders.length === 0" class="text-center py-10">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
      <p class="mt-1 text-sm text-gray-500">There are currently no orders to display.</p>
    </div>

    <template v-else>
      <div class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Email</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="order in orders" :key="order.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                <NuxtLink :to="`/admin/orders/${order.id}`" class="text-indigo-600 hover:text-indigo-800">#{{ order.id }}</NuxtLink>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ order.user_email }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatCurrency(order.total_amount) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span :class="getStatusClass(order.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ order.status }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatOrderDate(order.created_at) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                <NuxtLink :to="`/admin/orders/${order.id}`" class="text-indigo-600 hover:text-indigo-900">View</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6 flex items-center justify-between" v-if="totalPages > 1">
        <p class="text-sm text-gray-700">
          Page {{ currentPage }} of {{ totalPages }} (Total: {{ totalOrders }} orders)
        </p>
        <div class="flex space-x-2">
          <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1 || isLoading"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            Previous
          </button>
          <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages || isLoading"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
            Next
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, useRoute, useRouter, useHead } from '#app'; // Added useHead

definePageMeta({
  layout: 'admin',
  title: 'Order Management' // This might be overridden by useHead below
});

useHead({
  title: 'Admin - Order Management',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const orders = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(parseInt(route.query.page) || 1);
const limit = ref(parseInt(route.query.limit) || 10); // Default limit
const totalOrders = ref(0);
const totalPages = ref(1);

const formatCurrency = (amount) => amount ? Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A';
const formatOrderDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';

const getStatusClass = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800';
  status = status.toLowerCase();
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'processing': return 'bg-blue-100 text-blue-800';
    case 'shipped': return 'bg-purple-100 text-purple-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

async function fetchOrders(page = currentPage.value, pageSize = limit.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    // Ensure page and pageSize are numbers for the API call
    const effectivePage = Number(page) || 1;
    const effectivePageSize = Number(pageSize) || 10;

    const response = await $axios.get('/admin/orders', {
      params: {
        page: effectivePage,
        limit: effectivePageSize,
      },
    });
    orders.value = response.data.data;
    totalOrders.value = response.data.pagination.total;
    totalPages.value = response.data.pagination.totalPages;
    currentPage.value = response.data.pagination.page;
  } catch (err) {
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= totalPages.value) {
    // Update limit.value if it can change, for now it's fixed or from query
    // router.push({ query: { ...route.query, page: newPage, limit: limit.value } });
    // The watcher will trigger fetchOrders. Or call directly:
    currentPage.value = newPage; // Directly update currentPage, watcher will handle it
  }
}

onMounted(() => {
  // Use current route query for initial fetch if available, otherwise defaults
  const initialPage = parseInt(route.query.page) || 1;
  const initialLimit = parseInt(route.query.limit) || limit.value;
  currentPage.value = initialPage;
  limit.value = initialLimit;
  fetchOrders(initialPage, initialLimit);
});

watch(
  () => route.query,
  async (newQuery, oldQuery) => {
    // Only refetch if page or limit actually changes and are valid numbers
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || limit.value; // Use current limit if not in query

    // Check if essential pagination params changed
    if (newPage !== currentPage.value || newLimit !== limit.value || (oldQuery && (newQuery.page !== oldQuery.page || newQuery.limit !== oldQuery.limit))) {
        // Update internal state before fetching
        currentPage.value = newPage;
        limit.value = newLimit;
        await fetchOrders(newPage, newLimit);
    } else if (orders.value.length === 0 && !isLoading.value && !fetchError.value) {
        // If orders are empty, try fetching (e.g., after an error or initial load with no params)
        await fetchOrders(currentPage.value, limit.value);
    }
  },
  { deep: true }
);

// Watch currentPage directly if router.push is not used in changePage
watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    // Update router query to reflect page change for bookmarking/sharing
    router.push({ query: { ...route.query, page: newPage, limit: limit.value } });
    // Fetching is handled by the route.query watcher
  }
});

</script>

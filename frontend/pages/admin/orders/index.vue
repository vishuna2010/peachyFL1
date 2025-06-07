<template>
  <div class="admin-orders-page">
    <h2>Order Management</h2>

    <div v-if="isLoading" class="loading-state">Loading orders...</div>
    <div v-if="fetchError" class="error-state">
      Error fetching orders: {{ fetchError.message || fetchError }}
    </div>

    <template v-if="orders.length > 0 && !isLoading">
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer Email</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Order Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>
              <NuxtLink :to="`/admin/orders/${order.id}`">#{{ order.id }}</NuxtLink>
            </td>
            <td>{{ order.user_email }}</td>
            <td>${{ parseFloat(order.total_amount).toFixed(2) }}</td>
            <td><span :class="`status status-${order.status.toLowerCase()}`">{{ order.status }}</span></td>
            <td>{{ new Date(order.created_at).toLocaleDateString() }}</td>
            <td>
              <NuxtLink :to="`/admin/orders/${order.id}`" class="action-link view-link">View</NuxtLink>
              <!-- Future actions: e.g., Update Status -->
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination-controls">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1 || isLoading">
          Previous
        </button>
        <span>Page {{ currentPage }} of {{ totalPages }} (Total: {{ totalOrders }})</span>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages || isLoading">
          Next
        </button>
      </div>
    </template>

    <div v-if="orders.length === 0 && !isLoading && !fetchError" class="empty-state">
      <p>No orders found.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const orders = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(parseInt(route.query.page) || 1);
const limit = ref(parseInt(route.query.limit) || 10);
const totalOrders = ref(0);
const totalPages = ref(1);

async function fetchOrders(page = currentPage.value, pageSize = limit.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/admin/orders', {
      params: {
        page: page,
        limit: pageSize,
      },
    });
    orders.value = response.data.data;
    totalOrders.value = response.data.pagination.total;
    totalPages.value = response.data.pagination.totalPages;
    currentPage.value = response.data.pagination.page; // Update currentPage from response
  } catch (err) {
    console.error('Failed to fetch orders:', err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= totalPages.value) {
    router.push({ query: { ...route.query, page: newPage, limit: limit.value } });
    // fetchOrders will be called by the watcher
  }
}

// Fetch orders when the component mounts
onMounted(() => {
  fetchOrders(currentPage.value, limit.value);
});

// Watch for route query changes to refetch orders (for pagination)
watch(
  () => route.query,
  async (newQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || 10;
    if (newPage !== currentPage.value || newLimit !== limit.value || orders.value.length === 0) { // also fetch if orders are empty
        await fetchOrders(newPage, newLimit);
    }
  },
  { deep: true } // immediate: true might be useful if initial load depends on this
);


useHead({
  title: 'Admin - Order Management',
});
</script>

<style scoped>
.admin-orders-page {
  padding: 1rem;
}
h2 {
  margin-bottom: 1.5rem;
}
.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  margin-top: 1rem;
}
.error-state { background-color: #fdd; color: #900; }

.orders-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.orders-table th, .orders-table td {
  border: 1px solid #ddd;
  padding: 0.75rem;
  text-align: left;
}
.orders-table th {
  background-color: #f2f2f2;
}
.status {
  padding: 0.2em 0.5em;
  border-radius: 4px;
  color: white;
  font-size: 0.9em;
  text-transform: capitalize;
}
.status-pending { background-color: #ffc107; color: #333; }
.status-processing { background-color: #17a2b8; }
.status-shipped { background-color: #007bff; }
.status-delivered { background-color: #28a745; }
.status-cancelled { background-color: #dc3545; }

.action-link {
  color: #007bff;
  text-decoration: none;
  margin-right: 0.5rem;
}
.action-link:hover {
  text-decoration: underline;
}

.pagination-controls {
  margin-top: 1.5rem;
  text-align: center;
}
.pagination-controls button {
  padding: 0.5rem 1rem;
  margin: 0 0.5rem;
  border: 1px solid #ccc;
  background-color: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
}
.pagination-controls button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.pagination-controls span {
  margin: 0 0.5rem;
}
</style>

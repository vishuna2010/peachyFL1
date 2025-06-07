<template>
  <div class="admin-po-list-page">
    <h2>Purchase Order Management</h2>

    <div class="actions-bar">
      <NuxtLink to="/admin/purchase-orders/new" class="create-new-button">Create New PO</NuxtLink>
    </div>

    <div v-if="isLoading" class="loading-state">Loading purchase orders...</div>
    <div v-if="fetchError" class="error-message">
      Error fetching purchase orders: {{ fetchError.message || fetchError }}
    </div>
    <div v-if="actionMessage" class="action-message success"> <!-- Assuming only success messages from redirect for now -->
      {{ actionMessage }}
    </div>

    <table v-if="purchaseOrders.length > 0 && !isLoading" class="po-table">
      <thead>
        <tr>
          <th>PO ID</th>
          <th>Supplier</th>
          <th>Status</th>
          <th>Order Date</th>
          <th>Expected Delivery</th>
          <th>Created At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="po in purchaseOrders" :key="po.id">
          <td>
            <NuxtLink :to="`/admin/purchase-orders/${po.id}`">#{{ po.id }}</NuxtLink>
          </td>
          <td>{{ po.supplier_name }}</td>
          <td><span :class="`status status-${po.status.toLowerCase()}`">{{ po.status }}</span></td>
          <td>{{ new Date(po.order_date).toLocaleDateString() }}</td>
          <td>{{ po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'N/A' }}</td>
          <td>{{ new Date(po.created_at).toLocaleDateString() }}</td>
          <td class="actions-cell">
            <NuxtLink :to="`/admin/purchase-orders/${po.id}`" class="action-link view-link">View/Edit</NuxtLink>
            <!-- Delete PO might be added later if business rules allow -->
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination-controls" v-if="pagination.totalPages > 1 && !isLoading">
      <button @click="changePage(pagination.page - 1)" :disabled="pagination.page === 1 || isLoading">
        Previous
      </button>
      <span>Page {{ pagination.page }} of {{ pagination.totalPages }} (Total: {{ pagination.total }})</span>
      <button @click="changePage(pagination.page + 1)" :disabled="pagination.page === pagination.totalPages || isLoading">
        Next
      </button>
    </div>

    <div v-if="purchaseOrders.length === 0 && !isLoading && !fetchError" class="empty-state">
      <p>No purchase orders found. <NuxtLink to="/admin/purchase-orders/new">Create one now!</NuxtLink></p>
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

const purchaseOrders = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const actionMessage = ref(''); // For messages from redirects (e.g., after creation)

const pagination = ref({
  total: 0,
  page: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 15,
  totalPages: 1,
});

async function fetchPurchaseOrders(page = pagination.value.page, limit = pagination.value.limit) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/admin/purchase-orders', {
      params: { page, limit }
    });
    purchaseOrders.value = response.data.data;
    pagination.value = response.data.pagination;
  } catch (err) {
    console.error('Failed to fetch purchase orders:', err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.totalPages && newPage !== pagination.value.page) {
    router.push({ query: { ...route.query, page: newPage, limit: pagination.value.limit } });
  }
}

onMounted(() => {
  if (route.query.created === 'success') {
    actionMessage.value = 'Purchase Order created successfully.';
     setTimeout(() => { actionMessage.value = ''; }, 3000);
     // Clean the query param
     const { created, ...queryWithoutStatus } = route.query;
     router.replace({ query: queryWithoutStatus });
  } else if (route.query.updated === 'success') {
    actionMessage.value = 'Purchase Order updated successfully.';
    setTimeout(() => { actionMessage.value = ''; }, 3000);
    const { updated, ...queryWithoutStatus } = route.query;
    router.replace({ query: queryWithoutStatus });
  }
  fetchPurchaseOrders(pagination.value.page, pagination.value.limit);
});

watch(() => route.query, (newQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || pagination.value.limit;
    if (newPage !== pagination.value.page || newLimit !== pagination.value.limit || purchaseOrders.value.length === 0) {
        fetchPurchaseOrders(newPage, newLimit);
    }
}, { deep: true });

useHead({
  title: 'Admin - Purchase Orders',
});
</script>

<style scoped>
.admin-po-list-page { padding: 1rem; }
h2 { margin-bottom: 1.5rem; }
.actions-bar { margin-bottom: 1rem; display: flex; justify-content: flex-end; }
.create-new-button { padding: 0.6rem 1.2rem; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em; }
.create-new-button:hover { background-color: #218838; }

.loading-state, .error-message, .empty-state, .action-message { text-align: center; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
.loading-state { background-color: #eef; }
.error-message { background-color: #fdd; color: #900; }
.action-message.success { background-color: #dfd; color: #070; }

.po-table { width: 100%; border-collapse: collapse; margin-top: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size: 0.9em; }
.po-table th, .po-table td { border: 1px solid #ddd; padding: 0.6rem; text-align: left; vertical-align: middle; }
.po-table th { background-color: #f2f2f2; }
.status { padding: 0.2em 0.5em; border-radius: 4px; color: white; font-size: 0.9em; text-transform: capitalize; }
.status-pending { background-color: #ffc107; color: #333; }
.status-ordered { background-color: #17a2b8; }
.status-partially_received { background-color: #fd7e14; } /* orange */
.status-received { background-color: #28a745; }
.status-cancelled { background-color: #dc3545; }

.actions-cell { white-space: nowrap; }
.action-link { padding: 0.3rem 0.6rem; border-radius: 4px; text-decoration: none; margin-right: 0.4rem; font-size: 0.9em; }
.view-link { background-color: #007bff; color: white; }
.view-link:hover { background-color: #0056b3; }

.pagination-controls { margin-top: 1.5rem; text-align: center; }
.pagination-controls button { padding: 0.5rem 1rem; margin: 0 0.5rem; border: 1px solid #ccc; background-color: #f8f9fa; border-radius: 4px; cursor: pointer; }
.pagination-controls button:disabled { cursor: not-allowed; opacity: 0.6; }
.pagination-controls span { margin: 0 0.5rem; }
</style>

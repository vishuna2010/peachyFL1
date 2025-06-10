<template>
  <div class="admin-discounts-page">
    <h2>Discount Code Management</h2>

    <div class="actions-bar">
      <NuxtLink to="/admin/discounts/new" class="create-new-button">Create New Discount</NuxtLink>
    </div>

    <div v-if="isLoading" class="loading-state">Loading discount codes...</div>
    <div v-if="fetchError" class="error-message">
      Error fetching discounts: {{ fetchError.message || fetchError }}
    </div>
    <div v-if="actionMessage" class="action-message" :class="{ 'success': !actionError, 'error': actionError }">
      {{ actionMessage }}
    </div>


    <table v-if="discounts.length > 0 && !isLoading" class="discounts-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Type</th>
          <th>Value</th>
          <th>Description</th>
          <th>Active</th>
          <th>Valid From</th>
          <th>Valid Until</th>
          <th>Usage (Used/Limit)</th>
          <th>Min Order Amt</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="discount in discounts" :key="discount.id">
          <td><strong>{{ discount.code }}</strong></td>
          <td>{{ discount.type }}</td>
          <td>
            {{ discount.type === 'percentage' ? `${parseFloat(discount.value).toFixed(0)}%` : `$${parseFloat(discount.value).toFixed(2)}` }}
          </td>
          <td class="description-cell">{{ discount.description ? (discount.description.substring(0, 50) + (discount.description.length > 50 ? '...' : '')) : 'N/A' }}</td>
          <td>
            <span :class="discount.is_active ? 'status-active' : 'status-inactive'">
              {{ discount.is_active ? 'Yes' : 'No' }}
            </span>
          </td>
          <td>{{ discount.valid_from ? new Date(discount.valid_from).toLocaleDateString() : 'N/A' }}</td>
          <td>{{ discount.valid_until ? new Date(discount.valid_until).toLocaleDateString() : 'N/A' }}</td>
          <td>{{ discount.times_used }} / {{ discount.usage_limit !== null ? discount.usage_limit : '∞' }}</td>
          <td>{{ discount.min_order_amount !== null ? `$${parseFloat(discount.min_order_amount).toFixed(2)}` : 'N/A' }}</td>
          <td class="actions-cell">
            <NuxtLink :to="`/admin/discounts/edit/${discount.id}`" class="action-link edit-link">Edit</NuxtLink>
            <button @click="confirmDeleteDiscount(discount)" class="action-link delete-button" :disabled="deletingId === discount.id">
              {{ deletingId === discount.id ? 'Deleting...' : 'Delete' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination-controls" v-if="pagination.total_pages > 1 && !isLoading">
        <button @click="changePage(pagination.current_page - 1)" :disabled="pagination.current_page === 1 || isLoadingData">
          Previous
        </button>
        <span>Page {{ pagination.current_page }} of {{ pagination.total_pages }} (Total: {{ pagination.total_discounts }})</span>
        <button @click="changePage(pagination.current_page + 1)" :disabled="pagination.current_page === pagination.total_pages || isLoadingData">
          Next
        </button>
    </div>

    <div v-if="discounts.length === 0 && !isLoading && !fetchError" class="empty-state">
      <p>No discount codes found. <NuxtLink to="/admin/discounts/new">Create one now!</NuxtLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Discount Management'
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const discounts = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const deletingId = ref(null); // To show loading state on delete button

const actionMessage = ref('');
const actionError = ref(false);

const pagination = ref({
  total_discounts: 0,
  current_page: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 15, // Default limit
  total_pages: 1,
});


async function fetchDiscounts(page = pagination.value.current_page, limit = pagination.value.limit) {
  isLoading.value = true;
  fetchError.value = null;
  actionMessage.value = ''; // Clear previous action messages
  actionError.value = false;
  try {
    const response = await $axios.get('/admin/discounts', {
      params: { page, limit }
    });
    discounts.value = response.data.data;
    pagination.value.total_discounts = response.data.pagination.total;
    pagination.value.total_pages = response.data.pagination.totalPages;
    pagination.value.current_page = response.data.pagination.page;
  } catch (err) {
    console.error('Failed to fetch discount codes:', err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.total_pages && newPage !== pagination.value.current_page) {
    router.push({ query: { ...route.query, page: newPage, limit: pagination.value.limit } });
    // fetchDiscounts will be called by watcher
  }
}

async function confirmDeleteDiscount(discount) {
  if (confirm(`Are you sure you want to delete discount code "${discount.code}"? This action cannot be undone.`)) {
    deletingId.value = discount.id;
    actionMessage.value = '';
    actionError.value = false;
    try {
      await $axios.delete(`/admin/discounts/${discount.id}`);
      actionMessage.value = `Discount code "${discount.code}" deleted successfully.`;
      actionError.value = false;
      // Refresh list - ideally current page, or first page if current page becomes empty
      // For simplicity, just refetch current page.
      fetchDiscounts(pagination.value.current_page);
    } catch (err) {
      console.error('Failed to delete discount code:', err);
      actionMessage.value = `Error deleting discount "${discount.code}": ${err.response?.data?.message || err.message}`;
      actionError.value = true;
    } finally {
      deletingId.value = null;
       setTimeout(() => { actionMessage.value = ''; }, 5000);
    }
  }
}

// Check for query params from create/edit redirects for user feedback
onMounted(() => {
  if (route.query.created === 'success') {
    actionMessage.value = 'Discount code created successfully.';
    actionError.value = false;
  } else if (route.query.updated === 'success') {
    actionMessage.value = 'Discount code updated successfully.';
    actionError.value = false;
  }
  // Clear query params after showing message
  if (route.query.created || route.query.updated) {
    router.replace({ query: { ...route.query, created: undefined, updated: undefined } });
  }
   setTimeout(() => { if(!actionError.value) actionMessage.value = ''; }, 3000);

  fetchDiscounts(pagination.value.current_page, pagination.value.limit);
});

watch(() => route.query, (newQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || pagination.value.limit;
    if (newPage !== pagination.value.current_page || newLimit !== pagination.value.limit || discounts.value.length === 0) {
        fetchDiscounts(newPage, newLimit);
    }
}, { deep: true });


useHead({
  title: 'Admin - Discount Codes',
});
</script>

<style scoped>
.admin-discounts-page {
  padding: 1rem;
}
h2 {
  margin-bottom: 1.5rem;
}
.actions-bar {
  margin-bottom: 1rem;
  display: flex;
  justify-content: flex-end;
}
.create-new-button {
  padding: 0.6rem 1.2rem;
  background-color: #28a745;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.9em;
}
.create-new-button:hover {
  background-color: #218838;
}

.loading-state, .error-message, .empty-state, .action-message {
  text-align: center;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}
.loading-state { background-color: #eef; }
.error-message, .action-message.error { background-color: #fdd; color: #900; }
.action-message.success { background-color: #dfd; color: #070; }


.discounts-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  font-size: 0.9em;
}
.discounts-table th, .discounts-table td {
  border: 1px solid #ddd;
  padding: 0.6rem;
  text-align: left;
  vertical-align: middle;
}
.discounts-table th {
  background-color: #f2f2f2;
}
.description-cell {
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.status-active { color: green; font-weight: bold; }
.status-inactive { color: red; }

.actions-cell {
  white-space: nowrap;
}
.action-link {
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  text-decoration: none;
  margin-right: 0.4rem;
  font-size: 0.9em;
}
.edit-link {
  background-color: #ffc107;
  color: #333;
}
.edit-link:hover { background-color: #e0a800; }
.delete-button {
  background-color: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
}
.delete-button:hover:not(:disabled) { background-color: #c82333; }
.delete-button:disabled { opacity: 0.6; cursor: not-allowed; }

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

<template>
  <div class="admin-suppliers-page">
    <h2>Supplier Management</h2>

    <div class="actions-bar">
      <NuxtLink to="/admin/suppliers/new" class="create-new-button">Create New Supplier</NuxtLink>
    </div>

    <div v-if="isLoading" class="loading-state">Loading suppliers...</div>
    <div v-if="fetchError" class="error-message">
      Error fetching suppliers: {{ fetchError.message || fetchError }}
    </div>
    <div v-if="actionMessage" class="action-message" :class="{ 'success': !actionError, 'error': actionError }">
      {{ actionMessage }}
    </div>

    <table v-if="suppliers.length > 0 && !isLoading" class="suppliers-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Contact Person</th>
          <th>Email</th>
          <th>Phone</th>
          <th>City</th>
          <th>Country</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="supplier in suppliers" :key="supplier.id">
          <td><strong>{{ supplier.name }}</strong></td>
          <td>{{ supplier.contact_person || 'N/A' }}</td>
          <td>{{ supplier.email || 'N/A' }}</td>
          <td>{{ supplier.phone || 'N/A' }}</td>
          <td>{{ supplier.city || 'N/A' }}</td>
          <td>{{ supplier.country || 'N/A' }}</td>
          <td class="actions-cell">
            <NuxtLink :to="`/admin/suppliers/${supplier.id}/edit`" class="action-link edit-link">Edit</NuxtLink> <!-- Corrected path -->
            <button @click="confirmDeleteSupplier(supplier)" class="action-link delete-button" :disabled="deletingId === supplier.id">
              {{ deletingId === supplier.id ? 'Deleting...' : 'Delete' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination-controls" v-if="pagination.total_pages > 1 && !isLoading">
        <button @click="changePage(pagination.current_page - 1)" :disabled="pagination.current_page === 1 || isLoading">
          Previous
        </button>
        <span>Page {{ pagination.current_page }} of {{ pagination.total_pages }} (Total: {{ pagination.total_suppliers }})</span>
        <button @click="changePage(pagination.current_page + 1)" :disabled="pagination.current_page === pagination.total_pages || isLoading">
          Next
        </button>
    </div>

    <div v-if="suppliers.length === 0 && !isLoading && !fetchError" class="empty-state">
      <p>No suppliers found. <NuxtLink to="/admin/suppliers/new">Create one now!</NuxtLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Supplier Management'
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const suppliers = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const deletingId = ref(null);

const actionMessage = ref('');
const actionError = ref(false);

const pagination = ref({
  total_suppliers: 0,
  current_page: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 15,
  total_pages: 1,
});

async function fetchSuppliers(page = pagination.value.current_page, limit = pagination.value.limit) {
  isLoading.value = true;
  fetchError.value = null;
  // Do not clear actionMessage here if we want to persist it across pagination
  // actionMessage.value = '';
  // actionError.value = false;
  try {
    const response = await $axios.get('/admin/suppliers', {
      params: { page, limit }
    });
    suppliers.value = response.data.data;
    pagination.value.total_suppliers = response.data.pagination.total;
    pagination.value.total_pages = response.data.pagination.totalPages;
    pagination.value.current_page = response.data.pagination.page;
  } catch (err) {
    console.error('Failed to fetch suppliers:', err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.total_pages && newPage !== pagination.value.current_page) {
    router.push({ query: { ...route.query, page: newPage, limit: pagination.value.limit } });
  }
}

async function confirmDeleteSupplier(supplier) {
  if (confirm(`Are you sure you want to delete supplier "${supplier.name}"? This action cannot be undone.`)) {
    deletingId.value = supplier.id;
    actionMessage.value = '';
    actionError.value = false;
    try {
      await $axios.delete(`/admin/suppliers/${supplier.id}`);
      actionMessage.value = `Supplier "${supplier.name}" deleted successfully.`;
      actionError.value = false;
      // Refresh list: if current page becomes empty and it's not the first page, go to previous page.
      if (suppliers.value.length === 1 && pagination.value.current_page > 1) {
        changePage(pagination.value.current_page - 1);
      } else {
        fetchSuppliers(pagination.value.current_page);
      }
    } catch (err) {
      console.error('Failed to delete supplier:', err);
      actionMessage.value = `Error deleting supplier "${supplier.name}": ${err.response?.data?.message || err.message}`;
      actionError.value = true;
    } finally {
      deletingId.value = null;
      setTimeout(() => { actionMessage.value = ''; }, 5000);
    }
  }
}

onMounted(() => {
  if (route.query.created === 'success') {
    actionMessage.value = 'Supplier created successfully.';
    actionError.value = false;
  } else if (route.query.updated === 'success') {
    actionMessage.value = 'Supplier updated successfully.';
    actionError.value = false;
  }
  if (route.query.created || route.query.updated) {
    router.replace({ query: { ...route.query, created: undefined, updated: undefined } });
  }
  setTimeout(() => { if(!actionError.value && actionMessage.value) actionMessage.value = ''; }, 3000);

  fetchSuppliers(pagination.value.current_page, pagination.value.limit);
});

watch(() => route.query, (newQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || pagination.value.limit;
    // Fetch only if page or limit actually changes, or if suppliers list is empty (e.g. initial load before query sync)
    if (newPage !== pagination.value.current_page || newLimit !== pagination.value.limit || suppliers.value.length === 0) {
        fetchSuppliers(newPage, newLimit);
    }
}, { deep: true });

useHead({
  title: 'Admin - Supplier Management',
});
</script>

<style scoped>
.admin-suppliers-page {
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

.suppliers-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  font-size: 0.9em;
}
.suppliers-table th, .suppliers-table td {
  border: 1px solid #ddd;
  padding: 0.6rem;
  text-align: left;
  vertical-align: middle;
}
.suppliers-table th {
  background-color: #f2f2f2;
}

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

<template>
  <div class="admin-products-page">
    <h2>Product Management (Admin)</h2>

    <div class="actions-bar">
      <NuxtLink to="/admin/products/new" class="create-new-button">Create New Product</NuxtLink>
    </div>

     <div v-if="actionMessage" class="action-message" :class="{ 'success': !actionError, 'error': actionError }">
      {{ actionMessage }}
    </div>

    <!-- Basic Filters (can be expanded) -->
    <div class="filters-container">
      <input type="text" v-model="searchTerm" placeholder="Search products..." @keyup.enter="applyFilters" class="filter-input search-input" />
      <button @click="applyFilters" class="apply-filters-button">Search</button>
      <button @click="resetFilters" class="reset-filters-button">Clear Search</button>
    </div>

    <div v-if="isLoading" class="loading-state">Loading products...</div>
    <div v-if="fetchError" class="error-message">
      Error fetching products: {{ fetchError.message || fetchError }}
    </div>

    <table v-if="products.length > 0 && !isLoading" class="products-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Image</th>
          <th>Name</th>
          <th>SKU</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Category</th>
          <th>Supplier</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id">
          <td>{{ product.id }}</td>
          <td>
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.name"
              class="product-thumbnail"
            />
            <div v-else class="product-thumbnail-placeholder">N/A</div>
          </td>
          <td><strong>{{ product.name }}</strong></td>
          <td>{{ product.sku || 'N/A' }}</td>
          <td>${{ parseFloat(product.price).toFixed(2) }}</td>
          <td>{{ product.stock_quantity }}</td>
          <td>{{ product.category_name || 'N/A' }}</td>
          <td>{{ product.supplier_name || 'N/A' }}</td>
          <td class="actions-cell">
            <NuxtLink :to="`/admin/products/edit/${product.id}`" class="action-link edit-link">Edit</NuxtLink>
            <button @click="confirmDeleteProduct(product)" class="action-link delete-button" :disabled="deletingId === product.id">
              {{ deletingId === product.id ? 'Deleting...' : 'Delete' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination-controls" v-if="pagination.total_pages > 1 && !isLoading">
        <button @click="changePage(pagination.current_page - 1)" :disabled="pagination.current_page === 1 || isLoading">
          Previous
        </button>
        <span>Page {{ pagination.current_page }} of {{ pagination.total_pages }} (Total: {{ pagination.total_products }})</span>
        <button @click="changePage(pagination.current_page + 1)" :disabled="pagination.current_page === pagination.total_pages || isLoading">
          Next
        </button>
    </div>

    <div v-if="products.length === 0 && !isLoading && !fetchError" class="empty-state">
      <p>No products found. <NuxtLink to="/admin/products/new">Create one now!</NuxtLink></p>
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
  // Do not clear actionMessage on fetch if it's from a redirect.
  // actionMessage.value = ''; actionError.value = false;

  const params = {
    page: pagination.value.current_page,
    limit: pagination.value.limit
  };
  if (searchTerm.value) {
    params.search_term = searchTerm.value;
  }

  try {
    // Using the public GET /api/products endpoint which supports search and returns supplier_name
    const response = await $axios.get('/products', { params });
    products.value = response.data.products;
    pagination.value.total_products = response.data.pagination.total_products;
    pagination.value.total_pages = response.data.pagination.total_pages;
    pagination.value.current_page = response.data.pagination.current_page;
  } catch (err) {
    console.error('Failed to fetch products:', err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

function applyFilters() {
    pagination.value.current_page = 1; // Reset to first page for new search
    const query = { ...route.query, page: pagination.value.current_page, limit: pagination.value.limit };
    if (searchTerm.value) {
        query.search_term = searchTerm.value;
    } else {
        delete query.search_term;
    }
    router.push({ query });
}

function resetFilters() {
    searchTerm.value = '';
    pagination.value.current_page = 1;
    router.push({ query: { page: 1, limit: pagination.value.limit } });
}


function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.total_pages && newPage !== pagination.value.current_page) {
    const query = { ...route.query, page: newPage, limit: pagination.value.limit };
    if (searchTerm.value) query.search_term = searchTerm.value;
    router.push({ query });
  }
}

async function confirmDeleteProduct(product) {
  if (confirm(`Are you sure you want to delete product "${product.name}" (ID: ${product.id})? This action cannot be undone.`)) {
    deletingId.value = product.id;
    actionMessage.value = ''; actionError.value = false;
    try {
      await $axios.delete(`/products/${product.id}`); // Admin protected route from routes/products.js
      actionMessage.value = `Product "${product.name}" deleted successfully.`;
      actionError.value = false;
      if (products.value.length === 1 && pagination.value.current_page > 1) {
        changePage(pagination.value.current_page - 1);
      } else {
        fetchProducts();
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
  if (route.query.created || route.query.updated) {
    router.replace({ query: { ...route.query, created: undefined, updated: undefined } });
  }
   setTimeout(() => { if(!actionError.value && actionMessage.value) actionMessage.value = ''; }, 3000);

  fetchProducts();
});

watch(() => route.query, (newQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || pagination.value.limit;
    const newSearchTerm = newQuery.search_term || '';

    if (newPage !== pagination.value.current_page || newLimit !== pagination.value.limit || newSearchTerm !== searchTerm.value || products.value.length === 0) {
        pagination.value.current_page = newPage;
        pagination.value.limit = newLimit;
        searchTerm.value = newSearchTerm; // Ensure local searchTerm is in sync with URL
        fetchProducts();
    }
}, { deep: true });

useHead({
  title: 'Admin - Product Management',
});
</script>

<style scoped>
.admin-products-page { padding: 1rem; }
h2 { margin-bottom: 1.5rem; }
.actions-bar { margin-bottom: 1rem; display: flex; justify-content: flex-end; }
.create-new-button { padding: 0.6rem 1.2rem; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em; }
.create-new-button:hover { background-color: #218838; }

.filters-container { display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 4px;}
.filter-input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.search-input { flex-grow: 1; }
.apply-filters-button, .reset-filters-button { padding: 0.5rem 1rem; border: none; border-radius: 4px; color: white; cursor: pointer; }
.apply-filters-button { background-color: #007bff; }
.apply-filters-button:hover { background-color: #0056b3; }
.reset-filters-button { background-color: #6c757d; }
.reset-filters-button:hover { background-color: #545b62; }

.loading-state, .error-message, .empty-state, .action-message { text-align: center; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
.loading-state { background-color: #eef; }
.error-message, .action-message.error { background-color: #fdd; color: #900; }
.action-message.success { background-color: #dfd; color: #070; }

.products-table { width: 100%; border-collapse: collapse; margin-top: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size: 0.85em; }
.products-table th, .products-table td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: middle; }
.products-table th { background-color: #f2f2f2; }
.product-thumbnail, .product-thumbnail-placeholder { width: 50px; height: 50px; object-fit: cover; border-radius: 3px; background-color: #eee; }
.product-thumbnail-placeholder { display:flex; align-items:center; justify-content:center; font-size:0.8em; color:#aaa; }
.actions-cell { white-space: nowrap; }
.action-link { padding: 0.3rem 0.6rem; border-radius: 4px; text-decoration: none; margin-right: 0.4rem; font-size: 0.9em; }
.edit-link { background-color: #ffc107; color: #333; }
.edit-link:hover { background-color: #e0a800; }
.delete-button { background-color: #dc3545; color: white; border: none; cursor: pointer; }
.delete-button:hover:not(:disabled) { background-color: #c82333; }
.delete-button:disabled { opacity: 0.6; cursor: not-allowed; }

.pagination-controls { margin-top: 1.5rem; text-align: center; }
.pagination-controls button { padding: 0.5rem 1rem; margin: 0 0.5rem; border: 1px solid #ccc; background-color: #f8f9fa; border-radius: 4px; cursor: pointer; }
.pagination-controls button:disabled { cursor: not-allowed; opacity: 0.6; }
.pagination-controls span { margin: 0 0.5rem; }
</style>

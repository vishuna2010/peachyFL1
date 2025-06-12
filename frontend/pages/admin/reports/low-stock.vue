<template>
  <div class="admin-low-stock-report-page">
    <h2>Low Stock Report</h2>

    <div class="actions-bar">
      <button @click="fetchLowStockReport" :disabled="isLoading" class="refresh-button">
        {{ isLoading ? 'Refreshing...' : 'Refresh Report' }}
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">Loading low stock report...</div>
    <div v-if="errorMessage" class="error-message">
      Error fetching report: {{ errorMessage }}
    </div>

    <div v-if="!isLoading && !errorMessage && lowStockProducts.length === 0" class="empty-state">
      <p>No products are currently low on stock based on their reorder thresholds.</p>
    </div>

    <table v-if="lowStockProducts.length > 0 && !isLoading" class="report-table">
      <thead>
        <tr>
          <th>Product Name</th>
          <th>SKU</th>
          <th>Current Stock</th>
          <th>Reorder Threshold</th>
          <th>Difference</th>
          <th>Supplier</th>
          <th>Last Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in lowStockProducts" :key="product.id" :class="{ 'urgent': product.stock_difference < 0, 'warning': product.stock_difference === 0 }">
          <td>
            <NuxtLink :to="`/admin/products/edit/${product.id}`" :title="`Edit ${product.name}`">
              {{ product.name }}
            </NuxtLink>
          </td>
          <td>{{ product.sku || 'N/A' }}</td>
          <td class="text-center">{{ product.stock_quantity }}</td>
          <td class="text-center">{{ product.reorder_threshold }}</td>
          <td class="text-center" :style="{ color: product.stock_difference < 0 ? 'red' : (product.stock_difference === 0 ? 'orange' : 'inherit') }">
            {{ product.stock_difference }}
          </td>
          <td>{{ product.supplier_name || 'N/A' }}</td>
          <td>{{ product.updated_at ? new Date(product.updated_at).toLocaleDateString() : 'N/A' }}</td>
          <td>
            <NuxtLink :to="`/admin/products/edit/${product.id}`" class="action-link edit-link">Edit Product</NuxtLink>
            <!-- Future: Link to create PO for this supplier -->
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Low Stock Report'
});

const { $axios } = useNuxtApp();

const lowStockProducts = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');

async function fetchLowStockReport() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await $axios.get('/admin/reports/low-stock-products');
    lowStockProducts.value = response.data;
  } catch (error) {
    console.error('Failed to fetch low stock report:', error);
    errorMessage.value = error.response?.data?.message || 'An unexpected error occurred.';
    lowStockProducts.value = []; // Clear previous data on error
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchLowStockReport();
});

useHead({
  title: 'Admin - Low Stock Report',
});
</script>

<style scoped>
.admin-low-stock-report-page {
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
.refresh-button {
  padding: 0.6rem 1.2rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
}
.refresh-button:disabled {
  background-color: #aaa;
}
.refresh-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.loading-state, .error-message, .empty-state {
  text-align: center;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}
.loading-state { background-color: #eef; }
.error-message { background-color: #fdd; color: #900; }
.empty-state { background-color: #f8f9fa; }

.report-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  font-size: 0.9em;
}
.report-table th, .report-table td {
  border: 1px solid #ddd;
  padding: 0.75rem;
  text-align: left;
  vertical-align: middle;
}
.report-table th {
  background-color: #f2f2f2;
}
.text-center {
  text-align: center;
}
tr.urgent td {
  /* background-color: #ffebee; /* Light red */
  /* Consider more subtle highlighting if needed */
}
tr.warning td {
  /* background-color: #fff9c4; /* Light yellow */
}
.action-link {
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9em;
  background-color: #6c757d;
  color: white;
}
.action-link.edit-link:hover {
  background-color: #5a6268;
}
</style>

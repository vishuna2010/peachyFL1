<template>
  <div class="admin-best-sellers-report-page">
    <h2>Best Sellers Report</h2>

    <div class="filter-section card">
      <h3>Report Options</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="limit">Top N Products:</label>
          <input type="number" id="limit" v-model.number="limit" min="1" max="100" />
        </div>
        <div class="form-group">
          <label for="sortByMetric">Sort By:</label>
          <select id="sortByMetric" v-model="sortByMetric">
            <option value="quantity">Total Quantity Sold</option>
            <option value="revenue">Total Revenue Generated</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="startDate">Start Date (Optional):</label>
          <input type="date" id="startDate" v-model="startDate" />
        </div>
        <div class="form-group">
          <label for="endDate">End Date (Optional):</label>
          <input type="date" id="endDate" v-model="endDate" />
        </div>
      </div>
      <button @click="generateReport" :disabled="isLoading" class="generate-button">
        {{ isLoading ? 'Generating...' : 'Generate Report' }}
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">Loading best sellers report...</div>
    <div v-if="errorMessage" class="error-message card">
      Error generating report: {{ errorMessage }}
    </div>

    <div v-if="reportData.length > 0 && !isLoading" class="report-results card">
      <h3>Top {{ reportData.length }} Best Selling Products</h3>
      <p v-if="apiQueryUsed.start_date && apiQueryUsed.end_date">
        For period: {{ apiQueryUsed.start_date }} to {{ apiQueryUsed.end_date }}.
        Sorted by {{ apiQueryUsed.sort_by_metric === 'revenue' ? 'Total Revenue' : 'Total Quantity Sold' }}.
      </p>
       <p v-else>
        For all time. Sorted by {{ apiQueryUsed.sort_by_metric === 'revenue' ? 'Total Revenue' : 'Total Quantity Sold' }}.
      </p>

      <table class="report-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Total Quantity Sold</th>
            <th>Total Revenue Generated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(product, index) in reportData" :key="product.product_id">
            <td class="text-center">{{ index + 1 }}</td>
            <td>
              <NuxtLink :to="`/admin/products/edit/${product.product_id}`" :title="`Edit ${product.product_name}`">
                {{ product.product_name }}
              </NuxtLink>
            </td>
            <td>{{ product.product_sku || 'N/A' }}</td>
            <td class="text-right">{{ product.total_quantity_sold }}</td>
            <td class="text-right">${{ parseFloat(product.total_revenue_generated).toFixed(2) }}</td>
            <td>
                 <NuxtLink :to="`/admin/products/edit/${product.product_id}`" class="action-link edit-link">View Product</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
     <div v-if="!isLoading && !errorMessage && reportData.length === 0 && hasGeneratedOnce" class="empty-state card">
      <p>No sales data found for the selected criteria to determine best sellers.</p>
    </div>
     <div v-if="!hasGeneratedOnce && !isLoading && !errorMessage" class="empty-state card">
        <p>Please select your desired options and click "Generate Report".</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();

const limit = ref(10);
const startDate = ref(''); // Default to empty
const endDate = ref('');   // Default to empty
const sortByMetric = ref('quantity'); // Default sort metric

const reportData = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const hasGeneratedOnce = ref(false); // To distinguish initial state from "no results found"
const apiQueryUsed = ref({}); // To store the parameters used for the current report display

async function generateReport() {
  isLoading.value = true;
  errorMessage.value = '';
  // reportData.value = []; // Clear previous results immediately or wait for new data
  hasGeneratedOnce.value = true;

  if (limit.value < 1 || limit.value > 100) {
    errorMessage.value = 'Limit must be between 1 and 100.';
    isLoading.value = false;
    return;
  }
  if ((startDate.value && !endDate.value) || (!startDate.value && endDate.value)) {
    errorMessage.value = 'If providing a date range, both start and end dates are required.';
    isLoading.value = false;
    return;
  }
  if (startDate.value && endDate.value && new Date(startDate.value) > new Date(endDate.value)) {
    errorMessage.value = 'Start date cannot be after end date.';
    isLoading.value = false;
    return;
  }

  const params = {
    limit: limit.value,
    sort_by_metric: sortByMetric.value,
  };
  if (startDate.value) params.start_date = startDate.value;
  if (endDate.value) params.end_date = endDate.value;

  apiQueryUsed.value = { ...params }; // Store what was used for display

  try {
    const response = await $axios.get('/admin/reports/best-sellers', { params });
    reportData.value = response.data;
  } catch (error) {
    console.error('Failed to generate best sellers report:', error);
    errorMessage.value = error.response?.data?.message || 'An unexpected error occurred.';
    reportData.value = []; // Clear data on error
  } finally {
    isLoading.value = false;
  }
}

// Optionally, fetch a default report on mount
onMounted(() => {
  // generateReport(); // Uncomment to load default top 10 (all time, by quantity) on page load
});

useHead({
  title: 'Admin - Best Sellers Report',
});
</script>

<style scoped>
.admin-best-sellers-report-page { padding: 1rem; }
h2 { margin-bottom: 1.5rem; text-align: center; }

.card {
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin-bottom: 1.5rem;
}

.filter-section h3 { margin-top: 0; margin-bottom: 1rem; font-size: 1.2em; }
.form-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
.form-group { display: flex; flex-direction: column; flex: 1; min-width: 180px; }
.form-group label { margin-bottom: 0.3rem; font-weight: bold; font-size: 0.9em; }
.form-group input[type="date"],
.form-group input[type="number"],
.form-group select {
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9em;
}
.generate-button {
  padding: 0.7rem 1.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
}
.generate-button:disabled { background-color: #aaa; }
.generate-button:hover:not(:disabled) { background-color: #0056b3; }

.loading-state, .error-message, .empty-state { text-align: center; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
.loading-state { background-color: #eef; }
/* .error-message is already in card */
/* .empty-state is already in card */

.report-results h3 { font-size: 1.3em; margin-bottom: 0.5rem; color: #333; }
.report-results p { font-size: 0.9em; color: #555; margin-bottom: 1rem; }

.report-table { width: 100%; border-collapse: collapse; font-size: 0.9em; margin-top:1rem; }
.report-table th, .report-table td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
.report-table th { background-color: #f2f2f2; }
.text-center { text-align: center; }
.text-right { text-align: right; }

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

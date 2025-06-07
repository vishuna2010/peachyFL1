<template>
  <div class="admin-sales-report-page">
    <h2>Sales Report</h2>

    <div class="filter-section card">
      <h3>Report Filters</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="startDate">Start Date:</label>
          <input type="date" id="startDate" v-model="startDate" />
        </div>
        <div class="form-group">
          <label for="endDate">End Date:</label>
          <input type="date" id="endDate" v-model="endDate" />
        </div>
        <!--
        <div class="form-group">
          <label for="groupBy">Group By (Future):</label>
          <select id="groupBy" v-model="groupBy" disabled>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        -->
      </div>
      <button @click="generateReport" :disabled="isLoading" class="generate-button">
        {{ isLoading ? 'Generating...' : 'Generate Report' }}
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">Loading report data...</div>
    <div v-if="errorMessage" class="error-message card">
      Error generating report: {{ errorMessage }}
    </div>

    <div v-if="reportData && !isLoading" class="report-results card">
      <h3>Report for Period: {{ reportData.report_period.start_date }} to {{ reportData.report_period.end_date }}</h3>

      <div class="summary-section">
        <h4>Summary</h4>
        <div class="summary-grid">
            <p><strong>Total Orders:</strong> {{ reportData.summary.total_orders_count }}</p>
            <p><strong>Total Gross Revenue:</strong> ${{ reportData.summary.total_gross_revenue }}</p>
            <p><strong>Total Discounts Given:</strong> ${{ reportData.summary.total_discount_given }}</p>
            <p><strong>Total Net Revenue:</strong> ${{ reportData.summary.total_revenue }}</p>
        </div>
      </div>

      <div class="orders-section" v-if="reportData.orders && reportData.orders.length > 0">
        <h4>Individual Orders ({{ reportData.orders.length }})</h4>
        <table class="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Order Date</th>
              <th>Status</th>
              <th>User ID</th>
              <th>Original Total</th>
              <th>Discount Applied</th>
              <th>Final Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in reportData.orders" :key="order.id">
              <td><NuxtLink :to="`/admin/orders/${order.id}`">#{{ order.id }}</NuxtLink></td>
              <td>{{ new Date(order.created_at).toLocaleDateString() }}</td>
              <td><span :class="`status status-${order.status.toLowerCase()}`">{{ order.status }}</span></td>
              <td>{{ order.user_id }}</td>
              <td>${{ parseFloat(order.original_total_amount || order.total_amount).toFixed(2) }}</td>
              <td>${{ parseFloat(order.discount_amount_applied || 0).toFixed(2) }}</td>
              <td><strong>${{ parseFloat(order.total_amount).toFixed(2) }}</strong></td>
            </tr>
          </tbody>
        </table>
        <!-- Basic client-side pagination for orders list if needed, or advise server-side if too many -->
      </div>
      <div v-else class="empty-state">
        <p>No individual orders found for this period matching the criteria.</p>
      </div>
    </div>
     <div v-if="!reportData && !isLoading && !errorMessage" class="empty-state card">
      <p>Please select a date range and generate the report.</p>
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

// Default date range (e.g., this month)
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const startDate = ref(firstDayOfMonth.toISOString().split('T')[0]);
const endDate = ref(today.toISOString().split('T')[0]);
// const groupBy = ref('day'); // For future use

const reportData = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

async function generateReport() {
  isLoading.value = true;
  errorMessage.value = '';
  reportData.value = null;

  if (!startDate.value || !endDate.value) {
    errorMessage.value = 'Please select both a start and end date.';
    isLoading.value = false;
    return;
  }
  if (new Date(startDate.value) > new Date(endDate.value)) {
    errorMessage.value = 'Start date cannot be after end date.';
    isLoading.value = false;
    return;
  }

  try {
    const response = await $axios.get('/admin/reports/sales', {
      params: {
        start_date: startDate.value,
        end_date: endDate.value,
        // group_by: groupBy.value, // For future use
      },
    });
    reportData.value = response.data;
  } catch (error) {
    console.error('Failed to generate sales report:', error);
    errorMessage.value = error.response?.data?.message || 'An unexpected error occurred.';
  } finally {
    isLoading.value = false;
  }
}

// Optionally generate a report on mount with default dates
onMounted(() => {
  // generateReport(); // Uncomment to load default report on page load
});

useHead({
  title: 'Admin - Sales Report',
});
</script>

<style scoped>
.admin-sales-report-page { padding: 1rem; }
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
.form-group { display: flex; flex-direction: column; flex: 1; min-width: 200px; }
.form-group label { margin-bottom: 0.3rem; font-weight: bold; font-size: 0.9em; }
.form-group input[type="date"], .form-group select {
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
.error-message { background-color: #fdd; color: #900; }
.empty-state { background-color: #f8f9fa; }

.report-results h3 { font-size: 1.3em; margin-bottom: 1rem; color: #333; }
.summary-section { margin-bottom: 2rem; }
.summary-section h4 { font-size: 1.1em; color: #0056b3; margin-bottom: 0.75rem; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; }
.summary-grid p { background-color: #f8f9fa; padding: 0.75rem; border-radius: 4px; margin:0; font-size: 1em; }
.summary-grid p strong { color: #333; }


.orders-section h4 { font-size: 1.1em; color: #0056b3; margin-bottom: 0.75rem; }
.orders-table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
.orders-table th, .orders-table td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
.orders-table th { background-color: #f2f2f2; }
.orders-table td strong { color: #155724; } /* Green for final total in table */
.status { padding: 0.2em 0.5em; border-radius: 4px; color: white; font-size: 0.9em; text-transform: capitalize; }
.status-shipped, .status-delivered, .status-completed { background-color: #28a745; }
/* Add other status colors if needed */
</style>

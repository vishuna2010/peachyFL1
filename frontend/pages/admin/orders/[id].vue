<template>
  <div class="admin-order-detail-page">
    <div v-if="isLoading" class="loading-state">Loading order details...</div>
    <div v-if="fetchError" class="error-state">
      Error fetching order details: {{ fetchError.message || fetchError }}
      <p v-if="fetchError.response && fetchError.response.status === 404">
        The requested order was not found.
      </p>
      <NuxtLink to="/admin/orders" class="back-link">Back to Orders List</NuxtLink>
    </div>

    <div v-if="order && !isLoading" class="order-details-container">
      <h2>Order Details: #{{ order.id }}</h2>

      <div class="order-section order-info">
        <h3>Order Information</h3>
        <p><strong>Order ID:</strong> {{ order.id }}</p>
        <div class="status-section">
          <p><strong>Status:</strong> <span :class="`status status-${order.status.toLowerCase()}`">{{ order.status }}</span></p>
          <div class="status-update-form" v-if="order && order.status">
            <select v-model="selectedStatus" :disabled="isUpdatingStatus" class="status-select">
              <option v-for="s in allowedOrderStatuses" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
            </select>
            <button
              @click="handleUpdateStatus"
              :disabled="isUpdatingStatus || selectedStatus === order.status"
              class="update-status-button"
            >
              {{ isUpdatingStatus ? 'Updating...' : 'Update Status' }}
            </button>
          </div>
          <p v-if="statusUpdateError" class="error-message status-error">{{ statusUpdateError }}</p>
          <p v-if="statusUpdateSuccess" class="success-message status-success">{{ statusUpdateSuccess }}</p>
        </div>
        <p><strong>Order Date:</strong> {{ new Date(order.created_at).toLocaleString() }}</p>
        <p><strong>Last Updated:</strong> {{ new Date(order.updated_at).toLocaleString() }}</p>
        <p><strong>Total Amount:</strong> ${{ parseFloat(order.total_amount).toFixed(2) }}</p>
      </div>

      <div class="order-section customer-info">
        <h3>Customer Information</h3>
        <p><strong>User ID:</strong> {{ order.user_id }}</p>
        <p><strong>Email:</strong> {{ order.user_email }}</p>
        <p><strong>Role:</strong> {{ order.user_role || 'N/A' }}</p>
      </div>

      <div class="order-section shipping-address">
        <h3>Shipping Address</h3>
        <p>{{ order.shipping_address_line1 }}</p>
        <p v-if="order.shipping_address_line2">{{ order.shipping_address_line2 }}</p>
        <p>{{ order.shipping_city }}, {{ order.shipping_postal_code }}</p>
        <p>{{ order.shipping_country }}</p>
      </div>

      <div v-if="order.billing_address_line1" class="order-section billing-address">
        <h3>Billing Address</h3>
        <p>{{ order.billing_address_line1 }}</p>
        <p v-if="order.billing_address_line2">{{ order.billing_address_line2 }}</p>
        <p>{{ order.billing_city }}, {{ order.billing_postal_code }}</p>
        <p>{{ order.billing_country }}</p>
      </div>
      <div v-else class="order-section billing-address">
         <h3>Billing Address</h3>
         <p>Same as shipping address.</p>
      </div>


      <div class="order-section ordered-items">
        <h3>Ordered Items ({{ order.items?.length || 0 }})</h3>
        <table v-if="order.items && order.items.length > 0" class="items-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Price at Purchase</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in order.items" :key="item.order_item_id">
              <td>
                <img
                  v-if="item.product_image_url"
                  :src="item.product_image_url" <!-- Removed backendUrl prefix -->
                  :alt="item.product_name"
                  class="item-image"
                />
                <img
  v-if="item.image"
  :src="item.image"
  class="item-image"
/>
                <div v-else class="item-image-placeholder">No Image</div>
              </td>
              <td>{{ item.product_name }} (ID: {{ item.product_id }})</td>
              <td>{{ item.quantity }}</td>
              <td>${{ parseFloat(item.price_at_purchase).toFixed(2) }}</td>
              <td>${{ (parseFloat(item.price_at_purchase) * item.quantity).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else>No items found for this order.</p>
      </div>

      <NuxtLink to="/admin/orders" class="back-link">Back to Orders List</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'; // Added watch
import { useRoute, useNuxtApp, useRuntimeConfig } from '#app';

definePageMeta({
  layout: 'admin',
});

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const route = useRoute();
const { $axios } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();

const order = ref(null);
const isLoading = ref(true);
const fetchError = ref(null);

const selectedStatus = ref('');
const isUpdatingStatus = ref(false);
const statusUpdateError = ref('');
const statusUpdateSuccess = ref('');

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

async function fetchOrderDetails() {
  const orderId = route.params.id;
  isLoading.value = true;
  fetchError.value = null;
  statusUpdateError.value = ''; // Clear previous status errors
  statusUpdateSuccess.value = ''; // Clear previous success messages
  try {
    const response = await $axios.get(`/admin/orders/${orderId}`);
    order.value = response.data;
    if (order.value) {
      selectedStatus.value = order.value.status; // Initialize dropdown
    }
  } catch (err) {
    console.error(`Failed to fetch order details for ID ${orderId}:`, err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

async function handleUpdateStatus() {
  if (!order.value || selectedStatus.value === order.value.status) {
    return;
  }
  if (!confirm(`Are you sure you want to update the status to "${selectedStatus.value}"?`)) {
    return;
  }

  isUpdatingStatus.value = true;
  statusUpdateError.value = '';
  statusUpdateSuccess.value = '';
  const orderId = order.value.id;

  try {
    const response = await $axios.put(`/admin/orders/${orderId}/status`, {
      status: selectedStatus.value,
    });
    if (response.data && response.data.order) {
      order.value = response.data.order; // Update local order data
      selectedStatus.value = order.value.status; // Sync dropdown
      statusUpdateSuccess.value = `Order status successfully updated to "${order.value.status}".`;
    } else {
      // Fallback if response is not as expected
      statusUpdateSuccess.value = 'Order status updated, but no order data returned.';
      await fetchOrderDetails(); // Re-fetch to be sure
    }
  } catch (err) {
    console.error(`Failed to update status for order ID ${orderId}:`, err);
    statusUpdateError.value = err.response?.data?.message || 'Failed to update status.';
    // Optionally revert selectedStatus if API call fails, or let user retry
    // selectedStatus.value = order.value.status; // Revert dropdown
  } finally {
    isUpdatingStatus.value = false;
    setTimeout(() => { // Clear messages after a few seconds
        statusUpdateSuccess.value = '';
        statusUpdateError.value = '';
    }, 5000);
  }
}

// Watch for order data to set the initial selectedStatus
watch(order, (newOrderData) => {
    if (newOrderData && newOrderData.status) {
        selectedStatus.value = newOrderData.status;
    }
});


onMounted(fetchOrderDetails);

useHead({
  title: computed(() => `Admin - Order #${route.params.id}`),
});
</script>

<style scoped>
.admin-order-detail-page {
  padding: 1rem;
}
h2, h3 {
  margin-bottom: 1rem;
  color: #333;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}
.loading-state, .error-state {
  text-align: center;
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 8px;
}
.error-state { background-color: #fdd; color: #900; }
.error-message, .success-message { /* General purpose messages */
  padding: 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
  text-align: center;
}
.error-message { background-color: #ffe0e0; color: #D8000C; }
.success-message { background-color: #e0ffe0; color: #006400; }


.order-details-container {
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.order-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}
.order-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
.order-section h3 {
  font-size: 1.2em;
  color: #0056b3; /* Darker blue for section titles */
  margin-bottom: 0.75rem;
}
.order-section p {
  margin: 0.3rem 0;
  line-height: 1.6;
}

.status-section { /* Container for status display and update form */
  margin-bottom: 0.5rem; /* Space between status display and other PIs */
}
.status-update-form {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  max-width: fit-content; /* Make it compact */
}
.status-select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
}
.update-status-button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.update-status-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.update-status-button:hover:not(:disabled) {
  background-color: #0056b3;
}
/* Specific styling for status messages within the status section */
.status-error, .status-success {
  font-size: 0.9em;
  margin-top: 0.5rem;
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

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}
.items-table th, .items-table td {
  border: 1px solid #ddd;
  padding: 0.6rem;
  text-align: left;
  font-size: 0.9em;
}
.items-table th {
  background-color: #f2f2f2;
}
.item-image, .item-image-placeholder {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  background-color: #e9ecef;
}
.item-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  color: #777;
}

.back-link {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.6rem 1.2rem;
  background-color: #6c757d;
  color: white;
  text-decoration: none;
  border-radius: 4px;
}
.back-link:hover {
  background-color: #5a6268;
}
</style>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div v-if="isLoading && !order" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading order details...</p>
    </div>
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 p-4 rounded-md border border-red-200">
      <p class="text-lg font-medium text-red-700">Error fetching order details</p>
      <p class="text-sm text-red-600 mt-1">{{ fetchError.message || fetchError }}</p>
      <p v-if="fetchError.response && fetchError.response.status === 404" class="text-sm text-red-600 mt-1">
        The requested order was not found.
      </p>
      <NuxtLink to="/admin/orders"
        class="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Back to Orders List
      </NuxtLink>
    </div>

    <div v-if="order && !isLoading" class="bg-white shadow-lg rounded-lg p-6 sm:p-8 border border-gray-200 space-y-8">
      <h1 class="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6 text-center">Order #{{ order.id }}</h1>

      <!-- Order Information Section -->
      <div class="border-b border-gray-200 pb-6">
        <h3 class="text-xl font-semibold text-gray-800 mb-4">Order Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <p><strong class="font-medium text-gray-800">Order ID:</strong> <span class="text-gray-700">{{ order.id }}</span></p>
          <p><strong class="font-medium text-gray-800">Order Date:</strong> <span class="text-gray-700">{{ formatOrderDateTime(order.created_at) }}</span></p>
          <p><strong class="font-medium text-gray-800">Total Amount:</strong> <span class="text-gray-700 font-semibold">{{ formatCurrency(order.total_amount) }}</span></p>
          <p><strong class="font-medium text-gray-800">Last Updated:</strong> <span class="text-gray-700">{{ formatOrderDateTime(order.updated_at) }}</span></p>
          <div class="md:col-span-2 flex items-center space-x-3 mt-2">
            <p><strong class="font-medium text-gray-800">Status:</strong>
              <span :class="getStatusClass(order.status)" class="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ order.status }}
              </span>
            </p>
          </div>
           <!-- Status Update Form -->
          <form @submit.prevent="handleUpdateStatus" class="mt-2 md:col-span-2 flex items-center space-x-2">
            <select v-model="selectedStatus" :disabled="isUpdatingStatus"
              class="form-select rounded-md shadow-sm border-gray-300 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1.5 h-9">
              <option v-for="s in ALLOWED_ORDER_STATUSES" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
            </select>
            <button type="submit" :disabled="isUpdatingStatus || selectedStatus === order.status"
              class="px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {{ isUpdatingStatus ? 'Updating...' : 'Update Status' }}
            </button>
          </form>
          <div class="md:col-span-2 mt-1">
            <p v-if="statusUpdateError" class="text-xs text-red-600">{{ statusUpdateError }}</p>
            <p v-if="statusUpdateSuccess" class="text-xs text-green-600">{{ statusUpdateSuccess }}</p>
          </div>
        </div>
      </div>

      <!-- Refund Section -->
      <div v-if="can('orders:manage_refunds').value && order && order.payment_status !== 'refunded'" class="border-b border-gray-200 pb-6">
        <h3 class="text-xl font-semibold text-gray-800 mb-4">Process Refund</h3>
        <div class="form-group mb-3">
            <label for="refund_reason" class="block text-sm font-medium text-gray-700 mb-1">Reason for Refund (Optional):</label>
            <input type="text" id="refund_reason" v-model="refundReason"
                   class="w-full sm:w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                   placeholder="e.g., Customer request, item damaged">
        </div>
        <button
          @click="handleProcessFullRefund"
          :disabled="isRefunding || order.payment_status === 'refunded'"
          class="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {{ isRefunding ? 'Processing Refund...' : 'Process Full Refund' }}
        </button>
        <p v-if="refundError" class="text-xs text-red-600 mt-2">{{ refundError }}</p>
        <p v-if="refundSuccess" class="text-xs text-green-600 mt-2">{{ refundSuccess }}</p>
      </div>
      <div v-else-if="order && order.payment_status === 'refunded'" class="border-b border-gray-200 pb-6">
         <h3 class="text-xl font-semibold text-gray-800 mb-4">Refund Status</h3>
         <p class="text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200">This order has been fully refunded.</p>
      </div>


      <!-- Customer Information Section -->
      <div class="border-b border-gray-200 pb-6">
        <h3 class="text-xl font-semibold text-gray-800 mb-4">Customer Information</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <p><strong class="font-medium text-gray-800">User ID:</strong> <span class="text-gray-700">{{ order.user_id }}</span></p>
          <p><strong class="font-medium text-gray-800">Email:</strong> <span class="text-gray-700">{{ order.user_email }}</span></p>
          <p><strong class="font-medium text-gray-800">Role:</strong> <span class="text-gray-700">{{ order.user_role || 'N/A' }}</span></p>
        </div>
      </div>

      <!-- Addresses Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div class="border-b md:border-b-0 md:border-r border-gray-200 pb-6 md:pb-0 md:pr-6">
          <h3 class="text-xl font-semibold text-gray-800 mb-4">Shipping Address</h3>
          <div class="text-sm text-gray-700 space-y-1">
            <p>{{ order.shipping_address_line1 }}</p>
            <p v-if="order.shipping_address_line2">{{ order.shipping_address_line2 }}</p>
            <p>{{ order.shipping_city }}, {{ order.shipping_postal_code }}</p>
            <p>{{ order.shipping_country }}</p>
          </div>
        </div>

        <div>
          <h3 class="text-xl font-semibold text-gray-800 mb-4">Billing Address</h3>
          <div v-if="order.billing_address_line1" class="text-sm text-gray-700 space-y-1">
            <p>{{ order.billing_address_line1 }}</p>
            <p v-if="order.billing_address_line2">{{ order.billing_address_line2 }}</p>
            <p>{{ order.billing_city }}, {{ order.billing_postal_code }}</p>
            <p>{{ order.billing_country }}</p>
          </div>
          <p v-else class="text-sm text-gray-700">Same as shipping address.</p>
        </div>
      </div>


      <!-- Ordered Items Section -->
      <div class="pt-6">
        <h3 class="text-xl font-semibold text-gray-800 mb-4">Ordered Items ({{ order.items?.length || 0 }})</h3>
        <div v-if="order.items && order.items.length > 0" class="overflow-x-auto border border-gray-200 rounded-md">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Details</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Class</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Line Total</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="item in order.items" :key="item.order_item_id">
                <td class="px-4 py-3">
                  <img v-if="item.product_image_url" :src="item.product_image_url" :alt="item.product_name"
                       class="w-16 h-16 rounded-md object-cover bg-gray-100">
                  <div v-else class="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Image</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  <div>{{ item.product_name }} (ID: {{ item.product_id }})</div>
                  <div v-if="item.display_sku" class="text-xs text-gray-500">SKU: {{ item.display_sku }}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  {{ item.tax_class_name_at_purchase || (item.tax_class_id_at_purchase ? `ID: ${item.tax_class_id_at_purchase}` : 'N/A') }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{{ item.quantity }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{{ formatCurrency(item.price_at_purchase) }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">{{ formatCurrency(parseFloat(item.price_at_purchase) * item.quantity) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-gray-500">No items found for this order.</p>
      </div>

      <div class="mt-8 text-center">
        <NuxtLink to="/admin/orders"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-block">
          Back to Orders List
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useNuxtApp, useRuntimeConfig, useHead } from '#app'; // Added useHead
import { usePermissions } from '~/composables/usePermissions'; // Import usePermissions

definePageMeta({
  layout: 'admin',
  // Title will be set dynamically by useHead
});

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const route = useRoute();
const { $axios } = useNuxtApp();
const runtimeConfig = useRuntimeConfig(); // Kept if backendUrl is needed, otherwise can be removed

const order = ref(null);
const isLoading = ref(true);
const fetchError = ref(null);

const selectedStatus = ref('');
const isUpdatingStatus = ref(false);
const statusUpdateError = ref('');
const statusUpdateSuccess = ref('');

const { can } = usePermissions();
const isRefunding = ref(false);
const refundError = ref('');
const refundSuccess = ref('');
const refundReason = ref('');

// backendUrl computed property is not used in this version, can be removed if not needed elsewhere
// const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

useHead({
  title: computed(() => `Admin - Order #${route.params.id}${order.value ? ` (${order.value.user_email})` : ''}`),
});

const formatCurrency = (amount) => amount ? Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A';
const formatOrderDateTime = (dateString) => dateString ? new Date(dateString).toLocaleString() : 'N/A';

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

async function fetchOrderDetails() {
  const orderId = route.params.id;
  isLoading.value = true;
  fetchError.value = null;
  statusUpdateError.value = '';
  statusUpdateSuccess.value = '';
  try {
    // Corrected API endpoint
    const response = await $axios.get(`/admin/orders/${orderId}`);
    order.value = response.data;
    if (order.value) {
      selectedStatus.value = order.value.status;
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
    // Corrected API endpoint
    const response = await $axios.put(`/admin/orders/${orderId}/status`, {
      status: selectedStatus.value,
    });
    if (response.data && response.data.order) {
      order.value = response.data.order;
      selectedStatus.value = order.value.status;
      statusUpdateSuccess.value = `Order status successfully updated to "${order.value.status}".`;
    } else {
      statusUpdateSuccess.value = 'Order status updated, but no order data returned.';
      await fetchOrderDetails();
    }
  } catch (err) {
    console.error(`Failed to update status for order ID ${orderId}:`, err);
    statusUpdateError.value = err.response?.data?.message || 'Failed to update status.';
  } finally {
    isUpdatingStatus.value = false;
    setTimeout(() => {
        statusUpdateSuccess.value = '';
        statusUpdateError.value = '';
    }, 5000);
  }
}

async function handleProcessFullRefund() {
  if (!order.value || order.value.payment_status === 'refunded') {
    refundError.value = "Order cannot be refunded or is already refunded.";
    return;
  }
  if (!confirm(`Are you sure you want to process a FULL refund for Order #${order.value.id}? This action cannot be undone.`)) {
    return;
  }

  isRefunding.value = true;
  refundError.value = '';
  refundSuccess.value = '';
  const orderId = order.value.id;

  try {
    const payload = {};
    if (refundReason.value.trim()) {
      payload.reason = refundReason.value.trim();
    }

    const response = await $axios.post(`/admin/orders/${orderId}/refund`, payload);
    if (response.data && response.data.order) {
      order.value = response.data.order; // Update local order data
      selectedStatus.value = order.value.status; // Sync status dropdown
      refundSuccess.value = response.data.message || `Order #${orderId} successfully refunded.`;
      refundReason.value = ''; // Clear reason input
    } else {
      // Should ideally not happen if backend returns proper response
      refundSuccess.value = 'Refund processed, but no updated order data returned. Please refresh.';
      await fetchOrderDetails(); // Re-fetch to be sure
    }
  } catch (err) {
    console.error(`Failed to process refund for order ID ${orderId}:`, err);
    refundError.value = err.response?.data?.message || 'Failed to process refund.';
  } finally {
    isRefunding.value = false;
    setTimeout(() => {
        refundSuccess.value = '';
        refundError.value = '';
    }, 7000); // Display message for longer
  }
}


watch(order, (newOrderData) => {
    if (newOrderData && newOrderData.status) {
        selectedStatus.value = newOrderData.status;
    }
});

onMounted(fetchOrderDetails);

</script>

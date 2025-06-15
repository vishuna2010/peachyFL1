<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))]">
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-6">
      Order Details <span class="text-brand-primary">#{{ orderId }}</span>
    </h1>

    <div v-if="isLoading" class="text-center py-10 text-lg text-text-secondary font-medium">
      Loading order details...
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load order details: {{ fetchError }}</p>
      <NuxtLink to="/profile/orders" class="mt-4 inline-block font-medium text-brand-primary hover:underline">Back to My Orders</NuxtLink>
    </div>
    <div v-else-if="!order" class="my-6 p-8 bg-neutral-light text-text-secondary rounded-lg shadow text-center">
      <p class="text-xl mb-4">Order not found.</p>
      <NuxtLink to="/profile/orders" class="mt-2 inline-block px-6 py-3 bg-brand-primary text-white font-medium rounded-md hover:bg-opacity-80 transition-colors">
        Back to My Orders
      </NuxtLink>
    </div>
    <div v-else class="space-y-6">
      <!-- Order Header Info -->
      <div class="bg-white shadow-md rounded-lg p-6 border border-neutral-medium">
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
          <div>
            <p class="text-sm text-text-secondary">Order Placed:</p>
            <p class="text-base text-text-primary font-medium">{{ new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p>
          </div>
          <div>
            <p class="text-sm text-text-secondary mt-3 sm:mt-0 text-left sm:text-right">Status:</p>
            <p :class="statusClass(order.status)" class="text-base font-semibold px-3 py-1 rounded-full inline-block mt-1">
              {{ order.status }}
            </p>
          </div>
        </div>
        <p class="text-sm text-text-secondary"><span class="font-medium">Payment Method:</span> {{ order.payment_method || 'N/A' }}</p>
      </div>

      <!-- Order Items -->
      <div class="bg-white shadow-md rounded-lg border border-neutral-medium">
        <h3 class="text-lg font-semibold text-text-primary p-4 sm:p-6 border-b border-neutral-light">Items Ordered</h3>
        <ul class="divide-y divide-neutral-light">
          <li v-for="item in order.items" :key="item.item_id" class="p-4 sm:p-6 flex items-start space-x-4">
            <img :src="item.image_url || 'https://via.placeholder.com/80x80.png?text=No+Img'" :alt="item.name" class="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md border border-neutral-light flex-shrink-0">
            <div class="flex-grow">
              <p class="font-semibold text-text-primary">{{ item.name }}</p>
              <p class="text-sm text-text-secondary">Qty: {{ item.quantity }}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="font-semibold text-text-primary">${{ (item.price_at_purchase * item.quantity).toFixed(2) }}</p>
              <p class="text-sm text-text-secondary" v-if="item.quantity > 1">${{ item.price_at_purchase.toFixed(2) }} each</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Addresses & Summary (Grid Layout) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Shipping Address -->
        <div class="bg-white shadow-md rounded-lg p-6 border border-neutral-medium">
          <h3 class="text-lg font-semibold text-text-primary mb-3">Shipping Address</h3>
          <address class="not-italic text-sm text-text-secondary space-y-1">
            <p>{{ order.shipping_address.line1 }}</p>
            <p v-if="order.shipping_address.line2">{{ order.shipping_address.line2 }}</p>
            <p>{{ order.shipping_address.city }}, {{ order.shipping_address.postalCode }}</p>
            <p>{{ order.shipping_address.country }}</p>
          </address>
        </div>

        <!-- Billing Address -->
        <div class="bg-white shadow-md rounded-lg p-6 border border-neutral-medium">
          <h3 class="text-lg font-semibold text-text-primary mb-3">Billing Address</h3>
          <address class="not-italic text-sm text-text-secondary space-y-1">
            <p>{{ order.billing_address.line1 }}</p>
            <p v-if="order.billing_address.line2">{{ order.billing_address.line2 }}</p>
            <p>{{ order.billing_address.city }}, {{ order.billing_address.postalCode }}</p>
            <p>{{ order.billing_address.country }}</p>
          </address>
        </div>
      </div>

      <!-- Pricing Summary -->
       <div class="bg-white shadow-md rounded-lg p-6 border border-neutral-medium">
         <h3 class="text-lg font-semibold text-text-primary mb-4">Order Totals</h3>
         <div class="space-y-2 text-sm">
           <p class="flex justify-between"><span class="text-text-secondary">Subtotal:</span> <span class="font-medium text-text-primary">${{ order.subtotal.toFixed(2) }}</span></p>
           <p v-if="order.discount_applied" class="flex justify-between"><span class="text-text-secondary">Discount ({{ order.discount_applied.code }}):</span> <span class="font-medium text-green-600">-${{ order.discount_applied.amount_deducted.toFixed(2) }}</span></p>
           <p class="flex justify-between"><span class="text-text-secondary">Shipping:</span> <span class="font-medium text-text-primary">${{ (order.shipping_cost || 0).toFixed(2) }}</span></p>
           <hr class="my-2 border-neutral-medium">
           <p class="flex justify-between text-base font-bold"><span class="text-text-primary">Grand Total:</span> <span class="text-brand-primary">${{ order.total_amount.toFixed(2) }}</span></p>
         </div>
       </div>

      <div class="mt-8 text-center">
         <NuxtLink to="/profile/orders" class="inline-block px-6 py-3 border border-neutral-dark text-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors">
             &larr; Back to My Orders
         </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRoute, useRouter, navigateTo, useHead, useNuxtApp } from '#app';

const route = useRoute();
const router = useRouter(); // Initialized useRouter
const { $axios } = useNuxtApp();

definePageMeta({
  layout: 'default',
  middleware: async (to, from) => {
    const { authToken, isAuthInitialized } = useAuth();

    if (typeof isAuthInitialized !== 'undefined' && !isAuthInitialized.value) {
      await new Promise(resolve => {
        const unwatch = watch(isAuthInitialized, (newValue) => {
          if (newValue) {
            unwatch();
            resolve();
          }
        });
      });
    }

    if (!authToken.value) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }
});

const orderId = route.params.id;

useHead({
  title: `Order #${orderId} Details`,
});

const order = ref(null);
const isLoading = ref(true);
const fetchError = ref(null);

const statusClass = (status) => {
  if (!status) return 'text-gray-700 bg-gray-100';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'delivered' || lowerStatus === 'completed') {
    return 'bg-green-100 text-green-700';
  } else if (lowerStatus === 'shipped' || lowerStatus === 'processing') {
    return 'bg-blue-100 text-blue-700';
  } else if (lowerStatus === 'cancelled' || lowerStatus === 'refunded') {
    return 'bg-red-100 text-red-700';
  } else if (lowerStatus === 'pending') {
    return 'bg-yellow-100 text-yellow-700';
  }
  return 'bg-gray-100 text-gray-700';
};

async function fetchOrderDetail() {
  const currentOrderId = route.params.id;
  isLoading.value = true;
  fetchError.value = null;
  order.value = null;

  try {
    const response = await $axios.get(`/orders/my-history/${currentOrderId}`);
    order.value = response.data;
  } catch (err) {
    console.error(`Failed to fetch order details for order ${currentOrderId}:`, err);
    if (err.response && err.response.status === 404) {
      fetchError.value = err.response.data.message || `Order #${currentOrderId} not found or you do not have permission to view it.`;
    } else {
      fetchError.value = err.response?.data?.message || err.message || 'Could not load order details.';
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchOrderDetail();
});

// Watch for route param changes if user navigates from one order detail to another (less common for this page)
watch(() => route.params.id, (newId) => {
    if (newId && newId !== order.value?.id) { // Check if order already loaded to avoid refetch on same page
        fetchOrderDetail();
    }
});
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))]">
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-8 text-center">My Orders</h1>

    <div v-if="isLoading" class="text-center py-10 text-lg text-text-secondary font-medium">
      Loading your orders...
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load your orders: {{ fetchError }}</p>
    </div>
    <div v-else-if="orders.length === 0" class="my-6 p-8 bg-neutral-light text-text-secondary rounded-lg shadow text-center">
      <p class="text-xl mb-4">You haven't placed any orders yet.</p>
      <NuxtLink to="/" class="mt-2 inline-block px-6 py-3 bg-brand-primary text-white font-medium rounded-md hover:bg-opacity-80 transition-colors">
        Start Shopping
      </NuxtLink>
    </div>
    <div v-else class="space-y-4">
      <div v-for="order in orders" :key="order.id" class="bg-white shadow-md rounded-lg p-4 sm:p-6 border border-neutral-medium hover:shadow-lg transition-shadow duration-200">
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-3 pb-3 border-b border-neutral-light">
          <div>
            <h3 class="text-lg font-semibold text-brand-primary hover:underline">
              <NuxtLink :to="`/profile/orders/${order.id}`">Order #{{ order.id }}</NuxtLink>
            </h3>
            <p class="text-xs text-text-secondary mt-1">Placed on: {{ new Date(order.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</p>
          </div>
          <span :class="statusClass(order.status)" class="text-xs font-medium px-2.5 py-1 rounded-full mt-2 sm:mt-0 self-start sm:self-center">
            {{ order.status }}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
          <p><span class="font-medium text-text-secondary">Total Amount:</span> <span class="font-semibold text-text-primary">${{ order.total_amount.toFixed(2) }}</span></p>
          <p><span class="font-medium text-text-secondary">Items:</span> <span class="font-semibold text-text-primary">{{ order.item_count }}</span></p>
        </div>
        <div class="text-right mt-3">
          <NuxtLink :to="`/profile/orders/${order.id}`" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors">
            View Details
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { navigateTo, useNuxtApp } from '#app';

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

useHead({
  title: 'My Orders',
});

const isLoading = ref(true);
const orders = ref([]);
const fetchError = ref(null);

const statusClass = (status) => {
  if (!status) return 'text-neutral-dark bg-neutral-light';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'delivered' || lowerStatus === 'completed') {
    return 'text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs';
  } else if (lowerStatus === 'shipped' || lowerStatus === 'processing') {
    return 'text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full text-xs';
  } else if (lowerStatus === 'cancelled' || lowerStatus === 'refunded') {
    return 'text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-xs';
  } else if (lowerStatus === 'pending') {
    return 'text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full text-xs';
  }
  return 'text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full text-xs'; // Default
};

onMounted(() => {
  isLoading.value = true;
  fetchError.value = null;

  setTimeout(() => {
    orders.value = [
      { id: 'ORD00123', order_date: '2023-10-26T10:30:00Z', total_amount: 79.98, status: 'Shipped', item_count: 2 },
      { id: 'ORD00124', order_date: '2023-10-20T14:15:00Z', total_amount: 149.50, status: 'Delivered', item_count: 1 },
      { id: 'ORD00125', order_date: '2023-09-15T09:00:00Z', total_amount: 35.00, status: 'Cancelled', item_count: 3 },
      { id: 'ORD00126', order_date: '2023-11-01T11:00:00Z', total_amount: 250.75, status: 'Processing', item_count: 5 },
    ];
    isLoading.value = false;
  }, 1000);
});
</script>

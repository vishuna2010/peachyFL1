<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))]">
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-8 text-center">My Orders</h1>

    <div v-if="isLoading" class="space-y-4">
      <OrderListItemSkeleton v-for="n in 4" :key="`order-skeleton-${n}`" />
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
    <div v-else>
      <div class="space-y-4">
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
      <!-- Pagination Controls -->
      <div class="mt-8 flex justify-center items-center space-x-3" v-if="paginationData && paginationData.totalPages > 1">
        <button
          @click="fetchUserOrders(paginationData.page - 1)"
          :disabled="!paginationData.hasPrevPage"
          class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-sm text-text-secondary">
          Page {{ paginationData.page }} of {{ paginationData.totalPages }}
        </span>
        <button
          @click="fetchUserOrders(paginationData.page + 1)"
          :disabled="!paginationData.hasNextPage"
          class="px-4 py-2 border border-neutral-dark rounded-md text-sm font-medium hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { navigateTo, useNuxtApp, useRoute, useRouter, useHead } from '#app'; // Added useHead
import OrderListItemSkeleton from '~/components/OrderListItemSkeleton.vue'; // Import skeleton

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

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const orders = ref([]);
const fetchError = ref(null);
const currentPage = ref(parseInt(route.query.page) || 1);
const limit = ref(10);
const paginationData = ref({
  total: 0,
  page: currentPage.value,
  limit: limit.value,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
});

const statusClass = (status) => {
  if (!status) return 'text-neutral-dark bg-neutral-light'; // Adjusted default from gray to neutral
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
  return 'text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full text-xs';
};

async function fetchUserOrders(pageToFetch = currentPage.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/api/orders/my-history', {
      params: {
        page: pageToFetch,
        limit: limit.value
      }
    });
    orders.value = response.data.data;
    paginationData.value = response.data.pagination;
    currentPage.value = response.data.pagination.page;
    // Update router query if pageToFetch was different from route.query.page
    // This handles direct calls to fetchUserOrders (e.g. from buttons)
    if (router && route.query.page !== currentPage.value.toString()) {
        router.push({ query: { ...route.query, page: currentPage.value } });
    }
  } catch (err) {
    console.error('Failed to fetch user orders:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load orders.';
    orders.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchUserOrders(currentPage.value);
});

watch(() => route.query.page, (newPage) => {
  const pageToFetch = parseInt(newPage) || 1;
  // Fetch only if page actually changed from the ref, or if it's the first load with no orders
  // This condition aims to prevent re-fetch if already on the correct page from onMounted
  if (pageToFetch !== currentPage.value) {
      fetchUserOrders(pageToFetch);
  } else if (!orders.value.length && !isLoading.value && !fetchError.value && pageToFetch === currentPage.value) {
      // This case handles scenarios like navigating back to a page that previously had an error
      // or was empty, and we want to retry loading if the URL matches the current state.
      fetchUserOrders(pageToFetch);
  }
}, { immediate: false }); // immediate: false because onMounted handles initial load.

</script>

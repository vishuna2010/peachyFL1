<template>
  <div class="space-y-6">
    <!-- Stat Cards Section -->
    <div v-if="statsError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
      <span class="font-medium">Error fetching statistics:</span> {{ statsError.message || statsError }}
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 mb-6">
      <StatCard
        v-for="card in statCardsData"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :iconName="card.iconName"
        :trend="card.trend"
        :trendDirection="card.trendDirection"
        :iconBackgroundClass="card.iconBackgroundClass"
        :isLoading="isLoadingStats"
      />
    </div>

    <!-- Chart and Recent Activity Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border border-neutral-200 min-h-[300px] flex flex-col items-center justify-center text-text-secondary">
        <svg class="w-16 h-16 text-neutral-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
        <p class="font-medium">Chart Area Placeholder</p>
        <p class="text-xs">(e.g., Sales Over Time)</p>
      </div>
      <!-- Recent Stock Activity -->
      <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-800">Recent Stock Activity</h3>
          <NuxtLink to="/admin/inventory/logs" class="text-sm text-peach-pink hover:text-opacity-80 font-medium">
            View All Logs &rarr;
          </NuxtLink>
        </div>

        <!-- Loading State -->
        <div v-if="isLoadingRecentActivity" class="text-center py-6">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
          <p class="mt-2 text-sm text-gray-500">Loading activity...</p>
        </div>

        <!-- Error State -->
        <div v-if="recentActivityError" class="p-3 mb-3 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
          <span class="font-medium">Error fetching activity:</span> {{ recentActivityError }}
        </div>

        <!-- Empty State -->
        <div v-if="!isLoadingRecentActivity && !recentActivityError && recentActivity.length === 0" class="text-center py-6">
           <svg class="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <p class="mt-2 text-sm text-gray-500">No recent stock activity found.</p>
        </div>

        <!-- Activity List -->
        <ul v-if="!isLoadingRecentActivity && !recentActivityError && recentActivity.length > 0" class="divide-y divide-gray-200">
          <li v-for="activity in recentActivity" :key="activity.id" class="py-3">
            <div class="flex items-center space-x-3">
              <div class="flex-shrink-0">
                <span :class="getActivityIconBackgroundClass(activity.movement_type)" class="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold">
                  {{ getActivityIconInitial(activity.movement_type) }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate" :title="formatActivityTitle(activity)">
                  {{ formatActivityTitle(activity) }}
                </p>
                <p class="text-xs text-gray-500 truncate">
                  <span :class="getQtyChangedClass(activity.quantity_changed)">
                    Qty: {{ activity.quantity_changed > 0 ? '+' : '' }}{{ activity.quantity_changed }}
                  </span>
                  (New: {{ activity.new_quantity_on_hand }})
                  <span v-if="activity.reason" class="italic"> - Reason: {{ activity.reason }}</span>
                </p>
              </div>
              <div class="text-xs text-gray-400 whitespace-nowrap">
                {{ formatActivityTimestamp(activity.timestamp) }}
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Recent Orders Table -->
    <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-800">Recent Orders</h3>
        <NuxtLink to="/admin/orders" class="text-sm text-peach-pink hover:text-opacity-80 font-medium">
          View All Orders &rarr;
        </NuxtLink>
      </div>

      <!-- Loading State -->
      <div v-if="isLoadingRecentOrders" class="text-center py-6">
        <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
        <p class="mt-2 text-sm text-gray-500">Loading recent orders...</p>
      </div>

      <!-- Error State -->
      <div v-if="recentOrdersError" class="p-3 mb-3 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
        <span class="font-medium">Error fetching recent orders:</span> {{ recentOrdersError }}
      </div>

      <!-- Empty State -->
      <div v-if="!isLoadingRecentOrders && !recentOrdersError && recentOrders.length === 0" class="text-center py-6">
        <svg class="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p class="mt-2 text-sm text-gray-500">No recent orders found.</p>
      </div>

      <!-- Table -->
      <div v-if="!isLoadingRecentOrders && !recentOrdersError && recentOrders.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="order in recentOrders" :key="order.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">#{{ order.id }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ order.user_email }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatOrderDate(order.created_at) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ formatCurrency(order.total_amount) }}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span :class="getStatusClass(order.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ order.status }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                <NuxtLink :to="`/admin/orders/${order.id}`" class="text-indigo-600 hover:text-indigo-900">View</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useHead, useNuxtApp, useRouter } from '#app';
import { useAuth } from '~/composables/useAuth';
import StatCard from '~/components/admin/StatCard.vue';

definePageMeta({
  layout: 'admin',
  title: 'Admin Dashboard'
});

useHead({
  title: 'Admin Dashboard',
});

const { $axios } = useNuxtApp();
const router = useRouter();
const { authToken, authUser, isAuthenticated, isAuthInitialized } = useAuth();

// Authentication state initialized

const isLoadingStats = ref(true);
const statsError = ref(null);

// Recent Orders State
const recentOrders = ref([]);
const isLoadingRecentOrders = ref(true);
const recentOrdersError = ref(null);

// Recent Activity State
const recentActivity = ref([]);
const isLoadingRecentActivity = ref(true);
const recentActivityError = ref(null);


const statCardsData = ref([
  {
    title: "Total Revenue",
    value: "...",
    iconName: "TR",
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-peach-pink/20 text-peach-pink"
  },
  {
    title: "Total Users",
    value: "...",
    iconName: "TU",
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-sky-blue/20 text-sky-blue"
  },
  {
    title: "Total Orders",
    value: "...",
    iconName: "TO",
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-fresh-green/20 text-fresh-green"
  },
  {
    title: "Total Products",
    value: "...",
    iconName: "TP",
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-orange-gold/20 text-orange-gold"
  }
]);

async function fetchDashboardStats() {
  isLoadingStats.value = true;
  statsError.value = null;
  try {
    const [
      revenueRes,
      usersRes,
      ordersRes,
      productsRes
    ] = await Promise.all([
      $axios.get('/admin/stats/total-revenue'),
      $axios.get('/admin/stats/users-count'),
      $axios.get('/admin/stats/orders-count'),
      $axios.get('/admin/stats/products-count')
    ]);

    // Update Total Revenue
    const revenueCard = statCardsData.value.find(card => card.title === "Total Revenue");
    if (revenueCard && revenueRes.data.total_revenue !== undefined && revenueRes.data.total_revenue !== null) {
      const revenue = parseFloat(revenueRes.data.total_revenue);
      if (!isNaN(revenue)) {
        revenueCard.value = revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      } else {
        revenueCard.value = '$0.00';
      }
    } else {
      revenueCard.value = '$0.00';
    }

    // Update Total Users
    const usersCard = statCardsData.value.find(card => card.title === "Total Users");
    if (usersCard && usersRes.data.count !== undefined && usersRes.data.count !== null) {
      usersCard.value = usersRes.data.count.toString();
    } else {
      usersCard.value = '0';
    }

    // Update Total Orders
    const ordersCard = statCardsData.value.find(card => card.title === "Total Orders");
    if (ordersCard && ordersRes.data.count !== undefined && ordersRes.data.count !== null) {
      ordersCard.value = ordersRes.data.count.toString();
    } else {
      ordersCard.value = '0';
    }

    // Update Total Products
    const productsCard = statCardsData.value.find(card => card.title === "Total Products");
    if (productsCard && productsRes.data.count !== undefined && productsRes.data.count !== null) {
      productsCard.value = productsRes.data.count.toString();
    } else {
      productsCard.value = '0';
    }

  } catch (error) {
    statsError.value = error.response?.data || error;
    // Optionally set card values to 'Error' or keep '...'
    statCardsData.value.forEach(card => card.value = "Error");
  } finally {
    isLoadingStats.value = false;
  }
}

onMounted(() => {
  Promise.all([
    fetchDashboardStats(),
    fetchRecentOrders(),
    fetchRecentActivity()
  ]);
});

// Helper functions for Recent Orders
const formatOrderDate = (dateString) => {
  return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
};

const formatCurrency = (amount) => {
  // Ensure amount is a number before calling toLocaleString
  const numAmount = Number(amount);
  if (isNaN(numAmount)) {
    return 'N/A'; // Or some other placeholder for invalid numbers
  }
  return numAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const getStatusClass = (status) => {
  if (!status) return 'bg-gray-100 text-gray-800';
  switch (status.toLowerCase()) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'processing': return 'bg-blue-100 text-blue-800';
    case 'shipped': return 'bg-purple-100 text-purple-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'refunded': return 'bg-pink-100 text-pink-800'; // Example for another status
    default: return 'bg-gray-100 text-gray-800';
  }
};

async function fetchRecentOrders() {
  isLoadingRecentOrders.value = true;
  recentOrdersError.value = null;
  try {
    const response = await $axios.get('/admin/orders', {
      params: { page: 1, limit: 5 } // Default sort by created_at DESC is usually applied by backend
    });
    recentOrders.value = response.data.data;
  } catch (error) {
    recentOrdersError.value = error.response?.data?.message || error.message || 'Could not load recent orders.';
  } finally {
    isLoadingRecentOrders.value = false;
  }
}

// Helper functions for Recent Activity
const formatActivityTimestamp = (ts) => {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric'}) : 'N/A';
};

const formatActivityTitle = (activity) => {
  let title = activity.movement_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (activity.product_name) {
    title += `: ${activity.product_name}`;
    if (activity.variant_sku) {
      title += ` (Var: ${activity.variant_sku})`;
    } else if (activity.product_sku) {
      title += ` (SKU: ${activity.product_sku})`;
    }
  }
  return title;
};

const getActivityIconInitial = (movementType) => {
  if (!movementType) return '?';
  const type = movementType.toLowerCase();
  if (type.includes('sale')) return 'S';
  if (type.includes('receipt') || type.includes('po_')) return 'PO';
  if (type.includes('adjust') || type.includes('count')) return 'A';
  if (type.includes('write_off') || type.includes('damage')) return 'W';
  return movementType.charAt(0).toUpperCase();
};

const getActivityIconBackgroundClass = (movementType) => {
  if (!movementType) return 'bg-gray-200 text-gray-700';
  const type = movementType.toLowerCase();
  if (type.includes('sale') || type.includes('write_off') || type.includes('damage') || type.includes('decrease')) return 'bg-red-100 text-red-700';
  if (type.includes('receipt') || type.includes('po_') || type.includes('increase') || type.includes('initial')) return 'bg-green-100 text-green-700';
  if (type.includes('adjust') || type.includes('count') || type.includes('batch')) return 'bg-blue-100 text-blue-700';
  return 'bg-gray-200 text-gray-700';
};

const getQtyChangedClass = (qty) => {
  if (qty === null || qty === undefined) return 'text-gray-500';
  return qty > 0 ? 'text-green-600 font-medium' : (qty < 0 ? 'text-red-600 font-medium' : 'text-gray-500');
};

async function fetchRecentActivity() {
  isLoadingRecentActivity.value = true;
  recentActivityError.value = null;
  try {
    const response = await $axios.get('/admin/stock-movement-logs', {
      params: { page: 1, limit: 5, sort_by: 'timestamp', sort_order: 'DESC' }
    });
    recentActivity.value = response.data.data;
  } catch (error) {
    recentActivityError.value = error.response?.data?.message || error.message || 'Could not load recent stock activity.';
  } finally {
    isLoadingRecentActivity.value = false;
  }
}

</script>

<!-- <style scoped> block removed -->

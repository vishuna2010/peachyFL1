<template>
  <div class="space-y-6">
    <!-- Stat Cards Section -->
    <div v-if="statsError" class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
      <span class="font-medium">Error fetching statistics:</span> {{ statsError.message || statsError }}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 mb-6">
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
      <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200 min-h-[300px] flex flex-col items-center justify-center text-text-secondary">
        <svg class="w-16 h-16 text-neutral-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
        <p class="font-medium">Recent Activity Placeholder</p>
        <p class="text-xs">(e.g., New Users, Recent Comments)</p>
      </div>
    </div>

    <!-- Recent Orders Table Placeholder -->
    <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200 min-h-[300px] flex flex-col items-center justify-center text-text-secondary">
      <svg class="w-16 h-16 text-neutral-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      <p class="font-medium">Recent Orders Table Placeholder</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useHead, useNuxtApp } from '#app';
import StatCard from '~/components/admin/StatCard.vue';

definePageMeta({
  layout: 'admin',
  title: 'Admin Dashboard'
});

useHead({
  title: 'Admin Dashboard',
});

// Add any specific script setup logic for the dashboard here later,
// e.g., fetching dashboard data.

const { $axios } = useNuxtApp();

const isLoadingStats = ref(true);
const statsError = ref(null);

const statCardsData = ref([
  {
    title: "Total Revenue",
    value: "...",
    iconName: "TR",
    trend: "", // Trends can be added later if specific APIs exist
    trendDirection: "neutral",
    iconBackgroundClass: "bg-green-100 text-green-700"
  },
  {
    title: "Total Users", // Changed from New Customers
    value: "...",
    iconName: "TU", // Changed iconName
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-blue-100 text-blue-700"
  },
  {
    title: "Total Orders", // Changed from Pending Orders
    value: "...",
    iconName: "TO", // Changed iconName
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-yellow-100 text-yellow-700"
  },
  {
    title: "Total Products", // Changed from Products Out of Stock
    value: "...",
    iconName: "TP", // Changed iconName
    trend: "",
    trendDirection: "neutral",
    iconBackgroundClass: "bg-purple-100 text-purple-700" // Changed color
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
      $axios.get('/api/admin/stats/total-revenue'),
      $axios.get('/api/admin/stats/users-count'),
      $axios.get('/api/admin/stats/orders-count'),
      $axios.get('/api/admin/stats/products-count')
    ]);

    // Update Total Revenue
    const revenueCard = statCardsData.value.find(card => card.title === "Total Revenue");
    if (revenueCard && revenueRes.data.total_revenue !== undefined) {
      revenueCard.value = revenueRes.data.total_revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    // Update Total Users
    const usersCard = statCardsData.value.find(card => card.title === "Total Users");
    if (usersCard && usersRes.data.count !== undefined) {
      usersCard.value = usersRes.data.count.toString();
    }

    // Update Total Orders
    const ordersCard = statCardsData.value.find(card => card.title === "Total Orders");
    if (ordersCard && ordersRes.data.count !== undefined) {
      ordersCard.value = ordersRes.data.count.toString();
    }

    // Update Total Products
    const productsCard = statCardsData.value.find(card => card.title === "Total Products");
    if (productsCard && productsRes.data.count !== undefined) {
      productsCard.value = productsRes.data.count.toString();
    }

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    statsError.value = error.response?.data || error;
    // Optionally set card values to 'Error' or keep '...'
    statCardsData.value.forEach(card => card.value = "Error");
  } finally {
    isLoadingStats.value = false;
  }
}

onMounted(() => {
  fetchDashboardStats();
});

</script>

<!-- <style scoped> block removed -->

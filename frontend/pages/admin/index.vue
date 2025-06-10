<template>
  <div class="space-y-6">
    <!-- Stat Cards Section -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 mb-6">
      <StatCard
        title="Total Revenue"
        value="$45,231.89"
        iconName="TR"
        trend="+20.1% from last month"
        trendDirection="up"
        iconBackgroundClass="bg-green-100 text-green-700"
      />
      <StatCard
        title="New Customers"
        value="380"
        iconName="NC"
        trend="+5.4% from last week"
        trendDirection="up"
        iconBackgroundClass="bg-blue-100 text-blue-700"
      />
      <StatCard
        title="Pending Orders"
        value="23"
        iconName="PO"
        trend="-3 since yesterday"
        trendDirection="down"
        iconBackgroundClass="bg-yellow-100 text-yellow-700"
      />
      <StatCard
        title="Products Out of Stock"
        value="7"
        iconName="OS"
        trend="Check inventory"
        trendDirection="neutral"
        iconBackgroundClass="bg-red-100 text-red-700"
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
import { useHead } from '#app';
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
</script>

<style scoped>
/* Add any page-specific styles here if needed, though prefer Tailwind utilities */
</style>

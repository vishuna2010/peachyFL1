<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Reports Dashboard</h1>
    <p class="text-gray-700">This page can serve as a dashboard for various reports.</p>
    <div class="mt-4 space-y-2">
      <p><NuxtLink to="/admin/reports/sales" class="text-indigo-600 hover:underline">View Sales Report</NuxtLink></p>
      <p><NuxtLink to="/admin/reports/low-stock" class="text-indigo-600 hover:underline">View Low Stock Report</NuxtLink></p>
      <p><NuxtLink to="/admin/reports/best-sellers" class="text-indigo-600 hover:underline">View Best Sellers Report</NuxtLink></p>
      <p><NuxtLink to="/admin/reports/stock-valuation" class="text-indigo-600 hover:underline">View Stock Valuation Report</NuxtLink></p>
      <p><NuxtLink to="/admin/reports/audit-logs" class="text-indigo-600 hover:underline">View Audit Logs</NuxtLink></p>
      <!-- Add links to other reports as they are created -->
    </div>
  </div>
</template>

<script setup>
import { definePageMeta, useHead } from '#imports';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Reports Overview',
});
</script>

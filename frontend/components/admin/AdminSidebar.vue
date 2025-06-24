<template>
  <div class="bg-sky-blue-deep text-neutral-100 w-60 min-h-screen flex flex-col shadow-lg fixed lg:static inset-y-0 left-0 z-50 transform lg:transform-none transition-transform duration-300 ease-in-out"
       :class="isOpenOnMobile ? 'translate-x-0' : '-translate-x-full'">

    <!-- Sidebar Header -->
    <div class="p-4 border-b border-sky-blue/50 flex justify-between items-center"> <!-- Adjusted border -->
      <NuxtLink to="/admin" @click="closeMobileSidebarIfNeeded" class="flex items-center space-x-2">
        <img src="/logo.png" alt="Admin Logo" class="h-8 w-auto">
        <h1 class="text-xl font-semibold hover:text-peach-pink transition-colors">Admin Panel</h1>
      </NuxtLink>
      <button @click="emit('toggleMobileSidebar')" class="lg:hidden text-neutral-300 hover:text-white p-1 rounded-md">
        <CloseIcon class="w-6 h-6" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-grow p-3 space-y-1.5 overflow-y-auto">
      <!-- Main Navigation Items -->
      <template v-for="item in navigationItems" :key="item.name">
        <NuxtLink
          v-if="can(item.permission).value"
          :to="item.href"
          @click="closeMobileSidebarIfNeeded"
          class="group flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-neutral-100 hover:bg-peach-pink hover:text-white"
          :class="isActive(item.href) ? 'bg-peach-pink text-white' : 'hover:bg-opacity-75'"
        >
          <span v-if="item.iconSvg" v-html="item.iconSvg" class="mr-3 h-5 w-5 flex-shrink-0 text-neutral-300 group-hover:text-white" :class="{'text-white': isActive(item.href)}"></span>
          <span v-else class="mr-3 h-5 w-5 flex-shrink-0"></span>
          {{ item.name }}
        </NuxtLink>
      </template>

      <!-- Inventory Sub-menu -->
      <div v-if="can('products:view').value">
        <button @click="toggleInventorySubmenu" class="group w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75 transition-colors duration-150">
          <span class="flex items-center">
            <span v-html="iconInventory" class="mr-3 h-5 w-5 flex-shrink-0 text-neutral-300 group-hover:text-white"></span>
            Inventory
          </span>
          <svg class="w-4 h-4 transform transition-transform duration-150 text-neutral-300 group-hover:text-white" :class="{'rotate-90': inventorySubmenuOpen}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
        </button>
        <div v-if="inventorySubmenuOpen" class="mt-1 space-y-1 pl-4 border-l border-sky-blue/50 ml-3"> <!-- Adjusted border -->
          <NuxtLink
            v-for="invItem in inventoryItems"
            :key="invItem.name"
            :to="invItem.href"
            @click="closeMobileSidebarIfNeeded"
            class="group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150"
            :class="isActive(invItem.href) ? 'bg-peach-pink text-white shadow-sm' : 'text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75'"
          >
            <span v-if="invItem.iconSvg" v-html="invItem.iconSvg" class="mr-2 h-4 w-4 flex-shrink-0" :class="isActive(invItem.href) ? 'text-white' : 'text-neutral-300 group-hover:text-white'"></span>
            {{ invItem.name }}
          </NuxtLink>
        </div>
      </div>

      <!-- Tax Management Sub-menu -->
      <div v-if="can('taxes:manage_classes').value || can('taxes:manage_rates').value">
        <button @click="toggleTaxSubmenu" class="group w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75 transition-colors duration-150">
          <span class="flex items-center">
            <span v-html="iconTax" class="mr-3 h-5 w-5 flex-shrink-0 text-neutral-300 group-hover:text-white"></span>
            Tax Management
          </span>
          <svg class="w-4 h-4 transform transition-transform duration-150 text-neutral-300 group-hover:text-white" :class="{'rotate-90': taxSubmenuOpen}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
        </button>
        <div v-if="taxSubmenuOpen" class="mt-1 space-y-1 pl-4 border-l border-sky-blue/50 ml-3"> <!-- Adjusted border -->
          <NuxtLink
            v-for="taxItem in taxItems"
            :key="taxItem.name"
            :to="taxItem.href"
            @click="closeMobileSidebarIfNeeded"
            class="group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150"
            :class="isActive(taxItem.href) ? 'bg-peach-pink text-white shadow-sm' : 'text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75'"
          >
            <span v-if="taxItem.iconSvg" v-html="taxItem.iconSvg" class="mr-2 h-4 w-4 flex-shrink-0" :class="isActive(taxItem.href) ? 'text-white' : 'text-neutral-300 group-hover:text-white'"></span>
            {{ taxItem.name }}
          </NuxtLink>
        </div>
      </div>

      <!-- Reports Sub-menu -->
      <div v-if="can('reports:view').value">
        <button @click="toggleReportsSubmenu" class="group w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75 transition-colors duration-150">
          <span class="flex items-center">
            <span v-html="iconReportsMain" class="mr-3 h-5 w-5 flex-shrink-0 text-neutral-300 group-hover:text-white"></span>
            Reports
          </span>
          <svg class="w-4 h-4 transform transition-transform duration-150 text-neutral-300 group-hover:text-white" :class="{'rotate-90': reportsSubmenuOpen}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
        </button>
        <div v-if="reportsSubmenuOpen" class="mt-1 space-y-1 pl-4 border-l border-sky-blue/50 ml-3"> <!-- Adjusted border -->
          <NuxtLink
            v-for="report in reportItems"
            :key="report.name"
            :to="report.href"
            @click="closeMobileSidebarIfNeeded"
            class="group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150"
            :class="isActive(report.href) ? 'bg-peach-pink text-white shadow-sm' : 'text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75'"
          >
            <span v-if="report.iconSvg" v-html="report.iconSvg" class="mr-2 h-4 w-4 flex-shrink-0" :class="isActive(report.href) ? 'text-white' : 'text-neutral-300 group-hover:text-white'"></span>
            {{ report.name }}
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Footer / View Site Link -->
    <div class="p-4 border-t border-sky-blue/50 mt-auto"> <!-- Adjusted border -->
      <NuxtLink
        to="/"
        class="flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-neutral-100 hover:bg-peach-pink hover:text-white hover:bg-opacity-75 transition-colors duration-150"
        title="View Live Site"
      >
        <svg class="w-5 h-5 mr-2 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        View Site
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'; // Added onMounted
import { useRoute } from 'vue-router';
import CloseIcon from '~/components/icons/CloseIcon.vue';
import { usePermissions } from '~/composables/usePermissions';
import { useAuth } from '~/composables/useAuth';

const props = defineProps({
  isOpenOnMobile: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggleMobileSidebar']);

const route = useRoute();
const { can, fetchUserPermissions, isLoadingPermissions } = usePermissions();
const { isAuthenticated } = useAuth();

// Fetch permissions when component mounts and user is authenticated
onMounted(() => {
  if (isAuthenticated.value) {
    fetchUserPermissions();
  }
});
// Watch for authentication changes to refetch permissions
watch(isAuthenticated, (newAuthStatus) => {
  if (newAuthStatus) {
    fetchUserPermissions();
  } else {
    // Permissions are usually cleared by usePermissions composable itself via its own watcher or logout hook
  }
}, { immediate: false }); // 'false' to avoid immediate call if already handled by onMounted or initial state

const iconDashboard = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>`;
const iconUsers = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>`;
const iconProducts = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.001c0 .621.504 1.125 1.125 1.125z" /></svg>`;
const iconCategories = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>`;
const iconOrders = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>`;
const iconDiscounts = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" /></svg>`;
const iconSuppliers = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v.958m12.013 0v11.177m-12.013 0v-11.177" /></svg>`;
const iconPurchaseOrders = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`;
const iconReportsMain = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>`;
const iconReportSubItem = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
const iconInventory = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 012.25 10.875v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" /></svg>`;
const iconTax = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.25 7.25A.75.75 0 018 6.5h8.5a.75.75 0 01.75.75v8.5a.75.75 0 01-.75.75H8a.75.75 0 01-.75-.75v-8.5z" /><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zm0 4.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zm4.5-4.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01zm0 4.5a.75.75 0 01.75-.75h.01a.75.75 0 01.75.75v.01a.75.75 0 01-.75.75h-.01a.75.75 0 01-.75-.75v-.01z" /><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 9.75l-6.75 6.75" /></svg>`

const navigationItems = ref([
  { name: 'Dashboard', href: '/admin', iconSvg: iconDashboard, permission: 'admin:access_dashboard' },
  { name: 'Users', href: '/admin/users', iconSvg: iconUsers, permission: 'users:view' },
  { name: 'Products', href: '/admin/products', iconSvg: null, permission: 'products:view' },
  { name: 'Categories', href: '/admin/categories', iconSvg: null, permission: 'categories:manage' },
  { name: 'Orders', href: '/admin/orders', iconSvg: iconOrders, permission: 'orders:view_all' },
  { name: 'Discounts', href: '/admin/discounts', iconSvg: iconDiscounts, permission: 'discounts:manage' },
  { name: 'Suppliers', href: '/admin/suppliers', iconSvg: iconSuppliers, permission: 'suppliers:manage' },
  { name: 'Purchase Orders', href: '/admin/purchase-orders', iconSvg: iconPurchaseOrders, permission: 'purchase_orders:manage' },
  { name: 'Product Options', href: '/admin/options', iconSvg: null, permission: 'products:edit' }, // Assuming managing global options is part of product editing
  { name: 'Reviews', href: '/admin/reviews', iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.82.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.82-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>`, permission: 'reviews:manage' }, // Assuming a 'reviews:manage' permission
  { name: 'Roles & Permissions', href: '/admin/roles', iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>`, permission: 'rbac:manage' },
]);

const reportsSubmenuOpen = ref(false);
const reportItems = ref([
    { name: 'Overview', href: '/admin/reports', iconSvg: iconReportSubItem }, // Added Overview
    { name: 'Low Stock', href: '/admin/reports/low-stock', iconSvg: iconReportSubItem },
    { name: 'Sales', href: '/admin/reports/sales', iconSvg: iconReportSubItem },
    { name: 'Best Sellers', href: '/admin/reports/best-sellers', iconSvg: iconReportSubItem },
    { name: 'Stock Valuation', href: '/admin/reports/stock-valuation', iconSvg: iconReportSubItem },
    { name: 'Audit Logs', href: '/admin/reports/audit-logs', iconSvg: iconReportSubItem },
]);

const inventorySubmenuOpen = ref(false);
const inventoryItems = ref([
  { name: 'Stock Levels', href: '/admin/inventory', iconSvg: iconReportSubItem },
  { name: 'Batch Management', href: '/admin/inventory/batches', iconSvg: iconReportSubItem },
  { name: 'Stock Adjustments', href: '/admin/inventory/adjustments', iconSvg: iconReportSubItem },
  { name: 'Movement Logs', href: '/admin/inventory/logs', iconSvg: iconReportSubItem }
]);

const taxSubmenuOpen = ref(false);
const taxItems = ref([
  { name: 'Tax Overview', href: '/admin/taxes', iconSvg: iconReportSubItem },
  { name: 'Tax Classes', href: '/admin/taxes/classes', iconSvg: iconReportSubItem },
  { name: 'Tax Rates', href: '/admin/taxes/rates', iconSvg: iconReportSubItem },
]);

const toggleReportsSubmenu = () => {
  reportsSubmenuOpen.value = !reportsSubmenuOpen.value;
};

const toggleInventorySubmenu = () => {
  inventorySubmenuOpen.value = !inventorySubmenuOpen.value;
};

const toggleTaxSubmenu = () => {
  taxSubmenuOpen.value = !taxSubmenuOpen.value;
};

const isActive = (path) => {
  if (path === '/admin' && route.path === '/admin') return true; // Exact match for dashboard
  // For other parent routes, ensure it's not just matching /admin itself unless it's the dashboard link
  if (path !== '/admin' && route.path.startsWith(path)) return true;
  return false;
};

const closeMobileSidebarIfNeeded = () => {
    if (props.isOpenOnMobile) {
        emit('toggleMobileSidebar');
    }
}
</script>

<style scoped>
/* Allow scrollbar styling if needed, but Tailwind's overflow-y-auto should be fine */
nav::-webkit-scrollbar {
  width: 6px;
}
nav::-webkit-scrollbar-thumb {
  background-color: #4a5568; /* neutral-600 */
  border-radius: 3px;
}
nav::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>

[end of frontend/components/admin/AdminSidebar.vue]

<template>
  <div class="bg-neutral-800 text-neutral-100 w-60 min-h-screen flex flex-col shadow-lg fixed lg:static inset-y-0 left-0 z-50 transform lg:transform-none transition-transform duration-300 ease-in-out"
       :class="isOpenOnMobile ? 'translate-x-0' : '-translate-x-full'">

    <!-- Sidebar Header -->
    <div class="p-4 border-b border-neutral-700 flex justify-between items-center">
      <NuxtLink to="/admin" @click="closeMobileSidebarIfNeeded"> {/* Changed to /admin */}
        <h1 class="text-xl font-semibold hover:text-brand-primary transition-colors">Admin Panel</h1>
      </NuxtLink>
      <button @click="emit('toggleMobileSidebar')" class="lg:hidden text-neutral-300 hover:text-white p-1 rounded-md">
        <CloseIcon class="w-6 h-6" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-grow p-3 space-y-1.5 overflow-y-auto">
      <NuxtLink
        v-for="item in navigationItems"
        :key="item.name"
        :to="item.href"
        @click="closeMobileSidebarIfNeeded"
        class="flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150"
        :class="isActive(item.href) ? 'bg-brand-primary text-white shadow-sm' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'"
      >
        <!-- Placeholder for item.icon - can add SVGs later -->
        <!-- <component :is="item.icon" class="mr-3 h-5 w-5" aria-hidden="true" /> -->
        {{ item.name }}
      </NuxtLink>

      <!-- Reports Sub-menu Example (Conceptual) -->
      <div>
        <button @click="toggleReportsSubmenu" class="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors duration-150">
          <span>Reports</span>
          <svg class="w-4 h-4 transform transition-transform duration-150" :class="{'rotate-90': reportsSubmenuOpen}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>
        </button>
        <div v-if="reportsSubmenuOpen" class="mt-1 space-y-1 pl-4 border-l border-neutral-700 ml-2">
          <NuxtLink
            v-for="report in reportItems"
            :key="report.name"
            :to="report.href"
            @click="closeMobileSidebarIfNeeded"
            class="block px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150"
            :class="isActive(report.href) ? 'bg-brand-primary text-white shadow-sm' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'"
          >
            {{ report.name }}
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Footer / View Site Link -->
    <div class="p-4 border-t border-neutral-700 mt-auto">
      <NuxtLink
        to="/"
        class="flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors duration-150"
        title="View Live Site"
      >
        <!-- Placeholder for external link icon -->
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        View Site
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import CloseIcon from '~/components/icons/CloseIcon.vue';

const props = defineProps({
  isOpenOnMobile: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggleMobileSidebar']);

const route = useRoute();

const navigationItems = ref([
  { name: 'Dashboard', href: '/admin', /* icon: CalendarIcon (example) */ },
  { name: 'Users', href: '/admin/users', /* icon: UsersIcon */ },
  { name: 'Products', href: '/admin/products', /* icon: ShoppingBagIcon */ },
  { name: 'Categories', href: '/admin/categories', /* icon: FolderIcon */ },
  { name: 'Orders', href: '/admin/orders', /* icon: ShoppingCartIcon */ },
  { name: 'Discounts', href: '/admin/discounts', /* icon: TagIcon */ },
  { name: 'Suppliers', href: '/admin/suppliers', /* icon: TruckIcon */ },
  { name: 'Purchase Orders', href: '/admin/purchase-orders', /* icon: DocumentTextIcon */ },
]);

const reportsSubmenuOpen = ref(false);
const reportItems = ref([
    { name: 'Low Stock', href: '/admin/reports/low-stock' },
    { name: 'Sales', href: '/admin/reports/sales' },
    { name: 'Best Sellers', href: '/admin/reports/best-sellers' },
]);

const toggleReportsSubmenu = () => {
  reportsSubmenuOpen.value = !reportsSubmenuOpen.value;
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

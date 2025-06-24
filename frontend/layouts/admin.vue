<template>
  <div class="flex flex-row h-screen bg-neutral-100 text-text-primary">
    <!-- Admin Sidebar -->
    <AdminSidebar :is-open-on-mobile="isMobileSidebarOpen" @toggle-mobile-sidebar="toggleMobileSidebar" />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0"> <!-- Added min-w-0 -->
      <!-- Top Bar -->
      <header class="bg-white shadow-sm py-3 px-4 sm:px-6 border-b border-neutral-200">
        <div class="flex items-center justify-between">
          <!-- Mobile Hamburger to open sidebar -->
          <button
            @click="toggleMobileSidebar"
            class="lg:hidden text-text-secondary hover:text-brand-primary p-1 -ml-1 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary"
            aria-label="Open sidebar"
          >
            <MenuIcon class="w-6 h-6" />
          </button>

          <!-- Page Title (can be dynamic using $route.meta.title) -->
          <div class="flex-1 min-w-0">
             <h2 class="text-lg font-semibold text-gray-700 truncate pl-2 lg:pl-0">
               {{ $route.meta.title || ($route.name === 'admin' || $route.name === 'admin-dashboard' ? 'Admin Dashboard' : 'Admin Page') }}
             </h2>
          </div>

          <!-- Global Search Bar -->
          <div class="flex-shrink-0 px-4 sm:px-0 mx-auto">
            <form @submit.prevent="handleSearchSubmit" class="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
              <div class="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                </svg>
              </div>
              <input
                v-model="searchQuery"
                id="global-search"
                name="global-search"
                class="block w-full bg-white border border-gray-300 rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:text-gray-900 focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Search..."
                type="search"
              >
            </form>
          </div>

          <!-- User Info & Logout -->
          <div class="flex items-center space-x-3 ml-auto flex-shrink-0">
            <span class="text-sm text-text-secondary hidden sm:inline" v-if="user">
              {{ user.email }}
            </span>
            <button
              @click="handleLogout"
              title="Logout"
              class="text-text-secondary hover:text-brand-primary p-2 rounded-full hover:bg-neutral-light transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary"
            >
              <LogoutIcon class="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <Breadcrumbs />

      <!-- Page Content Slot -->
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-neutral-100 p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter } from '#app'; // Or 'vue-router'
import AdminSidebar from '~/components/admin/AdminSidebar.vue';
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';
import LogoutIcon from '~/components/icons/LogoutIcon.vue';
import MenuIcon from '~/components/icons/MenuIcon.vue';

const { authToken, authUser, logout } = useAuth();
const router = useRouter();

const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);

const isMobileSidebarOpen = ref(false);
const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value;
};

const handleLogout = () => {
  logout();
};

// Search
const searchQuery = ref('');
const handleSearchSubmit = () => {
  if (searchQuery.value.trim()) {
    router.push({ path: '/admin/search', query: { q: searchQuery.value.trim() } });
    // searchQuery.value = ''; // Optionally clear search after submit
  }
};
</script>
<!-- <style scoped> block removed -->

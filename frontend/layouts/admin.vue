<template>
  <!-- Changed text-text-primary to text-venus-text-primary -->
  <div class="flex flex-row h-screen bg-white text-venus-text-primary">
    <!-- Admin Sidebar -->
    <AdminSidebar :is-open-on-mobile="isMobileSidebarOpen" @toggle-mobile-sidebar="toggleMobileSidebar" />

    <!-- Main Content Area -->
    <!-- Removed lg:w-[calc(100%-theme('spacing.60'))] -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">
      <!-- Top Bar -->
      <header class="bg-white shadow-sm py-3 px-4 sm:px-6 border-b border-neutral-200">
        <div class="flex items-center justify-between">
          <!-- Mobile Hamburger to open sidebar -->
          <button
            @click="toggleMobileSidebar"
            class="lg:hidden text-venus-text-secondary hover:text-peach-pink p-1 -ml-1 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-peach-pink"
            aria-label="Open sidebar"
          >
            <MenuIcon class="w-6 h-6" />
          </button>

          <!-- Page Title (can be dynamic using route.meta.title) -->
          <div class="flex-1 min-w-0">
             <h2 class="text-lg font-semibold text-gray-700 truncate pl-2 lg:pl-0">
               {{ pageTitle }}
             </h2>
          </div>

          <!-- Global Search Bar -->
          <div class="flex-grow-0 flex-shrink-0 px-4 sm:px-0 mx-auto">
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
                class="block w-full bg-white border border-gray-300 rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:text-gray-900 focus:placeholder-gray-400 focus:ring-1 focus:ring-peach-pink focus:border-peach-pink sm:text-sm"
                placeholder="Search..."
                type="search"
              >
            </form>
          </div>

          <!-- User Info & Logout -->
          <div class="flex items-center space-x-3 ml-auto flex-grow-0 flex-shrink-0">
            <!-- Notification Icon & Dropdown Placeholder -->
            <div class="relative">
              <button @click="toggleNotificationsDropdown" class="text-venus-text-secondary hover:text-peach-pink p-2 rounded-full hover:bg-neutral-bg-soft transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              </button>
              <div v-if="notificationsDropdownOpen" class="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Notification 1</a>
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Notification 2</a>
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-center" role="menuitem">View all (placeholder)</a>
                </div>
              </div>
            </div>

            <span class="text-sm text-venus-text-secondary hidden sm:inline" v-if="user">
              {{ user.email }}
            </span>
            <!-- Edit Profile Link -->
            <NuxtLink
              to="/profile"
              title="Edit Profile"
              class="text-venus-text-secondary hover:text-peach-pink p-2 rounded-full hover:bg-neutral-bg-soft transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink"
            >
              <span class="text-sm font-medium">Edit Profile</span>
            </NuxtLink>
            <button
              @click="handleLogout"
              title="Logout"
              class="text-venus-text-secondary hover:text-peach-pink p-2 rounded-full hover:bg-neutral-bg-soft transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink"
            >
              <LogoutIcon class="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <Breadcrumbs />

      <!-- Page Content Slot -->
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-white p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter, useRoute } from '#app';
import AdminSidebar from '~/components/admin/AdminSidebar.vue';
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';
import LogoutIcon from '~/components/icons/LogoutIcon.vue';
import MenuIcon from '~/components/icons/MenuIcon.vue';

const { authToken, authUser, logout } = useAuth();
const router = useRouter();
const route = useRoute();

const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);

const pageTitle = computed(() => {
  const currentRoute = route.value;
  return currentRoute?.meta?.title || (currentRoute?.name === 'admin' || currentRoute?.name === 'admin-dashboard' ? 'Admin Dashboard' : 'Admin Page');
});

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

// Notifications Dropdown
const notificationsDropdownOpen = ref(false);
const toggleNotificationsDropdown = () => {
  notificationsDropdownOpen.value = !notificationsDropdownOpen.value;
};

// Close dropdown when clicking outside
const closeDropdowns = (event) => {
  if (notificationsDropdownOpen.value) {
    const notificationButton = event.target.closest('button');
    const notificationDropdown = event.target.closest('.origin-top-right');
    // Check if the click is outside the button AND outside the dropdown content
    let isBellButton = false;
    if (notificationButton) {
        const svgElement = notificationButton.querySelector('svg');
        if (svgElement) {
            const pathElement = svgElement.querySelector('path');
            if (pathElement && pathElement.getAttribute('d').includes("M15 17h5l-1.405-1.405")) { // Check if it's the bell icon
                isBellButton = true;
            }
        }
    }
    if (!isBellButton && !notificationDropdown) {
      notificationsDropdownOpen.value = false;
    }
  }
};

onMounted(() => {
  document.addEventListener('click', closeDropdowns);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns);
});

</script>
<!-- <style scoped> block removed -->

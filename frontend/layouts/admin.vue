<template>
  <div class="flex h-screen bg-neutral-100 text-text-primary">
    <!-- Admin Sidebar -->
    <AdminSidebar :is-open-on-mobile="isMobileSidebarOpen" @toggle-mobile-sidebar="toggleMobileSidebar" />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
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

      <!-- Page Content Slot -->
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-neutral-100 p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'; // Added ref
import { useAuth } from '~/composables/useAuth';
// useRouter is not strictly needed here if handleLogout only calls useAuth().logout() which handles redirect
// import { useRouter } from 'vue-router';
import AdminSidebar from '~/components/admin/AdminSidebar.vue';
import LogoutIcon from '~/components/icons/LogoutIcon.vue';
import MenuIcon from '~/components/icons/MenuIcon.vue';

const { authToken, authUser, logout } = useAuth();
// const router = useRouter(); // Only needed if handleLogout performs router.push directly

const isAuthenticated = computed(() => !!authToken.value); // Kept for potential direct use, though sidebar handles its own logic
const user = computed(() => authUser.value);

const isMobileSidebarOpen = ref(false);
const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value;
};

const handleLogout = () => {
  logout();
  // logout() in useAuth should handle redirecting to /login
};
</script>
<!-- <style scoped> block removed -->

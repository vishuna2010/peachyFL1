<template>
  <div class="flex flex-col min-h-screen bg-neutral-light text-text-primary">
    <header class="bg-white shadow-md">
      <nav class="container mx-auto px-4 py-3 flex justify-between items-center">
        <NuxtLink to="/" class="text-2xl font-bold text-brand-primary">MySite</NuxtLink>
        <ul class="flex items-center space-x-4">
          <li><NuxtLink to="/" class="hover:text-brand-primary">Home</NuxtLink></li>
          <template v-if="!isAuthenticated">
            <li><NuxtLink to="/login" class="hover:text-brand-primary">Login</NuxtLink></li>
            <li><NuxtLink to="/register" class="hover:text-brand-primary">Register</NuxtLink></li>
          </template>
          <template v-else>
            <li><NuxtLink to="/profile" class="hover:text-brand-primary">Profile</NuxtLink></li>
            <li v-if="isAdminUser"><NuxtLink to="/admin/users" class="hover:text-brand-primary">Manage Users</NuxtLink></li>
            <li>
              <button @click="handleLogout" class="hover:text-brand-primary">Logout</button>
            </li>
          </template>
          <li>
            <NuxtLink to="/cart" class="flex items-center hover:text-brand-primary">
              <svg class="w-6 h-6 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              Cart <span v-if="cartTotalItems > 0" class="ml-1 text-xs font-semibold text-white bg-brand-accent rounded-full px-1.5 py-0.5">({{ cartTotalItems }})</span>
            </NuxtLink>
          </li>
          <li v-if="user" class="text-sm text-text-secondary hidden md:block">
            Hello, {{ user.email }} ({{ user.role }})
          </li>
        </ul>
      </nav>
    </header>
    <main class="flex-grow container mx-auto px-4 py-8">
      <slot />
    </main>
    <footer class="bg-neutral-medium text-center py-4 text-text-secondary text-sm">
      <p>&copy; {{ new Date().getFullYear() }} My E-commerce Site. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useCart } from '~/composables/useCart'; // Import useCart

// Auth composable
const { authToken, authUser, logout } = useAuth();
const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);
const isAdminUser = computed(() => authUser.value?.role === 'admin');

const handleLogout = () => {
  logout();
};

// Cart composable
const { cartTotalItems } = useCart();

</script>

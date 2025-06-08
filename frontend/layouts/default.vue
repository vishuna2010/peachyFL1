<template>
  <div class="flex flex-col min-h-screen bg-neutral-light text-text-primary">
    <header class="bg-white shadow-md">
      <nav class="container mx-auto px-4 sm:px-6 lg:px-8 py-0 flex items-center justify-between h-16">
        <!-- Logo (Left Side) -->
        <NuxtLink to="/" class="text-2xl font-bold text-brand-primary hover:text-opacity-80 transition-colors duration-150 flex-shrink-0">MySite</NuxtLink>

        <!-- Centered Navigation Links -->
        <div class="hidden md:flex items-center space-x-6 flex-grow justify-center">
          <NuxtLink to="/" class="text-text-primary hover:text-brand-primary transition-colors duration-150">Home</NuxtLink>
          <NuxtLink to="/products" class="text-text-primary hover:text-brand-primary transition-colors duration-150">Shop All</NuxtLink>
          <!-- Add other static links here if desired, e.g., About, Contact -->
        </div>

        <!-- Right-side Utility Navigation -->
        <ul class="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <!-- Admin Link -->
          <li v-if="isAdminUser"><NuxtLink to="/admin/users" class="text-sm font-medium text-text-secondary hover:text-brand-primary hidden sm:block px-3 py-2 rounded-md hover:bg-neutral-light transition-colors duration-150">Admin</NuxtLink></li>

          <!-- User / Auth Links -->
          <template v-if="!isAuthenticated">
            <li>
              <NuxtLink to="/login" title="Login / Register" class="text-text-secondary hover:text-brand-primary p-2 rounded-full hover:bg-neutral-light transition-colors duration-150">
                <UserIcon class="w-6 h-6" />
              </NuxtLink>
            </li>
          </template>
          <template v-else>
            <li>
              <NuxtLink to="/profile" title="My Profile" class="text-text-secondary hover:text-brand-primary p-2 rounded-full hover:bg-neutral-light transition-colors duration-150">
                <UserIcon class="w-6 h-6" />
              </NuxtLink>
            </li>
            <li>
              <button @click="handleLogout" title="Logout" class="text-text-secondary hover:text-brand-primary p-2 rounded-full hover:bg-neutral-light transition-colors duration-150">
                <LogoutIcon class="w-6 h-6" />
              </button>
            </li>
          </template>

          <!-- Cart Link -->
          <li class="relative"> <!-- Added relative for badge positioning -->
            <NuxtLink to="/cart" title="Shopping Cart" class="text-text-secondary hover:text-brand-primary p-2 rounded-full hover:bg-neutral-light transition-colors duration-150 block">
              <CartIcon class="w-6 h-6" />
              <span v-if="cartTotalItems > 0"
                    class="absolute -top-1 -right-1 bg-brand-accent text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                {{ cartTotalItems }}
              </span>
            </NuxtLink>
          </li>

          <!-- User Greeting -->
          <li v-if="user" class="text-sm text-text-secondary hidden lg:block ml-2"> <!-- Added ml-2 for slight spacing from icons -->
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
import { useCart } from '~/composables/useCart';
import UserIcon from '~/components/icons/UserIcon.vue';
import LogoutIcon from '~/components/icons/LogoutIcon.vue';
import CartIcon from '~/components/icons/CartIcon.vue';

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

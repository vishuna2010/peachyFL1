<template>
  <div class="flex flex-col min-h-screen bg-neutral-light text-text-primary">
    <header class="bg-white shadow-md sticky top-0 z-50"> <!-- Added sticky top-0 z-50 -->
      <nav class="container mx-auto px-4 sm:px-6 lg:px-8 py-0 flex items-center justify-between h-16">
        <!-- Logo (Left Side) -->
        <NuxtLink to="/" class="text-2xl font-bold text-brand-primary hover:text-opacity-80 transition-colors duration-150 flex-shrink-0">MySite</NuxtLink>

        <!-- Centered Navigation Links -->
        <div class="hidden md:flex items-center space-x-6 flex-grow justify-center">
          <NuxtLink to="/" class="text-text-primary hover:text-brand-primary transition-colors duration-150">Home</NuxtLink>
          <NuxtLink to="/" class="text-text-primary hover:text-brand-primary transition-colors duration-150">Shop All</NuxtLink>
          <!-- Add other static links here if desired, e.g., About, Contact -->
        </div>

        <!-- Right Side Group (Hamburger and Utility Icons) -->
        <div class="flex items-center">
          <!-- Hamburger Menu Button - visible on mobile, hidden on md and up -->
          <button
              @click="toggleMobileMenu"
              class="md:hidden text-text-secondary hover:text-brand-primary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary"
              aria-label="Open main menu"
              :aria-expanded="isMobileMenuOpen.toString()"
          >
              <MenuIcon class="w-6 h-6" />
          </button>

          <!-- Utility Navigation - hidden on mobile, visible on md and up -->
          <ul class="hidden md:flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
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
            <li class="relative">
              <NuxtLink to="/cart" title="Shopping Cart" class="text-text-secondary hover:text-brand-primary p-2 rounded-full hover:bg-neutral-light transition-colors duration-150 block">
                <CartIcon class="w-6 h-6" />
                <span v-if="cartTotalItems > 0"
                      class="absolute -top-1 -right-1 bg-brand-accent text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                  {{ cartTotalItems }}
                </span>
              </NuxtLink>
            </li>

            <!-- User Greeting -->
            <li v-if="user" class="text-sm text-text-secondary hidden lg:block ml-2">
              Hello, {{ user.email }} ({{ user.role }})
            </li>
          </ul>
        </div>
      </nav>
    </header>

    <!-- Mobile Menu Panel -->
    <div v-if="isMobileMenuOpen" class="md:hidden fixed inset-x-0 top-16 bg-white shadow-lg z-40 border-t border-neutral-medium">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
        <NuxtLink to="/" @click="toggleMobileMenu" class="block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">Home</NuxtLink>
        <NuxtLink to="/" @click="toggleMobileMenu" class="block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">Shop All</NuxtLink>

        <!-- Divider (optional) -->
        <hr class="my-2 border-neutral-medium" />

        <template v-if="!isAuthenticated">
          <NuxtLink to="/login" @click="toggleMobileMenu" class="block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">Login</NuxtLink>
          <NuxtLink to="/register" @click="toggleMobileMenu" class="block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">Register</NuxtLink>
        </template>
        <template v-else>
          <NuxtLink to="/profile" @click="toggleMobileMenu" class="block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">My Profile</NuxtLink>
          <NuxtLink v-if="isAdminUser" to="/admin/users" @click="toggleMobileMenu" class="block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">Admin</NuxtLink>
          <button @click="handleLogout" class="w-full text-left block rounded-md px-3 py-2 text-base font-medium text-text-primary hover:bg-neutral-light hover:text-brand-primary">
            Logout
          </button>
        </template>
      </div>
    </div>

    <main class="flex-grow container mx-auto px-4 py-8">
      <slot />
    </main>
    <footer class="bg-neutral-medium text-center py-4 text-text-secondary text-sm">
      <p>&copy; {{ new Date().getFullYear() }} My E-commerce Site. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useCart } from '~/composables/useCart';
import UserIcon from '~/components/icons/UserIcon.vue';
import LogoutIcon from '~/components/icons/LogoutIcon.vue';
import CartIcon from '~/components/icons/CartIcon.vue';
import MenuIcon from '~/components/icons/MenuIcon.vue';

// Mobile menu state
const isMobileMenuOpen = ref(false);
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

// Auth composable
const { authToken, authUser, logout } = useAuth();
const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);
const isAdminUser = computed(() => authUser.value?.role === 'admin');

const handleLogout = () => {
  logout();
  isMobileMenuOpen.value = false; // Close mobile menu on logout
};

// Cart composable
const { cartTotalItems } = useCart();

</script>

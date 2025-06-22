<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-theme(spacing.16))]">
    <h2 class="text-3xl font-serif text-venus-text-primary mb-8 text-center">Your Shopping Cart</h2>
    <!-- Debug: isCartInitialized in template = {{ isCartInitialized }} -->
    <div v-if="!isCartInitialized" class="text-center py-8 px-4 bg-venus-neutral-light rounded-sm">
      Initializing cart... (isCartInitialized from template: {{ isCartInitialized }})
    </div>
    <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 bg-venus-neutral-light rounded-sm">
      <p class="text-xl text-venus-text-secondary mb-4">Your cart is empty.</p>
      <NuxtLink to="/" class="bg-venus-text-primary text-white font-semibold py-3 px-6 rounded-sm hover:bg-opacity-80 transition-colors duration-200 ease-in-out">Continue Shopping</NuxtLink>
    </div>
    <div v-else class="md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
      <div class="md:col-span-2">
        <p>Cart has items! Count: {{ cartItems.length }}</p>
        <!-- Minimal item display for now -->
        <ul>
          <li v-for="item in cartItems" :key="item.cartItemId">
            {{ item.name }} - Qty: {{ item.quantity }}
          </li>
        </ul>
      </div>
      <div class="md:col-span-1">
        <p>Cart Summary (placeholder)</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watchEffect } from 'vue'; // watchEffect for logging
import { useCart } from '~/composables/useCart';
import { useHead } from '#app'; // For useHead

console.log('--- CART.VUE SCRIPT SETUP EXECUTED (Restored Phase 1) ---');

const {
  isCartInitialized, // This is a computed ref from useCart, so .value is needed in script
  cartItems,
  initCart
} = useCart();

console.log('[cart.vue setup Phase 1] Initial isCartInitialized (from composable):', isCartInitialized.value);
console.log('[cart.vue setup Phase 1] Initial cartItems.length (from composable):', cartItems.value.length);

watchEffect(() => {
  console.log('[cart.vue watchEffect Phase 1] isCartInitialized.value changed to:', isCartInitialized.value);
  console.log('[cart.vue watchEffect Phase 1] cartItems.length changed to:', cartItems.value.length);
});

onMounted(() => {
  console.log('[cart.vue onMounted Phase 1] Component mounted. Current isCartInitialized.value:', isCartInitialized.value);
  // initCart is already called in app.vue. Calling it here again is safe due to internal guard.
  // This ensures that if navigation to /cart happens and app.vue's onMounted hasn't fully resolved reactivity
  // for this page, we give it another chance.
  initCart();
});

useHead({
  title: 'Shopping Cart',
});
</script>

<style scoped>
/* Minimal styles for testing if needed */
</style>

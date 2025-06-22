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
      <ul class="md:col-span-2 list-none p-0 m-0">
        <li v-for="item in cartItems" :key="item.cartItemId" class="flex items-start gap-4 p-4 border border-venus-neutral-medium rounded-sm bg-venus-background mb-4 shadow-sm relative">
          <img
            v-if="item.image_url"
            :src="item.image_url"
            :alt="item.name"
            class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-sm bg-venus-neutral-light flex-shrink-0"
          />
          <div v-else class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-sm bg-venus-neutral-light flex-shrink-0 flex items-center justify-center text-venus-text-secondary text-sm">No Image</div>

          <div class="flex-grow flex flex-col">
            <h3 class="text-lg font-semibold text-venus-text-primary mb-1">{{ item.name }}</h3>
            <p v-if="item.selectedVariantDescription" class="text-sm text-venus-text-secondary mb-1">{{ item.selectedVariantDescription }}</p>
            <p v-if="item.sku" class="text-xs text-venus-text-secondary mb-1">SKU: {{ item.sku }}</p>
            <p class="text-sm text-venus-text-secondary">Price: ${{ item.price.toFixed(2) }}</p>
            <div class="item-quantity my-2">
              <label :for="`quantity-${item.cartItemId}`" class="text-sm mr-2">Quantity:</label>
              <input
                type="number"
                :id="`quantity-${item.cartItemId}`"
                :value="item.quantity"
                @input="updateItemQuantity(item.cartItemId, parseInt($event.target.value))"
                min="1"
                class="quantity-input w-16 px-2 py-1 border border-venus-neutral-medium rounded-sm text-sm text-center focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold"
              />
            </div>
            <p class="font-medium text-venus-text-primary mt-auto pt-1">Item Total: ${{ (item.price * item.quantity).toFixed(2) }}</p>
          </div>
          <button @click="removeItem(item.cartItemId)" class="remove-item-button absolute top-2 right-2 text-red-600 hover:text-red-800 transition-colors duration-200 ease-in-out p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </li>
      </ul>
      <div class="cart-summary md:col-span-1 mt-6 md:mt-0 p-6 bg-venus-neutral-light rounded-sm shadow border-venus-neutral-medium h-fit sticky top-20">
        <h3 class="text-xl font-serif text-venus-text-primary mb-4">Cart Summary</h3>
        <p class="flex justify-between text-venus-text-secondary"><span>Total Items:</span> <span>{{ cartTotalItems }}</span></p>
        <p class="flex justify-between text-venus-text-secondary mb-2"><span>Subtotal:</span> <span>${{ cartSubtotal.toFixed(2) }}</span></p>

        <!-- Discount section will be added back later -->
        <div class="my-4 py-4 border-t border-b border-venus-neutral-medium text-center text-venus-text-secondary">
            (Discount section placeholder)
        </div>

        <p class="flex justify-between text-xl font-bold text-venus-text-primary my-3">
          <span>Final Total:</span>
          <span>${{ cartFinalTotalPrice.toFixed(2) }}</span>
        </p>
        <div class="cart-actions mt-6 space-y-3">
          <NuxtLink
            :to="cartItems.length > 0 ? '/checkout' : '#'"
            :class="['block w-full text-center px-4 py-3 bg-venus-text-primary text-white font-semibold rounded-sm shadow hover:bg-opacity-80 transition-colors duration-200 ease-in-out', { 'opacity-60 cursor-not-allowed': cartItems.length === 0 }]"
            @click="checkCartEmptyBeforeCheckout"
          >
            Proceed to Checkout
          </NuxtLink>
          <button
            @click="confirmClearCart"
            class="w-full px-4 py-2 bg-venus-neutral-medium text-venus-text-secondary text-sm font-medium rounded-sm shadow-sm hover:bg-venus-neutral-dark hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-venus-neutral-dark transition-colors duration-200 ease-in-out"
          >
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watchEffect } from 'vue';
import { useCart } from '~/composables/useCart';
import { useHead } from '#app';
import CloseIcon from '~/components/icons/CloseIcon.vue'; // Assuming this was used in original, if not remove

console.log('--- CART.VUE SCRIPT SETUP EXECUTED (Restored Phase 2) ---');

const {
  initCart,
  cartItems,
  isCartInitialized,
  updateQuantity,
  removeFromCart,
  clearCart,
  cartTotalItems,
  cartSubtotal,
  cartFinalTotalPrice,
  // Not adding discount related things back yet:
  // applyDiscountCode,
  // clearAppliedDiscount,
  // appliedDiscount,
  // discountValidationError
} = useCart();

console.log('[cart.vue setup Phase 2] Initial isCartInitialized.value:', isCartInitialized.value);

watchEffect(() => {
  console.log('[cart.vue watchEffect Phase 2] isCartInitialized.value changed to:', isCartInitialized.value);
});

onMounted(() => {
  console.log('[cart.vue onMounted Phase 2] Component mounted. Current isCartInitialized.value:', isCartInitialized.value);
  initCart();
});

const updateItemQuantity = (cartItemId, quantity) => {
  if (isNaN(quantity) || quantity < 0) return; // Prevent negative or NaN quantities, allow 0 for removal by updateQuantity
  updateQuantity(cartItemId, quantity);
};

const removeItem = (cartItemId) => {
  if (confirm('Are you sure you want to remove this item from your cart?')) {
    removeFromCart(cartItemId);
  }
};

const confirmClearCart = () => {
  if (confirm('Are you sure you want to clear your entire cart?')) {
    clearCart();
  }
};

const checkCartEmptyBeforeCheckout = (event) => {
  if (cartItems.value.length === 0) {
    event.preventDefault();
    alert("Your cart is empty. Please add items before proceeding to checkout.");
  }
};

useHead({
  title: 'Shopping Cart',
});
</script>

<style scoped>
/* Styles from original cart.vue if any, or keep minimal */
</style>

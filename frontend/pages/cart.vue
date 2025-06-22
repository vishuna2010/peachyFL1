<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-theme(spacing.16))]">
    <h2 class="text-3xl font-serif text-venus-text-primary mb-8 text-center">Your Shopping Cart</h2>
    <div v-if="!isCartInitialized.value" class="text-center py-8 px-4 bg-venus-neutral-light rounded-sm">Initializing cart...</div>
    <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 bg-venus-neutral-light rounded-sm">
      <p class="text-xl text-venus-text-secondary mb-4">Your cart is empty.</p>
      <NuxtLink to="/" class="bg-venus-text-primary text-white font-semibold py-3 px-6 rounded-sm hover:bg-opacity-80 transition-colors duration-200 ease-in-out">Continue Shopping</NuxtLink>
    </div>
    <div v-else class="md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
      <ul class="md:col-span-2 list-none p-0 m-0">
        <li v-for="item in cartItems" :key="item.productId" class="flex items-start gap-4 p-4 border border-venus-neutral-medium rounded-sm bg-venus-background mb-4 shadow-sm relative">
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
              <label :for="`quantity-${item.cartItemId}`" class="text-sm mr-2">Quantity:</label> {/* Label text color will inherit or can be venus-text-primary if needed */}
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

        <div class="discount-section my-4 py-4 border-t border-b border-venus-neutral-medium">
          <div class="discount-form flex gap-2 mb-2">
            <input
              type="text"
              v-model="discountCodeInput"
              placeholder="Discount code"
              class="discount-input flex-grow px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold"
              :disabled="applyingDiscount"
            />
            <button
              @click="handleApplyDiscount"
              :disabled="applyingDiscount || !discountCodeInput"
              class="apply-discount-button px-4 py-2 bg-venus-accent-gold text-white text-sm font-medium rounded-sm shadow-sm hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-venus-accent-gold/70 disabled:opacity-60 transition-colors duration-200 ease-in-out"
            >
              {{ applyingDiscount ? 'Applying...' : 'Apply' }}
            </button>
          </div>
          <p v-if="discountValidationError" class="text-sm text-red-600 mt-1">{{ discountValidationError }}</p>
          <div v-if="appliedDiscount" class="mt-2 p-2 bg-venus-accent-sale/10 text-venus-accent-sale rounded-sm text-sm border border-venus-accent-sale/20">
            <div class="flex justify-between items-center">
              <span>
                Discount: <strong>{{ appliedDiscount.code }}</strong> (-${{ parseFloat(appliedDiscount.calculated_discount_amount_for_cart).toFixed(2) }})
              </span>
              <button @click="handleRemoveDiscount" class="text-venus-accent-sale hover:opacity-70 transition-opacity duration-200 ease-in-out text-xs underline disabled:opacity-60" :disabled="applyingDiscount">Remove</button>
            </div>
            <p v-if="appliedDiscount.description" class="text-xs mt-1">{{ appliedDiscount.description }}</p>
          </div>
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
import { ref, computed, onMounted } from 'vue';
import { useCart } from '~/composables/useCart';

const {
  initCart, // Import initCart
  cartItems,
  isCartInitialized,
  updateQuantity,
  removeFromCart,
  clearCart,
  cartTotalItems,
  cartSubtotal,
  cartFinalTotalPrice,
  applyDiscountCode,
  clearAppliedDiscount,
  appliedDiscount,
  discountValidationError
} = useCart();

const discountCodeInput = ref('');
const applyingDiscount = ref(false);

const updateItemQuantity = (cartItemId, quantity) => {
  if (isNaN(quantity)) return;
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

const handleApplyDiscount = async () => {
  if (!discountCodeInput.value.trim()) return;
  applyingDiscount.value = true;
  await applyDiscountCode(discountCodeInput.value.trim());
  applyingDiscount.value = false;
};

const handleRemoveDiscount = () => {
  clearAppliedDiscount();
  discountCodeInput.value = '';
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

onMounted(() => {
  // Ensure cart initialization logic is run when cart page is mounted,
  // especially for client-side navigations if app.vue's onMounted
  // doesn't cover all scenarios or if there's a reactivity lag.
  // initCart() has an internal guard so it only runs fully once.
  initCart();
});
</script>
<!-- <style scoped> block removed -->

<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-theme(spacing.16))]">
    <h2 class="text-3xl font-bold text-text-primary mb-8 text-center">Your Shopping Cart</h2>
    <div v-if="!isCartInitialized.value" class="text-center py-8 px-4 bg-neutral-light rounded-lg">Initializing cart...</div>
    <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 bg-neutral-light rounded-lg">
      <p class="text-xl text-text-secondary mb-4">Your cart is empty.</p>
      <NuxtLink to="/" class="bg-brand-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-80 transition-colors">Continue Shopping</NuxtLink>
    </div>
    <div v-else class="md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
      <ul class="md:col-span-2 list-none p-0 m-0">
        <li v-for="item in cartItems" :key="item.productId" class="flex items-start gap-4 p-4 border border-neutral-medium rounded-lg bg-white mb-4 shadow-sm relative">
          <img
            v-if="item.image_url"
            :src="item.image_url"
            :alt="item.name"
            class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-md bg-neutral-light flex-shrink-0"
          />
          <div v-else class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-md bg-neutral-light flex-shrink-0 flex items-center justify-center text-text-secondary text-sm">No Image</div>

          <div class="flex-grow flex flex-col">
            <h3 class="text-lg font-semibold text-text-primary mb-1">{{ item.name }}</h3>
            <p v-if="item.selectedVariantDescription" class="text-sm text-text-secondary mb-1">{{ item.selectedVariantDescription }}</p>
            <p v-if="item.sku" class="text-xs text-neutral-dark mb-1">SKU: {{ item.sku }}</p>
            <p class="text-sm text-text-secondary">Price: ${{ item.price.toFixed(2) }}</p>
            <div class="item-quantity my-2">
              <label :for="`quantity-${item.cartItemId}`" class="text-sm mr-2">Quantity:</label>
              <input
                type="number"
                :id="`quantity-${item.cartItemId}`"
                :value="item.quantity"
                @input="updateItemQuantity(item.cartItemId, parseInt($event.target.value))"
                min="1"
                class="quantity-input w-16 px-2 py-1 border border-neutral-dark rounded-md text-sm text-center"
              />
            </div>
            <p class="font-medium text-text-primary mt-auto pt-1">Item Total: ${{ (item.price * item.quantity).toFixed(2) }}</p>
          </div>
          <button @click="removeItem(item.cartItemId)" class="remove-item-button absolute top-2 right-2 text-red-500 hover:text-red-700 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </li>
      </ul>
      <div class="cart-summary md:col-span-1 mt-6 md:mt-0 p-6 bg-neutral-light rounded-lg shadow border border-neutral-medium h-fit sticky top-20">
        <h3 class="text-xl font-semibold text-text-primary mb-4">Cart Summary</h3>
        <p class="flex justify-between text-text-secondary"><span>Total Items:</span> <span>{{ cartTotalItems }}</span></p>
        <p class="flex justify-between text-text-secondary mb-2"><span>Subtotal:</span> <span>${{ cartSubtotal.toFixed(2) }}</span></p>

        <div class="discount-section my-4 py-4 border-t border-b border-neutral-medium">
          <div class="discount-form flex gap-2 mb-2">
            <input
              type="text"
              v-model="discountCodeInput"
              placeholder="Discount code"
              class="discount-input flex-grow px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              :disabled="applyingDiscount"
            />
            <button
              @click="handleApplyDiscount"
              :disabled="applyingDiscount || !discountCodeInput"
              class="apply-discount-button px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary disabled:opacity-60 transition-colors"
            >
              {{ applyingDiscount ? 'Applying...' : 'Apply' }}
            </button>
          </div>
          <p v-if="discountValidationError" class="text-sm text-red-600 mt-1">{{ discountValidationError }}</p>
          <div v-if="appliedDiscount" class="mt-2 p-2 bg-green-100 text-green-700 rounded-md text-sm border border-green-200">
            <div class="flex justify-between items-center">
              <span>
                Discount: <strong>{{ appliedDiscount.code }}</strong> (-${{ parseFloat(appliedDiscount.calculated_discount_amount_for_cart).toFixed(2) }})
              </span>
              <button @click="handleRemoveDiscount" class="text-green-700 hover:text-green-900 text-xs underline disabled:opacity-60" :disabled="applyingDiscount">Remove</button>
            </div>
            <p v-if="appliedDiscount.description" class="text-xs mt-1">{{ appliedDiscount.description }}</p>
          </div>
        </div>

        <p class="flex justify-between text-xl font-bold text-text-primary my-3">
          <span>Final Total:</span>
          <span>${{ cartFinalTotalPrice.toFixed(2) }}</span>
        </p>
        <div class="cart-actions mt-6 space-y-3">
          <NuxtLink
            :to="cartItems.length > 0 ? '/checkout' : '#'"
            :class="['block w-full text-center px-4 py-3 bg-brand-primary text-white font-semibold rounded-lg shadow hover:bg-opacity-90 transition-colors', { 'opacity-60 cursor-not-allowed': cartItems.length === 0 }]"
            @click="checkCartEmptyBeforeCheckout"
          >
            Proceed to Checkout
          </NuxtLink>
          <button
            @click="confirmClearCart"
            class="w-full px-4 py-2 bg-neutral-medium text-text-secondary text-sm font-medium rounded-md shadow-sm hover:bg-neutral-dark hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-neutral-dark transition-colors"
          >
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCart } from '~/composables/useCart';

const {
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
</script>
<!-- <style scoped> block removed -->

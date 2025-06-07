<template>
  <div class="cart-page">
    <h2>Your Shopping Cart</h2>
    <div v-if="!isCartInitialized.value" class="loading-cart">Initializing cart...</div>
    <div v-else-if="cartItems.length === 0" class="empty-cart">
      <p>Your cart is empty.</p>
      <NuxtLink to="/">Continue Shopping</NuxtLink>
    </div>
    <div v-else class="cart-content">
      <ul class="cart-items-list">
        <li v-for="item in cartItems" :key="item.productId" class="cart-item">
          <img
            v-if="item.image_url"
            :src="item.image_url"
            :alt="item.name"
            class="cart-item-image"
          />
          <div v-else class="cart-item-image-placeholder">No Image</div>

          <div class="item-details">
            <h3>{{ item.name }}</h3>
            <p v-if="item.selectedVariantDescription" class="item-variant-desc">{{ item.selectedVariantDescription }}</p>
            <p v-if="item.sku" class="item-sku">SKU: {{ item.sku }}</p>
            <p>Price: ${{ item.price.toFixed(2) }}</p>
            <div class="item-quantity">
              <label :for="`quantity-${item.cartItemId}`">Quantity:</label>
              <input
                type="number"
                :id="`quantity-${item.cartItemId}`"
                :value="item.quantity"
                @input="updateItemQuantity(item.cartItemId, parseInt($event.target.value))"
                min="1"
                class="quantity-input"
              />
            </div>
            <p>Item Total: ${{ (item.price * item.quantity).toFixed(2) }}</p>
          </div>
          <button @click="removeItem(item.cartItemId)" class="remove-item-button">&times;</button>
        </li>
      </ul>
      <div class="cart-summary">
        <h3>Cart Summary</h3>
        <p>Total Items: {{ cartTotalItems }}</p>
        <p>Subtotal: ${{ cartSubtotal.toFixed(2) }}</p>

        <div class="discount-section">
          <div class="discount-form">
            <input type="text" v-model="discountCodeInput" placeholder="Enter discount code" class="discount-input" :disabled="applyingDiscount"/>
            <button @click="handleApplyDiscount" :disabled="applyingDiscount || !discountCodeInput" class="apply-discount-button">
              {{ applyingDiscount ? 'Applying...' : 'Apply Discount' }}
            </button>
          </div>
          <p v-if="discountValidationError" class="error-message discount-error">{{ discountValidationError }}</p>
          <div v-if="appliedDiscount" class="applied-discount-info">
            <p>
              Discount Applied: <strong>{{ appliedDiscount.code }}</strong>
              (-${{ parseFloat(appliedDiscount.calculated_discount_amount_for_cart).toFixed(2) }})
              <button @click="handleRemoveDiscount" class="remove-discount-button" :disabled="applyingDiscount">Remove</button>
            </p>
            <p v-if="appliedDiscount.description" class="discount-description">{{ appliedDiscount.description }}</p>
          </div>
        </div>

        <p class="final-total">Final Total: <strong>${{ cartFinalTotalPrice.toFixed(2) }}</strong></p>
        <div class="cart-actions">
          <button @click="confirmClearCart" class="clear-cart-button">Clear Cart</button>
          <NuxtLink
            :to="cartItems.length > 0 ? '/checkout' : '#'"
            :class="['checkout-button', { 'disabled-link': cartItems.length === 0 }]"
            @click="checkCartEmptyBeforeCheckout"
          >
            Proceed to Checkout
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'; // Removed unused useRuntimeConfig, added ref
import { useCart } from '~/composables/useCart';
// import { useRuntimeConfig } from '#app'; // Not needed if image URLs are absolute

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

// Note: backendUrl is not needed if image_urls from cart are absolute (e.g. S3)

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
  // Do not clear input if there was a validation error, so user can correct it.
  // if (!discountValidationError.value) {
  //   discountCodeInput.value = '';
  // }
};

const handleRemoveDiscount = () => {
  clearAppliedDiscount();
  discountCodeInput.value = ''; // Optionally clear input when discount is removed
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
.cart-page {
  max-width: 900px;
  margin: 2rem auto;
  padding: 1rem;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}
.loading-cart, .empty-cart {
  text-align: center;
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 8px;
}
.empty-cart a {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.7rem 1.5rem;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 5px;
}
.empty-cart a:hover {
  background-color: #0056b3;
}

.cart-items-list {
  list-style: none;
  padding: 0;
}
.cart-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #fff;
  position: relative;
}
.cart-item-image, .cart-item-image-placeholder {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
  background-color: #e0e0e0;
}
.cart-item-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  color: #777;
}
.item-details {
  flex-grow: 1;
}
.item-details h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1em;
}
.item-details p {
  margin: 0.3rem 0;
}
.item-quantity {
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.quantity-input {
  width: 60px;
  padding: 0.3rem;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.remove-item-button {
  background: none;
  border: none;
  color: #dc3545;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
.remove-item-button:hover {
  color: #c82333;
}

.cart-summary {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #eee;
}
.cart-summary h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}
.cart-summary p {
  margin: 0.5rem 0;
  font-size: 1.1em;
}
.cart-summary .final-total strong {
  font-size: 1.2em;
  color: #28a745;
}
.discount-section {
  margin: 1rem 0;
  padding: 1rem 0;
  border-top: 1px dashed #ccc;
  border-bottom: 1px dashed #ccc;
}
.discount-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.discount-input {
  flex-grow: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.apply-discount-button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.apply-discount-button:disabled {
  background-color: #aaa;
}
.apply-discount-button:hover:not(:disabled) {
  background-color: #0056b3;
}
.error-message.discount-error {
  color: #721c24;
  background-color: #f8d7da;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9em;
  margin-top: 0.5rem;
}
.applied-discount-info {
  background-color: #d4edda;
  color: #155724;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 0.9em;
}
.applied-discount-info strong {
  font-weight: bold;
}
.discount-description {
    font-size: 0.9em;
    margin-top: 0.3em;
}
.remove-discount-button {
  background: none;
  border: none;
  color: #155724;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.9em;
  margin-left: 0.5rem;
}
.remove-discount-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.cart-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.clear-cart-button, .checkout-button {
  padding: 0.7rem 1.2rem;
  border-radius: 5px;
  text-decoration: none;
  font-size: 1em;
  cursor: pointer;
}
.clear-cart-button {
  background-color: #ffc107;
  color: #333;
  border: none;
}
.clear-cart-button:hover {
  background-color: #e0a800;
}
.checkout-button {
  background-color: #28a745;
  color: white;
  border: none;
}
.checkout-button:hover:not(.disabled-link) {
  background-color: #218838;
}
.checkout-button.disabled-link {
  background-color: #aaa;
  cursor: not-allowed;
  pointer-events: none;
}
</style>

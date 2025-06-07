<template>
  <div class="cart-page">
    <h2>Your Shopping Cart</h2>
    <div v-if="!isCartInitialized" class="loading-cart">Initializing cart...</div>
    <div v-else-if="cartItems.length === 0" class="empty-cart">
      <p>Your cart is empty.</p>
      <NuxtLink to="/">Continue Shopping</NuxtLink>
    </div>
    <div v-else class="cart-content">
      <ul class="cart-items-list">
        <li v-for="item in cartItems" :key="item.productId" class="cart-item">
          <img
            v-if="item.image_url"
            :src="item.image_url" <!-- Removed backendUrl prefix -->
            :alt="item.name"
            class="cart-item-image"
          />
          <div v-else class="cart-item-image-placeholder">No Image</div>

          <div class="item-details">
            <h3>{{ item.name }}</h3>
            <p>Price: ${{ item.price.toFixed(2) }}</p>
            <div class="item-quantity">
              <label :for="`quantity-${item.productId}`">Quantity:</label>
              <input
                type="number"
                :id="`quantity-${item.productId}`"
                :value="item.quantity"
                @input="updateItemQuantity(item.productId, parseInt($event.target.value))"
                min="1"
                class="quantity-input"
              />
            </div>
            <p>Item Total: ${{ (item.price * item.quantity).toFixed(2) }}</p>
          </div>
          <button @click="removeItem(item.productId)" class="remove-item-button">&times;</button>
        </li>
      </ul>
      <div class="cart-summary">
        <h3>Cart Summary</h3>
        <p>Total Items: {{ cartTotalItems }}</p>
        <p>Total Price: <strong>${{ cartTotalPrice.toFixed(2) }}</strong></p>
        <div class="cart-actions">
          <button @click="confirmClearCart" class="clear-cart-button">Clear Cart</button>
          <NuxtLink to="/checkout" class="checkout-button">Proceed to Checkout</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCart } from '~/composables/useCart';
import { useRuntimeConfig } from '#app'; // For Nuxt 3 global runtime config

const {
  cartItems,
  isCartInitialized,
  updateQuantity,
  removeFromCart,
  clearCart,
  cartTotalItems,
  cartTotalPrice
} = useCart();

const runtimeConfig = useRuntimeConfig();
const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

const updateItemQuantity = (productId, quantity) => {
  if (isNaN(quantity)) return; // Prevent NaN issues if input is cleared
  updateQuantity(productId, quantity);
};

const removeItem = (productId) => {
  if (confirm('Are you sure you want to remove this item from your cart?')) {
    removeFromCart(productId);
  }
};

const confirmClearCart = () => {
  if (confirm('Are you sure you want to clear your entire cart?')) {
    clearCart();
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
  background-color: #e0e0e0; /* Placeholder background */
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
.cart-summary strong {
  font-size: 1.2em;
  color: #007bff;
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
.checkout-button:hover {
  background-color: #218838;
}
</style>

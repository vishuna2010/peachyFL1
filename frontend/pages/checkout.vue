<template>
  <div class="checkout-page">
    <h2>Checkout</h2>

    <div v-if="isLoadingAuthOrCart" class="loading-message">Loading checkout...</div>

    <div v-else-if="!isAuthenticated" class="auth-redirect-message">
      <p>You need to be logged in to proceed to checkout.</p>
      <NuxtLink :to="`/login?redirect=${encodeURIComponent('/checkout')}`">Login</NuxtLink>
    </div>

    <div v-else-if="cartItems.length === 0" class="empty-cart-message">
      <p>Your cart is empty. Please add items to your cart before proceeding to checkout.</p>
      <NuxtLink to="/">Continue Shopping</NuxtLink>
    </div>

    <div v-else class="checkout-content">
      <div class="order-summary">
        <h3>Order Summary</h3>
        <ul>
          <li v-for="item in cartItems" :key="item.productId" class="summary-item">
            <span>{{ item.name }} ({{ item.quantity }} x ${{ item.price.toFixed(2) }})</span>
            <span>${{ (item.price * item.quantity).toFixed(2) }}</span>
          </li>
        </ul>
        <p class="summary-subtotal">Subtotal: ${{ cartSubtotal.toFixed(2) }}</p>
        <div v-if="appliedDiscount" class="summary-discount">
          <p>Discount ({{ appliedDiscount.code }}):
            <strong>-${{ parseFloat(appliedDiscount.calculated_discount_amount_for_cart).toFixed(2) }}</strong>
          </p>
        </div>
        <p class="summary-total"><strong>Final Total: ${{ cartFinalTotalPrice.toFixed(2) }}</strong></p>
      </div>

      <form @submit.prevent="handlePlaceOrder" class="checkout-form">
        <h3>Shipping Address</h3>
        <div class="form-group">
          <label for="sa-line1">Address Line 1:</label>
          <input type="text" id="sa-line1" v-model="shippingAddress.line1" required />
        </div>
        <div class="form-group">
          <label for="sa-line2">Address Line 2 (Optional):</label>
          <input type="text" id="sa-line2" v-model="shippingAddress.line2" />
        </div>
        <div class="form-group">
          <label for="sa-city">City:</label>
          <input type="text" id="sa-city" v-model="shippingAddress.city" required />
        </div>
        <div class="form-group">
          <label for="sa-postalCode">Postal Code:</label>
          <input type="text" id="sa-postalCode" v-model="shippingAddress.postalCode" required />
        </div>
        <div class="form-group">
          <label for="sa-country">Country:</label>
          <input type="text" id="sa-country" v-model="shippingAddress.country" required />
        </div>

        <div class="form-group checkbox-group">
          <input type="checkbox" id="sameAsShipping" v-model="sameAsShipping" />
          <label for="sameAsShipping">Billing address is the same as shipping address</label>
        </div>

        <template v-if="!sameAsShipping">
          <h3>Billing Address</h3>
          <div class="form-group">
            <label for="ba-line1">Address Line 1:</label>
            <input type="text" id="ba-line1" v-model="billingAddress.line1" :required="!sameAsShipping" />
          </div>
          <div class="form-group">
            <label for="ba-line2">Address Line 2 (Optional):</label>
            <input type="text" id="ba-line2" v-model="billingAddress.line2" />
          </div>
          <div class="form-group">
            <label for="ba-city">City:</label>
            <input type="text" id="ba-city" v-model="billingAddress.city" :required="!sameAsShipping" />
          </div>
          <div class="form-group">
            <label for="ba-postalCode">Postal Code:</label>
            <input type="text" id="ba-postalCode" v-model="billingAddress.postalCode" :required="!sameAsShipping" />
          </div>
          <div class="form-group">
            <label for="ba-country">Country:</label>
            <input type="text" id="ba-country" v-model="billingAddress.country" :required="!sameAsShipping" />
          </div>
        </template>

        <div v-if="submissionError" class="error-message">{{ submissionError }}</div>

        <button type="submit" :disabled="isSubmitting" class="place-order-button">
          {{ isSubmitting ? 'Placing Order...' : 'Place Order' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watchEffect, computed, nextTick } from 'vue'; // Added nextTick, computed
import { useCart } from '~/composables/useCart';
import { useAuth } from '~/composables/useAuth';
import { useRouter, useNuxtApp } from '#app';

const {
  cartItems,
  cartSubtotal, // Corrected: use cartSubtotal
  cartFinalTotalPrice, // Corrected: use cartFinalTotalPrice
  appliedDiscount,    // Corrected: import appliedDiscount
  clearCart,
  isCartInitialized: isCartStoreInitialized
} = useCart();
const { authToken, authUser, isAuthInitialized } = useAuth();
const { $axios } = useNuxtApp();
const router = useRouter();

const isAuthenticated = ref(false);
const isLoadingAuthOrCart = ref(true);

const shippingAddress = reactive({
  line1: '', line2: '', city: '', postalCode: '', country: ''
});
const billingAddress = reactive({
  line1: '', line2: '', city: '', postalCode: '', country: ''
});
const sameAsShipping = ref(true);
const isSubmitting = ref(false);
const submissionError = ref('');

onMounted(async () => {
  await nextTick();

  const updateLoadingState = () => {
      const authReady = typeof isAuthInitialized === 'undefined' ? true : isAuthInitialized.value;
      const cartReady = isCartStoreInitialized.value;

      if (authReady && cartReady) {
          isLoadingAuthOrCart.value = false;
          isAuthenticated.value = !!authToken.value; // Update isAuthenticated based on actual authToken
          if (!isAuthenticated.value) {
              router.replace(`/login?redirect=${encodeURIComponent('/checkout')}`);
          } else if (cartItems.value.length === 0) {
              router.replace('/cart');
          }
      }
  };

  if (typeof isAuthInitialized !== 'undefined') {
    watchEffect(() => {
      if (isAuthInitialized.value && isCartStoreInitialized.value) {
        updateLoadingState();
      }
    });
  }
   watchEffect(() => { // This handles cart initialization changes
      if (isCartStoreInitialized.value && (typeof isAuthInitialized === 'undefined' || isAuthInitialized.value)) {
        updateLoadingState();
      }
  });

  // Initial check in case watchers didn't cover all scenarios or for immediate state
  updateLoadingState();
});


const handlePlaceOrder = async () => {
  isSubmitting.value = true;
  submissionError.value = '';

  const orderPayload = {
    cart: cartItems.value.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    shippingAddress: { ...shippingAddress },
    billingAddress: sameAsShipping.value ? { ...shippingAddress } : { ...billingAddress },
    discount_code: appliedDiscount.value?.code || undefined, // Add discount_code
  };

  try {
    const response = await $axios.post('/orders', orderPayload);

    if (response.status === 201 && response.data.order) {
      clearCart(); // This will also clear the applied discount via the updated composable
      router.push(`/orders/thank-you?orderId=${response.data.order.id}`);
    } else {
      submissionError.value = 'Failed to place order. Unexpected response.';
    }
  } catch (error) {
    console.error('Order submission error:', error);
    submissionError.value = error.response?.data?.message || 'An error occurred while placing your order.';
  } finally {
    isSubmitting.value = false;
  }
};

useHead({
  title: 'Checkout',
});
</script>

<style scoped>
.checkout-page {
  max-width: 800px;
  margin: 2rem auto;
  padding: 1rem;
}
h2, h3 {
  color: #333;
  margin-bottom: 1rem;
}
h2 { text-align: center; margin-bottom: 1.5rem; }

.loading-message, .auth-redirect-message, .empty-cart-message {
  text-align: center;
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 8px;
}
.auth-redirect-message a, .empty-cart-message a {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.7rem 1.5rem;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 5px;
}

.checkout-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .checkout-content {
    grid-template-columns: 1fr 1fr;
  }
}

.order-summary {
  background-color: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #eee;
}
.order-summary ul {
  list-style: none;
  padding: 0;
}
.summary-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9em;
}
.summary-item span:first-child { color: #555; }
.summary-subtotal {
  text-align: right;
  font-size: 1em;
  color: #444;
}
.summary-discount {
  text-align: right;
  font-size: 1em;
  color: #28a745;
}
.summary-discount strong {
  font-weight: bold;
}
.summary-total {
  margin-top: 0.5rem;
  font-size: 1.2em;
  text-align: right;
  border-top: 1px solid #eee;
  padding-top: 0.5rem;
}
.summary-total strong { color: #007bff; }

.checkout-form .form-group {
  margin-bottom: 1rem;
}
.checkout-form label {
  display: block;
  margin-bottom: 0.3rem;
  font-weight: bold;
  font-size: 0.9em;
  color: #444;
}
.checkout-form input[type="text"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.checkbox-group input[type="checkbox"] {
  width: auto;
}

.place-order-button {
  width: 100%;
  padding: 0.8rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.2s;
}
.place-order-button:hover:not(:disabled) {
  background-color: #218838;
}
.place-order-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.error-message {
  color: red;
  background-color: #ffe0e0;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  text-align: center;
}
</style>

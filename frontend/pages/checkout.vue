<template>
  <div class="checkout-page">
    <h2>Checkout</h2>

    <div v-if="isLoadingAuthOrCart" class="loading-message">Loading checkout...</div>

    <div v-else-if="!isAuthenticated" class="auth-redirect-message">
      <p>You need to be logged in to proceed to checkout.</p>
      <NuxtLink to="/login?redirect=/checkout">Login</NuxtLink>
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
        <p class="summary-total"><strong>Total: ${{ cartTotalPrice.toFixed(2) }}</strong></p>
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
            <input type="text" id="ba-line1" v-model="billingAddress.line1" required />
          </div>
          <div class="form-group">
            <label for="ba-line2">Address Line 2 (Optional):</label>
            <input type="text" id="ba-line2" v-model="billingAddress.line2" />
          </div>
          <div class="form-group">
            <label for="ba-city">City:</label>
            <input type="text" id="ba-city" v-model="billingAddress.city" required />
          </div>
          <div class="form-group">
            <label for="ba-postalCode">Postal Code:</label>
            <input type="text" id="ba-postalCode" v-model="billingAddress.postalCode" required />
          </div>
          <div class="form-group">
            <label for="ba-country">Country:</label>
            <input type="text" id="ba-country" v-model="billingAddress.country" required />
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
import { ref, reactive, onMounted, watchEffect } from 'vue';
import { useCart } from '~/composables/useCart';
import { useAuth } from '~/composables/useAuth';
import { useRouter, useNuxtApp } from '#app';

const { cartItems, cartTotalPrice, clearCart, isCartInitialized: isCartStoreInitialized } = useCart();
const { authToken, authUser, isAuthInitialized } = useAuth(); // Assuming useAuth exposes isAuthInitialized
const { $axios } = useNuxtApp();
const router = useRouter();

const isAuthenticated = ref(false); // Local ref to track auth status post-initialization
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

// Check auth and cart status after client-side initialization
onMounted(async () => {
  // Wait for both auth and cart to confirm initialization if they have such flags
  // For this example, we assume useAuth().authToken will be populated after its own init logic (e.g. from localStorage)
  // And useCart().isCartInitialized is used.

  // A simple way to wait for composables if they load async from localStorage:
  // This can be improved with explicit isInitialized flags in composables
  await nextTick(); // Wait for potential updates from composables

  if (typeof isAuthInitialized !== 'undefined') { // If useAuth has an initialized flag
    watchEffect(() => {
        if (isAuthInitialized.value) {
            isAuthenticated.value = !!authToken.value;
        }
    });
    isAuthenticated.value = !!authToken.value; // Initial check
  } else { // Fallback if useAuth doesn't have isAuthInitialized
      isAuthenticated.value = !!authToken.value;
  }


  watchEffect(() => {
    if (isCartStoreInitialized.value && (typeof isAuthInitialized === 'undefined' || isAuthInitialized.value) ) {
        isLoadingAuthOrCart.value = false;
        if (!isAuthenticated.value) {
            router.replace('/login?redirect=/checkout');
        } else if (cartItems.value.length === 0) {
            router.replace('/cart');
        }
    }
  });
   if (isCartStoreInitialized.value && (typeof isAuthInitialized === 'undefined' || isAuthInitialized.value) ) {
        isLoadingAuthOrCart.value = false;
        if (!isAuthenticated.value) {
            router.replace('/login?redirect=/checkout');
        } else if (cartItems.value.length === 0) {
            router.replace('/cart');
        }
    }

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
  };

  try {
    // Axios plugin should already include the auth token if set up in useAuth
    const response = await $axios.post('/orders', orderPayload);

    if (response.status === 201 && response.data.order) {
      clearCart();
      // Redirect to a thank you page, potentially with order ID
      // For simplicity, a generic thank you page.
      router.push(`/orders/thank-you?orderId=${response.data.order.id}`);
    } else {
      // Should not happen if backend returns 201 only on success
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
    grid-template-columns: 1fr 1fr; /* Summary and Form side-by-side on larger screens */
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
.summary-total {
  margin-top: 1rem;
  font-size: 1.2em;
  text-align: right;
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
.checkout-form input[type="text"],
.checkout-form input[type="email"] /* If email was needed */ {
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

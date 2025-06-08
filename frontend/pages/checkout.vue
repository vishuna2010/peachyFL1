<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-theme(spacing.16))]">
    <h2 class="text-3xl font-bold text-text-primary mb-8 text-center">Checkout</h2>

    <div v-if="isLoadingAuthOrCart" class="text-center py-10 px-4 my-6 bg-neutral-light rounded-lg shadow text-text-secondary">Loading checkout...</div>

    <div v-else-if="!isAuthenticated" class="text-center py-10 px-4 my-6 bg-neutral-light rounded-lg shadow">
      <p class="text-lg text-text-secondary mb-4">You need to be logged in to proceed to checkout.</p>
      <NuxtLink :to="`/login?redirect=${encodeURIComponent('/checkout')}`" class="mt-4 inline-block px-6 py-3 bg-brand-primary text-white font-medium rounded-md hover:bg-opacity-80 transition-colors">Login</NuxtLink>
    </div>

    <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 my-6 bg-neutral-light rounded-lg shadow">
      <p class="text-lg text-text-secondary mb-4">Your cart is empty. Please add items to your cart before proceeding to checkout.</p>
      <NuxtLink to="/" class="mt-4 inline-block px-6 py-3 bg-brand-primary text-white font-medium rounded-md hover:bg-opacity-80 transition-colors">Continue Shopping</NuxtLink>
    </div>

    <div v-else class="lg:grid lg:grid-cols-5 lg:gap-x-8 xl:gap-x-12 mt-6">
      <div class="lg:col-span-2 order-first lg:order-last p-6 bg-neutral-light rounded-lg shadow-md border border-neutral-medium h-fit lg:sticky lg:top-24">
        <h3 class="text-xl font-semibold text-text-primary mb-6">Order Summary</h3>
        <ul class="list-none p-0 m-0 space-y-3">
          <li v-for="item in cartItems" :key="item.productId" class="flex justify-between items-center text-sm">
            <span class="text-text-secondary pr-2">{{ item.name }} ({{ item.quantity }} x ${{ item.price.toFixed(2) }})</span>
            <span class="font-medium text-text-primary whitespace-nowrap">${{ (item.price * item.quantity).toFixed(2) }}</span>
          </li>
        </ul>
        <p class="flex justify-between text-base text-text-secondary mt-6 pt-4 border-t border-neutral-dark">
          <span>Subtotal:</span>
          <span class="font-semibold text-text-primary">${{ cartSubtotal.toFixed(2) }}</span>
        </p>
        <div v-if="appliedDiscount" class="mt-1 text-sm text-green-700">
          <p class="flex justify-between text-sm text-green-700 mt-2">
            <span>Discount ({{ appliedDiscount.code }}):</span>
            <span class="font-medium"><strong>-${{ parseFloat(appliedDiscount.calculated_discount_amount_for_cart).toFixed(2) }}</strong></span>
          </p>
        </div>
        <p class="flex justify-between text-xl font-bold text-text-primary mt-4 pt-4 border-t-2 border-brand-primary">
          <span>Final Total:</span>
          <span>${{ cartFinalTotalPrice.toFixed(2) }}</span>
        </p>
      </div>

      <form @submit.prevent="handlePlaceOrder" class="lg:col-span-3 mt-8 lg:mt-0">
        <h3 class="text-xl font-semibold text-text-primary mb-6 mt-8 first:mt-0">Shipping Address</h3>
        <div class="mb-4">
          <label for="sa-line1" class="block text-sm font-medium text-text-primary mb-1">Address Line 1:</label>
          <input type="text" id="sa-line1" v-model="shippingAddress.line1" required class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
        </div>
        <div class="mb-4">
          <label for="sa-line2" class="block text-sm font-medium text-text-primary mb-1">Address Line 2 (Optional):</label>
          <input type="text" id="sa-line2" v-model="shippingAddress.line2" class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
        </div>
        <div class="mb-4">
          <label for="sa-city" class="block text-sm font-medium text-text-primary mb-1">City:</label>
          <input type="text" id="sa-city" v-model="shippingAddress.city" required class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
        </div>
        <div class="mb-4">
          <label for="sa-postalCode" class="block text-sm font-medium text-text-primary mb-1">Postal Code:</label>
          <input type="text" id="sa-postalCode" v-model="shippingAddress.postalCode" required class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
        </div>
        <div class="mb-4">
          <label for="sa-country" class="block text-sm font-medium text-text-primary mb-1">Country:</label>
          <input type="text" id="sa-country" v-model="shippingAddress.country" required class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
        </div>

        <div class="flex items-center gap-2 my-5">
          <input type="checkbox" id="sameAsShipping" v-model="sameAsShipping" class="h-4 w-4 text-brand-primary border-neutral-dark rounded focus:ring-brand-primary focus:ring-offset-1" />
          <label for="sameAsShipping" class="text-sm text-text-primary cursor-pointer">Billing address is the same as shipping address</label>
        </div>

        <template v-if="!sameAsShipping">
          <h3 class="text-xl font-semibold text-text-primary mb-6 mt-8 first:mt-0">Billing Address</h3>
          <div class="mb-4">
            <label for="ba-line1" class="block text-sm font-medium text-text-primary mb-1">Address Line 1:</label>
            <input type="text" id="ba-line1" v-model="billingAddress.line1" :required="!sameAsShipping" class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
          <div class="mb-4">
            <label for="ba-line2" class="block text-sm font-medium text-text-primary mb-1">Address Line 2 (Optional):</label>
            <input type="text" id="ba-line2" v-model="billingAddress.line2" class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
          <div class="mb-4">
            <label for="ba-city" class="block text-sm font-medium text-text-primary mb-1">City:</label>
            <input type="text" id="ba-city" v-model="billingAddress.city" :required="!sameAsShipping" class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
          <div class="mb-4">
            <label for="ba-postalCode" class="block text-sm font-medium text-text-primary mb-1">Postal Code:</label>
            <input type="text" id="ba-postalCode" v-model="billingAddress.postalCode" :required="!sameAsShipping" class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
          <div class="mb-4">
            <label for="ba-country" class="block text-sm font-medium text-text-primary mb-1">Country:</label>
            <input type="text" id="ba-country" v-model="billingAddress.country" :required="!sameAsShipping" class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
        </template>

        <div v-if="submissionError" class="mt-4 p-4 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg">{{ submissionError }}</div>

        <button type="submit" :disabled="isSubmitting" class="w-full mt-8 px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-brand-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-60 transition-colors duration-150">
          {{ isSubmitting ? 'Placing Order...' : 'Place Order' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watchEffect, computed, nextTick } from 'vue';
import { useCart } from '~/composables/useCart';
import { useAuth } from '~/composables/useAuth';
import { useRouter, useNuxtApp } from '#app';

const {
  cartItems,
  cartSubtotal,
  cartFinalTotalPrice,
  appliedDiscount,
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
          isAuthenticated.value = !!authToken.value;
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
   watchEffect(() => {
      if (isCartStoreInitialized.value && (typeof isAuthInitialized === 'undefined' || isAuthInitialized.value)) {
        updateLoadingState();
      }
  });

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
    discount_code: appliedDiscount.value?.code || undefined,
  };

  try {
    const response = await $axios.post('/orders', orderPayload);

    if (response.status === 201 && response.data.order) {
      clearCart();
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

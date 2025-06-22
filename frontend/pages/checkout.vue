<template>
<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
    <h2 class="text-3xl font-serif text-venus-text-primary mb-8 text-center">Checkout</h2>
    <ClientOnly>
      <div v-if="isLoadingAuthOrCart" class="text-center py-10 px-4 my-6 bg-venus-neutral-light rounded-sm shadow text-venus-text-secondary">Loading checkout...</div>

      <div v-else> <!-- Main content wrapper when not loading auth/cart -->
        <div v-if="showInitializingMessage" class="text-center py-8 px-4 my-6 bg-venus-neutral-light rounded-sm shadow">
          <p class="text-lg text-venus-text-secondary mb-4">Initializing cart... (computed: {{ showInitializingMessage }})</p>
        </div>
        <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 my-6 bg-venus-neutral-light rounded-sm shadow">
          <p class="text-lg text-venus-text-secondary mb-4">Your cart is empty. Please add items to your cart before proceeding to checkout.</p>
          <NuxtLink to="/" class="mt-4 inline-block px-6 py-3 bg-venus-text-primary text-white font-medium rounded-sm hover:bg-opacity-80 transition-colors duration-200 ease-in-out">Continue Shopping</NuxtLink>
        </div>
        <div v-else class="lg:grid lg:grid-cols-5 lg:gap-x-8 xl:gap-x-12 mt-6">
          <!-- Order Summary (Right Column on Desktop, First on Mobile) -->
          <div class="lg:col-span-2 lg:order-last p-6 bg-venus-neutral-light rounded-sm shadow-md border-venus-neutral-medium h-fit lg:sticky lg:top-24">
        <h3 class="text-xl font-serif text-venus-text-primary mb-6">Order Summary</h3>
        <ul class="list-none p-0 m-0 space-y-3">
          <li v-for="item in cartItems" :key="item.cartItemId" class="text-sm pb-3 mb-3 border-b border-venus-neutral-medium last:border-b-0 last:pb-0 last:mb-0">
            <div class="flex justify-between items-start">
              <div class="pr-2">
                <span class="font-medium text-venus-text-primary">{{ item.name }}</span>
                <p v-if="item.tax_class_name || item.tax_class_id" class="text-xs text-venus-text-secondary/80 mt-0.5">
                  Tax Class: {{ item.tax_class_name || (item.tax_class_id ? `ID: ${item.tax_class_id}` : 'N/A') }}
                </p>
              </div>
              <span class="font-medium text-venus-text-primary whitespace-nowrap">${{ (item.price * item.quantity).toFixed(2) }}</span>
            </div>
            <p class="text-xs text-venus-text-secondary mt-1">{{ item.quantity }} x ${{ item.price.toFixed(2) }}</p>
          </li>
        </ul>
        <p class="flex justify-between text-base text-venus-text-secondary mt-6 pt-4 border-t border-venus-neutral-medium">
          <span>Subtotal:</span>
          <span class="font-semibold text-venus-text-primary">${{ cartSubtotal.toFixed(2) }}</span>
        </p>
        <div v-if="appliedDiscount" class="mt-1 text-sm text-venus-accent-sale">
          <p class="flex justify-between text-sm text-venus-accent-sale mt-2">
            <span>Discount ({{ appliedDiscount.code }}):</span>
            <span class="font-medium"><strong>-${{ parseFloat(appliedDiscount.calculated_discount_amount_for_cart).toFixed(2) }}</strong></span>
          </p>
        </div>
        <p class="flex justify-between text-xl font-bold text-venus-text-primary mt-4 pt-4 border-t-2 border-venus-accent-gold">
          <span>Final Total:</span>
          <span>${{ cartFinalTotalPrice.toFixed(2) }}</span>
        </p>
      </div>

      <form @submit.prevent="handlePlaceOrder" class="lg:col-span-3 mt-8 lg:mt-0">
        <!-- Guest Details Form -->
        <div v-if="!isAuthenticated" class="mb-8 p-6 bg-white border border-gray-200 rounded-md shadow-sm">
          <h3 class="text-xl font-serif text-venus-text-primary mb-4">Guest Information</h3>
          <p class="text-sm text-venus-text-secondary mb-4">
            Already have an account? <NuxtLink :to="`/login?redirect=${encodeURIComponent('/checkout')}`" class="text-venus-accent-gold hover:underline font-medium">Log In</NuxtLink>
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="mb-4">
              <label for="guest-firstName" class="block text-sm font-medium text-venus-text-primary mb-1">First Name:</label>
              <input type="text" id="guest-firstName" v-model="guestDetails.firstName" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold" />
            </div>
            <div class="mb-4">
              <label for="guest-lastName" class="block text-sm font-medium text-venus-text-primary mb-1">Last Name:</label>
              <input type="text" id="guest-lastName" v-model="guestDetails.lastName" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold" />
            </div>
          </div>
          <div class="mb-4">
            <label for="guest-email" class="block text-sm font-medium text-venus-text-primary mb-1">Email Address:</label>
            <input type="email" id="guest-email" v-model="guestDetails.email" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold" />
          </div>
        </div>

        <div v-else class="mb-8 p-6 bg-white border border-gray-200 rounded-md shadow-sm">
           <h3 class="text-xl font-serif text-venus-text-primary mb-2">Welcome back, {{ authUser?.name || authUser?.email }}!</h3>
           <p class="text-sm text-venus-text-secondary">You are checking out as a logged-in user.</p>
        </div>

        <h3 class="text-xl font-serif text-venus-text-primary mb-6 mt-8 first:mt-0">Shipping Address</h3>
        <div class="p-6 bg-white border border-gray-200 rounded-md shadow-sm">
          <div class="mb-4">
            <label for="sa-line1" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 1:</label>
          <input type="text" id="sa-line1" v-model="shippingAddress.line1" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
        </div>
        <div class="mb-4">
          <label for="sa-line2" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 2 (Optional):</label>
          <input type="text" id="sa-line2" v-model="shippingAddress.line2" class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
        </div>
        <div class="mb-4">
          <label for="sa-city" class="block text-sm font-medium text-venus-text-primary mb-1">City:</label>
          <input type="text" id="sa-city" v-model="shippingAddress.city" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
        </div>
        <div class="mb-4">
          <label for="sa-postalCode" class="block text-sm font-medium text-venus-text-primary mb-1">Postal Code:</label>
          <input type="text" id="sa-postalCode" v-model="shippingAddress.postalCode" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
        </div>
        <div class="mb-4">
          <label for="sa-country" class="block text-sm font-medium text-venus-text-primary mb-1">Country:</label>
          <input type="text" id="sa-country" v-model="shippingAddress.country" required class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
        </div>
        </div> <!-- Closing the div for shipping address fields -->

        <div class="flex items-center gap-2 my-5">
          <input type="checkbox" id="sameAsShipping" v-model="sameAsShipping" class="h-4 w-4 text-venus-accent-gold border-venus-neutral-medium rounded-sm focus:ring-1 focus:ring-venus-accent-gold focus:ring-offset-0" />
          <label for="sameAsShipping" class="text-sm text-venus-text-primary cursor-pointer">Billing address is the same as shipping address</label>
        </div>

        <!-- Billing Address Section -->
        <div v-if="!sameAsShipping" class="p-6 bg-white border border-gray-200 rounded-md shadow-sm mt-8">
          <h3 class="text-xl font-serif text-venus-text-primary mb-6">Billing Address</h3>
          <div class="mb-4">
            <label for="ba-line1" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 1:</label>
            <input type="text" id="ba-line1" v-model="billingAddress.line1" :required="!sameAsShipping" class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
          </div>
          <div class="mb-4">
            <label for="ba-line2" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 2 (Optional):</label>
            <input type="text" id="ba-line2" v-model="billingAddress.line2" class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
          </div>
          <div class="mb-4">
            <label for="ba-city" class="block text-sm font-medium text-venus-text-primary mb-1">City:</label>
            <input type="text" id="ba-city" v-model="billingAddress.city" :required="!sameAsShipping" class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
          </div>
          <div class="mb-4">
            <label for="ba-postalCode" class="block text-sm font-medium text-venus-text-primary mb-1">Postal Code:</label>
            <input type="text" id="ba-postalCode" v-model="billingAddress.postalCode" :required="!sameAsShipping" class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
          </div>
          <div class="mb-4">
            <label for="ba-country" class="block text-sm font-medium text-venus-text-primary mb-1">Country:</label>
            <input type="text" id="ba-country" v-model="billingAddress.country" :required="!sameAsShipping" class="w-full px-3 py-2 border border-venus-neutral-medium rounded-sm text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-venus-accent-gold focus:border-venus-accent-gold placeholder:text-venus-text-secondary/70" />
          </div>
        </div> <!-- Closing the div for billing address section -->

        <div v-if="submissionError" class="mt-4 p-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded-sm">{{ submissionError }}</div>

        <button type="submit" :disabled="isSubmitting" class="w-full mt-8 px-6 py-3 border border-transparent rounded-sm shadow-sm text-base font-medium text-white bg-venus-text-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-venus-accent-gold/70 disabled:opacity-60 transition-colors duration-200 ease-in-out">
          {{ isSubmitting ? 'Placing Order...' : 'Place Order' }}
        </button>
      </form>
    </div> <!-- End of lg:grid -->
    </div> <!-- Closing tag for <div v-else> associated with isLoadingAuthOrCart -->
  </ClientOnly> <!-- End of ClientOnly -->
<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
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
  isCartInitialized: isCartStoreInitialized,
  initCart // Added initCart here
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
const guestDetails = reactive({ // For guest checkout
  email: '', firstName: '', lastName: ''
});
const sameAsShipping = ref(true);
const isSubmitting = ref(false);
const submissionError = ref('');

console.log('[checkout.vue setup] Initial isCartStoreInitialized.value:', isCartStoreInitialized.value);

const showInitializingMessage = computed(() => {
  console.log('[checkout.vue computed showInitializingMessage] isCartStoreInitialized.value is:', isCartStoreInitialized.value);
  return !isCartStoreInitialized.value;
});

// Watchers for auth and cart initialization
watchEffect(() => {
    console.log('[checkout.vue watchEffect] TOP: isAuthInitialized.value:', (typeof isAuthInitialized === 'undefined' ? 'undefined_itself' : isAuthInitialized.value), 'isCartStoreInitialized.value:', isCartStoreInitialized.value);
    const authReady = typeof isAuthInitialized === 'undefined' ? true : isAuthInitialized.value;
    const cartReady = isCartStoreInitialized.value;
    console.log('[checkout.vue watchEffect] authReady:', authReady, 'cartReady:', cartReady);

    if (authReady && cartReady) {
        console.log('[checkout.vue watchEffect] Both ready. Setting isLoadingAuthOrCart to false. Prev value:', isLoadingAuthOrCart.value);
        isLoadingAuthOrCart.value = false;
        isAuthenticated.value = !!authToken.value; // Update isAuthenticated based on actual token
        console.log('[checkout.vue watchEffect] isLoadingAuthOrCart is now:', isLoadingAuthOrCart.value, 'isAuthenticated is now:', isAuthenticated.value);

        if (isAuthenticated.value && cartItems.value.length === 0) {
            console.log("[checkout.vue watchEffect] User authenticated but cart empty. Redirecting to /cart");
            router.replace('/cart');
        } else if (!isAuthenticated.value && cartItems.value.length === 0) {
            // If guest and cart becomes empty (e.g. cleared on another tab and then nav here)
            console.log("[checkout.vue watchEffect] User is guest and cart is empty. Redirecting to /cart");
            router.replace('/cart');
        }
        // No automatic redirect to login if not authenticated, allow guest form to show
    } else {
        console.log('[checkout.vue watchEffect] Not yet ready. isLoadingAuthOrCart:', isLoadingAuthOrCart.value);
    }
});

onMounted(() => {
  console.log('[checkout.vue onMounted] Component mounted. Initial isCartStoreInitialized.value:', isCartStoreInitialized.value);
  // initCart is already destructured from useCart
  // Call it to be safe, it has an internal guard.
  if (typeof initCart === 'function') {
      console.log('[checkout.vue onMounted] Calling initCart().');
      initCart();
      console.log('[checkout.vue onMounted] After initCart() call, isCartStoreInitialized.value:', isCartStoreInitialized.value);
  } else {
      console.error('[checkout.vue onMounted] initCart is not available from useCart()');
  }
});

const handlePlaceOrder = async () => {
  isSubmitting.value = true;
  submissionError.value = '';

  let orderPayload = {
    cart: cartItems.value.map(item => ({
      // Ensure all necessary item fields are sent, e.g., product_id, variant_id, quantity
      // The backend currently expects productId, productVariantId, quantity from the original cart structure.
      // Let's assume cartItems from useCart provides these.
      productId: item.productId, // Base product ID
      productVariantId: item.variantId || null, // Actual variant ID
      quantity: item.quantity,
      // Price is not sent; backend recalculates. Tax class will be fetched by backend.
    })),
    shippingAddress: { ...shippingAddress },
    billingAddress: sameAsShipping.value ? { ...shippingAddress } : { ...billingAddress },
    discount_code: appliedDiscount.value?.code || undefined,
  };

  if (!isAuthenticated.value) {
    // Add guest details if not authenticated
    if (!guestDetails.email || !guestDetails.firstName || !guestDetails.lastName) {
      submissionError.value = "Please fill in all guest information fields.";
      isSubmitting.value = false;
      return;
    }
    orderPayload.guestDetails = { ...guestDetails };
  }

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

<template>
<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
    <h2 class="text-3xl font-serif text-peach-pink mb-8 text-center">Checkout</h2> <!-- Themed: Page Title -->
    <ClientOnly>
      <div v-if="isLoadingAuthOrCart" class="text-center py-10 px-4 my-6 bg-neutral-bg-soft rounded-lg border border-gray-200 shadow text-venus-text-secondary">Loading checkout...</div> <!-- Themed: Placeholder -->

      <div v-else>
        <div v-if="showInitializingMessage" class="text-center py-8 px-4 my-6 bg-neutral-bg-soft rounded-lg border border-gray-200 shadow"> <!-- Themed: Placeholder -->
          <p class="text-lg text-venus-text-secondary mb-4">Initializing cart... (computed: {{ showInitializingMessage }})</p>
        </div>
        <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 my-6 bg-neutral-bg-soft rounded-lg border border-gray-200 shadow"> <!-- Themed: Placeholder -->
          <p class="text-lg text-venus-text-secondary mb-4">Your cart is empty. Please add items to your cart before proceeding to checkout.</p>
          <NuxtLink to="/" class="mt-4 inline-block px-6 py-3 bg-peach-pink text-white font-medium rounded-md hover:bg-opacity-90 transition-colors duration-200 ease-in-out">Continue Shopping</NuxtLink> <!-- Themed: Button -->
        </div>
        <div v-else class="lg:grid lg:grid-cols-5 lg:gap-x-8 xl:gap-x-12 mt-6">
          <!-- Order Summary -->
          <div class="lg:col-span-2 lg:order-last p-6 bg-neutral-bg-soft rounded-lg shadow-md border-gray-200 h-fit lg:sticky lg:top-24"> <!-- Themed: Summary BG, Rounded, Border -->
            <h3 class="text-xl font-serif text-peach-pink mb-6">Order Summary</h3> <!-- Themed: Title -->
            <ul class="list-none p-0 m-0 space-y-3">
              <li v-for="item in cartItems" :key="item.cartItemId" class="text-sm pb-3 mb-3 border-b border-gray-200 last:border-b-0 last:pb-0 last:mb-0"> <!-- Themed: Border -->
                <div class="flex justify-between items-start">
                  <div class="pr-2">
                    <span class="font-medium text-venus-text-primary">{{ item.name }}</span>
                    <p v-if="item.tax_class_name || item.tax_class_id" class="text-xs text-venus-text-secondary/80 mt-0.5">
                      Tax Class: {{ item.tax_class_name || (item.tax_class_id ? `ID: ${item.tax_class_id}` : 'N/A') }}
                    </p>
                  </div>
                  <span class="font-medium text-orange-gold whitespace-nowrap">${{ (item.price * item.quantity).toFixed(2) }}</span> <!-- Themed: Price -->
                </div>
                <p class="text-xs text-venus-text-secondary mt-1">{{ item.quantity }} x <span class="text-orange-gold/90">${{ (typeof item.price === 'number' ? item.price : 0).toFixed(2) }}</span> (Unit Price)</p> <!-- Themed: Price -->
                <p v-if="getLineItemTaxCheckout(item) !== null && !isFetchingTaxDetails" class="text-xs text-venus-text-secondary/90 mt-0.5">
                    Item Tax: <span class="text-orange-gold/80">${{ getLineItemTaxCheckout(item) }}</span> <!-- Themed: Price -->
                </p>
                <p v-if="isFetchingTaxDetails && !getLineItemTaxCheckout(item)" class="text-xs text-venus-text-secondary/70 animate-pulse mt-0.5">Calculating item tax...</p>
              </li>
            </ul>

            <div class="mt-6 pt-4 border-t border-gray-200 space-y-1 text-sm"> <!-- Themed: Border -->
                <p class="flex justify-between text-venus-text-secondary">
                  <span>Subtotal:</span>
                  <span class="font-medium text-orange-gold">${{ cartSubtotal.toFixed(2) }}</span> <!-- Themed: Price -->
                </p>
                <div v-if="appliedDiscount" class="text-fresh-green"> <!-- Themed: Discount Text -->
                  <p class="flex justify-between">
                    <span>Discount ({{ appliedDiscount.code }}):</span>
                    <span class="font-medium">-${{ calculatedDiscountAmount.toFixed(2) }}</span>
                  </p>
                </div>
                <div v-if="isFetchingTaxDetails" class="text-venus-text-secondary animate-pulse">
                    <p class="flex justify-between"><span>Tax:</span><span>Calculating...</span></p>
                </div>
                <div v-else-if="taxCalculationError">
                    <p class="flex justify-between text-red-600"><span>Tax:</span><span>Error</span></p>
                    <p class="text-xs text-red-500 text-right">{{ taxCalculationError }}</p>
                </div>
                <div v-else-if="cartItems.length > 0">
                     <p class="flex justify-between text-venus-text-secondary">
                        <span>Total Tax:</span>
                        <span class="font-medium text-orange-gold/80">${{ cartTotalTax }}</span> <!-- Themed: Price -->
                    </p>
                </div>
                <!-- Shipping Cost -->
                <div v-if="selectedShippingMethod" class="text-venus-text-secondary">
                  <p class="flex justify-between">
                    <span>Shipping ({{ selectedShippingMethod.name }}):</span>
                    <span class="font-medium text-orange-gold">${{ parseFloat(selectedShippingMethod.price).toFixed(2) }}</span>
                  </p>
                </div>
                <div v-else class="text-venus-text-secondary">
                  <p class="flex justify-between">
                    <span>Shipping:</span>
                    <span class="text-sm text-gray-500">Select a method</span>
                  </p>
                </div>
            </div>

            <p class="flex justify-between text-xl font-bold text-orange-gold mt-4 pt-4 border-t-2 border-peach-pink"> <!-- Themed: Grand Total & Border -->
              <span>Grand Total:</span>
              <span>${{ cartFinalTotalPriceWithShipping.toFixed(2) }}</span>
            </p>
          </div>

      <form @submit.prevent="handlePlaceOrder" class="lg:col-span-3 mt-8 lg:mt-0">
        <!-- Guest Details Form -->
        <div v-if="!isAuthenticated" class="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm"> <!-- Themed: Rounded -->
          <h3 class="text-xl font-serif text-peach-pink mb-4">Guest Information</h3> <!-- Themed: Title -->
          <p class="text-sm text-venus-text-secondary mb-4">
            Already have an account? <NuxtLink :to="`/login?redirect=${encodeURIComponent('/checkout')}`" class="text-peach-pink hover:underline font-medium">Log In</NuxtLink> <!-- Themed: Link -->
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="mb-4">
              <label for="guest-firstName" class="block text-sm font-medium text-venus-text-primary mb-1">First Name:</label>
              <input type="text" id="guest-firstName" v-model="guestDetails.firstName" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink" /> <!-- Themed: Input -->
            </div>
            <div class="mb-4">
              <label for="guest-lastName" class="block text-sm font-medium text-venus-text-primary mb-1">Last Name:</label>
              <input type="text" id="guest-lastName" v-model="guestDetails.lastName" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink" /> <!-- Themed: Input -->
            </div>
          </div>
          <div class="mb-4">
            <label for="guest-email" class="block text-sm font-medium text-venus-text-primary mb-1">Email Address:</label>
            <input type="email" id="guest-email" v-model="guestDetails.email" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink" /> <!-- Themed: Input -->
          </div>
        </div>

        <div v-else class="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm"> <!-- Themed: Rounded -->
           <h3 class="text-xl font-serif text-peach-pink mb-2">Welcome back, {{ authUser?.name || authUser?.email }}!</h3> <!-- Themed: Title -->
           <p class="text-sm text-venus-text-secondary">You are checking out as a logged-in user.</p>
        </div>

        <h3 class="text-xl font-serif text-peach-pink mb-6 mt-8 first:mt-0">Shipping Address</h3> <!-- Themed: Title -->
        <div class="p-6 bg-white border border-gray-200 rounded-lg shadow-sm"> <!-- Themed: Rounded -->
          <div class="mb-4">
            <label for="sa-line1" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 1:</label>
          <input type="text" id="sa-line1" v-model="shippingAddress.line1" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
        </div>
        <div class="mb-4">
          <label for="sa-line2" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 2 (Optional):</label>
          <input type="text" id="sa-line2" v-model="shippingAddress.line2" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
        </div>
        <div class="mb-4">
          <label for="sa-city" class="block text-sm font-medium text-venus-text-primary mb-1">City:</label>
          <input type="text" id="sa-city" v-model="shippingAddress.city" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
        </div>
        <div class="mb-4">
          <label for="sa-postalCode" class="block text-sm font-medium text-venus-text-primary mb-1">Postal Code:</label>
          <input type="text" id="sa-postalCode" v-model="shippingAddress.postalCode" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
        </div>
        <div class="mb-4">
          <label for="sa-country" class="block text-sm font-medium text-venus-text-primary mb-1">Country:</label>
          <input type="text" id="sa-country" v-model="shippingAddress.country" required class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
        </div>
        </div> <!-- Closing the div for shipping address fields -->

        <div class="flex items-center gap-2 my-5">
          <input type="checkbox" id="sameAsShipping" v-model="sameAsShipping" class="h-4 w-4 text-peach-pink border-gray-300 rounded-sm focus:ring-1 focus:ring-peach-pink focus:ring-offset-0" /> <!-- Themed: Checkbox -->
          <label for="sameAsShipping" class="text-sm text-venus-text-primary cursor-pointer">Billing address is the same as shipping address</label>
        </div>

        <!-- Billing Address Section -->
        <div v-if="!sameAsShipping" class="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mt-8"> <!-- Themed: Rounded -->
          <h3 class="text-xl font-serif text-peach-pink mb-6">Billing Address</h3> <!-- Themed: Title -->
          <div class="mb-4">
            <label for="ba-line1" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 1:</label>
            <input type="text" id="ba-line1" v-model="billingAddress.line1" :required="!sameAsShipping" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
          </div>
          <div class="mb-4">
            <label for="ba-line2" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 2 (Optional):</label>
            <input type="text" id="ba-line2" v-model="billingAddress.line2" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
          </div>
          <div class="mb-4">
            <label for="ba-city" class="block text-sm font-medium text-venus-text-primary mb-1">City:</label>
            <input type="text" id="ba-city" v-model="billingAddress.city" :required="!sameAsShipping" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
          </div>
          <div class="mb-4">
            <label for="ba-postalCode" class="block text-sm font-medium text-venus-text-primary mb-1">Postal Code:</label>
            <input type="text" id="ba-postalCode" v-model="billingAddress.postalCode" :required="!sameAsShipping" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
          </div>
          <div class="mb-4">
            <label for="ba-country" class="block text-sm font-medium text-venus-text-primary mb-1">Country:</label>
            <input type="text" id="ba-country" v-model="billingAddress.country" :required="!sameAsShipping" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink placeholder:text-venus-text-secondary/70" /> <!-- Themed: Input -->
          </div>
        </div> <!-- Closing the div for billing address section -->

        <div v-if="submissionError" class="mt-4 p-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded-md">{{ submissionError }}</div> <!-- Adjusted rounded -->

        <!-- Shipping Method Selection -->
        <div class="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 class="text-xl font-serif text-peach-pink mb-4">Shipping Method</h3>
          
          <!-- Loading State -->
          <div v-if="loadingShippingMethods" class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-peach-pink"></div>
            <span class="ml-3 text-venus-text-secondary">Loading shipping options...</span>
          </div>

          <!-- Error State -->
          <div v-else-if="shippingError" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error loading shipping methods</h3>
                <div class="mt-2 text-sm text-red-700">{{ shippingError }}</div>
              </div>
            </div>
          </div>

          <!-- Shipping Methods -->
          <div v-else-if="shippingMethods.length === 0" class="text-center py-8">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No shipping methods available</h3>
            <p class="mt-1 text-sm text-gray-500">Please contact customer support for assistance.</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="method in shippingMethods"
              :key="method.id"
              class="relative border border-gray-200 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-peach-pink hover:shadow-md"
              :class="{
                'border-peach-pink bg-peach-pink/5': selectedShippingMethod?.id === method.id,
                'border-gray-200': selectedShippingMethod?.id !== method.id
              }"
              @click="selectShippingMethod(method)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <input
                    type="radio"
                    :id="`shipping-${method.id}`"
                    :name="'shipping-method'"
                    :value="method.id"
                    :checked="selectedShippingMethod?.id === method.id"
                    class="h-4 w-4 text-peach-pink border-gray-300 focus:ring-peach-pink"
                    @change="selectShippingMethod(method)"
                  />
                  <div class="ml-3">
                    <label :for="`shipping-${method.id}`" class="text-sm font-medium text-venus-text-primary cursor-pointer">
                      {{ method.name }}
                    </label>
                    <div class="flex items-center mt-1">
                      <span v-if="method.courier_name" class="text-xs text-venus-text-secondary mr-2">
                        {{ method.courier_name }}
                      </span>
                      <span v-if="method.description" class="text-xs text-venus-text-secondary">
                        {{ method.description }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-lg font-bold text-orange-gold">${{ parseFloat(method.price).toFixed(2) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Method Section (Placeholder) -->
        <div class="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 class="text-xl font-serif text-peach-pink mb-4">Payment Method</h3>
          <div class="p-4 border border-dashed border-gray-300 rounded-md bg-gray-50">
            <p class="text-sm text-gray-700">
              This is a mock checkout. Clicking "Proceed to Payment" will simulate a payment step.
            </p>
            <p class="mt-2 font-semibold text-gray-800">Pay with: MockCard Ending in 1234</p>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full mt-8 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-60 transition-colors duration-200 ease-in-out"
        > <!-- Themed: Button -->
          {{ isSubmitting ? 'Processing...' : 'Proceed to Payment' }}
        </button>
      </form>
    </div> <!-- End of lg:grid -->

    <!-- Mock Payment Modal -->
    <div v-if="showMockPaymentModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out p-6 space-y-4">
        <h3 class="text-2xl font-serif text-peach-pink text-center">Confirm Mock Payment</h3>
        <p class="text-center text-venus-text-secondary">
          You are about to place an order for:
          <strong class="text-orange-gold">${{ cartFinalTotalPriceWithShipping.toFixed(2) }}</strong>
        </p>
        <p class="text-sm text-center text-gray-600">This is a simulated payment. No real transaction will occur.</p>
        <div class="flex justify-around mt-6">
          <button
            @click="executeOrderPlacement"
            :disabled="isPlacingOrderAfterMockPayment"
            class="px-6 py-3 bg-fresh-green text-white font-semibold rounded-md shadow hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-fresh-green disabled:opacity-60"
          >
            {{ isPlacingOrderAfterMockPayment ? 'Placing Order...' : 'Confirm Payment & Place Order' }}
          </button>
          <button
            @click="showMockPaymentModal = false"
            :disabled="isPlacingOrderAfterMockPayment"
            class="px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-md shadow hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        <p v-if="mockPaymentError" class="text-sm text-red-600 mt-3 text-center">{{ mockPaymentError }}</p>
      </div>
    </div>

    </div> <!-- Closing tag for <div v-else> associated with isLoadingAuthOrCart -->
  </ClientOnly> <!-- End of ClientOnly -->
</div> <!-- Closing tag for the main container div -->
</template>

<script setup>
import { ref, reactive, onMounted, watchEffect, computed } from 'vue';
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
  initCart,
  // Tax-related properties from useCart
  cartTotalTax,
  cartLineItemsWithTaxDetails,
  isFetchingTaxDetails, // To potentially show loading if taxes are being recalculated
  taxCalculationError,  // To show error if tax calculation failed
  calculatedDiscountAmount
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
const isSubmitting = ref(false); // Used for the "Proceed to Payment" button state
const submissionError = ref(''); // For errors before showing modal

const showMockPaymentModal = ref(false);
const isPlacingOrderAfterMockPayment = ref(false); // For the "Confirm Payment & Place Order" button state
const mockPaymentError = ref('');

const loadingShippingMethods = ref(false);
const shippingError = ref('');
const shippingMethods = ref([]);
const selectedShippingMethod = ref(null);

const showInitializingMessage = computed(() => {
  return !isCartStoreInitialized.value;
});

// Calculate total with shipping
const cartFinalTotalPriceWithShipping = computed(() => {
  const baseTotal = cartFinalTotalPrice.value;
  const shippingCost = selectedShippingMethod.value ? parseFloat(selectedShippingMethod.value.price) : 0;
  return baseTotal + shippingCost;
});

// Helper function to find tax details for a specific cart item (similar to cart.vue)
const getLineItemTaxCheckout = (cartItem) => {
  if (!cartLineItemsWithTaxDetails.value || cartLineItemsWithTaxDetails.value.length === 0) {
    return null;
  }
  const taxDetail = cartLineItemsWithTaxDetails.value.find(taxItem =>
    taxItem.product_id === cartItem.productId &&
    (taxItem.variant_id === cartItem.variantId || (taxItem.variant_id === null && cartItem.variantId === null))
  );
  return taxDetail ? parseFloat(taxDetail.line_item_tax_amount).toFixed(2) : null;
};


// Watchers for auth and cart initialization
watchEffect(() => {
    const authReady = typeof isAuthInitialized === 'undefined' ? true : isAuthInitialized.value;
    const cartReady = isCartStoreInitialized.value;

    if (authReady && cartReady) {
        isLoadingAuthOrCart.value = false;
        isAuthenticated.value = !!authToken.value;

        if (isAuthenticated.value && cartItems.value.length === 0) {
            router.replace('/cart');
        } else if (!isAuthenticated.value && cartItems.value.length === 0 && route.path === '/checkout') { // Ensure only redirect from checkout
            router.replace('/cart');
        }
    }
});

onMounted(() => {
  if (typeof initCart === 'function') {
      initCart();
  }
  fetchShippingMethods();
});

const fetchShippingMethods = async () => {
  loadingShippingMethods.value = true;
  shippingError.value = '';
  try {
    const response = await $axios.get('/shipping/options');
    shippingMethods.value = response.data.options || [];
    if (shippingMethods.value.length > 0 && !selectedShippingMethod.value) {
      selectedShippingMethod.value = shippingMethods.value[0];
    }
  } catch (error) {
    shippingError.value = error.response?.data?.message || error.message || 'Failed to load shipping methods';
    console.error('Error fetching shipping methods:', error);
  } finally {
    loadingShippingMethods.value = false;
  }
};

const selectShippingMethod = (method) => {
  selectedShippingMethod.value = method;
};

const validateForm = () => {
  submissionError.value = ''; // Clear previous errors
  if (!isAuthenticated.value) {
    if (!guestDetails.email || !guestDetails.firstName || !guestDetails.lastName) {
      submissionError.value = "Please fill in all guest information fields.";
      return false;
    }
  }
  // Add other address validations if necessary (though HTML 'required' handles some)
  if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
    submissionError.value = "Please fill in all required shipping address fields.";
    return false;
  }
  if (!sameAsShipping.value && (!billingAddress.line1 || !billingAddress.city || !billingAddress.postalCode || !billingAddress.country)) {
    submissionError.value = "Please fill in all required billing address fields.";
    return false;
  }
  if (!selectedShippingMethod.value) {
    submissionError.value = "Please select a shipping method.";
    return false;
  }
  return true;
};

const handlePlaceOrder = async (event) => { // Renamed from original handlePlaceOrder, now called by form submit
  if (!validateForm()) {
    return;
  }
  // Instead of submitting, show the mock payment modal
  isSubmitting.value = true; // Indicate processing for the "Proceed to Payment" button
  mockPaymentError.value = ''; // Clear previous mock payment errors
  // Simulate a brief delay as if validating payment details before showing modal
  await new Promise(resolve => setTimeout(resolve, 500));
  isSubmitting.value = false;
  showMockPaymentModal.value = true;
};

const executeOrderPlacement = async () => {
  isPlacingOrderAfterMockPayment.value = true;
  mockPaymentError.value = ''; // Clear previous errors specific to this modal step

  let orderPayload = {
    cartItems: cartItems.value.map(item => ({
      productId: item.productId,
      productVariantId: item.variantId || null,
      quantity: item.quantity,
    })),
    shippingAddress: { ...shippingAddress },
    billingAddress: sameAsShipping.value ? { ...shippingAddress } : { ...billingAddress },
    discount_code: appliedDiscount.value?.code || undefined,
    shipping_method_id: selectedShippingMethod.value?.id,
    shipping_cost: selectedShippingMethod.value ? parseFloat(selectedShippingMethod.value.price) : 0,
    // Add a flag to indicate mock payment was "successful"
    mock_payment_successful: true
  };

  if (!isAuthenticated.value) {
    // Guest details should have been validated by validateForm already
    orderPayload.guestDetails = { ...guestDetails };
  }

  try {
    const response = await $axios.post('/orders', orderPayload);

    if (response.status === 201 && response.data.order) {
      clearCart();
      showMockPaymentModal.value = false; // Close modal on success
      router.push(`/orders/thank-you?orderId=${response.data.order.id}`);
    } else {
      // This path might not be hit if server always returns error status codes for issues
      mockPaymentError.value = 'Failed to place order. Unexpected response from server.';
    }
  } catch (error) {
    mockPaymentError.value = error.response?.data?.message || 'An error occurred while placing your order.';
  } finally {
    isPlacingOrderAfterMockPayment.value = false;
  }
};

useHead({
  title: 'Checkout',
});
</script>

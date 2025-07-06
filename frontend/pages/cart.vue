<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-theme(spacing.16))]"> <!-- Page background will be white from layout -->
    <h2 class="text-3xl font-serif text-peach-pink mb-8 text-center">Your Shopping Cart</h2> <!-- Themed title -->
    <div v-if="!isCartInitialized" class="text-center py-8 px-4 bg-neutral-bg-soft rounded-lg border border-gray-200"> <!-- Themed placeholder bg -->
      Initializing cart...
    </div>
    <div v-else-if="cartItems.length === 0" class="text-center py-10 px-4 bg-neutral-bg-soft rounded-lg border border-gray-200"> <!-- Themed placeholder bg -->
      <p class="text-xl text-venus-text-secondary mb-4">Your cart is empty.</p>
      <NuxtLink to="/" class="bg-peach-pink text-white font-semibold py-3 px-6 rounded-md hover:bg-opacity-90 transition-colors duration-200 ease-in-out">Continue Shopping</NuxtLink> <!-- Themed button -->
    </div>
    <div v-else class="md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
      <ul class="md:col-span-2 list-none p-0 m-0">
        <li v-for="item in cartItems" :key="item.cartItemId" class="flex items-start gap-4 p-4 border border-gray-200 rounded-lg bg-white mb-4 shadow-sm relative">
          <template v-if="item.image_url">
            <img
              :src="sanitizeAttributeValue(item.image_url)"
              :alt="sanitizeAttributeValue(item.name)"
              class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-md bg-gray-100 flex-shrink-0" />
          </template>
          <template v-else>
            <div class="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-md bg-gray-100 flex-shrink-0 flex items-center justify-center text-venus-text-secondary text-sm">No Image</div>
          </template>

          <div class="flex-grow flex flex-col">
            <h3 class="text-lg font-semibold text-venus-text-primary mb-1" :title="sanitizeAttributeValue(item.name)">{{ item.name }}</h3>
            <p v-if="item.selectedVariantDescription" class="text-sm text-venus-text-secondary mb-1">{{ item.selectedVariantDescription }}</p>
            <p v-if="item.sku" class="text-xs text-venus-text-secondary mb-1">SKU: {{ sanitizeAttributeValue(item.sku) }}</p>
            <p class="text-sm text-venus-text-secondary">Unit Price: <span class="text-orange-gold">${{ (typeof item.price === 'number' ? item.price : 0).toFixed(2) }}</span></p>
            <p v-if="item.tax_class_name" class="text-xs text-venus-text-secondary mt-0.5">
              Tax Class: {{ item.tax_class_name }}
            </p>
            <p v-else-if="item.tax_class_id" class="text-xs text-venus-text-secondary mt-0.5">
              Tax Class ID: {{ item.tax_class_id }}
            </p>
            <div class="item-quantity my-2">
              <label :for="`quantity-${item.cartItemId}`" class="text-sm mr-2">Quantity:</label>
              <input
                type="number"
                :id="`quantity-${item.cartItemId}`"
                :value="item.quantity"
                @input="updateItemQuantity(item.cartItemId, parseInt($event.target.value))"
                min="1"
                class="quantity-input w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:ring-1 focus:ring-peach-pink focus:border-peach-pink"
              />
            </div>
            <div class="mt-auto pt-1">
              <p v-if="getLineItemTax(item) !== null && !isFetchingTaxDetails" class="text-xs text-venus-text-secondary">
                Item Tax: <span class="text-orange-gold/80">${{ getLineItemTax(item) }}</span>
              </p>
               <p v-if="isFetchingTaxDetails && !getLineItemTax(item)" class="text-xs text-venus-text-secondary animate-pulse">Calculating tax...</p>
              <p class="font-medium text-orange-gold">
                Subtotal for item: ${{
                  ((typeof item.price === 'number' ? item.price : 0) * (typeof item.quantity === 'number' ? item.quantity : 0)).toFixed(2)
                }}
              </p>
            </div>
          </div>
          <button @click="removeItem(item.cartItemId)" class="remove-item-button absolute top-3 right-3 text-red-500 hover:text-red-700 transition-colors duration-200 ease-in-out p-1 rounded-full hover:bg-red-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </li>
      </ul>
      <div class="cart-summary md:col-span-1 mt-6 md:mt-0 p-6 bg-neutral-bg-soft rounded-lg shadow border border-gray-200 h-fit sticky top-20"> <!-- Themed background and rounded -->
        <h3 class="text-xl font-serif text-peach-pink mb-4">Cart Summary</h3> <!-- Themed title -->
        <p class="flex justify-between text-venus-text-secondary"><span>Total Items:</span> <span>{{ cartTotalItems }}</span></p>
        <p class="flex justify-between text-venus-text-secondary mb-2"><span>Subtotal:</span> <span class="text-orange-gold font-medium">${{ cartSubtotal.toFixed(2) }}</span></p> <!-- Themed subtotal -->

        <div class="discount-section my-4 py-4 border-t border-b border-gray-200"> <!-- Adjusted border -->
          <div class="discount-form flex gap-2 mb-2">
            <input
              type="text"
              v-model="discountCodeInput"
              placeholder="Discount code"
              class="discount-input flex-grow px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink"
              :disabled="applyingDiscount"
            />
            <button
              @click="handleApplyDiscount"
              :disabled="applyingDiscount || !discountCodeInput"
              class="apply-discount-button px-4 py-2 bg-sky-blue text-white text-sm font-medium rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-blue/70 disabled:opacity-60 transition-colors duration-200 ease-in-out"
            >
              {{ applyingDiscount ? 'Applying...' : 'Apply' }}
            </button>
          </div>
          <p v-if="discountValidationError" class="text-sm text-red-600 mt-1">{{ discountValidationError }}</p>
          <div v-if="appliedDiscount" class="mt-2 p-2 bg-fresh-green/10 text-fresh-green rounded-md text-sm border border-fresh-green/20"> <!-- Themed discount applied message -->
            <div class="flex justify-between items-center">
              <span>
                Discount: <strong>{{ appliedDiscount.code }}</strong> (-${{ calculatedDiscountAmount.toFixed(2) }})
              </span>
              <button @click="handleRemoveDiscount" class="text-fresh-green hover:opacity-70 transition-opacity duration-200 ease-in-out text-xs underline disabled:opacity-60" :disabled="applyingDiscount">Remove</button>
            </div>
            <p v-if="appliedDiscount.description" class="text-xs mt-1">{{ appliedDiscount.description }}</p>
          </div>
        </div>

        <!-- Tax Information -->
        <div class="tax-info py-4 border-b border-gray-200"> <!-- Adjusted border -->
          <p v-if="isFetchingTaxDetails" class="text-sm text-venus-text-secondary animate-pulse">Calculating taxes...</p>
          <p v-if="taxCalculationError && !isFetchingTaxDetails" class="text-sm text-red-600">Error calculating tax: {{ taxCalculationError }}</p>
          <p v-if="!isFetchingTaxDetails && !taxCalculationError && cartItems.length > 0" class="flex justify-between text-venus-text-secondary">
            <span>Total Tax:</span>
            <span class="font-medium text-orange-gold/80">${{ cartTotalTax }}</span> <!-- Themed tax total -->
          </p>
        </div>

        <!-- Shipping Method Selection -->
        <div class="shipping-section py-4 border-b border-gray-200">
          <h4 class="text-sm font-medium text-venus-text-primary mb-3">Shipping Method</h4>
          
          <!-- Loading State -->
          <div v-if="loadingShippingMethods" class="flex justify-center items-center py-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-peach-pink"></div>
            <span class="ml-2 text-sm text-venus-text-secondary">Loading shipping options...</span>
          </div>

          <!-- Error State -->
          <div v-else-if="shippingError" class="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-2">
                <p class="text-xs text-red-800">{{ shippingError }}</p>
              </div>
            </div>
          </div>

          <!-- Shipping Methods -->
          <div v-else-if="shippingMethods.length === 0" class="text-center py-4">
            <p class="text-sm text-gray-500">No shipping methods available</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="method in shippingMethods"
              :key="method.id"
              class="relative border border-gray-200 rounded-md p-3 cursor-pointer transition-all duration-200 hover:border-peach-pink"
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
                    :id="`cart-shipping-${method.id}`"
                    :name="'cart-shipping-method'"
                    :value="method.id"
                    :checked="selectedShippingMethod?.id === method.id"
                    class="h-3 w-3 text-peach-pink border-gray-300 focus:ring-peach-pink"
                    @change="selectShippingMethod(method)"
                  />
                  <div class="ml-2">
                    <label :for="`cart-shipping-${method.id}`" class="text-sm font-medium text-venus-text-primary cursor-pointer">
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
                  <div class="text-sm font-bold text-orange-gold">${{ parseFloat(method.price).toFixed(2) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p class="flex justify-between text-xl font-bold text-orange-gold my-3 pt-3 border-t-2 border-peach-pink"> <!-- Themed grand total and border -->
          <span>Grand Total:</span>
          <span>${{ cartFinalTotalPriceWithShipping.toFixed(2) }}</span>
        </p>
        <div class="cart-actions mt-6 space-y-3">
          <NuxtLink
            :to="cartItems.length > 0 ? '/checkout' : '#'"
            :class="['block w-full text-center px-4 py-3 bg-peach-pink text-white font-semibold rounded-md shadow hover:bg-opacity-90 transition-colors duration-200 ease-in-out', { 'opacity-60 cursor-not-allowed': cartItems.length === 0 }]"
            @click="checkCartEmptyBeforeCheckout"
          > <!-- Themed button -->
            Proceed to Checkout
          </NuxtLink>
          <button
            @click="confirmClearCart"
            class="w-full px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors duration-200 ease-in-out"
          > <!-- Neutral clear button -->
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
import { useHead, useNuxtApp } from '#app';
import { sanitizeAttributeValue } from '~/utils/sanitize'; // Import the sanitizer

// CloseIcon import can be removed if SVG is directly in template for remove button
// import CloseIcon from '~/components/icons/CloseIcon.vue';

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
  applyDiscountCode,
  clearAppliedDiscount,
  appliedDiscount,
  discountValidationError,
  // Tax related properties from useCart
  cartTotalTax,
  cartLineItemsWithTaxDetails,
  isFetchingTaxDetails,
  taxCalculationError,
  calculatedDiscountAmount // To display the actual discount value
} = useCart();

const discountCodeInput = ref('');
const applyingDiscount = ref(false);

// Shipping method variables
const loadingShippingMethods = ref(false);
const shippingError = ref('');
const shippingMethods = ref([]);
const selectedShippingMethod = ref(null);

// Calculate total with shipping
const cartFinalTotalPriceWithShipping = computed(() => {
  const baseTotal = cartFinalTotalPrice.value;
  const shippingCost = selectedShippingMethod.value ? parseFloat(selectedShippingMethod.value.price) : 0;
  return baseTotal + shippingCost;
});

// Helper function to find tax details for a specific cart item
const getLineItemTax = (cartItem) => {
  if (!cartLineItemsWithTaxDetails.value || cartLineItemsWithTaxDetails.value.length === 0) {
    return null;
  }
  // The cartItem from cartItems ref has productId and variantId.
  // The items in cartLineItemsWithTaxDetails have product_id and variant_id.
  const taxDetail = cartLineItemsWithTaxDetails.value.find(taxItem =>
    taxItem.product_id === cartItem.productId &&
    (taxItem.variant_id === cartItem.variantId || (taxItem.variant_id === null && cartItem.variantId === null))
  );
  return taxDetail ? parseFloat(taxDetail.line_item_tax_amount).toFixed(2) : null;
};

const fetchShippingMethods = async () => {
  loadingShippingMethods.value = true;
  shippingError.value = '';
  try {
    const { $axios } = useNuxtApp();
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

onMounted(() => {
  // Ensure cart initialization logic is run when cart page is mounted,
  // especially for client-side navigations if app.vue's onMounted
  // doesn't cover all scenarios or if there's a reactivity lag.
  // initCart() has an internal guard so it only runs fully once.
  initCart();
  fetchShippingMethods();
});

const updateItemQuantity = (cartItemId, quantity) => {
  if (isNaN(quantity) || quantity < 0) return;
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

const handleApplyDiscount = async () => { // Added back
  if (!discountCodeInput.value.trim()) return;
  applyingDiscount.value = true;
  await applyDiscountCode(discountCodeInput.value.trim());
  applyingDiscount.value = false;
};

const handleRemoveDiscount = () => { // Added back
  clearAppliedDiscount();
  discountCodeInput.value = ''; // Clear input field as well
};

const checkCartEmptyBeforeCheckout = (event) => {
  if (cartItems.value.length === 0) {
    event.preventDefault();
    // Handle empty cart silently or show toast notification
  }
};

useHead({
  title: 'Shopping Cart',
});
</script>

<style scoped>
/* Styles from original cart.vue if any, or keep minimal */
</style>

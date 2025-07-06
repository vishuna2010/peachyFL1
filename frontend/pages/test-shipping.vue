<template>
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-theme(spacing.16))]">
    <h2 class="text-3xl font-serif text-peach-pink mb-8 text-center">Shipping Method Test</h2>
    
    <!-- Simulated Cart Items -->
    <div class="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 class="text-xl font-serif text-peach-pink mb-4">Simulated Cart Items</h3>
      <div class="space-y-4">
        <div v-for="item in simulatedCartItems" :key="item.cartItemId" class="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
          <div class="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center text-sm text-gray-500">Image</div>
          <div class="flex-grow">
            <h4 class="font-medium text-venus-text-primary">{{ item.name }}</h4>
            <p class="text-sm text-venus-text-secondary">Qty: {{ item.quantity }} | Price: ${{ item.price.toFixed(2) }}</p>
          </div>
          <div class="text-right">
            <p class="font-medium text-orange-gold">${{ (item.price * item.quantity).toFixed(2) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Shipping Method Selection -->
    <div class="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <h3 class="text-xl font-serif text-peach-pink mb-4">Shipping Method Selection</h3>
      
      <!-- Loading State -->
      <div v-if="loadingShippingMethods" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-peach-pink"></div>
        <span class="ml-3 text-venus-text-secondary">Loading shipping options...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="shippingError" class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading shipping methods</h3>
            <p class="text-sm text-red-700 mt-1">{{ shippingError }}</p>
          </div>
        </div>
      </div>

      <!-- Shipping Methods -->
      <div v-else-if="shippingMethods.length === 0" class="text-center py-8">
        <p class="text-gray-500">No shipping methods available</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="method in shippingMethods"
          :key="method.id"
          class="relative border border-gray-200 rounded-md p-4 cursor-pointer transition-all duration-200 hover:border-peach-pink"
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
                :id="`test-shipping-${method.id}`"
                :name="'test-shipping-method'"
                :value="method.id"
                :checked="selectedShippingMethod?.id === method.id"
                class="h-4 w-4 text-peach-pink border-gray-300 focus:ring-peach-pink"
                @change="selectShippingMethod(method)"
              />
              <div class="ml-3">
                <label :for="`test-shipping-${method.id}`" class="text-sm font-medium text-venus-text-primary cursor-pointer">
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

    <!-- Order Summary -->
    <div class="mt-8 p-6 bg-neutral-bg-soft rounded-lg shadow border border-gray-200">
      <h3 class="text-xl font-serif text-peach-pink mb-4">Order Summary</h3>
      <div class="space-y-2 text-sm">
        <p class="flex justify-between text-venus-text-secondary">
          <span>Subtotal:</span>
          <span class="font-medium text-orange-gold">${{ cartSubtotal.toFixed(2) }}</span>
        </p>
        <p v-if="selectedShippingMethod" class="flex justify-between text-venus-text-secondary">
          <span>Shipping ({{ selectedShippingMethod.name }}):</span>
          <span class="font-medium text-orange-gold">${{ parseFloat(selectedShippingMethod.price).toFixed(2) }}</span>
        </p>
        <div class="border-t border-gray-200 pt-2 mt-4">
          <p class="flex justify-between text-lg font-bold text-orange-gold">
            <span>Total:</span>
            <span>${{ cartTotalWithShipping.toFixed(2) }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Debug Info -->
    <div class="mt-8 p-4 bg-gray-50 rounded-lg">
      <h4 class="font-medium text-gray-700 mb-2">Debug Information</h4>
      <div class="text-xs text-gray-600 space-y-1">
        <p>Shipping Methods Count: {{ shippingMethods.length }}</p>
        <p>Selected Method: {{ selectedShippingMethod ? `${selectedShippingMethod.name} - $${selectedShippingMethod.price}` : 'None' }}</p>
        <p>Loading: {{ loadingShippingMethods }}</p>
        <p>Error: {{ shippingError || 'None' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useNuxtApp } from '#app';

// Simulated cart items
const simulatedCartItems = ref([
  {
    cartItemId: 'product-1',
    name: 'Test Product 1',
    price: 29.99,
    quantity: 2
  },
  {
    cartItemId: 'product-2',
    name: 'Test Product 2',
    price: 15.50,
    quantity: 1
  }
]);

// Shipping method variables
const loadingShippingMethods = ref(false);
const shippingError = ref('');
const shippingMethods = ref([]);
const selectedShippingMethod = ref(null);

// Calculate totals
const cartSubtotal = computed(() => {
  return simulatedCartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0);
});

const cartTotalWithShipping = computed(() => {
  const baseTotal = cartSubtotal.value;
  const shippingCost = selectedShippingMethod.value ? parseFloat(selectedShippingMethod.value.price) : 0;
  return baseTotal + shippingCost;
});

// Fetch shipping methods
const fetchShippingMethods = async () => {
  loadingShippingMethods.value = true;
  shippingError.value = '';
  
  try {
    const { $axios } = useNuxtApp();
    const response = await $axios.get('/shipping/options');
    shippingMethods.value = response.data.options || [];
    
    // Auto-select the first method if available
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
  fetchShippingMethods();
});
</script> 
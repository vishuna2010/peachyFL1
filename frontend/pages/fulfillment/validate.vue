<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b">
      <div class="max-w-md mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold text-gray-900">📦 Fulfillment Validation</h1>
          <button
            @click="showManualEntry = !showManualEntry"
            class="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {{ showManualEntry ? 'Hide' : 'Manual' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-md mx-auto px-4 py-6">
      <!-- Scanner Section -->
      <div v-if="!showManualEntry" class="mb-6">
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4 text-center">Scan QR Code</h2>
          <div class="bg-gray-100 rounded-lg p-8 text-center">
            <div class="text-gray-400 text-6xl mb-4">📱</div>
            <p class="text-gray-600 mb-2">Point camera at QR code on packing slip</p>
            <p class="text-xs text-gray-400">(Camera integration would be implemented here)</p>
          </div>
        </div>
      </div>

      <!-- Manual Entry Section -->
      <div v-if="showManualEntry" class="mb-6">
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Manual Code Entry</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Validation Code</label>
              <input
                v-model="manualCode"
                type="text"
                placeholder="Enter 8-character code"
                maxlength="8"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                @keyup.enter="validateCode"
              />
            </div>
            <button
              @click="validateCode"
              :disabled="!manualCode || manualCode.length !== 8 || isProcessing"
              class="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isProcessing ? 'Validating...' : 'Validate Fulfillment' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Validation Result -->
      <div v-if="validationResult" class="mb-6">
        <div :class="validationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'" 
             class="border rounded-lg p-4">
          <div class="flex items-center">
            <div :class="validationResult.success ? 'text-green-400' : 'text-red-400'" class="text-2xl mr-3">
              {{ validationResult.success ? '✅' : '❌' }}
            </div>
            <div>
              <h3 class="font-medium" :class="validationResult.success ? 'text-green-800' : 'text-red-800'">
                {{ validationResult.success ? 'Validation Successful' : 'Validation Failed' }}
              </h3>
              <p class="text-sm" :class="validationResult.success ? 'text-green-700' : 'text-red-700'">
                {{ validationResult.message }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Details (if validation successful) -->
      <div v-if="validationResult?.success && orderDetails" class="mb-6">
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Order Details</h3>
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Order ID:</span>
              <span class="text-sm font-medium">#{{ orderDetails.id }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Customer:</span>
              <span class="text-sm font-medium">{{ orderDetails.customer_name || 'N/A' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Items:</span>
              <span class="text-sm font-medium">{{ orderDetails.items?.length || 0 }} items</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600">Total:</span>
              <span class="text-sm font-medium">{{ formatCurrency(orderDetails.total_amount) }}</span>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Order Items:</h4>
            <div class="space-y-2">
              <div v-for="item in orderDetails.items" :key="item.order_item_id" 
                   class="flex justify-between text-sm">
                <span class="text-gray-600">{{ item.quantity }}x {{ item.product_name }}</span>
                <span class="font-medium">{{ formatCurrency(item.total_price) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Validations -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Recent Validations</h3>
        <div v-if="recentValidations.length === 0" class="text-center py-4">
          <p class="text-gray-500">No recent validations</p>
        </div>
        <div v-else class="space-y-3">
          <div v-for="validation in recentValidations" :key="validation.id" 
               class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p class="text-sm font-medium">Order #{{ validation.order_id }}</p>
              <p class="text-xs text-gray-500">{{ formatTime(validation.validated_at) }}</p>
            </div>
            <span class="text-green-600 text-sm">✅</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'vue-toastification';

definePageMeta({
  title: 'Fulfillment Validation'
});

const toast = useToast();
const { $axios } = useNuxtApp();

// Reactive data
const showManualEntry = ref(false);
const manualCode = ref('');
const isProcessing = ref(false);
const validationResult = ref(null);
const orderDetails = ref(null);
const recentValidations = ref([]);

// Validate code
const validateCode = async () => {
  if (!manualCode.value || manualCode.value.length !== 8) {
    toast.error('Please enter a valid 8-character code');
    return;
  }
  
  isProcessing.value = true;
  validationResult.value = null;
  orderDetails.value = null;
  
  try {
    const response = await $axios.post(`/fulfillment/validate/${manualCode.value}`, {
      validationMethod: 'manual'
    });
    
    validationResult.value = response.data;
    
    if (response.data.success) {
      orderDetails.value = response.data.order;
      manualCode.value = '';
      toast.success('Fulfillment validated successfully!');
      await loadRecentValidations();
    } else {
      toast.error(response.data.message || 'Validation failed');
    }
    
  } catch (err) {
    validationResult.value = {
      success: false,
      message: err.response?.data?.message || 'Validation failed'
    };
    toast.error(validationResult.value.message);
  } finally {
    isProcessing.value = false;
  }
};

// Load recent validations
const loadRecentValidations = async () => {
  try {
    const response = await $axios.get('/fulfillment/recent-validations');
    recentValidations.value = response.data.validations || [];
  } catch (err) {
    // Silently fail - not critical
  }
};

// Format currency
const formatCurrency = (amount) => {
  return amount ? Number(amount).toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }) : 'N/A';
};

// Format time
const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString();
};

// Load data on mount
onMounted(() => {
  loadRecentValidations();
});
</script> 
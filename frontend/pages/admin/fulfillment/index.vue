<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Fulfillment Validation</h1>
      <div class="flex space-x-3">
        <button
          @click="showScanner = !showScanner"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {{ showScanner ? 'Hide Scanner' : 'Show Scanner' }}
        </button>
        <button
          @click="refreshData"
          class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- QR Code Scanner Section -->
    <div v-if="showScanner" class="mb-8 bg-white rounded-lg shadow-md p-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">📱 QR Code Scanner</h2>
      <div class="text-center">
        <div class="max-w-md mx-auto">
          <div class="bg-gray-100 rounded-lg p-4 mb-4">
            <p class="text-sm text-gray-600 mb-2">Scan the QR code on the packing slip to validate fulfillment</p>
            <div class="bg-white rounded border-2 border-dashed border-gray-300 p-8">
              <div class="text-gray-400 text-6xl mb-4">📱</div>
              <p class="text-gray-500">Scanner Interface</p>
              <p class="text-xs text-gray-400 mt-2">(Would integrate with device camera)</p>
            </div>
          </div>
          
          <!-- Manual Code Entry -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-md font-medium text-gray-800 mb-2">Manual Code Entry</h3>
            <div class="flex space-x-2">
              <input
                v-model="manualCode"
                type="text"
                placeholder="Enter 8-character code"
                maxlength="8"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keyup.enter="validateManualCode"
              />
              <button
                @click="validateManualCode"
                :disabled="!manualCode || manualCode.length !== 8"
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Validation Status -->
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

    <!-- Pending Orders Section -->
    <div class="bg-white rounded-lg shadow-md">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">Pending Fulfillment Validation</h2>
      </div>
      
      <div v-if="isLoading" class="p-6 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <p class="mt-2 text-sm text-gray-500">Loading orders...</p>
      </div>
      
      <div v-else-if="error" class="p-6 text-center">
        <div class="text-red-600 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <p class="text-red-600">{{ error }}</p>
        <button @click="refreshData" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Try Again
        </button>
      </div>
      
      <div v-else-if="pendingOrders.length === 0" class="p-6 text-center">
        <div class="text-gray-400 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">All Orders Validated!</h3>
        <p class="text-gray-500">No pending orders require fulfillment validation.</p>
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validation Code</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="order in pendingOrders" :key="order.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <NuxtLink :to="`/admin/orders/${order.id}`" class="text-blue-600 hover:text-blue-800">
                  #{{ order.id }}
                </NuxtLink>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ order.customer_name || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span :class="getStatusClass(order.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ order.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div class="flex items-center space-x-2">
                  <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{{ order.fulfillment_validation_code }}</span>
                  <button
                    @click="showQRCode(order.fulfillment_validation_code)"
                    class="text-blue-600 hover:text-blue-800"
                    title="Show QR Code"
                  >
                    📱
                  </button>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(order.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  @click="validateOrder(order.fulfillment_validation_code)"
                  class="text-green-600 hover:text-green-900 mr-3"
                >
                  Validate
                </button>
                <NuxtLink :to="`/admin/orders/${order.id}`" class="text-blue-600 hover:text-blue-900">
                  View
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- QR Code Modal -->
    <div v-if="showQRModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3 text-center">
          <h3 class="text-lg font-medium text-gray-900 mb-4">QR Code for Validation</h3>
          <div class="bg-gray-100 p-4 rounded-lg">
            <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="QR Code" class="mx-auto w-48 h-48" />
            <p class="mt-2 text-sm text-gray-600">Scan this QR code to validate fulfillment</p>
            <p class="mt-1 font-mono text-sm bg-white px-2 py-1 rounded">{{ selectedValidationCode }}</p>
          </div>
          <div class="mt-4">
            <button
              @click="showQRModal = false"
              class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
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
  layout: 'admin',
  title: 'Fulfillment Validation'
});

const toast = useToast();
const { $axios } = useNuxtApp();

// Reactive data
const isLoading = ref(true);
const error = ref(null);
const pendingOrders = ref([]);
const showScanner = ref(false);
const manualCode = ref('');
const validationResult = ref(null);
const showQRModal = ref(false);
const selectedValidationCode = ref('');
const qrCodeDataUrl = ref('');

// Load pending orders
const loadPendingOrders = async () => {
  try {
    isLoading.value = true;
    error.value = null;
    
    const response = await $axios.get('/admin/orders', {
      params: {
        status: 'pending,processing',
        limit: 50
      }
    });
    
    // Filter orders that have validation codes but haven't been validated
    pendingOrders.value = response.data.data.filter(order => 
      order.fulfillment_validation_code && !order.fulfillment_validated_at
    );
    
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load pending orders';
    toast.error(error.value);
  } finally {
    isLoading.value = false;
  }
};

// Validate order by code
const validateOrder = async (validationCode) => {
  try {
    const response = await $axios.post(`/fulfillment/validate/${validationCode}`, {
      validationMethod: 'manual'
    });
    
    validationResult.value = response.data;
    toast.success(response.data.message);
    
    // Refresh the orders list
    await loadPendingOrders();
    
  } catch (err) {
    validationResult.value = {
      success: false,
      message: err.response?.data?.message || 'Validation failed'
    };
    toast.error(validationResult.value.message);
  }
};

// Validate manual code entry
const validateManualCode = async () => {
  if (!manualCode.value || manualCode.value.length !== 8) {
    toast.error('Please enter a valid 8-character code');
    return;
  }
  
  await validateOrder(manualCode.value);
  manualCode.value = '';
};

// Show QR code modal
const showQRCode = async (validationCode) => {
  try {
    selectedValidationCode.value = validationCode;
    const response = await $axios.get(`/fulfillment/qr-code/${validationCode}`);
    qrCodeDataUrl.value = response.data.qr_code_data_url;
    showQRModal.value = true;
  } catch (err) {
    toast.error('Failed to generate QR code');
  }
};

// Refresh data
const refreshData = () => {
  validationResult.value = null;
  loadPendingOrders();
};

// Format date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

// Get status class
const getStatusClass = (status) => {
  const classMap = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'processing': 'bg-blue-100 text-blue-800',
    'shipped': 'bg-purple-100 text-purple-800',
    'delivered': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  };
  return classMap[status] || 'bg-gray-100 text-gray-800';
};

// Load data on mount
onMounted(() => {
  loadPendingOrders();
});
</script> 
<template>
  <div class="min-h-screen bg-venus-background">
    <!-- Header -->
    <div class="bg-white shadow-md border-b border-neutral-medium">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="py-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-serif font-bold text-venus-text-primary">Order #{{ orderId }}</h1>
              <p class="mt-2 text-venus-text-secondary">Order details and tracking information</p>
            </div>
            <div class="flex items-center space-x-3">
              <a
                v-if="order && order.status !== 'cancelled'"
                :href="`/api/users/me/orders/${orderId}/invoice`"
                target="_blank"
                class="inline-flex items-center px-4 py-2 border border-neutral-medium rounded-md shadow-sm text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Download Invoice
              </a>
              <NuxtLink
                to="/profile/orders"
                class="inline-flex items-center px-4 py-2 border border-neutral-medium rounded-md shadow-sm text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light transition-colors"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to Orders
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-peach-pink"></div>
      </div>

      <!-- Order Details -->
      <div v-else-if="order" class="space-y-6">
        <!-- Order Status -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Order Status</h2>
          </div>
          <div class="p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-venus-text-secondary">Status</p>
                <span
                  :class="getStatusClass(order.status)"
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                >
                  {{ formatStatus(order.status) }}
                </span>
              </div>
              <div>
                <p class="text-sm font-medium text-venus-text-secondary">Payment Status</p>
                <span
                  :class="getPaymentStatusClass(order.payment_status)"
                  class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                >
                  {{ formatPaymentStatus(order.payment_status) }}
                </span>
              </div>
              <div>
                <p class="text-sm font-medium text-venus-text-secondary">Order Date</p>
                <p class="text-sm text-venus-text-secondary">{{ formatDate(order.order_date) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Order Summary</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 class="text-lg font-medium text-venus-text-primary mb-4">Order Items</h3>
                <div class="space-y-4">
                  <div
                    v-for="item in order.items"
                    :key="item.item_id"
                    class="flex items-center space-x-4 p-4 border border-neutral-medium rounded-lg hover:border-peach-pink transition-colors"
                  >
                    <img
                      v-if="item.image_url"
                      :src="item.image_url"
                      :alt="item.name"
                      class="w-16 h-16 object-cover rounded-md"
                    />
                    <div v-else class="w-16 h-16 bg-neutral-light rounded-md flex items-center justify-center">
                      <svg class="w-8 h-8 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <h4 class="text-sm font-medium text-venus-text-primary">{{ item.name }}</h4>
                      <p class="text-sm text-venus-text-secondary">SKU: {{ item.sku }}</p>
                      <p class="text-sm text-venus-text-secondary">Quantity: {{ item.quantity }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-medium text-venus-text-primary">${{ parseFloat(item.price_at_purchase).toFixed(2) }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-medium text-venus-text-primary mb-4">Order Totals</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Subtotal</span>
                    <span class="text-sm font-medium text-venus-text-primary">${{ parseFloat(order.subtotal).toFixed(2) }}</span>
                  </div>
                  
                  <div v-if="order.total_tax_amount > 0" class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Tax</span>
                    <span class="text-sm font-medium text-venus-text-primary">${{ parseFloat(order.total_tax_amount).toFixed(2) }}</span>
                  </div>
                  
                  <div v-if="order.discount_applied" class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Discount ({{ order.discount_applied.code }})</span>
                    <span class="text-sm font-medium text-red-600">-${{ parseFloat(order.discount_applied.amount_deducted).toFixed(2) }}</span>
                  </div>
                  
                  <div class="border-t border-neutral-medium pt-3">
                    <div class="flex justify-between">
                      <span class="text-base font-medium text-venus-text-primary">Total</span>
                      <span class="text-base font-bold text-venus-text-primary">${{ parseFloat(order.total_amount).toFixed(2) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Shipping Information -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Shipping Information</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 class="text-lg font-medium text-venus-text-primary mb-4">Shipping Address</h3>
                <div class="space-y-2">
                  <p class="text-sm text-venus-text-primary">{{ order.shipping_address.line1 }}</p>
                  <p v-if="order.shipping_address.line2" class="text-sm text-venus-text-primary">{{ order.shipping_address.line2 }}</p>
                  <p class="text-sm text-venus-text-primary">
                    {{ order.shipping_address.city }}, {{ order.shipping_address.postalCode }}
                  </p>
                  <p class="text-sm text-venus-text-primary">{{ order.shipping_address.country }}</p>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-medium text-venus-text-primary mb-4">Billing Address</h3>
                <div class="space-y-2">
                  <p class="text-sm text-venus-text-primary">{{ order.billing_address.line1 }}</p>
                  <p v-if="order.billing_address.line2" class="text-sm text-venus-text-primary">{{ order.billing_address.line2 }}</p>
                  <p class="text-sm text-venus-text-primary">
                    {{ order.billing_address.city }}, {{ order.billing_address.postalCode }}
                  </p>
                  <p class="text-sm text-venus-text-primary">{{ order.billing_address.country }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional Information -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Additional Information</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 class="text-lg font-medium text-venus-text-primary mb-4">Order Details</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Order Number</span>
                    <span class="text-sm font-medium text-venus-text-primary">#{{ order.id }}</span>
                  </div>
                  <div v-if="order.invoice_number" class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Invoice Number</span>
                    <span class="text-sm font-medium text-venus-text-primary">{{ order.invoice_number }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Order Date</span>
                    <span class="text-sm font-medium text-venus-text-primary">{{ formatDate(order.order_date) }}</span>
                  </div>
                  <div v-if="order.shipping_method" class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Shipping Method</span>
                    <span class="text-sm font-medium text-venus-text-primary">{{ order.shipping_method }}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-medium text-venus-text-primary mb-4">Payment Details</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Payment Method</span>
                    <span class="text-sm font-medium text-venus-text-primary">{{ order.payment_method || 'N/A' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Payment Status</span>
                    <span
                      :class="getPaymentStatusClass(order.payment_status)"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    >
                      {{ formatPaymentStatus(order.payment_status) }}
                    </span>
                  </div>
                  <div v-if="order.transaction_id" class="flex justify-between">
                    <span class="text-sm text-venus-text-secondary">Transaction ID</span>
                    <span class="text-sm font-medium text-venus-text-primary">{{ order.transaction_id }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <div class="text-red-600 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-venus-text-primary mb-2">Error Loading Order</h3>
        <p class="text-venus-text-secondary mb-4">{{ error }}</p>
        <button
          @click="loadOrder"
          class="px-4 py-2 bg-peach-pink text-white rounded-md hover:bg-peach-pink/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const orderId = route.params.id

// Reactive data
const loading = ref(true)
const order = ref(null)
const error = ref(null)

// Load order details
const loadOrder = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await $fetch(`/api/users/me/orders/${orderId}`)
    order.value = response.order
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load order details'
  } finally {
    loading.value = false
  }
}

// Format date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format status
const formatStatus = (status) => {
  const statusMap = {
    'pending': 'Pending',
    'processing': 'Processing',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  }
  return statusMap[status] || status
}

// Format payment status
const formatPaymentStatus = (status) => {
  const statusMap = {
    'pending': 'Pending',
    'paid': 'Paid',
    'partially_paid': 'Partially Paid',
    'refunded': 'Refunded',
    'partially_refunded': 'Partially Refunded',
    'failed': 'Failed',
    'cancelled': 'Cancelled',
    'voided': 'Voided'
  }
  return statusMap[status] || status
}

// Get status class
const getStatusClass = (status) => {
  const classMap = {
    'pending': 'bg-orange-gold/20 text-orange-gold',
    'processing': 'bg-sky-blue/20 text-sky-blue',
    'shipped': 'bg-purple-500/20 text-purple-600',
    'delivered': 'bg-fresh-green/20 text-fresh-green',
    'cancelled': 'bg-red-500/20 text-red-600',
    'refunded': 'bg-neutral-medium/20 text-neutral-medium'
  }
  return classMap[status] || 'bg-neutral-medium/20 text-neutral-medium'
}

// Get payment status class
const getPaymentStatusClass = (status) => {
  const classMap = {
    'pending': 'bg-orange-gold/20 text-orange-gold',
    'paid': 'bg-fresh-green/20 text-fresh-green',
    'partially_paid': 'bg-sky-blue/20 text-sky-blue',
    'refunded': 'bg-neutral-medium/20 text-neutral-medium',
    'partially_refunded': 'bg-orange-gold/20 text-orange-gold',
    'failed': 'bg-red-500/20 text-red-600',
    'cancelled': 'bg-red-500/20 text-red-600',
    'voided': 'bg-neutral-medium/20 text-neutral-medium'
  }
  return classMap[status] || 'bg-neutral-medium/20 text-neutral-medium'
}

// Load data on mount
onMounted(() => {
  loadOrder()
})
</script>

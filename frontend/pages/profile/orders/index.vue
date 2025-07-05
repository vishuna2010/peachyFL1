<template>
  <div class="min-h-screen bg-venus-background">
    <!-- Header -->
    <div class="bg-white shadow-md border-b border-neutral-medium">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="py-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-serif font-bold text-venus-text-primary">My Orders</h1>
              <p class="mt-2 text-venus-text-secondary">View and track all your orders</p>
            </div>
            <NuxtLink
              to="/profile"
              class="inline-flex items-center px-4 py-2 border border-neutral-medium rounded-md shadow-sm text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light transition-colors"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Profile
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-peach-pink"></div>
      </div>

      <!-- Orders Content -->
      <div v-else-if="orders" class="space-y-6">
        <!-- Filters -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center space-x-4">
              <label class="text-sm font-medium text-venus-text-secondary">Status:</label>
              <select
                v-model="filters.status"
                @change="loadOrders"
                class="border border-neutral-medium rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-peach-pink transition-colors"
              >
                <option value="">All Orders</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div class="text-sm text-venus-text-secondary">
              {{ orders.pagination.total }} orders total
            </div>
          </div>
        </div>

        <!-- Orders List -->
        <div v-if="orders.data.length === 0" class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-venus-text-primary">No orders found</h3>
          <p class="mt-1 text-sm text-venus-text-secondary">
            {{ filters.status ? `No ${filters.status} orders found.` : 'Start shopping to see your orders here.' }}
          </p>
          <div class="mt-6">
            <NuxtLink
              to="/products"
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-peach-pink/90 transition-colors"
            >
              Start Shopping
            </NuxtLink>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="order in orders.data"
            :key="order.id"
            class="bg-white rounded-lg shadow-md border border-neutral-medium hover:border-peach-pink hover:shadow-lg transition-all"
          >
            <div class="p-6">
              <!-- Order Header -->
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-lg font-semibold text-venus-text-primary">Order #{{ order.id }}</h3>
                  <p class="text-sm text-venus-text-secondary">{{ formatDate(order.order_date) }}</p>
                </div>
                <div class="text-right">
                  <p class="text-lg font-semibold text-venus-text-primary">${{ parseFloat(order.total_amount).toFixed(2) }}</p>
                  <span
                    :class="getStatusClass(order.status)"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ formatStatus(order.status) }}
                  </span>
                </div>
              </div>

              <!-- Order Details -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p class="text-sm font-medium text-venus-text-secondary">Items</p>
                  <p class="text-sm text-venus-text-secondary">{{ order.item_count }} items</p>
                </div>
                <div>
                  <p class="text-sm font-medium text-venus-text-secondary">Order Date</p>
                  <p class="text-sm text-venus-text-secondary">{{ formatDate(order.order_date) }}</p>
                </div>
                <div>
                  <p class="text-sm font-medium text-venus-text-secondary">Total</p>
                  <p class="text-sm text-venus-text-secondary">${{ parseFloat(order.total_amount).toFixed(2) }}</p>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-wrap gap-2">
                <NuxtLink
                  :to="`/profile/orders/${order.id}`"
                  class="inline-flex items-center px-3 py-2 border border-neutral-medium rounded-md text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light transition-colors"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                  View Details
                </NuxtLink>
                
                <a
                  v-if="order.status !== 'cancelled'"
                  :href="`/api/users/me/orders/${order.id}/invoice`"
                  target="_blank"
                  class="inline-flex items-center px-3 py-2 border border-neutral-medium rounded-md text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light transition-colors"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Download Invoice
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="orders.pagination.totalPages > 1" class="bg-white rounded-lg shadow-md border border-neutral-medium p-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-sm text-venus-text-secondary">
                Showing {{ (orders.pagination.page - 1) * orders.pagination.limit + 1 }} to 
                {{ Math.min(orders.pagination.page * orders.pagination.limit, orders.pagination.total) }} of 
                {{ orders.pagination.total }} results
              </span>
            </div>
            
            <div class="flex items-center space-x-2">
              <button
                @click="changePage(orders.pagination.page - 1)"
                :disabled="!orders.pagination.hasPrevPage"
                class="px-3 py-2 border border-neutral-medium rounded-md text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div class="flex items-center space-x-1">
                <button
                  v-for="page in getPageNumbers()"
                  :key="page"
                  @click="changePage(page)"
                  :class="[
                    'px-3 py-2 border rounded-md text-sm font-medium transition-colors',
                    page === orders.pagination.page
                      ? 'border-peach-pink bg-peach-pink/10 text-peach-pink'
                      : 'border-neutral-medium text-venus-text-secondary bg-white hover:bg-neutral-light'
                  ]"
                >
                  {{ page }}
                </button>
              </div>
              
              <button
                @click="changePage(orders.pagination.page + 1)"
                :disabled="!orders.pagination.hasNextPage"
                class="px-3 py-2 border border-neutral-medium rounded-md text-sm font-medium text-venus-text-secondary bg-white hover:bg-neutral-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
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
        <h3 class="text-lg font-medium text-venus-text-primary mb-2">Error Loading Orders</h3>
        <p class="text-venus-text-secondary mb-4">{{ error }}</p>
        <button
          @click="loadOrders"
          class="px-4 py-2 bg-peach-pink text-white rounded-md hover:bg-peach-pink/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

// Reactive data
const loading = ref(true)
const orders = ref(null)
const error = ref(null)
const filters = ref({
  status: '',
  page: 1,
  limit: 10
})

// Load orders
const loadOrders = async () => {
  try {
    loading.value = true
    error.value = null
    
    const queryParams = new URLSearchParams({
      page: filters.value.page.toString(),
      limit: filters.value.limit.toString()
    })
    
    if (filters.value.status) {
      queryParams.append('status', filters.value.status)
    }
    
    const { $axios } = useNuxtApp()
    const response = await $axios.get(`/users/me/orders?${queryParams}`)
    orders.value = response.data
  } catch (err) {
    console.error('Error loading orders:', err)
    error.value = err.response?.data?.message || 'Failed to load orders'
  } finally {
    loading.value = false
  }
}

// Change page
const changePage = (page) => {
  if (page >= 1 && page <= orders.value.pagination.totalPages) {
    filters.value.page = page
    loadOrders()
  }
}

// Get page numbers for pagination
const getPageNumbers = () => {
  if (!orders.value) return []
  
  const currentPage = orders.value.pagination.page
  const totalPages = orders.value.pagination.totalPages
  const pages = []
  
  // Always show first page
  pages.push(1)
  
  // Show pages around current page
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  
  if (start > 2) {
    pages.push('...')
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  if (end < totalPages - 1) {
    pages.push('...')
  }
  
  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages)
  }
  
  return pages.filter((page, index, array) => {
    if (page === '...') return true
    return array.indexOf(page) === index
  })
}

// Format date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
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

// Load data on mount
onMounted(() => {
  loadOrders()
})
</script> 
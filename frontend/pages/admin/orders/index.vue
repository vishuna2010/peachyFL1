<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Orders</h1>
    </div>

    <!-- Source Tabs -->
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ tab.label }}
            <span class="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
              {{ tab.count }}
            </span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Filters Section -->
    <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">Filters</h3>
        <button
          @click="clearFilters"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear all filters
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <!-- Order ID Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
          <input
            v-model="filters.order_id"
            type="number"
            placeholder="Enter order ID"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <!-- Customer Email Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
          <input
            v-model="filters.customer_email"
            type="email"
            placeholder="Enter customer email"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
          <select
            v-model="filters.status"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
          </select>
        </div>

        <!-- Payment Status Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
          <select
            v-model="filters.payment_status"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Payment Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="voided">Voided</option>
          </select>
        </div>

        <!-- Date From Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
          <input
            v-model="filters.date_from"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <!-- Date To Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
          <input
            v-model="filters.date_to"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <!-- Apply Filters Button -->
      <div class="mt-4 flex justify-end">
        <button
          @click="applyFilters"
          class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Apply Filters
        </button>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <div v-if="loading" class="p-6 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="mt-2 text-gray-500">Loading orders...</p>
      </div>

      <div v-else-if="error" class="p-6 text-center">
        <p class="text-red-600">{{ error }}</p>
        <button @click="fetchOrders" class="mt-2 text-indigo-600 hover:text-indigo-800">
          Try again
        </button>
      </div>

      <div v-else>
        <ul v-if="orders.length > 0" class="divide-y divide-gray-200">
          <li v-for="order in orders" :key="order.id" class="px-6 py-4 hover:bg-gray-50">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    Order #{{ order.id }}
                  </p>
                  <p class="text-sm text-gray-500">{{ order.user_email }}</p>
                  <p class="text-xs text-gray-400">
                    {{ formatDate(order.created_at) }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center space-x-4">
                <div class="text-right">
                  <p class="text-sm font-medium text-gray-900">
                    ${{ parseFloat(order.total_amount).toFixed(2) }}
                  </p>
                  <div class="flex items-center space-x-2 mt-1">
                    <span :class="getStatusBadgeClass(order.status)">
                      {{ formatStatus(order.status) }}
                    </span>
                    <span :class="getPaymentStatusBadgeClass(order.payment_status)">
                      {{ formatPaymentStatus(order.payment_status) }}
                    </span>
                    <span :class="getSourceBadgeClass(order.source)">
                      {{ formatSource(order.source) }}
                    </span>
                  </div>
                </div>
                
                <NuxtLink
                  :to="`/admin/orders/${order.id}`"
                  class="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                >
                  View Details →
                </NuxtLink>
              </div>
            </div>
          </li>
        </ul>

        <div v-else class="p-6 text-center">
          <p class="text-gray-500">No orders found.</p>
        </div>

        <!-- Pagination -->
        <div v-if="pagination && pagination.totalPages > 1" class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              @click="changePage(pagination.page - 1)"
              :disabled="pagination.page <= 1"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              @click="changePage(pagination.page + 1)"
              :disabled="pagination.page >= pagination.totalPages"
              class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Showing
                <span class="font-medium">{{ (pagination.page - 1) * pagination.limit + 1 }}</span>
                to
                <span class="font-medium">{{ Math.min(pagination.page * pagination.limit, pagination.total) }}</span>
                of
                <span class="font-medium">{{ pagination.total }}</span>
                results
              </p>
            </div>
            <div>
              <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  @click="changePage(pagination.page - 1)"
                  :disabled="pagination.page <= 1"
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  v-for="pageNum in getPageNumbers()"
                  :key="pageNum"
                  @click="changePage(pageNum)"
                  :class="[
                    'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                    pageNum === pagination.page
                      ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  ]"
                >
                  {{ pageNum }}
                </button>
                <button
                  @click="changePage(pagination.page + 1)"
                  :disabled="pagination.page >= pagination.totalPages"
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useNuxtApp } from '#app'

// Page meta
definePageMeta({
  layout: 'admin',
  title: 'Order Management'
})

const router = useRouter()
const route = useRoute()
const { $axios } = useNuxtApp()

// Reactive data
const orders = ref([])
const loading = ref(false)
const error = ref(null)
const pagination = ref(null)
const activeTab = ref('all')

// Filter state
const filters = ref({
  order_id: '',
  customer_email: '',
  status: '',
  payment_status: '',
  date_from: '',
  date_to: ''
})

// Tab counts
const allOrdersCount = ref(0)
const onlineOrdersCount = ref(0)
const posOrdersCount = ref(0)

// Computed tabs with counts
const tabs = computed(() => [
  { key: 'all', label: 'All Orders', count: allOrdersCount.value },
  { key: 'online', label: 'Online Orders', count: onlineOrdersCount.value },
  { key: 'pos', label: 'POS Orders', count: posOrdersCount.value }
])

// Watch for route changes to sync with URL params
watch(() => route.query, (newQuery) => {
  // Update active tab from URL
  if (newQuery.source) {
    activeTab.value = newQuery.source
  } else {
    activeTab.value = 'all'
  }
  
  // Update filters from URL
  filters.value = {
    order_id: newQuery.order_id || '',
    customer_email: newQuery.customer_email || '',
    status: newQuery.status || '',
    payment_status: newQuery.payment_status || '',
    date_from: newQuery.date_from || '',
    date_to: newQuery.date_to || ''
  }
}, { immediate: true })

// Fetch orders with current filters
const fetchOrders = async () => {
  loading.value = true
  error.value = null
  
  try {
    const params = new URLSearchParams()
    
    // Add pagination params
    if (pagination.value) {
      params.append('page', pagination.value.page.toString())
      params.append('limit', pagination.value.limit.toString())
    } else {
      params.append('page', '1')
      params.append('limit', '10')
    }
    
    // Add source filter based on active tab
    if (activeTab.value !== 'all') {
      params.append('source', activeTab.value)
    }
    
    // Add other filters
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value) {
        params.append(key, value)
      }
    })
    
    console.log('Fetching orders with params:', params.toString())
    const response = await $axios.get(`/admin/orders?${params.toString()}`)
    console.log('Orders response:', response.data)
    
    orders.value = response.data.data
    pagination.value = response.data.pagination
    
    console.log('Orders loaded:', orders.value.length, 'orders')
    console.log('Pagination:', pagination.value)
    
    // Update URL without triggering navigation
    const newQuery = { ...route.query }
    if (activeTab.value !== 'all') {
      newQuery.source = activeTab.value
    } else {
      delete newQuery.source
    }
    
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value) {
        newQuery[key] = value
      } else {
        delete newQuery[key]
      }
    })
    
    await router.replace({ query: newQuery })
    
  } catch (err) {
    console.error('Error fetching orders:', err)
    error.value = err.message || 'Failed to fetch orders'
  } finally {
    loading.value = false
  }
}

// Fetch order counts for tabs
const fetchOrderCounts = async () => {
  try {
    console.log('Fetching order counts...')
    
    // Fetch all orders count
    const allResponse = await $axios.get('/admin/orders?limit=1')
    allOrdersCount.value = allResponse.data.pagination.total
    console.log('All orders count:', allOrdersCount.value)
    
    // Fetch online orders count
    const onlineResponse = await $axios.get('/admin/orders?source=online&limit=1')
    onlineOrdersCount.value = onlineResponse.data.pagination.total
    console.log('Online orders count:', onlineOrdersCount.value)
    
    // Fetch POS orders count
    const posResponse = await $axios.get('/admin/orders?source=pos&limit=1')
    posOrdersCount.value = posResponse.data.pagination.total
    console.log('POS orders count:', posOrdersCount.value)
    
  } catch (err) {
    console.error('Error fetching order counts:', err)
  }
}

// Change page
const changePage = (page) => {
  if (!pagination.value) return
  
  pagination.value.page = page
  fetchOrders()
}

// Apply filters
const applyFilters = () => {
  // Reset to first page when applying filters
  if (pagination.value) {
    pagination.value.page = 1
  }
  fetchOrders()
}

// Clear all filters
const clearFilters = () => {
  filters.value = {
    order_id: '',
    customer_email: '',
    status: '',
    payment_status: '',
    date_from: '',
    date_to: ''
  }
  applyFilters()
}

// Get page numbers for pagination
const getPageNumbers = () => {
  if (!pagination.value) return []
  
  const current = pagination.value.page
  const total = pagination.value.totalPages
  const delta = 2
  
  const range = []
  const rangeWithDots = []
  
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i)
  }
  
  if (current - delta > 2) {
    rangeWithDots.push(1, '...')
  } else {
    rangeWithDots.push(1)
  }
  
  rangeWithDots.push(...range)
  
  if (current + delta < total - 1) {
    rangeWithDots.push('...', total)
  } else {
    rangeWithDots.push(total)
  }
  
  return rangeWithDots
}

// Format functions
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatStatus = (status) => {
  const statusMap = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    partially_refunded: 'Partially Refunded'
  }
  return statusMap[status] || status
}

const formatPaymentStatus = (paymentStatus) => {
  const paymentStatusMap = {
    pending: 'Pending',
    paid: 'Paid',
    partially_paid: 'Partially Paid',
    refunded: 'Refunded',
    partially_refunded: 'Partially Refunded',
    failed: 'Failed',
    cancelled: 'Cancelled',
    voided: 'Voided'
  }
  return paymentStatusMap[paymentStatus] || paymentStatus
}

const formatSource = (source) => {
  return source === 'pos' ? 'POS' : 'Online'
}

// Badge classes
const getStatusBadgeClass = (status) => {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
    partially_refunded: 'bg-orange-100 text-orange-800'
  }
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes[status] || 'bg-gray-100 text-gray-800'}`
}

const getPaymentStatusBadgeClass = (paymentStatus) => {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    partially_paid: 'bg-orange-100 text-orange-800',
    refunded: 'bg-gray-100 text-gray-800',
    partially_refunded: 'bg-orange-100 text-orange-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-red-100 text-red-800',
    voided: 'bg-gray-100 text-gray-800'
  }
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes[paymentStatus] || 'bg-gray-100 text-gray-800'}`
}

const getSourceBadgeClass = (source) => {
  const classes = {
    online: 'bg-blue-100 text-blue-800',
    pos: 'bg-green-100 text-green-800'
  }
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes[source] || 'bg-gray-100 text-gray-800'}`
}

// Watch for tab changes
watch(activeTab, () => {
  fetchOrders()
})

// Initialize
onMounted(async () => {
  await fetchOrderCounts()
  await fetchOrders()
})
</script>

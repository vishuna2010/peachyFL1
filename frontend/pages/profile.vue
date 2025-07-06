<template>
  <div class="min-h-screen bg-venus-background">
    <!-- Header -->
    <div class="bg-white shadow-md border-b border-neutral-medium">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="py-8">
          <h1 class="text-3xl font-serif font-bold text-venus-text-primary">My Profile</h1>
          <p class="mt-2 text-venus-text-secondary">Manage your account, view orders, and update your information</p>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-peach-pink"></div>
      </div>

      <!-- Dashboard Content -->
      <div v-else-if="dashboard" class="space-y-8">
        <!-- Profile Section -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Profile Information</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-venus-text-secondary mb-2">Name</label>
                <input
                  v-model="profileForm.name"
                  type="text"
                  class="w-full px-3 py-2 border border-neutral-medium rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-peach-pink transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-venus-text-secondary mb-2">Email</label>
                <input
                  :value="dashboard.user.email"
                  type="email"
                  disabled
                  class="w-full px-3 py-2 border border-neutral-medium rounded-md bg-neutral-light text-venus-text-secondary"
                />
              </div>
            </div>
            <div class="mt-6 flex justify-end">
              <button
                @click="updateProfile"
                :disabled="updating"
                class="px-6 py-2 bg-peach-pink text-white rounded-md hover:bg-peach-pink/90 disabled:opacity-50 transition-colors font-medium"
              >
                {{ updating ? 'Updating...' : 'Update Profile' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white rounded-lg shadow-md border border-neutral-medium p-6 hover:shadow-lg transition-shadow">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-peach-pink/20 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-peach-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-venus-text-secondary">Total Orders</p>
                <p class="text-2xl font-bold text-venus-text-primary">{{ dashboard.order_statistics.total_orders }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md border border-neutral-medium p-6 hover:shadow-lg transition-shadow">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-fresh-green/20 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-fresh-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-venus-text-secondary">Completed</p>
                <p class="text-2xl font-bold text-venus-text-primary">{{ dashboard.order_statistics.completed_orders }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md border border-neutral-medium p-6 hover:shadow-lg transition-shadow">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-orange-gold/20 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-orange-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-venus-text-secondary">Active Orders</p>
                <p class="text-2xl font-bold text-venus-text-primary">{{ dashboard.order_statistics.active_orders }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md border border-neutral-medium p-6 hover:shadow-lg transition-shadow">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-sky-blue/20 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-sky-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-venus-text-secondary">Total Spent</p>
                <p class="text-2xl font-bold text-venus-text-primary">${{ dashboard.order_statistics.total_spent.toFixed(2) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Quick Actions</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <NuxtLink
                to="/profile/orders"
                class="flex items-center p-4 border border-neutral-medium rounded-lg hover:border-peach-pink hover:shadow-md transition-all group"
              >
                <div class="w-10 h-10 bg-peach-pink/20 rounded-full flex items-center justify-center mr-4 group-hover:bg-peach-pink/30 transition-colors">
                  <svg class="w-6 h-6 text-peach-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-venus-text-primary group-hover:text-peach-pink transition-colors">View All Orders</h3>
                  <p class="text-sm text-venus-text-secondary">Check your complete order history</p>
                </div>
              </NuxtLink>

              <NuxtLink
                to="/profile/addresses"
                class="flex items-center p-4 border border-neutral-medium rounded-lg hover:border-peach-pink hover:shadow-md transition-all group"
              >
                <div class="w-10 h-10 bg-sky-blue/20 rounded-full flex items-center justify-center mr-4 group-hover:bg-sky-blue/30 transition-colors">
                  <svg class="w-6 h-6 text-sky-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-venus-text-primary group-hover:text-peach-pink transition-colors">Manage Addresses</h3>
                  <p class="text-sm text-venus-text-secondary">Update your shipping addresses</p>
                </div>
              </NuxtLink>

              <NuxtLink
                to="/profile/2fa-setup"
                class="flex items-center p-4 border border-neutral-medium rounded-lg hover:border-peach-pink hover:shadow-md transition-all group"
              >
                <div class="w-10 h-10 bg-orange-gold/20 rounded-full flex items-center justify-center mr-4 group-hover:bg-orange-gold/30 transition-colors">
                  <svg class="w-6 h-6 text-orange-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-venus-text-primary group-hover:text-peach-pink transition-colors">Setup 2FA</h3>
                  <p class="text-sm text-venus-text-secondary">Enable two-factor authentication</p>
                </div>
              </NuxtLink>

              <NuxtLink
                to="/products"
                class="flex items-center p-4 border border-neutral-medium rounded-lg hover:border-peach-pink hover:shadow-md transition-all group"
              >
                <div class="w-10 h-10 bg-fresh-green/20 rounded-full flex items-center justify-center mr-4 group-hover:bg-fresh-green/30 transition-colors">
                  <svg class="w-6 h-6 text-fresh-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="font-medium text-venus-text-primary group-hover:text-peach-pink transition-colors">Continue Shopping</h3>
                  <p class="text-sm text-venus-text-secondary">Browse our latest products</p>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Recent Orders -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium flex justify-between items-center">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Recent Orders</h2>
            <NuxtLink
              to="/profile/orders"
              class="text-sm text-peach-pink hover:text-peach-pink/80 font-medium transition-colors"
            >
              View All
            </NuxtLink>
          </div>
          <div class="p-6">
            <div v-if="dashboard.recent_orders.length === 0" class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-neutral-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-venus-text-primary">No orders yet</h3>
              <p class="mt-1 text-sm text-venus-text-secondary">Start shopping to see your orders here.</p>
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
                v-for="order in dashboard.recent_orders"
                :key="order.id"
                class="border border-neutral-medium rounded-lg p-4 hover:border-peach-pink hover:shadow-md transition-all"
              >
                <div class="flex justify-between items-start">
                  <div>
                    <p class="text-sm font-medium text-venus-text-primary">Order #{{ order.id }}</p>
                    <p class="text-sm text-venus-text-secondary">{{ formatDate(order.order_date) }}</p>
                    <p class="text-sm text-venus-text-secondary">{{ order.item_count }} items</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium text-venus-text-primary">${{ parseFloat(order.total_amount).toFixed(2) }}</p>
                    <span
                      :class="getStatusClass(order.status)"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    >
                      {{ formatStatus(order.status) }}
                    </span>
                  </div>
                </div>
                <div class="mt-3 flex justify-end">
                  <NuxtLink
                    :to="`/profile/orders/${order.id}`"
                    class="text-sm text-peach-pink hover:text-peach-pink/80 font-medium transition-colors"
                  >
                    View Details
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Security Settings -->
        <div class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Security Settings</h2>
          </div>
          <div class="p-6">
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <div class="flex items-center">
                  <div class="w-10 h-10 bg-orange-gold/20 rounded-full flex items-center justify-center mr-4">
                    <svg class="w-6 h-6 text-orange-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="font-medium text-venus-text-primary">Two-Factor Authentication</h3>
                    <p class="text-sm text-venus-text-secondary">
                      {{ dashboard.user.two_factor_enabled ? 'Enabled' : 'Not enabled' }}
                    </p>
                  </div>
                </div>
                <NuxtLink
                  to="/profile/2fa-setup"
                  class="text-sm text-peach-pink hover:text-peach-pink/80 font-medium transition-colors"
                >
                  {{ dashboard.user.two_factor_enabled ? 'Manage' : 'Setup' }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- Default Shipping Address -->
        <div v-if="dashboard.default_shipping_address" class="bg-white rounded-lg shadow-md border border-neutral-medium">
          <div class="px-6 py-4 border-b border-neutral-medium">
            <h2 class="text-xl font-serif font-semibold text-venus-text-primary">Default Shipping Address</h2>
          </div>
          <div class="p-6">
            <div class="flex justify-between items-start">
              <div>
                <p class="text-sm font-medium text-venus-text-primary">{{ dashboard.default_shipping_address.name }}</p>
                <p class="text-sm text-venus-text-secondary">{{ dashboard.default_shipping_address.line1 }}</p>
                <p v-if="dashboard.default_shipping_address.line2" class="text-sm text-venus-text-secondary">{{ dashboard.default_shipping_address.line2 }}</p>
                <p class="text-sm text-venus-text-secondary">
                  {{ dashboard.default_shipping_address.city }}, {{ dashboard.default_shipping_address.state_province }} {{ dashboard.default_shipping_address.postal_code }}
                </p>
                <p class="text-sm text-venus-text-secondary">{{ dashboard.default_shipping_address.country }}</p>
              </div>
              <NuxtLink
                to="/profile/addresses"
                class="text-sm text-peach-pink hover:text-peach-pink/80 font-medium transition-colors"
              >
                Edit
              </NuxtLink>
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
        <h3 class="text-lg font-medium text-venus-text-primary mb-2">Error Loading Profile</h3>
        <p class="text-venus-text-secondary mb-4">{{ error }}</p>
        <button
          @click="loadDashboard"
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
import { useToast } from 'vue-toastification'

const toast = useToast()

// Reactive data
const loading = ref(true)
const updating = ref(false)
const dashboard = ref(null)
const error = ref(null)
const profileForm = ref({
  name: ''
})

// Load dashboard data
const loadDashboard = async () => {
  try {
    loading.value = true
    error.value = null
    
    const { $axios } = useNuxtApp()
    const response = await $axios.get('/users/me/dashboard')
    dashboard.value = response.data.dashboard
    profileForm.value.name = dashboard.value.user.name || ''
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load profile data'
  } finally {
    loading.value = false
  }
}

// Update profile
const updateProfile = async () => {
  try {
    updating.value = true
    
    const { $axios } = useNuxtApp()
    const response = await $axios.put('/users/me/profile', profileForm.value)
    
    toast.success('Profile updated successfully')
    await loadDashboard() // Reload to get updated data
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update profile')
  } finally {
    updating.value = false
  }
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
  loadDashboard()
})
</script>

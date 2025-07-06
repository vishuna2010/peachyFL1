<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Email Unsubscribes</h1>
      <p class="text-gray-600 mt-2">Manage user email preferences and unsubscribe lists</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <StatCard
        title="Total Unsubscribes"
        :value="stats.totalUnsubscribes"
        iconName="Unsubscribes"
        iconBackgroundClass="bg-red-100 text-red-600"
      />
      <StatCard
        title="Marketing Unsubscribes"
        :value="stats.marketingUnsubscribes"
        iconName="Marketing"
        iconBackgroundClass="bg-orange-100 text-orange-600"
      />
      <StatCard
        title="Transactional Unsubscribes"
        :value="stats.transactionalUnsubscribes"
        iconName="Transactional"
        iconBackgroundClass="bg-yellow-100 text-yellow-600"
      />
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="p-4 border-b border-gray-200">
        <div class="flex flex-wrap gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Type</label>
            <select
              v-model="filters.emailType"
              class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="marketing">Marketing</option>
              <option value="transactional">Transactional</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              v-model="filters.status"
              class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="resubscribed">Resubscribed</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search by email..."
              class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Unsubscribes List -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">Unsubscribe List</h2>
          <div class="flex space-x-2">
            <button
              @click="exportUnsubscribes"
              :disabled="exporting"
              class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {{ exporting ? 'Exporting...' : 'Export CSV' }}
            </button>
            <button
              @click="refreshData"
              :disabled="loading"
              class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-6">
        <div class="animate-pulse space-y-4">
          <div v-for="i in 5" :key="i" class="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>

      <div v-else-if="filteredUnsubscribes.length === 0" class="p-6 text-center text-gray-500">
        No unsubscribes found matching your criteria.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email Type
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unsubscribed Date
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="unsubscribe in paginatedUnsubscribes"
              :key="unsubscribe.id"
              class="hover:bg-gray-50"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ unsubscribe.user_name || 'N/A' }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ unsubscribe.email }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                  :class="{
                    'bg-blue-100 text-blue-800': unsubscribe.email_type === 'marketing',
                    'bg-green-100 text-green-800': unsubscribe.email_type === 'transactional'
                  }"
                >
                  {{ unsubscribe.email_type }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                  :class="{
                    'bg-red-100 text-red-800': unsubscribe.status === 'unsubscribed',
                    'bg-green-100 text-green-800': unsubscribe.status === 'resubscribed'
                  }"
                >
                  {{ unsubscribe.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(unsubscribe.unsubscribed_at) }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ unsubscribe.reason || 'No reason provided' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  v-if="unsubscribe.status === 'unsubscribed'"
                  @click="resubscribeUser(unsubscribe)"
                  class="text-green-600 hover:text-green-900"
                >
                  Resubscribe
                </button>
                <button
                  @click="viewUserDetails(unsubscribe)"
                  class="text-blue-600 hover:text-blue-900 ml-3"
                >
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-6 py-3 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-700">
            Showing {{ startIndex + 1 }} to {{ endIndex }} of {{ filteredUnsubscribes.length }} results
          </div>
          <div class="flex space-x-2">
            <button
              @click="currentPage--"
              :disabled="currentPage === 1"
              class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <span class="px-3 py-1 text-sm text-gray-700">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button
              @click="currentPage++"
              :disabled="currentPage === totalPages"
              class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Details Modal -->
    <Modal v-if="selectedUser" @close="selectedUser = null">
      <div class="p-6 max-w-2xl">
        <h3 class="text-lg font-semibold mb-4">User Email Preferences</h3>
        
        <div class="space-y-4">
          <div>
            <h4 class="font-medium text-gray-900 mb-2">User Information</h4>
            <div class="bg-gray-50 p-4 rounded-md">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div><span class="font-medium">Name:</span> {{ selectedUser.user_name || 'N/A' }}</div>
                <div><span class="font-medium">Email:</span> {{ selectedUser.email }}</div>
                <div><span class="font-medium">User ID:</span> {{ selectedUser.user_id }}</div>
                <div><span class="font-medium">Member Since:</span> {{ formatDate(selectedUser.user_created_at) }}</div>
              </div>
            </div>
          </div>

          <div>
            <h4 class="font-medium text-gray-900 mb-2">Email Preferences</h4>
            <div class="space-y-2">
              <div
                v-for="preference in selectedUser.preferences"
                :key="preference.email_type"
                class="flex items-center justify-between p-3 border border-gray-200 rounded-md"
              >
                <div>
                  <div class="font-medium capitalize">{{ preference.email_type }} Emails</div>
                  <div class="text-sm text-gray-500">{{ preference.description }}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <span
                    class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                    :class="{
                      'bg-green-100 text-green-800': preference.subscribed,
                      'bg-red-100 text-red-800': !preference.subscribed
                    }"
                  >
                    {{ preference.subscribed ? 'Subscribed' : 'Unsubscribed' }}
                  </span>
                  <button
                    v-if="!preference.subscribed"
                    @click="resubscribeUserType(selectedUser, preference.email_type)"
                    class="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    Resubscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button
            @click="selectedUser = null"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import StatCard from '~/components/admin/StatCard.vue'
import Modal from '~/components/common/Modal.vue'

const toast = useToast()
const { apiFetch } = useApi()

definePageMeta({
  layout: 'admin',
  title: 'Email Unsubscribes'
})

// Data
const unsubscribes = ref([])
const stats = ref({
  totalUnsubscribes: 0,
  marketingUnsubscribes: 0,
  transactionalUnsubscribes: 0
})
const loading = ref(false)
const exporting = ref(false)
const selectedUser = ref(null)
const currentPage = ref(1)
const itemsPerPage = 20

const filters = ref({
  emailType: '',
  status: '',
  search: ''
})

// Computed
const filteredUnsubscribes = computed(() => {
  let filtered = unsubscribes.value

  if (filters.value.emailType) {
    filtered = filtered.filter(u => u.email_type === filters.value.emailType)
  }

  if (filters.value.status) {
    filtered = filtered.filter(u => u.status === filters.value.status)
  }

  if (filters.value.search) {
    const search = filters.value.search.toLowerCase()
    filtered = filtered.filter(u => 
      u.email.toLowerCase().includes(search) ||
      (u.user_name && u.user_name.toLowerCase().includes(search))
    )
  }

  return filtered
})

const totalPages = computed(() => Math.ceil(filteredUnsubscribes.value.length / itemsPerPage))

const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage)
const endIndex = computed(() => Math.min(startIndex.value + itemsPerPage, filteredUnsubscribes.value.length))

const paginatedUnsubscribes = computed(() => {
  return filteredUnsubscribes.value.slice(startIndex.value, endIndex.value)
})

// Methods
const fetchUnsubscribes = async () => {
  loading.value = true
  try {
    const response = await apiFetch('/api/admin/email-unsubscribes')
    unsubscribes.value = response.unsubscribes || []
    stats.value = response.stats || {
      totalUnsubscribes: 0,
      marketingUnsubscribes: 0,
      transactionalUnsubscribes: 0
    }
  } catch (error) {
    console.error('Error fetching unsubscribes:', error)
    toast.error('Failed to load unsubscribes')
  } finally {
    loading.value = false
  }
}

const resubscribeUser = async (unsubscribe) => {
  try {
    await apiFetch(`/api/email/resubscribe`, {
      method: 'POST',
      body: {
        email: unsubscribe.email,
        email_type: unsubscribe.email_type
      }
    })
    toast.success('User resubscribed successfully')
    await fetchUnsubscribes()
  } catch (error) {
    console.error('Error resubscribing user:', error)
    toast.error('Failed to resubscribe user')
  }
}

const resubscribeUserType = async (user, emailType) => {
  try {
    await apiFetch(`/api/email/resubscribe`, {
      method: 'POST',
      body: {
        email: user.email,
        email_type: emailType
      }
    })
    toast.success('User resubscribed successfully')
    selectedUser.value = null
    await fetchUnsubscribes()
  } catch (error) {
    console.error('Error resubscribing user:', error)
    toast.error('Failed to resubscribe user')
  }
}

const viewUserDetails = async (unsubscribe) => {
  try {
    const response = await apiFetch(`/api/admin/email-unsubscribes/user/${unsubscribe.user_id}`)
    selectedUser.value = response.user
  } catch (error) {
    console.error('Error fetching user details:', error)
    toast.error('Failed to load user details')
  }
}

const exportUnsubscribes = async () => {
  exporting.value = true
  try {
    const response = await apiFetch('/api/admin/email-unsubscribes/export', {
      method: 'POST',
      body: { filters: filters.value }
    })
    
    // Create and download CSV file
    const blob = new Blob([response.csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `unsubscribes-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    toast.success('Export completed successfully')
  } catch (error) {
    console.error('Error exporting unsubscribes:', error)
    toast.error('Failed to export unsubscribes')
  } finally {
    exporting.value = false
  }
}

const refreshData = () => {
  currentPage.value = 1
  fetchUnsubscribes()
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

// Watchers
watch(filters, () => {
  currentPage.value = 1
}, { deep: true })

// Lifecycle
onMounted(() => {
  fetchUnsubscribes()
})
</script> 
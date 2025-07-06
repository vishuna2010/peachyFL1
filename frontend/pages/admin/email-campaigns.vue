<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Email Campaigns</h1>
      <p class="text-gray-600 mt-2">Manage and track your email marketing campaigns</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Campaigns"
        :value="stats.totalCampaigns"
        iconName="Campaigns"
        iconBackgroundClass="bg-blue-100 text-blue-600"
      />
      <StatCard
        title="Total Sent"
        :value="stats.totalSent"
        iconName="Sent"
        iconBackgroundClass="bg-green-100 text-green-600"
      />
      <StatCard
        title="Avg Open Rate"
        :value="`${stats.avgOpenRate}%`"
        iconName="Opens"
        iconBackgroundClass="bg-purple-100 text-purple-600"
      />
      <StatCard
        title="Avg Click Rate"
        :value="`${stats.avgClickRate}%`"
        iconName="Clicks"
        iconBackgroundClass="bg-orange-100 text-orange-600"
      />
    </div>

    <!-- Campaign List -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">Campaigns</h2>
          <button
            @click="showCreateModal = true"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Campaign
          </button>
        </div>
      </div>

      <div v-if="loading" class="p-6">
        <div class="animate-pulse space-y-4">
          <div v-for="i in 3" :key="i" class="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>

      <div v-else-if="campaigns.length === 0" class="p-6 text-center text-gray-500">
        No campaigns found. Create your first campaign to get started.
      </div>

      <div v-else class="divide-y divide-gray-200">
        <div
          v-for="campaign in campaigns"
          :key="campaign.id"
          class="p-6 hover:bg-gray-50 transition-colors"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h3 class="text-lg font-medium text-gray-900">{{ campaign.name }}</h3>
              <p class="text-gray-600 mt-1">{{ campaign.subject }}</p>
              <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <span>Status: {{ campaign.status }}</span>
                <span>Sent: {{ campaign.sent_count || 0 }}</span>
                <span>Opens: {{ campaign.open_count || 0 }}</span>
                <span>Clicks: {{ campaign.click_count || 0 }}</span>
                <span>Created: {{ formatDate(campaign.created_at) }}</span>
              </div>
            </div>
            <div class="flex space-x-2">
              <button
                @click="viewCampaign(campaign)"
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Details
              </button>
              <button
                v-if="campaign.status === 'draft'"
                @click="sendCampaign(campaign)"
                class="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Campaign Modal -->
    <Modal v-if="showCreateModal" @close="showCreateModal = false">
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Create New Campaign</h3>
        <form @submit.prevent="createCampaign">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Campaign Name</label>
              <input
                v-model="newCampaign.name"
                type="text"
                required
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Subject Line</label>
              <input
                v-model="newCampaign.subject"
                type="text"
                required
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Content</label>
              <textarea
                v-model="newCampaign.content"
                rows="6"
                required
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Target Audience</label>
              <select
                v-model="newCampaign.target_audience"
                required
                class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                <option value="active">Active Users (last 30 days)</option>
                <option value="inactive">Inactive Users (30+ days)</option>
                <option value="new">New Users (last 7 days)</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              @click="showCreateModal = false"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creating"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {{ creating ? 'Creating...' : 'Create Campaign' }}
            </button>
          </div>
        </form>
      </div>
    </Modal>

    <!-- Campaign Details Modal -->
    <Modal v-if="selectedCampaign" @close="selectedCampaign = null">
      <div class="p-6 max-w-4xl">
        <h3 class="text-lg font-semibold mb-4">{{ selectedCampaign.name }}</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium text-gray-900 mb-2">Campaign Details</h4>
            <div class="space-y-2 text-sm">
              <div><span class="font-medium">Subject:</span> {{ selectedCampaign.subject }}</div>
              <div><span class="font-medium">Status:</span> {{ selectedCampaign.status }}</div>
              <div><span class="font-medium">Created:</span> {{ formatDate(selectedCampaign.created_at) }}</div>
              <div><span class="font-medium">Sent:</span> {{ selectedCampaign.sent_count || 0 }}</div>
            </div>
          </div>
          
          <div>
            <h4 class="font-medium text-gray-900 mb-2">Performance</h4>
            <div class="space-y-2 text-sm">
              <div><span class="font-medium">Opens:</span> {{ selectedCampaign.open_count || 0 }}</div>
              <div><span class="font-medium">Clicks:</span> {{ selectedCampaign.click_count || 0 }}</div>
              <div><span class="font-medium">Open Rate:</span> {{ calculateOpenRate(selectedCampaign) }}%</div>
              <div><span class="font-medium">Click Rate:</span> {{ calculateClickRate(selectedCampaign) }}%</div>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <h4 class="font-medium text-gray-900 mb-2">Content Preview</h4>
          <div class="bg-gray-50 p-4 rounded-md text-sm">
            <div v-html="selectedCampaign.content"></div>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button
            @click="selectedCampaign = null"
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
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import StatCard from '~/components/admin/StatCard.vue'
import Modal from '~/components/common/Modal.vue'

const toast = useToast()
const { apiFetch } = useApi()

definePageMeta({
  layout: 'admin',
  title: 'Email Campaigns'
})

// Data
const campaigns = ref([])
const stats = ref({
  totalCampaigns: 0,
  totalSent: 0,
  avgOpenRate: 0,
  avgClickRate: 0
})
const loading = ref(false)
const creating = ref(false)
const showCreateModal = ref(false)
const selectedCampaign = ref(null)

const newCampaign = ref({
  name: '',
  subject: '',
  content: '',
  target_audience: 'all'
})

// Methods
const fetchCampaigns = async () => {
  loading.value = true
  try {
    const response = await apiFetch('/api/admin/email-campaigns')
    campaigns.value = response.campaigns || []
    stats.value = response.stats || {
      totalCampaigns: 0,
      totalSent: 0,
      avgOpenRate: 0,
      avgClickRate: 0
    }
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    toast.error('Failed to load campaigns')
  } finally {
    loading.value = false
  }
}

const createCampaign = async () => {
  creating.value = true
  try {
    await apiFetch('/api/admin/email-campaigns', {
      method: 'POST',
      body: newCampaign.value
    })
    toast.success('Campaign created successfully')
    showCreateModal.value = false
    newCampaign.value = { name: '', subject: '', content: '', target_audience: 'all' }
    await fetchCampaigns()
  } catch (error) {
    console.error('Error creating campaign:', error)
    toast.error('Failed to create campaign')
  } finally {
    creating.value = false
  }
}

const sendCampaign = async (campaign) => {
  try {
    await apiFetch(`/api/admin/email-campaigns/${campaign.id}/send`, {
      method: 'POST'
    })
    toast.success('Campaign sent successfully')
    await fetchCampaigns()
  } catch (error) {
    console.error('Error sending campaign:', error)
    toast.error('Failed to send campaign')
  }
}

const viewCampaign = (campaign) => {
  selectedCampaign.value = campaign
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const calculateOpenRate = (campaign) => {
  if (!campaign.sent_count || campaign.sent_count === 0) return 0
  return ((campaign.open_count || 0) / campaign.sent_count * 100).toFixed(1)
}

const calculateClickRate = (campaign) => {
  if (!campaign.sent_count || campaign.sent_count === 0) return 0
  return ((campaign.click_count || 0) / campaign.sent_count * 100).toFixed(1)
}

// Lifecycle
onMounted(() => {
  fetchCampaigns()
})
</script> 
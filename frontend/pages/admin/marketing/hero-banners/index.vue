<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Hero Banners</h1>
      <NuxtLink
        to="/admin/marketing/hero-banners/new"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        <span>Add New Banner</span>
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Empty State -->
      <div v-if="!heroBanners || heroBanners.length === 0" class="text-center py-12">
        <div class="text-gray-400 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No hero banners yet</h3>
        <p class="text-gray-500 mb-6">Get started by creating your first hero banner to showcase your products.</p>
        <NuxtLink
          to="/admin/marketing/hero-banners/new"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <span>Add New Banner</span>
        </NuxtLink>
      </div>

      <!-- Banners List -->
      <div v-else class="grid gap-6">
        <div
          v-for="banner in heroBanners"
          :key="banner.id"
          class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-4 mb-4">
                <img
                  v-if="banner.image_url"
                  :src="banner.image_url"
                  :alt="banner.title"
                  class="w-24 h-16 object-cover rounded-lg"
                />
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-gray-900">{{ banner.title }}</h3>
                  <p class="text-gray-600 text-sm">{{ banner.subtitle }}</p>
                </div>
              </div>
              
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="font-medium text-gray-700">Status:</span>
                  <span
                    :class="{
                      'text-green-600': banner.is_active,
                      'text-red-600': !banner.is_active
                    }"
                    class="ml-2"
                  >
                    {{ banner.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Priority:</span>
                  <span class="ml-2">{{ banner.priority }}</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">Start Date:</span>
                  <span class="ml-2">{{ formatDate(banner.start_date) }}</span>
                </div>
                <div>
                  <span class="font-medium text-gray-700">End Date:</span>
                  <span class="ml-2">{{ formatDate(banner.end_date) }}</span>
                </div>
              </div>

              <div v-if="banner.call_to_action_text" class="mt-4">
                <span class="font-medium text-gray-700">Call to Action:</span>
                <span class="ml-2 text-blue-600">{{ banner.call_to_action_text }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 ml-4">
              <NuxtLink
                :to="`/admin/marketing/hero-banners/edit/${banner.id}`"
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit
              </NuxtLink>
              <button
                @click="toggleBannerStatus(banner)"
                :class="{
                  'text-green-600 hover:text-green-800': banner.is_active,
                  'text-red-600 hover:text-red-800': !banner.is_active
                }"
                class="text-sm font-medium"
              >
                {{ banner.is_active ? 'Deactivate' : 'Activate' }}
              </button>
              <button
                @click="deleteBanner(banner.id)"
                class="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  permission: 'marketing:manage_hero_banners'
})

const { $toast } = useNuxtApp()
const heroBanners = ref([])
const loading = ref(true)
const error = ref(null)

const fetchHeroBanners = async () => {
  try {
    loading.value = true
    error.value = null
    
    const { $axios } = useNuxtApp()
    const response = await $axios.get('/admin/hero-banners')
    heroBanners.value = response.data.data || []
  } catch (err) {
    console.error('Error fetching hero banners:', err)
    error.value = 'Failed to load hero banners. Please try again.'
  } finally {
    loading.value = false
  }
}

const toggleBannerStatus = async (banner) => {
  try {
    const newStatus = !banner.is_active
    const { $axios } = useNuxtApp()
    await $axios.patch(`/admin/hero-banners/${banner.id}`, {
      is_active: newStatus
    })
    
    banner.is_active = newStatus
    if (typeof $toast !== 'undefined' && $toast.success) {
      $toast.success(`Banner ${newStatus ? 'activated' : 'deactivated'} successfully`)
    }
  } catch (err) {
    console.error('Error toggling banner status:', err)
    if (typeof $toast !== 'undefined' && $toast.error) {
      $toast.error('Failed to update banner status')
    }
  }
}

const deleteBanner = async (bannerId) => {
  if (!confirm('Are you sure you want to delete this banner?')) {
    return
  }

  try {
    const { $axios } = useNuxtApp()
    await $axios.delete(`/admin/hero-banners/${bannerId}`)
    
    heroBanners.value = heroBanners.value.filter(b => b.id !== bannerId)
    if (typeof $toast !== 'undefined' && $toast.success) {
      $toast.success('Banner deleted successfully')
    }
  } catch (err) {
    console.error('Error deleting banner:', err)
    if (typeof $toast !== 'undefined' && $toast.error) {
      $toast.error('Failed to delete banner')
    }
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

onMounted(() => {
  fetchHeroBanners()
})
</script>

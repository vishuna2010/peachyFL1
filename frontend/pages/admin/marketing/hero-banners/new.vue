<template>
  <div class="p-6">
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/marketing/hero-banners"
        class="text-blue-600 hover:text-blue-800 flex items-center gap-2"
      >
        <span>← Back to Hero Banners</span>
      </NuxtLink>
    </div>

    <div class="max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Create New Hero Banner</h1>

      <form @submit.prevent="createBanner" class="space-y-6">
        <!-- Title -->
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter banner title"
          />
        </div>

        <!-- Subtitle -->
        <div>
          <label for="subtitle" class="block text-sm font-medium text-gray-700 mb-2">
            Subtitle
          </label>
          <input
            id="subtitle"
            v-model="form.subtitle"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter banner subtitle"
          />
        </div>

        <!-- Image Upload -->
        <div>
          <label for="image" class="block text-sm font-medium text-gray-700 mb-2">
            Banner Image *
          </label>
          <input
            id="image"
            ref="imageInput"
            type="file"
            accept="image/*"
            required
            @change="handleImageChange"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p class="text-sm text-gray-500 mt-1">
            Recommended size: 1200x600 pixels. Max file size: 5MB.
          </p>
        </div>

        <!-- Call to Action Text -->
        <div>
          <label for="callToActionText" class="block text-sm font-medium text-gray-700 mb-2">
            Call to Action Text
          </label>
          <input
            id="callToActionText"
            v-model="form.call_to_action_text"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Shop Now, Learn More"
          />
        </div>

        <!-- Call to Action URL -->
        <div>
          <label for="callToActionUrl" class="block text-sm font-medium text-gray-700 mb-2">
            Call to Action URL
          </label>
          <input
            id="callToActionUrl"
            v-model="form.call_to_action_url"
            type="url"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com"
          />
        </div>

        <!-- Priority -->
        <div>
          <label for="priority" class="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <select
            id="priority"
            v-model="form.priority"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1">1 - Highest</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5 - Lowest</option>
          </select>
          <p class="text-sm text-gray-500 mt-1">
            Higher priority banners will be displayed first.
          </p>
        </div>

        <!-- Status -->
        <div>
          <label class="flex items-center">
            <input
              v-model="form.is_active"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="ml-2 text-sm font-medium text-gray-700">Active</span>
          </label>
          <p class="text-sm text-gray-500 mt-1">
            Only active banners will be displayed on the frontend.
          </p>
        </div>

        <!-- Note: Date range functionality not yet implemented in backend -->

        <!-- Buttons -->
        <div class="flex gap-4 pt-6">
          <button
            type="submit"
            :disabled="loading"
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center gap-2"
          >
            <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span>{{ loading ? 'Creating...' : 'Create Banner' }}</span>
          </button>
          <NuxtLink
            to="/admin/marketing/hero-banners"
            class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg"
          >
            Cancel
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

definePageMeta({
  layout: 'admin',
  permission: 'marketing:manage_hero_banners'
})

const { $toast } = useNuxtApp()
const router = useRouter()
const imageInput = ref(null)

const loading = ref(false)
const form = ref({
  title: '',
  subtitle: '',
  image: null,
  call_to_action_text: '',
  call_to_action_url: '',
  priority: 1,
  is_active: true
})

console.log('Hero banner new page loaded')

const handleImageChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      if (typeof $toast !== 'undefined' && $toast.error) {
        $toast.error('File size must be less than 5MB')
      }
      event.target.value = ''
      return
    }
    
    form.value.image = file
  }
}

const createBanner = async () => {
  try {
    loading.value = true

    // Create FormData for file upload
    const formData = new FormData()
    formData.append('title', form.value.title)
    formData.append('subtitle', form.value.subtitle)
    formData.append('buttonText', form.value.call_to_action_text)
    formData.append('buttonLink', form.value.call_to_action_url)
    formData.append('sortOrder', form.value.priority)
    formData.append('isActive', form.value.is_active)
    // Note: start_date and end_date are not in the backend schema, so we'll skip them for now
    
    if (form.value.image) {
      formData.append('productImage', form.value.image)
    }

    const { $axios } = useNuxtApp()
    const response = await $axios.post('/admin/hero-banners', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (typeof $toast !== 'undefined' && $toast.success) {
      $toast.success('Hero banner created successfully')
    }
    router.push('/admin/marketing/hero-banners')
  } catch (err) {
    console.error('Error creating hero banner:', err)
    const errorMessage = err.response?.data?.message || err.message || 'Failed to create hero banner'
    if (typeof $toast !== 'undefined' && $toast.error) {
      $toast.error(errorMessage)
    }
  } finally {
    loading.value = false
  }
}
</script>

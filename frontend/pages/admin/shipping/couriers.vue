<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Shipping Couriers</h1>
      <p class="text-gray-600">Manage shipping couriers and their contact information</p>
    </div>

    <!-- Add New Courier Button -->
    <div class="mb-6">
      <button
        @click="showAddModal = true"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        v-if="can('shipping:manage_couriers')"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add New Courier
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading couriers</h3>
          <div class="mt-2 text-sm text-red-700">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- Couriers Table -->
    <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
      <div v-if="couriers.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No couriers</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating a new courier.</p>
      </div>

      <ul v-else class="divide-y divide-gray-200">
        <li v-for="courier in couriers" :key="courier.id" class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v.958m12.013 0v11.177m-12.013 0v-11.177" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900">{{ courier.name }}</div>
                <div v-if="courier.contact_info" class="text-sm text-gray-500">{{ courier.contact_info }}</div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="editCourier(courier)"
                class="text-blue-600 hover:text-blue-900 text-sm font-medium"
                v-if="can('shipping:manage_couriers')"
              >
                Edit
              </button>
              <button
                @click="deleteCourier(courier.id)"
                class="text-red-600 hover:text-red-900 text-sm font-medium"
                v-if="can('shipping:manage_couriers')"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add/Edit Courier Modal -->
    <Modal v-if="showAddModal || showEditModal" @close="closeModal">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          {{ showEditModal ? 'Edit Courier' : 'Add New Courier' }}
        </h3>
        
        <form @submit.prevent="saveCourier" class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Courier Name</label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              required
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label for="contact_info" class="block text-sm font-medium text-gray-700">Contact Information</label>
            <textarea
              id="contact_info"
              v-model="form.contact_info"
              rows="3"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Email, phone, or other contact details"
            ></textarea>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              @click="closeModal"
              class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md"
            >
              {{ saving ? 'Saving...' : (showEditModal ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePermissions } from '~/composables/usePermissions'
import Modal from '~/components/common/Modal.vue'

definePageMeta({
  layout: 'admin'
})

const { can } = usePermissions()

const loading = ref(false)
const saving = ref(false)
const error = ref(null)
const couriers = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingCourier = ref(null)

const form = ref({
  name: '',
  contact_info: ''
})

onMounted(() => {
  fetchCouriers()
})

const fetchCouriers = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await $fetch('http://localhost:3000/api/shipping/couriers')
    couriers.value = response.couriers || []
  } catch (err) {
    error.value = err.message || 'Failed to load couriers'
  } finally {
    loading.value = false
  }
}

const editCourier = (courier) => {
  editingCourier.value = courier
  form.value = {
    name: courier.name,
    contact_info: courier.contact_info || ''
  }
  showEditModal.value = true
}

const saveCourier = async () => {
  saving.value = true
  
  try {
    if (showEditModal.value) {
      await $fetch(`http://localhost:3000/api/shipping/couriers/${editingCourier.value.id}`, {
        method: 'PUT',
        body: form.value
      })
    } else {
      await $fetch('http://localhost:3000/api/shipping/couriers', {
        method: 'POST',
        body: form.value
      })
    }
    
    await fetchCouriers()
    closeModal()
  } catch (err) {
    error.value = err.message || 'Failed to save courier'
  } finally {
    saving.value = false
  }
}

const deleteCourier = async (id) => {
  if (!confirm('Are you sure you want to delete this courier?')) return
  
  try {
    await $fetch(`http://localhost:3000/api/shipping/couriers/${id}`, {
      method: 'DELETE'
    })
    await fetchCouriers()
  } catch (err) {
    error.value = err.message || 'Failed to delete courier'
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingCourier.value = null
  form.value = {
    name: '',
    contact_info: ''
  }
}
</script> 
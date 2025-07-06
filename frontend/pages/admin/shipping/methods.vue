<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Shipping Methods</h1>
      <p class="text-gray-600">Manage shipping methods and their pricing</p>
    </div>

    <!-- Add New Method Button -->
    <div class="mb-6">
      <button
        @click="showAddModal = true"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        v-if="can('shipping:manage_methods')"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add New Method
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
          <h3 class="text-sm font-medium text-red-800">Error loading shipping methods</h3>
          <div class="mt-2 text-sm text-red-700">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- Shipping Methods Table -->
    <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
      <div v-if="methods.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No shipping methods</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating a new shipping method.</p>
      </div>

      <ul v-else class="divide-y divide-gray-200">
        <li v-for="method in methods" :key="method.id" class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900">{{ method.name }}</div>
                <div class="text-sm text-gray-500">
                  <span class="font-medium">${{ method.price }}</span>
                  <span v-if="method.courier_name" class="ml-2">• {{ method.courier_name }}</span>
                </div>
                <div v-if="method.description" class="text-sm text-gray-400">{{ method.description }}</div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="editMethod(method)"
                class="text-blue-600 hover:text-blue-900 text-sm font-medium"
                v-if="can('shipping:manage_methods')"
              >
                Edit
              </button>
              <button
                @click="deleteMethod(method.id)"
                class="text-red-600 hover:text-red-900 text-sm font-medium"
                v-if="can('shipping:manage_methods')"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add/Edit Method Modal -->
    <Modal v-if="showAddModal || showEditModal" @close="closeModal">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          {{ showEditModal ? 'Edit Shipping Method' : 'Add New Shipping Method' }}
        </h3>
        
        <form @submit.prevent="saveMethod" class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Method Name</label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              required
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Standard Shipping"
            />
          </div>
          
          <div>
            <label for="price" class="block text-sm font-medium text-gray-700">Price ($)</label>
            <input
              id="price"
              v-model="form.price"
              type="number"
              step="0.01"
              min="0"
              required
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label for="courier_id" class="block text-sm font-medium text-gray-700">Courier</label>
            <select
              id="courier_id"
              v-model="form.courier_id"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a courier</option>
              <option v-for="courier in couriers" :key="courier.id" :value="courier.id">
                {{ courier.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              rows="3"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 3-5 business days"
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
const methods = ref([])
const couriers = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingMethod = ref(null)

const form = ref({
  name: '',
  price: '',
  courier_id: '',
  description: ''
})

onMounted(() => {
  fetchMethods()
  fetchCouriers()
})

const fetchMethods = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await $fetch('http://localhost:3000/api/shipping/methods')
    methods.value = response.methods || []
  } catch (err) {
    error.value = err.message || 'Failed to load shipping methods'
  } finally {
    loading.value = false
  }
}

const fetchCouriers = async () => {
  try {
    const response = await $fetch('http://localhost:3000/api/shipping/couriers')
    couriers.value = response.couriers || []
  } catch (err) {
    console.error('Failed to load couriers:', err)
  }
}

const editMethod = (method) => {
  editingMethod.value = method
  form.value = {
    name: method.name,
    price: method.price,
    courier_id: method.courier_id || '',
    description: method.description || ''
  }
  showEditModal.value = true
}

const saveMethod = async () => {
  saving.value = true
  
  try {
    if (showEditModal.value) {
      await $fetch(`http://localhost:3000/api/shipping/methods/${editingMethod.value.id}`, {
        method: 'PUT',
        body: form.value
      })
    } else {
      await $fetch('http://localhost:3000/api/shipping/methods', {
        method: 'POST',
        body: form.value
      })
    }
    
    await fetchMethods()
    closeModal()
  } catch (err) {
    error.value = err.message || 'Failed to save shipping method'
  } finally {
    saving.value = false
  }
}

const deleteMethod = async (id) => {
  if (!confirm('Are you sure you want to delete this shipping method?')) return
  
  try {
    await $fetch(`http://localhost:3000/api/shipping/methods/${id}`, {
      method: 'DELETE'
    })
    await fetchMethods()
  } catch (err) {
    error.value = err.message || 'Failed to delete shipping method'
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingMethod.value = null
  form.value = {
    name: '',
    price: '',
    courier_id: '',
    description: ''
  }
}
</script> 
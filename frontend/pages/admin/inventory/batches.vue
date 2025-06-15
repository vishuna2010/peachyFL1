<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Inventory Batch Management</h1>

    <!-- Filter Section -->
    <div class="mb-6 p-4 border rounded-md bg-gray-50 shadow">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div>
          <label for="filter_product_id" class="block text-sm font-medium text-gray-700">Product ID</label>
          <input type="number" v-model.number="filters.product_id" id="filter_product_id" placeholder="Enter Product ID"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_variant_id" class="block text-sm font-medium text-gray-700">Variant ID</label>
          <input type="number" v-model.number="filters.variant_id" id="filter_variant_id" placeholder="Enter Variant ID"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_batch_number" class="block text-sm font-medium text-gray-700">Batch Number</label>
          <input type="text" v-model="filters.batch_number" id="filter_batch_number" placeholder="Enter Batch No."
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_expires_soon_days" class="block text-sm font-medium text-gray-700">Expires in (Days)</label>
          <input type="number" v-model.number="filters.expires_soon_days" id="filter_expires_soon_days" placeholder="e.g., 30" min="1"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <div>
          <label for="filter_has_expired" class="block text-sm font-medium text-gray-700">Expiry Status</label>
          <select v-model="filters.has_expired" id="filter_has_expired"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option :value="null">Any Status</option>
            <option :value="true">Expired</option>
            <option :value="false">Not Expired</option>
          </select>
        </div>
        <div>
          <label for="filter_sort_by" class="block text-sm font-medium text-gray-700">Sort By</label>
          <select v-model="filters.sort_by" id="filter_sort_by"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option value="expiry_date">Expiry Date</option>
            <option value="received_date">Received Date</option>
            <option value="product_id">Product ID</option>
            <option value="batch_number">Batch No.</option>
            <option value="current_quantity">Current Quantity</option>
          </select>
        </div>
        <div>
          <label for="filter_sort_order" class="block text-sm font-medium text-gray-700">Sort Order</label>
          <select v-model="filters.sort_order" id="filter_sort_order"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option value="ASC">Ascending</option>
            <option value="DESC">Descending</option>
          </select>
        </div>
      </div>
      <div class="mt-4 flex space-x-3 justify-end">
        <button @click="applyFilters"
                class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
          Apply Filters
        </button>
        <button @click="resetFilters"
                class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
          Reset Filters
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading batches...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-lg text-red-600">Could not load batches.</p>
      <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
      <button @click="fetchBatches" class="mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="batches.length === 0" class="text-center py-10">
      <p class="text-lg text-gray-500">No inventory batches found matching your criteria.</p>
    </div>

    <!-- Table Display -->
    <div v-else class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant SKU</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No.</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initial Qty</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Qty</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost@Receipt</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="batch in batches" :key="batch.id" :class="getExpiryClass(batch.expiry_date).rowClass">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ batch.id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ batch.product_name || 'N/A' }} ({{ batch.product_sku || 'N/A' }})
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ batch.variant_sku || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ batch.batch_number || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm" :class="getExpiryClass(batch.expiry_date).textClass">
              {{ formatDate(batch.expiry_date) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ formatDate(batch.received_date) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{{ batch.initial_quantity }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">{{ batch.current_quantity }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ batch.cost_price_at_receipt != null ? `$${parseFloat(batch.cost_price_at_receipt).toFixed(2)}` : 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              <button @click="openEditModal(batch)" class="text-indigo-600 hover:text-indigo-900 text-xs px-2 py-1 border border-indigo-600 rounded hover:bg-indigo-50 transition-colors duration-150">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination UI -->
    <div v-if="!isLoading && !fetchError && batches.length > 0" class="flex justify-between items-center mt-6">
      <div>
        <span class="text-sm text-gray-700">
          Page {{ currentPage }} of {{ totalPages }}. Total batches: {{ totalBatches }}
        </span>
      </div>
      <div class="space-x-2">
        <button @click="currentPage--" :disabled="currentPage <= 1"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <button @click="currentPage++" :disabled="currentPage >= totalPages"
                class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>

    <!-- Edit Batch Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg space-y-4 border border-gray-300 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-medium leading-6 text-gray-900">
            Edit Batch #{{ editingBatch?.batch_number }} (ID: {{ editingBatch?.id }})
          </h3>
          <button @click="closeEditModal" class="text-gray-400 hover:text-gray-600 transition-colors duration-150">
            <span class="sr-only">Close</span>
            <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form @submit.prevent="handleUpdateBatch" class="space-y-4">
          <div>
            <label for="edit_batch_number" class="block text-sm font-medium text-gray-700">Batch Number:</label>
            <input type="text" v-model="editFormData.batch_number" id="edit_batch_number"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label for="edit_current_quantity" class="block text-sm font-medium text-gray-700">Current Quantity:</label>
            <input type="number" v-model.number="editFormData.current_quantity" id="edit_current_quantity" min="0"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            <p class="mt-1 text-xs text-gray-500">Initial quantity for this batch was {{ editingBatch?.initial_quantity }}.</p>
          </div>
          <div>
            <label for="edit_expiry_date" class="block text-sm font-medium text-gray-700">Expiry Date:</label>
            <input type="date" v-model="editFormData.expiry_date" id="edit_expiry_date"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label for="edit_reason" class="block text-sm font-medium text-gray-700">Reason for Change <span class="text-red-500">*</span></label>
            <textarea v-model.trim="editFormData.reason_for_change" id="edit_reason" required rows="3"
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Briefly explain the reason for this update."></textarea>
          </div>
          <div class="flex justify-end space-x-3 pt-2">
            <button type="button" @click="closeEditModal"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150">
              Cancel
            </button>
            <button type="submit" :disabled="isEditLoading"
                    class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors duration-150">
              <span v-if="isEditLoading">Saving...</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, definePageMeta, useHead } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Batch Management',
});

const { $axios } = useNuxtApp();
const toast = useToast();

const batches = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(20);
const totalBatches = ref(0);

// Modal State
const showEditModal = ref(false);
const editingBatch = ref(null);
const editFormData = ref({
  current_quantity: null,
  expiry_date: null,
  batch_number: '',
  reason_for_change: ''
});
const isEditLoading = ref(false);

const initialFilters = {
  product_id: '',
  variant_id: '',
  batch_number: '',
  has_expired: null,
  expires_soon_days: '',
  sort_by: 'expiry_date',
  sort_order: 'ASC',
};
const filters = ref({ ...initialFilters });

const fetchBatches = async () => {
  isLoading.value = true;
  fetchError.value = null;

  const params = {
    page: currentPage.value,
    limit: limit.value,
  };

  for (const key in filters.value) {
    const value = filters.value[key];
    if (value !== '' && value !== null) {
      if (key === 'has_expired' && (value === true || value === 'true' || value === false || value === 'false')) {
        params[key] = (value === true || value === 'true');
      } else if (key !== 'has_expired') {
        if ((key === 'product_id' || key === 'variant_id' || key === 'expires_soon_days') && value) {
            params[key] = Number(value);
        } else if (value) {
            params[key] = value;
        }
      }
    }
  }
  for (const key in params) {
    if (params[key] === '' || (typeof params[key] === 'number' && isNaN(params[key]))) {
      delete params[key];
    }
  }

  try {
    const response = await $axios.get('/admin/inventory-batches', { params });
    batches.value = response.data.data;
    totalPages.value = response.data.pagination.totalPages || 1;
    totalBatches.value = response.data.pagination.total;
    currentPage.value = response.data.pagination.page;
  } catch (error) {
    console.error('Error fetching batches:', error);
    fetchError.value = error.response?.data?.message || error.message || 'An unknown error occurred.';
    batches.value = [];
    totalPages.value = 1;
    totalBatches.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const applyFilters = () => {
  currentPage.value = 1;
  fetchBatches();
};

const resetFilters = () => {
  filters.value = { ...initialFilters };
  applyFilters();
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString();
};

const getExpiryClass = (expiryDateString) => {
  if (!expiryDateString) return { rowClass: '', textClass: '' };
  const expiryDate = new Date(expiryDateString);
  if (isNaN(expiryDate.getTime())) return { rowClass: '', textClass: '' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  if (expiryDate < today) {
    return { rowClass: 'bg-red-50 hover:bg-red-100', textClass: 'text-red-700 font-medium' };
  } else if (expiryDate <= thirtyDaysFromNow) {
    return { rowClass: 'bg-orange-50 hover:bg-orange-100', textClass: 'text-orange-700 font-medium' };
  }
  return { rowClass: '', textClass: '' };
};

onMounted(() => {
  fetchBatches();
});

watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    fetchBatches();
  }
});

const openEditModal = (batch) => {
  editingBatch.value = JSON.parse(JSON.stringify(batch));
  editFormData.value = {
    current_quantity: batch.current_quantity,
    expiry_date: batch.expiry_date ? new Date(batch.expiry_date).toISOString().split('T')[0] : null,
    batch_number: batch.batch_number || '',
    reason_for_change: ''
  };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingBatch.value = null;
  editFormData.value = { current_quantity: null, expiry_date: null, batch_number: '', reason_for_change: '' };
};

const handleUpdateBatch = async () => {
  if (!editFormData.value.reason_for_change.trim()) {
    toast.error('Reason for change is required.');
    return;
  }
  if (editFormData.value.current_quantity === null || editFormData.value.current_quantity < 0) {
    toast.error('Current quantity must be a non-negative number.');
    return;
  }
   if (editingBatch.value && editingBatch.value.initial_quantity !== null && editFormData.value.current_quantity > editingBatch.value.initial_quantity) {
    toast.error(`Current quantity (${editFormData.value.current_quantity}) cannot exceed initial quantity (${editingBatch.value.initial_quantity}).`);
    return;
  }

  isEditLoading.value = true;

  const payload = {
    reason_for_change: editFormData.value.reason_for_change.trim(),
    current_quantity: editFormData.value.current_quantity,
    batch_number: editFormData.value.batch_number.trim() === '' ? null : editFormData.value.batch_number.trim(),
    expiry_date: editFormData.value.expiry_date ? editFormData.value.expiry_date : null,
  };

  try {
    await $axios.put(`/admin/inventory-batches/${editingBatch.value.id}`, payload);
    toast.success(`Batch ID ${editingBatch.value.id} updated successfully.`);
    await fetchBatches();
    closeEditModal();
  } catch (error) {
    console.error('Error updating batch:', error.response?.data || error.message);
    const mainMessage = error.response?.data?.message || 'Failed to update batch.';
    let detailedMessages = '';
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        detailedMessages = error.response.data.errors.map(e => e.msg).join(' ');
    }
    toast.error(`${mainMessage} ${detailedMessages}`.trim());
  } finally {
    isEditLoading.value = false;
  }
};

</script>

<style scoped>
/* Add any component-specific styles here if needed */
</style>

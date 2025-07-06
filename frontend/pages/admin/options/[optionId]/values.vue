<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="mb-6">
      <NuxtLink to="/admin/options" class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Option Types
      </NuxtLink>
      <div v-if="isFetchingOptionName" class="mt-2">
        <div class="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
      </div>
      <h1 v-else class="text-2xl font-semibold text-gray-900 mt-2">
        Manage Values for: <span class="text-indigo-600">{{ optionName || `Option ID ${optionId}` }}</span>
      </h1>
    </div>

    <div class="sm:flex sm:items-center sm:justify-end mb-6">
      <button
        @click="openAddModal"
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Add New Value
      </button>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading option values...</p>
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load option values: {{ fetchError }}</p>
    </div>
    <div v-else-if="optionValues.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl mb-4">No values found for this option type.</p>
      <p>Get started by adding a new value.</p>
    </div>

    <div v-else>
      <div class="bg-white shadow-md rounded-lg border border-neutral-200 overflow-x-auto">
        <table class="min-w-full divide-y divide-neutral-200">
          <thead class="bg-neutral-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-neutral-200">
            <tr v-for="val in optionValues" :key="val.id" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ val.value }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button @click="openEditModal(val)" class="text-indigo-600 hover:text-indigo-900 hover:underline">Edit</button>
                <button @click="handleDeleteValue(val.id)" class="text-red-600 hover:text-red-800 hover:underline" :disabled="isDeleting === val.id">
                  {{ isDeleting === val.id ? 'Deleting...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal for Add/Edit Value -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" aria-hidden="true" @click="closeModal">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form @submit.prevent="handleSubmitValue">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                {{ isEditing ? 'Edit Value' : 'Add New Value' }} for {{ optionName }}
              </h3>
              <div>
                <label for="optionValue" class="block text-sm font-medium text-gray-700 mb-1">Value Name</label>
                <input
                  type="text"
                  id="optionValue"
                  v-model="currentValue.value"
                  required
                  :disabled="isSubmitting"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                  placeholder="e.g., Red, Large, Cotton"
                />
              </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                :disabled="isSubmitting"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="isSubmitting" class="animate-pulse">{{ isEditing ? 'Saving...' : 'Adding...' }}</span>
                <span v-else>{{ isEditing ? 'Save Changes' : 'Add Value' }}</span>
              </button>
              <button
                type="button"
                @click="closeModal"
                :disabled="isSubmitting"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useNuxtApp, useRoute, useRouter, useHead } from '#app';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter(); // For navigation if needed, e.g. if option type deleted
const toast = useToast();

const optionId = computed(() => route.params.optionId);
const optionName = ref(''); // To store the parent option's name

const optionValues = ref([]);
const isLoading = ref(true); // For list loading
const isFetchingOptionName = ref(true);
const fetchError = ref(null);

const showModal = ref(false);
const isEditing = ref(false);
const currentValue = ref({ id: null, value: '' }); // For add/edit form
const isSubmitting = ref(false); // For modal form submission loading state
const isDeleting = ref(null); // Stores ID of value being deleted

useHead(() => ({
  title: `Admin - Values for ${optionName.value || `Option ID ${optionId.value}`}`,
}));

async function fetchParentOptionName() {
  isFetchingOptionName.value = true;
  try {
    const response = await $axios.get(`/api/admin/options/${optionId.value}`);
    optionName.value = response.data.name;
  } catch (err) {
    toast.error(err.response?.data?.message || `Failed to fetch option type (ID: ${optionId.value}).`);
    // Optionally navigate back if parent option doesn't exist
    // router.push('/admin/options');
  } finally {
    isFetchingOptionName.value = false;
  }
}

async function fetchOptionValues() {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/api/admin/options/${optionId.value}/values`);
    optionValues.value = response.data;
  } catch (err) {
    fetchError.value = err.response?.data?.message || err.message || 'Could not load option values.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  await fetchParentOptionName();
  if (!fetchError.value) { // Only fetch values if parent option name was fetched successfully (or no critical error)
      await fetchOptionValues();
  } else { // If parent option fetch failed, don't attempt to load values
      isLoading.value = false; // Ensure main loading state is also false
  }
});

const openAddModal = () => {
  currentValue.value = { id: null, value: '' };
  isEditing.value = false;
  showModal.value = true;
};

const openEditModal = (valueObj) => {
  currentValue.value = { ...valueObj }; // Create a copy for editing
  isEditing.value = true;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  currentValue.value = { id: null, value: '' };
};

const handleSubmitValue = async () => {
  if (!currentValue.value.value.trim()) {
    toast.error('Value name is required.');
    return;
  }
  if (currentValue.value.value.trim().length < 1) { // Or other validation as needed
    toast.error('Value name must be at least 1 character long.');
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEditing.value) {
      await $axios.put(`/api/admin/option-values/${currentValue.value.id}`, { value: currentValue.value.value.trim() });
      toast.success('Option value updated successfully!');
    } else {
      await $axios.post(`/api/admin/options/${optionId.value}/values`, { value: currentValue.value.value.trim() });
      toast.success('Option value added successfully!');
    }
    fetchOptionValues(); // Refresh the list
    closeModal();
  } catch (error) {
    toast.error(error.response?.data?.message || 'An unexpected error occurred.');
  } finally {
    isSubmitting.value = false;
  }
};

const handleDeleteValue = async (valueId) => {
  if (!window.confirm('Are you sure you want to delete this option value? This might affect product variants using it.')) {
    return;
  }
  isDeleting.value = valueId;
  try {
    await $axios.delete(`/api/admin/option-values/${valueId}`);
    toast.success('Option value deleted successfully!');
    fetchOptionValues(); // Refresh the list
  } catch (error) {
    toast.error(error.response?.data?.message || 'Failed to delete option value.');
  } finally {
    isDeleting.value = null;
  }
};
</script>

<style scoped>
/* Minimal scoped styles if needed */
</style>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Global Product Option Types</h1>
      <button
        @click="openAddModal"
        type="button"
        class="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Add Option Type
      </button>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading option types...</p>
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load option types: {{ fetchError.message || fetchError }}</p>
    </div>
    <div v-else-if="options.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl mb-4">No global option types found.</p>
      <p>Get started by adding a new option type (e.g., Color, Size).</p>
    </div>

    <div v-else>
      <div class="bg-white shadow-md rounded-lg border border-neutral-200 overflow-x-auto">
        <table class="min-w-full divide-y divide-neutral-200">
          <thead class="bg-neutral-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Option Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. of Values</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-neutral-200">
            <tr v-for="opt in options" :key="opt.id" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ opt.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ opt.value_count || 0 }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <NuxtLink :to="`/admin/options/${opt.id}/values`" class="text-green-600 hover:text-green-800 hover:underline">Manage Values</NuxtLink>
                <button @click="openEditModal(opt)" class="text-indigo-600 hover:text-indigo-900 hover:underline">Edit</button>
                <button @click="handleDeleteOption(opt.id)" class="text-red-600 hover:text-red-800 hover:underline" :disabled="isDeleting === opt.id">
                  {{ isDeleting === opt.id ? 'Deleting...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination could be added here if API supports it for options list -->
    </div>

    <!-- Modal for Add/Edit Option Type -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" aria-hidden="true" @click="closeModal">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form @submit.prevent="handleSubmitOption">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                {{ isEditing ? 'Edit Option Type' : 'Add New Option Type' }}
              </h3>
              <div>
                <label for="optionName" class="block text-sm font-medium text-gray-700 mb-1">Option Name</label>
                <input
                  type="text"
                  id="optionName"
                  v-model="currentOption.name"
                  required
                  :disabled="isSubmitting"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                  placeholder="e.g., Color, Size, Material"
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
                <span v-else>{{ isEditing ? 'Save Changes' : 'Add Option Type' }}</span>
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
import { ref, onMounted } from 'vue';
import { useNuxtApp, definePageMeta, useHead } from '#app'; // useRouter is not explicitly used for navigation in this version
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Product Option Types',
});

const { $axios } = useNuxtApp();
const toast = useToast();
// const router = useRouter(); // Not used directly for navigation, NuxtLink is used

const options = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const showModal = ref(false);
const isEditing = ref(false);
const currentOption = ref({ id: null, name: '' });
const isSubmitting = ref(false); // For form submission loading state
const isDeleting = ref(null); // Tracks ID of option being deleted

async function fetchOptions() {
  isLoading.value = true;
  fetchError.value = null;
  try {
    // The GET /api/admin/options does not yet support product_count or value_count directly
    // For now, we fetch just the options. value_count can be added later or fetched on demand.
    const response = await $axios.get('/api/admin/options');
    options.value = response.data.map(opt => ({ ...opt, value_count: 0 })); // Placeholder for value_count

    // To get actual value_counts, we'd need to iterate and make more calls, or backend sends it.
    // Example for fetching value counts (can be slow, N+1):
    // for (let opt of options.value) {
    //   try {
    //     const valuesResponse = await $axios.get(`/api/admin/options/${opt.id}/values`);
    //     opt.value_count = valuesResponse.data.length;
    //   } catch (countError) {
    //     console.warn(`Could not fetch value count for option ${opt.id}`, countError);
    //   }
    // }

  } catch (err) {
    console.error('Error fetching option types:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load option types.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchOptions);

const openAddModal = () => {
  currentOption.value = { id: null, name: '' };
  isEditing.value = false;
  showModal.value = true;
};

const openEditModal = (option) => {
  currentOption.value = { ...option }; // Create a copy for editing
  isEditing.value = true;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  currentOption.value = { id: null, name: '' }; // Reset
};

const handleSubmitOption = async () => {
  if (!currentOption.value.name.trim()) {
    toast.error('Option name is required.');
    return;
  }
   if (currentOption.value.name.trim().length < 2) {
    toast.error('Option name must be at least 2 characters long.');
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEditing.value) {
      await $axios.put(`/api/admin/options/${currentOption.value.id}`, { name: currentOption.value.name.trim() });
      toast.success('Option type updated successfully!');
    } else {
      await $axios.post('/api/admin/options', { name: currentOption.value.name.trim() });
      toast.success('Option type added successfully!');
    }
    fetchOptions(); // Refresh the list
    closeModal();
  } catch (error) {
    console.error('Error submitting option type:', error);
    toast.error(error.response?.data?.message || 'An unexpected error occurred.');
  } finally {
    isSubmitting.value = false;
  }
};

const handleDeleteOption = async (optionId) => {
  if (!window.confirm('Are you sure you want to delete this option type? This might affect products and variants using its values.')) {
    return;
  }
  isDeleting.value = optionId;
  try {
    await $axios.delete(`/api/admin/options/${optionId}`);
    toast.success('Option type deleted successfully!');
    fetchOptions(); // Refresh the list
  } catch (error) {
    console.error('Error deleting option type:', error);
    toast.error(error.response?.data?.message || 'Failed to delete option type.');
  } finally {
    isDeleting.value = null;
  }
};
</script>

<style scoped>
/* Minimal scoped styles if needed, prefer Tailwind utilities */
</style>

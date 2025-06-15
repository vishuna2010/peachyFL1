<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Global Product Option Types (Simplified)</h1>
      <!-- Add button temporarily removed
      <button @click="openAddModal" type="button" class="...">Add Option Type</button>
      -->
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p>Loading option types...</p>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700">
      <p>Could not load option types: {{ fetchError.message || fetchError }}</p>
    </div>
    <div v-else-if="options.length === 0" class="my-6 p-8 bg-gray-50 text-center">
      <p>No global option types found.</p>
    </div>

    <div v-else class="bg-white shadow-md rounded-lg border overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="opt in options" :key="opt.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ opt.name }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <NuxtLink :to="`/admin/options/${opt.id}/values`" class="text-green-600 hover:text-green-800">Manage Values</NuxtLink>
              <!-- Edit/Delete buttons temporarily removed -->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-gray-500">Simplified version for testing. Modals and full actions are temporarily removed.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, definePageMeta, useHead } from '#app';
// import { useToast } from 'vue-toastification'; // Toast not used in this version

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Product Option Types (Simplified Test)',
});

console.log('Simplified Product Options Page Loaded - Script Setup Start');

const { $axios } = useNuxtApp();
// const toast = useToast(); // Toast not used

const options = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
// Modal and edit/delete related refs temporarily removed
// const showModal = ref(false);
// const isEditing = ref(false);
// const currentOption = ref({ id: null, name: '' });
// const isSubmitting = ref(false);
// const isDeleting = ref(null);

async function fetchOptions() {
  console.log('Simplified Product Options: fetchOptions START');
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/admin/options'); // Path is correct
    console.log('Simplified Product Options: API response received', response.data);
    if (Array.isArray(response.data)) {
      options.value = response.data.map(opt => ({ ...opt, value_count: opt.value_count || 0 }));
    } else {
      console.error('Simplified Product Options: API response is not an array', response.data);
      options.value = []; // Set to empty if response is not as expected
      // fetchError.value = 'Invalid data structure from API.'; // Optionally set error
    }
    console.log('Simplified Product Options: Options set', options.value);
  } catch (err) {
    console.error('Simplified Product Options: Error fetching option types:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load option types.';
    // toast.error(fetchError.value); // Toast not used
  } finally {
    isLoading.value = false;
    console.log('Simplified Product Options: fetchOptions END, isLoading:', isLoading.value);
  }
}

onMounted(() => {
  console.log('Simplified Product Options: onMounted, calling fetchOptions');
  fetchOptions();
});

// Other functions (openAddModal, openEditModal, closeModal, handleSubmitOption, handleDeleteOption) are temporarily removed.
console.log('Simplified Product Options Page Loaded - Script Setup End');
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-3xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 v-if="assignedOptionInfo" class="text-2xl font-semibold text-gray-900">
          Manage Values for: {{ assignedOptionInfo.global_option_name }}
        </h1>
        <h1 v-else class="text-2xl font-semibold text-gray-900">
          Manage Assigned Option Values
        </h1>
        <NuxtLink :to="getBackLink()" class="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back</NuxtLink>
      </div>

      <div v-if="isLoading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        <p class="mt-3 text-gray-600">Loading option values...</p>
      </div>

      <div v-else-if="error" class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
        <p class="font-bold">Error Loading Data</p>
        <p>{{ error }}</p>
        <button @click="fetchData" class="mt-2 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">Retry</button>
      </div>

      <div v-else-if="allPossibleValues.length === 0" class="text-center py-10 bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <p class="text-lg text-gray-500">No global values found for the option type: "{{ assignedOptionInfo?.global_option_name }}".</p>
        <p class="mt-2 text-sm text-gray-400">You can add values to this option type in the Global Options management area.</p>
      </div>

      <form v-else @submit.prevent="handleSave" class="bg-white shadow-md rounded-lg p-6 border border-gray-200 space-y-5">
        <div class="space-y-3">
          <p class="text-sm text-gray-600">Select which values of '{{ assignedOptionInfo?.global_option_name }}' should be available for the product this option is assigned to.</p>
          <div v-for="valueItem in allPossibleValues" :key="valueItem.id" class="relative flex items-start">
            <div class="flex h-5 items-center">
              <input
                :id="'value-' + valueItem.id"
                :name="'value-' + valueItem.id"
                type="checkbox"
                :checked="selectedValues.has(valueItem.id)"
                @change="toggleValueSelection(valueItem.id)"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            <div class="ml-3 text-sm">
              <label :for="'value-' + valueItem.id" class="font-medium text-gray-700 cursor-pointer">{{ valueItem.value_name }}</label>
              <p class="text-xs text-gray-500">(Global Value ID: {{ valueItem.id }})</p>
            </div>
          </div>
        </div>

        <div class="mt-8 flex items-center justify-end space-x-4 pt-5 border-t border-gray-200">
          <NuxtLink :to="getBackLink()"
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Cancel
          </NuxtLink>
          <button type="submit" :disabled="isSaving"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            <span v-if="isSaving">Saving...</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, useNuxtApp, definePageMeta, useHead } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });

const route = useRoute();
const router = useRouter();
const { $axios } = useNuxtApp();
const toast = useToast();

const assignedOptionId = ref(route.params.assignedOptionId);

const assignedOptionInfo = ref(null); // Will store { global_option_name, etc. }
const allPossibleValues = ref([]); // Array of { id, value_name, is_selected (from initial fetch) }
const selectedValues = ref(new Set()); // Set to store IDs of currently selected values

const isLoading = ref(true);
const isSaving = ref(false);
const error = ref(null);

useHead({ title: computed(() => `Admin - Manage Values for Option ${assignedOptionInfo.value?.global_option_name || assignedOptionId.value || ''}`) });

const fetchData = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await $axios.get(`/admin/assigned-options/${assignedOptionId.value}/values`);
    if (response.data && response.data.data) { // Backend sends { data: { assigned_option_id, global_option_name, all_possible_values }}
      assignedOptionInfo.value = {
        assigned_option_id: response.data.data.assigned_option_id,
        global_option_name: response.data.data.global_option_name,
      };
      allPossibleValues.value = response.data.data.all_possible_values || [];

      const initialSelectedIds = new Set();
      allPossibleValues.value.forEach(val => {
        if (val.is_selected) {
          initialSelectedIds.add(val.id);
        }
      });
      selectedValues.value = initialSelectedIds;

    } else {
      throw new Error('Invalid data structure received from API.');
    }
  } catch (err) {
    console.error('Error fetching assigned option values:', err);
    error.value = err.response?.data?.message || err.message || 'Failed to load option values.';
    toast.error(error.value);
  } finally {
    isLoading.value = false;
  }
};

const toggleValueSelection = (valueId) => {
  if (selectedValues.value.has(valueId)) {
    selectedValues.value.delete(valueId);
  } else {
    selectedValues.value.add(valueId);
  }
};

const handleSave = async () => {
  isSaving.value = true;
  error.value = null; // Clear previous errors

  const payload = {
    value_ids: Array.from(selectedValues.value)
  };

  try {
    await $axios.put(`/admin/assigned-options/${assignedOptionId.value}/values`, payload);
    toast.success('Assigned values updated successfully!');
    // Attempt to get product ID from query or referer to navigate back intelligently
    // This is a simple approach; more robust state management might be needed for complex back navigation
    const productId = route.query.productId; // If productId was passed in query
    if (productId) {
      router.push(`/admin/products/${productId}/edit`);
    } else {
      // Fallback: go to a general options page or just refresh/stay.
      // For now, let's try to go to the product list page as a generic fallback.
      // A better approach might be to use router.back() if the previous page is reliable.
      router.push('/admin/products'); // Or router.back();
    }
  } catch (err) {
    console.error('Error saving assigned option values:', err);
    error.value = err.response?.data?.message || (err.response?.data?.errors ? err.response.data.errors.map(e=>e.msg).join(', ') : 'Failed to save changes.');
    toast.error(error.value);
  } finally {
    isSaving.value = false;
  }
};

const getBackLink = () => {
  const productId = route.query.productId;
  if (productId) {
    return `/admin/products/${productId}/edit`;
  }
  // Fallback if no productId in query - this might need adjustment based on typical navigation flow
  return '/admin/products';
};

onMounted(() => {
  console.log('[manage-values.vue onMounted] Route params:', route.params);
  console.log('[manage-values.vue onMounted] Initial assignedOptionId.value from route.params:', route.params.assignedOptionId);
  // The ref assignedOptionId is defined as: const assignedOptionId = ref(route.params.assignedOptionId);
  // So, logging it directly after its definition or here should be fine.
  console.log('[manage-values.vue onMounted] Component assignedOptionId.value:', assignedOptionId.value);

  if (!assignedOptionId.value) {
    error.value = "Assigned Option ID is missing from the route.";
    isLoading.value = false;
    toast.error(error.value);
    console.error('[manage-values.vue onMounted] Error: Assigned Option ID is missing. Not calling fetchData.');
    return;
  }
  console.log('[manage-values.vue onMounted] Assigned Option ID found. Calling fetchData...');
  fetchData();
});
</script>

<style scoped>
/* Basic styling, can be enhanced with Tailwind utility classes as needed */
</style>

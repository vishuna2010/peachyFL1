<template>
  <div class="p-4 border border-gray-200 rounded-lg shadow-sm mt-6 bg-white">
    <h2 class="text-xl font-semibold text-gray-800 mb-4">Manage Assigned Product Options</h2>

    <div v-if="isLoadingGlobalOptions || isLoadingAssignedOptions" class="text-center py-6">
      <p class="text-gray-500">Loading options data...</p>
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mt-2"></div>
    </div>
    <div v-else-if="fetchError" class="my-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm">
      <p>Error loading options data: {{ fetchError }}</p>
    </div>
    <div v-else class="space-y-8">
      <!-- Section 1: Display Assigned Options -->
      <div>
        <h3 class="text-lg font-semibold text-gray-700 mb-3">Assigned Options to Product</h3>
        <div v-if="isLoadingAssignedOptions && !assignedProductOptions.length" class="text-sm text-gray-500 italic">Loading assigned options...</div>
        <div v-else-if="assignedProductOptions.length === 0" class="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-md">
          No options have been assigned to this product yet.
        </div>
        <ul v-else class="space-y-3">
          <li v-for="assignedOpt in assignedProductOptions" :key="assignedOpt.id" class="p-3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <div class="font-semibold text-gray-800">{{ assignedOpt.global_option_name }}</div>
              <div class="text-xs text-gray-500">Global Option ID: {{ assignedOpt.option_id }} <span class="text-gray-300 mx-1">|</span> Assigned ID: {{ assignedOpt.id }}</div>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0 mt-2 sm:mt-0">
              <NuxtLink
                :to="`/admin/options/assigned/${assignedOpt.id}/manage-values`"
                class="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 whitespace-nowrap"
              >
                Configure Values
              </NuxtLink>
              <button
                @click="handleRemoveAssignedOption(assignedOpt.id)"
                :disabled="actionLoading.type === 'remove' && actionLoading.id === assignedOpt.id"
                class="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 disabled:opacity-50 whitespace-nowrap"
              >
                <span v-if="actionLoading.type === 'remove' && actionLoading.id === assignedOpt.id" class="animate-pulse">Removing...</span>
                <span v-else>Remove</span>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Section 2: Assign New Global Option -->
      <div class="pt-6 border-t border-gray-200">
        <h3 class="text-lg font-semibold text-gray-700 mb-3">Assign New Global Option Type</h3>
        <div v-if="isLoadingGlobalOptions && !allGlobalOptions.length" class="text-sm text-gray-500 italic">Loading global options...</div>
        <div v-else-if="assignableGlobalOptions.length === 0 && !isLoadingGlobalOptions" class="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-md">
          All available global option types have been assigned, or no global options exist to assign.
        </div>
        <div v-else class="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
          <select
            v-model="selectedGlobalOptionIdToAssign"
            class="block w-full sm:w-auto sm:flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option :value="null" disabled>Select an option to assign</option>
            <option v-for="globalOpt in assignableGlobalOptions" :key="globalOpt.id" :value="globalOpt.id">
              {{ globalOpt.name }}
            </option>
          </select>
          <button
            @click="handleAssignOptionToProduct"
            :disabled="!selectedGlobalOptionIdToAssign || (actionLoading.type === 'assign' && actionLoading.id === selectedGlobalOptionIdToAssign)"
            class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 disabled:opacity-50 whitespace-nowrap"
          >
            <span v-if="actionLoading.type === 'assign' && actionLoading.id === selectedGlobalOptionIdToAssign" class="animate-pulse">Assigning...</span>
            <span v-else>Assign to Product</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, toRefs, computed } from 'vue';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true,
  }
});

const { productId: propProductId } = toRefs(props);

const allGlobalOptions = ref([]);
const assignedProductOptions = ref([]);
const isLoadingGlobalOptions = ref(false);
const isLoadingAssignedOptions = ref(false);
const fetchError = ref(null);

const selectedGlobalOptionIdToAssign = ref(null);
const actionLoading = ref({ type: null, id: null });

const { $axios } = useNuxtApp();
const toast = useToast();

const assignableGlobalOptions = computed(() => {
  if (!allGlobalOptions.value || !assignedProductOptions.value) return [];
  const assignedOptionIds = new Set(assignedProductOptions.value.map(ao => ao.option_id));
  return allGlobalOptions.value.filter(globalOpt => !assignedOptionIds.has(globalOpt.id));
});

async function fetchAllGlobalOptionsInternal() {
  try {
    const response = await $axios.get('/admin/options');
    allGlobalOptions.value = response.data.data; // Correctly access the array
  } catch (err) {
    allGlobalOptions.value = [];
    throw err;
  } finally {
    isLoadingGlobalOptions.value = false;
  }
}

async function fetchAssignedProductOptionsInternal() {
  if (!propProductId.value) {
    assignedProductOptions.value = [];
    isLoadingAssignedOptions.value = false;
    return;
  }
  try {
    const response = await $axios.get(`/admin/products/${propProductId.value}/assigned-options`);
    assignedProductOptions.value = response.data;
  } catch (err) {
    assignedProductOptions.value = [];
    throw err;
  } finally {
    isLoadingAssignedOptions.value = false;
  }
}

async function loadInitialData() {
  fetchError.value = null;
  isLoadingGlobalOptions.value = true;
  isLoadingAssignedOptions.value = true;

  const results = await Promise.allSettled([
    fetchAllGlobalOptionsInternal(),
    fetchAssignedProductOptionsInternal()
  ]);

  let combinedErrorMessages = [];
  if (results[0].status === 'rejected') {
    console.error("Failed to load global options:", results[0].reason);
    combinedErrorMessages.push(results[0].reason.response?.data?.message || results[0].reason.message || 'Failed to load global options.');
  }
  if (results[1].status === 'rejected') {
     console.error("Failed to load assigned options:", results[1].reason);
    combinedErrorMessages.push(results[1].reason.response?.data?.message || results[1].reason.message || 'Failed to load assigned options.');
  }

  if (combinedErrorMessages.length > 0) {
    fetchError.value = combinedErrorMessages.join(' ');
    toast.error(fetchError.value);
  }
}

onMounted(() => {
  if (propProductId.value) {
    loadInitialData();
  }
});

watch(propProductId, (newProductId, oldProductId) => {
  if (newProductId && newProductId !== oldProductId) {
    loadInitialData();
  } else if (!newProductId) {
    allGlobalOptions.value = [];
    assignedProductOptions.value = [];
    fetchError.value = null;
  }
}, { immediate: false });

async function handleAssignOptionToProduct() {
  if (!selectedGlobalOptionIdToAssign.value) {
    toast.error('Please select a global option type to assign.');
    return;
  }
  actionLoading.value = { type: 'assign', id: selectedGlobalOptionIdToAssign.value };
  try {
    await $axios.post(`/admin/products/${propProductId.value}/assigned-options`, {
      option_id: selectedGlobalOptionIdToAssign.value
    });
    toast.success('Option assigned to product successfully.');
    await fetchAssignedProductOptionsInternal();
    selectedGlobalOptionIdToAssign.value = null;
  } catch (error) {
    console.error('Error assigning option to product:', error);
    toast.error(error.response?.data?.message || 'Failed to assign option.');
  } finally {
    actionLoading.value = { type: null, id: null };
  }
}

async function handleRemoveAssignedOption(assignedOptionId) {
  if (!window.confirm('Are you sure you want to remove this option from the product? This will also remove any specific values set for it and may affect variants that depend on this option assignment.')) {
    return;
  }
  actionLoading.value = { type: 'remove', id: assignedOptionId };
  try {
    await $axios.delete(`/admin/assigned-options/${assignedOptionId}`);
    toast.success('Option assignment removed successfully.');
    await fetchAssignedProductOptionsInternal();
  } catch (error) {
    console.error(`Error removing assigned option ${assignedOptionId}:`, error);
    toast.error(error.response?.data?.message || 'Failed to remove option assignment.');
  } finally {
    actionLoading.value = { type: null, id: null };
  }
}
</script>

<style scoped>
/* Scoped styles if needed. Using Tailwind for now. */
</style>

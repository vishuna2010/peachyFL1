<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="mb-6">
      <NuxtLink
        :to="`/admin/products/edit/${productId}`"
        class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Product Edit
      </NuxtLink>

      <div v-if="isLoading && !assignedOptionDetails" class="mt-2">
        <div class="h-8 bg-gray-200 rounded w-3/4 animate-pulse"></div>
      </div>
      <h1 v-else class="text-2xl font-semibold text-gray-900 mt-2">
        Configure Values for <span class="text-indigo-600">{{ assignedOptionDetails?.option_name || 'Option' }}</span>
        <span v-if="productName">on <span class="text-indigo-600">{{ productName }}</span></span>
      </h1>
      <p v-if="assignedOptionDetails" class="text-sm text-gray-500">
        Select which global '{{ assignedOptionDetails.option_name }}' values are applicable for this product.
      </p>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading configuration...</p>
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load configuration: {{ fetchError }}</p>
    </div>
    <div v-else-if="!assignedOptionDetails" class="my-6 p-4 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-lg shadow text-sm text-center">
      <p>Could not load details for the assigned option. <NuxtLink :to="`/admin/products/edit/${productId}`" class="font-medium hover:underline">Return to product edit.</NuxtLink></p>
    </div>

    <div v-else>
      <div v-if="allGlobalValuesForOptionType.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
        <p class="text-xl mb-4">No global values found for "{{ assignedOptionDetails.option_name }}".</p>
        <p>You can add values in the <NuxtLink :to="`/admin/options/${assignedOptionDetails.option_id}/values`" class="text-indigo-600 hover:underline">Global Option Management</NuxtLink> section.</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mt-4">
        <button
          v-for="globalValue in allGlobalValuesForOptionType"
          :key="globalValue.id"
          type="button"
          @click="handleToggleValue(globalValue.id)"
          :class="[
            'p-2 border rounded-lg flex flex-col items-center justify-center text-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150 min-h-[60px]',
            selectedGlobalValueIds.has(globalValue.id)
              ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-400 shadow-md'
              : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:shadow-sm',
            isColorOption(assignedOptionDetails.option_name) ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-auto'
          ]"
        >
          <span
            v-if="isColorOption(assignedOptionDetails.option_name)"
            class="w-8 h-8 sm:w-10 sm:h-10 rounded-md border border-gray-400 inline-block mb-1"
            :style="{ backgroundColor: globalValue.value.toLowerCase() }"
          ></span>
          <span class="text-xs sm:text-sm leading-tight">{{ globalValue.value }}</span>
        </button>
      </div>

      <div class="mt-8 flex justify-end">
        <button
          @click="handleSaveChanges"
          :disabled="isSaving"
          class="px-6 py-2.5 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isSaving" class="animate-pulse">Saving...</span>
          <span v-else>Save Configuration</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useNuxtApp, useRouter, useRoute, definePageMeta, useHead } from '#app';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const productId = computed(() => route.params.productId);
const assignedOptionId = computed(() => route.params.assignedOptionId); // This is product_assigned_options.id

const pageTitle = ref('Manage Option Values');
useHead(() => ({
  title: `Admin - ${pageTitle.value}`
}));

const productName = ref('');
const assignedOptionDetails = ref(null); // Stores { option_id (global), option_name }
const allGlobalValuesForOptionType = ref([]); // All global values for the parent option_id
const selectedGlobalValueIds = ref(new Set()); // Set of global product_option_values.id

const isLoading = ref(true); // Combined loading state for initial data
const fetchError = ref(null);
const isSaving = ref(false);

const isColorOption = (optionName) => {
  return optionName?.toLowerCase() === 'color';
};

async function loadData() {
  isLoading.value = true;
  fetchError.value = null;
  try {
    // Fetch product name (optional, for display)
    try {
      const productRes = await $axios.get(`/api/products/${productId.value}`);
      productName.value = productRes.data?.name || `Product ID ${productId.value}`;
    } catch (productErr) {
      console.warn(`Could not fetch product name for ID ${productId.value}`, productErr);
      productName.value = `Product ID ${productId.value}`;
    }

    // 1. Fetch Assigned Option Details (to get global option_id and option_name)
    const assignedOptRes = await $axios.get(`/api/admin/assigned-options/${assignedOptionId.value}`);
    assignedOptionDetails.value = assignedOptRes.data;
    if (!assignedOptionDetails.value || !assignedOptionDetails.value.option_id) {
      throw new Error('Invalid assigned option data received.');
    }
    pageTitle.value = `Values for ${assignedOptionDetails.value.option_name} on ${productName.value}`;


    // 2. Fetch All Global Values for this specific global Option Type
    const globalValuesRes = await $axios.get(`/api/admin/options/${assignedOptionDetails.value.option_id}/values`);
    allGlobalValuesForOptionType.value = globalValuesRes.data;

    // 3. Fetch Currently Configured/Selected Values for this Product-Assigned-Option
    const configuredValuesRes = await $axios.get(`/api/admin/assigned-options/${assignedOptionId.value}/values`);
    const currentSelectedIds = new Set(configuredValuesRes.data.map(val => val.option_value_id));
    selectedGlobalValueIds.value = currentSelectedIds;

  } catch (err) {
    console.error('Error loading page data:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Failed to load configuration page.';
    toast.error(fetchError.value);
    // If assignedOptionDetails failed to load, page title might not be fully updated.
    if (!assignedOptionDetails.value) pageTitle.value = 'Error Loading Configuration';
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadData);

const handleToggleValue = (valueId) => {
  if (selectedGlobalValueIds.value.has(valueId)) {
    selectedGlobalValueIds.value.delete(valueId);
  } else {
    selectedGlobalValueIds.value.add(valueId);
  }
};

const handleSaveChanges = async () => {
  if (!assignedOptionId.value) {
    toast.error("Assigned option ID is missing.");
    return;
  }
  isSaving.value = true;
  try {
    await $axios.put(`/api/admin/assigned-options/${assignedOptionId.value}/values`, {
      option_value_ids: Array.from(selectedGlobalValueIds.value)
    });
    toast.success('Configuration saved successfully!');
    // Optionally, can re-fetch data if backend returns new state or just trust local state
    // loadData();
  } catch (error) {
    console.error('Error saving configuration:', error);
    toast.error(error.response?.data?.message || 'Failed to save configuration.');
  } finally {
    isSaving.value = false;
  }
};

</script>

<style scoped>
/* Minimal scoped styles if needed */
</style>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-2xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">
          Manage Values for <span v-if="globalOptionName" class="text-indigo-600">'{{ globalOptionName }}'</span>
        </h1>
        <button
          @click="goBack"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
        >
          &larr; Back
        </button>
      </div>
      <p class="text-sm text-gray-600 mb-6">
        Assigned Option ID: <strong>{{ assignedOptionId }}</strong>.
        Select the specific values that should be available for this product option.
      </p>

      <div v-if="isLoading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        <p class="mt-2 text-sm text-gray-500">Loading available values...</p>
      </div>

      <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
        <p>{{ fetchError }}</p>
      </div>

      <form v-else-if="allPossibleValues.length > 0" @submit.prevent="handleSaveChanges" class="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <div class="space-y-5">
          <div v-for="valueItem in allPossibleValues" :key="valueItem.id" class="relative flex items-start">
            <div class="flex items-center h-5">
              <input
                :id="'value-' + valueItem.id"
                :name="'value-' + valueItem.id"
                type="checkbox"
                v-model="valueItem.is_selected"
                class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
            </div>
            <div class="ml-3 text-sm">
              <label :for="'value-' + valueItem.id" class="font-medium text-gray-700 cursor-pointer">{{ valueItem.value }}</label>
              <p class="text-xs text-gray-500">(Global Value ID: {{ valueItem.id }})</p>
            </div>
          </div>
        </div>

        <div v-if="saveError" class="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
          {{ saveError }}
        </div>

        <div class="mt-8 pt-5 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            :disabled="isSaving"
            class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <span v-if="isSaving" class="animate-pulse">Saving...</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </form>
      <div v-else class="text-center py-10 bg-gray-50 rounded-md">
        <p class="text-gray-500">No possible values found for this option type, or the option type itself is invalid.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, definePageMeta, useHead, useNuxtApp } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

const route = useRoute();
const router = useRouter();
const { $axios } = useNuxtApp();
const toast = useToast();

const assignedOptionId = ref(route.params.assignedOptionId);

const isLoading = ref(true);
const fetchError = ref(null);
const globalOptionName = ref('');
const allPossibleValues = ref([]); // Expected structure: [{ id, value, is_selected }, ...]

const isSaving = ref(false);
const saveError = ref(null);

useHead({
  title: computed(() => {
    let baseTitle = 'Manage Values';
    if (globalOptionName.value) {
      baseTitle += ` for '${globalOptionName.value}'`;
    }
    if (assignedOptionId.value) {
      baseTitle += ` (Assigned ID: ${assignedOptionId.value})`;
    }
    return `Admin - ${baseTitle}`;
  }),
});

const fetchData = async () => {
  if (!assignedOptionId.value) {
    fetchError.value = "Assigned Option ID is missing from the URL.";
    isLoading.value = false;
    toast.error(fetchError.value);
    return;
  }
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/admin/assigned-options/${assignedOptionId.value}/values`);
    if (response.data && response.data.data) {
      globalOptionName.value = response.data.data.global_option_name || '';
      allPossibleValues.value = response.data.data.all_possible_values || [];
    } else {
      throw new Error("Invalid data structure received from API.");
    }
  } catch (err) {
    console.error('Error fetching assigned option values:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Failed to load option values.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
};

const handleSaveChanges = async () => {
  isSaving.value = true;
  saveError.value = null;

  const selectedValueIds = allPossibleValues.value
    .filter(valueItem => valueItem.is_selected)
    .map(valueItem => valueItem.id);

  try {
    await $axios.put(`/admin/assigned-options/${assignedOptionId.value}/values`, {
      value_ids: selectedValueIds,
    });
    toast.success('Assigned values updated successfully!');
    // Optionally re-fetch data if needed, or trust the local state if PUT confirms changes
    // await fetchData();
  } catch (err) {
    console.error('Error saving assigned option values:', err);
    saveError.value = err.response?.data?.message || 'Failed to save changes.';
    toast.error(saveError.value);
  } finally {
    isSaving.value = false;
  }
};

const goBack = () => {
  router.go(-1);
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
/* Styles using Tailwind classes are applied directly in the template. */
/* Add specific styles here if truly necessary. */
</style>

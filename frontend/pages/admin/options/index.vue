<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-semibold mb-6 text-gray-800">Manage Global Product Options</h1>

    <div class="mb-6">
      <button
        @click="openCreateOptionTypeModal"
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
      >
        Create New Option Type
      </button>
    </div>

    <!-- Loading and Error Display for Option Types List -->
    <div v-if="isLoadingOptionTypes" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading option types...</p>
      <!-- Spinner Icon -->
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mt-3"></div>
    </div>
    <div v-if="fetchOptionTypesError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> {{ fetchOptionTypesError }}</span>
    </div>

    <!-- Option Types List -->
    <div v-if="!isLoadingOptionTypes && !fetchOptionTypesError && optionTypes.length === 0" class="text-center py-10 bg-gray-50 rounded-lg shadow">
      <p class="text-lg text-gray-500">No global option types found. Create one to get started!</p>
    </div>

    <div v-if="!isLoadingOptionTypes && optionTypes.length > 0" class="bg-white shadow-xl rounded-lg overflow-hidden">
      <ul class="divide-y divide-gray-200">
        <li v-for="optionType in optionTypes" :key="optionType.id" class="px-6 py-4 hover:bg-gray-50 transition duration-150 ease-in-out">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <span class="text-lg font-medium text-gray-700 mb-2 sm:mb-0">{{ optionType.name }} <span class="text-xs text-gray-400">(ID: {{ optionType.id }})</span></span>
            <div class="space-x-0 sm:space-x-3 space-y-2 sm:space-y-0 flex flex-col sm:flex-row w-full sm:w-auto">
              <button
                @click="openManageValuesModal(optionType)"
                class="w-full sm:w-auto text-sm bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm transition duration-150"
              >
                Manage Global Values
              </button>
              <button
                @click="openEditOptionTypeModal(optionType)"
                class="w-full sm:w-auto text-sm bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm transition duration-150"
              >
                Edit Name
              </button>
              <button
                @click="handleDeleteOptionType(optionType.id, optionType.name)"
                class="w-full sm:w-auto text-sm bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm transition duration-150"
              >
                Delete Type
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Create/Edit Global Option Type Modal -->
    <div v-if="showOptionTypeModal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div class="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md mx-auto">
        <h2 class="text-2xl font-semibold mb-6 text-gray-800">{{ isEditingOptionType ? `Edit Option Type: ${currentOptionType.id}` : 'Create New Option Type' }}</h2>
        <form @submit.prevent="handleSaveOptionType">
          <div>
            <label for="optionTypeName" class="block text-sm font-medium text-gray-700 mb-1">Option Type Name</label>
            <input
              type="text"
              id="optionTypeName"
              v-model="currentOptionType.name"
              class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
              :disabled="isSavingOptionType"
            />
            <p v-if="saveOptionTypeError" class="text-xs text-red-600 mt-1">{{ saveOptionTypeError }}</p>
          </div>
          <div class="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              @click="closeOptionTypeModal"
              :disabled="isSavingOptionType"
              class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-150 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSavingOptionType"
              class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 disabled:opacity-50"
            >
              {{ isSavingOptionType ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Manage Global Values Modal -->
    <div v-if="showManageValuesModal && selectedOptionTypeForValues" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10 p-4">
      <div class="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg mx-auto min-h-[400px]">
        <h2 class="text-2xl font-semibold mb-2 text-gray-800">Manage Global Values for:</h2>
        <h3 class="text-xl mb-6 text-indigo-600">{{ selectedOptionTypeForValues.name }} <span class="text-sm text-gray-500">(Type ID: {{selectedOptionTypeForValues.id}})</span></h3>

        <div v-if="isLoadingValues" class="text-center py-5">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
          <p class="text-gray-500 mt-2">Loading values...</p>
        </div>
        <div v-if="fetchValuesError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
          <span class="block sm:inline">{{ fetchValuesError }}</span>
        </div>

        <form @submit.prevent="handleAddValue" class="mb-6 flex gap-3">
          <input
            type="text"
            v-model="newValueName"
            placeholder="Enter new value name"
            class="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            required
            :disabled="isSavingValue"
          />
          <button
            type="submit"
            :disabled="isSavingValue"
            class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-150 disabled:opacity-50"
          >
            {{ isSavingValue && !editingValue ? 'Adding...' : 'Add Value' }}
          </button>
        </form>
         <p v-if="saveValueError && !editingValue" class="text-xs text-red-600 mb-2 -mt-4">{{ saveValueError }}</p>


        <div v-if="!isLoadingValues && currentValues.length === 0" class="text-center py-5 bg-gray-50 rounded-md">
          <p class="text-gray-500">No global values defined for this option type yet. Add one above!</p>
        </div>

        <ul v-if="!isLoadingValues && currentValues.length > 0" class="divide-y divide-gray-200 max-h-72 overflow-y-auto border rounded-md p-2">
          <li v-for="valueItem in currentValues" :key="valueItem.id" class="py-3 px-2 flex items-center justify-between hover:bg-gray-50 rounded">
            <template v-if="editingValue && editingValue.id === valueItem.id">
              <input
                type="text"
                v-model="editingValue.value"
                class="flex-grow px-3 py-1.5 border border-indigo-500 rounded-md shadow-sm sm:text-sm focus:ring-1 focus:ring-indigo-500"
                @keyup.enter="handleUpdateValue"
                @keyup.esc="cancelEditValue"
                :disabled="isSavingValue"
              />
              <div class="space-x-2 ml-2 flex-shrink-0">
                <button @click="handleUpdateValue" :disabled="isSavingValue" class="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-md disabled:opacity-50">
                   {{ isSavingValue ? 'Saving...' : 'Save' }}
                </button>
                <button @click="cancelEditValue" :disabled="isSavingValue" class="text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 py-1 px-2 rounded-md disabled:opacity-50">Cancel</button>
              </div>
            </template>
            <template v-else>
              <span class="text-gray-700 flex-grow">{{ valueItem.value }} <span class="text-xs text-gray-400">(ID: {{ valueItem.id }})</span></span>
              <div class="space-x-2 flex-shrink-0">
                <button @click="openEditValueModal(valueItem)" class="text-xs text-yellow-600 hover:text-yellow-800 font-medium">Edit</button>
                <button @click="handleDeleteValue(valueItem.id, valueItem.value)" class="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
              </div>
            </template>
          </li>
           <p v-if="saveValueError && editingValue" class="text-xs text-red-600 mt-1">{{ saveValueError }}</p>
        </ul>

        <div class="mt-8 flex justify-end">
          <button
            @click="closeManageValuesModal"
            class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useHead } from '#app'; // Use #app for Nuxt 3 auto-imports
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Global Product Options',
});

const { $axios } = useNuxtApp();
const toast = useToast();

// --- Option Types State & Methods ---
const optionTypes = ref([]);
const isLoadingOptionTypes = ref(true);
const fetchOptionTypesError = ref(null);
const showOptionTypeModal = ref(false);
const currentOptionType = ref({ id: null, name: '' });
const isEditingOptionType = ref(false);
const isSavingOptionType = ref(false);
const saveOptionTypeError = ref(null);

const fetchOptionTypes = async () => {
  isLoadingOptionTypes.value = true;
  fetchOptionTypesError.value = null;
  try {
    const response = await $axios.get('/admin/options');
    optionTypes.value = response.data.data || response.data || [];
  } catch (err) {
    fetchOptionTypesError.value = err.response?.data?.message || err.message || 'Failed to load option types.';
    toast.error(fetchOptionTypesError.value);
  } finally {
    isLoadingOptionTypes.value = false;
  }
};

const openCreateOptionTypeModal = () => {
  isEditingOptionType.value = false;
  currentOptionType.value = { id: null, name: '' };
  saveOptionTypeError.value = null;
  showOptionTypeModal.value = true;
};

const openEditOptionTypeModal = (optionType) => {
  isEditingOptionType.value = true;
  currentOptionType.value = { ...optionType };
  saveOptionTypeError.value = null;
  showOptionTypeModal.value = true;
};

const closeOptionTypeModal = () => {
  showOptionTypeModal.value = false;
};

const handleSaveOptionType = async () => {
  if (!currentOptionType.value.name || currentOptionType.value.name.trim().length < 2) {
    saveOptionTypeError.value = "Option Type name must be at least 2 characters.";
    toast.error(saveOptionTypeError.value);
    return;
  }
  isSavingOptionType.value = true;
  saveOptionTypeError.value = null;
  const payload = { name: currentOptionType.value.name.trim() };
  try {
    if (isEditingOptionType.value && currentOptionType.value.id) {
      await $axios.put(`/admin/options/${currentOptionType.value.id}`, payload);
      toast.success('Option type updated successfully!');
    } else {
      await $axios.post('/admin/options', payload);
      toast.success('Option type added successfully!');
    }
    fetchOptionTypes();
    closeOptionTypeModal();
  } catch (err) {
    saveOptionTypeError.value = err.response?.data?.message || 'Failed to save option type.';
    toast.error(saveOptionTypeError.value);
  } finally {
    isSavingOptionType.value = false;
  }
};

const handleDeleteOptionType = async (optionTypeId, optionTypeName) => {
  if (!confirm(`Are you sure you want to delete option type '${optionTypeName}' (ID: ${optionTypeId})? This may affect products using it.`)) {
    return;
  }
  try {
    await $axios.delete(`/admin/options/${optionTypeId}`);
    toast.success(`Option type '${optionTypeName}' deleted successfully!`);
    fetchOptionTypes();
  } catch (err) {
    toast.error(err.response?.data?.message || `Failed to delete '${optionTypeName}'. It might be in use.`);
  }
};

// --- Global Option Values State & Methods (for the modal) ---
const showManageValuesModal = ref(false);
const selectedOptionTypeForValues = ref(null); // { id, name }
const currentValues = ref([]); // [{ id, value, product_option_id }, ...]
const isLoadingValues = ref(false);
const fetchValuesError = ref(null);
const newValueName = ref('');
const isSavingValue = ref(false);
const saveValueError = ref(null);
const editingValue = ref(null); // { id, value, product_option_id }

const openManageValuesModal = async (optionType) => {
  selectedOptionTypeForValues.value = { ...optionType };
  currentValues.value = [];
  newValueName.value = '';
  editingValue.value = null;
  fetchValuesError.value = null;
  saveValueError.value = null;
  await fetchGlobalValuesForType();
  showManageValuesModal.value = true;
};

const closeManageValuesModal = () => {
  showManageValuesModal.value = false;
};

const fetchGlobalValuesForType = async () => {
  if (!selectedOptionTypeForValues.value?.id) return;
  isLoadingValues.value = true;
  fetchValuesError.value = null;
  try {
    const response = await $axios.get(`/admin/options/${selectedOptionTypeForValues.value.id}/values`);
    currentValues.value = response.data.data || [];
  } catch (err) {
    fetchValuesError.value = err.response?.data?.message || 'Failed to load values for this option type.';
    toast.error(fetchValuesError.value);
  } finally {
    isLoadingValues.value = false;
  }
};

const handleAddValue = async () => {
  if (!newValueName.value.trim()) {
    saveValueError.value = 'Value name cannot be empty.';
    toast.error(saveValueError.value);
    return;
  }
  isSavingValue.value = true;
  saveValueError.value = null;
  try {
    await $axios.post(`/admin/options/${selectedOptionTypeForValues.value.id}/values`, {
      value: newValueName.value.trim(),
    });
    toast.success(`Value '${newValueName.value.trim()}' added successfully.`);
    newValueName.value = '';
    await fetchGlobalValuesForType(); // Refresh list
  } catch (err) {
    saveValueError.value = err.response?.data?.message || 'Failed to add value.';
    toast.error(saveValueError.value);
  } finally {
    isSavingValue.value = false;
  }
};

const openEditValueModal = (valueItem) => {
  editingValue.value = { ...valueItem }; // Copy to avoid direct mutation before save
  saveValueError.value = null;
};

const cancelEditValue = () => {
  editingValue.value = null;
};

const handleUpdateValue = async () => {
  if (!editingValue.value?.value.trim()) {
    saveValueError.value = 'Value name cannot be empty for update.';
    toast.error(saveValueError.value);
    return;
  }
  isSavingValue.value = true;
  saveValueError.value = null;
  try {
    await $axios.put(`/admin/option-values/${editingValue.value.id}`, {
      value: editingValue.value.value.trim(),
    });
    toast.success('Value updated successfully.');
    editingValue.value = null;
    await fetchGlobalValuesForType(); // Refresh list
  } catch (err) {
    saveValueError.value = err.response?.data?.message || 'Failed to update value.';
    toast.error(saveValueError.value);
  } finally {
    isSavingValue.value = false;
  }
};

const handleDeleteValue = async (valueId, valueName) => {
  if (!confirm(`Are you sure you want to delete the global value '${valueName}' (ID: ${valueId})? This may affect products and variants using it.`)) {
    return;
  }
  // Note: No isSavingValue state for delete, but could be added if complex
  try {
    await $axios.delete(`/admin/option-values/${valueId}`);
    toast.success(`Value '${valueName}' deleted successfully.`);
    await fetchGlobalValuesForType(); // Refresh list
  } catch (err) {
    toast.error(err.response?.data?.message || `Failed to delete value '${valueName}'. It might be in use.`);
  }
};

onMounted(() => {
  fetchOptionTypes();
});
</script>

<style scoped>
/* Styles using Tailwind classes are applied directly in the template. */
</style>

<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-semibold mb-6 text-gray-800">Product Global Options</h1>

    <div class="mb-6">
      <button
        @click="openAddOptionTypeModal"
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out"
      >
        Add New Option Type
      </button>
    </div>

    <!-- Loading and Error Display for Option Types -->
    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading option types...</p>
      <!-- You could add a spinner here -->
    </div>
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline">{{ error.message || error }}</span>
    </div>

    <!-- Option Types List -->
    <div v-if="!isLoading && !error && optionTypes.length === 0" class="text-center py-10">
      <p class="text-lg text-gray-500">No option types found. Add one to get started!</p>
    </div>

    <div v-if="!isLoading && optionTypes.length > 0" class="bg-white shadow-xl rounded-lg overflow-hidden">
      <ul class="divide-y divide-gray-200">
        <li v-for="optionType in optionTypes" :key="optionType.id" class="px-6 py-4 hover:bg-gray-50 transition duration-150">
          <div class="flex items-center justify-between">
            <span class="text-lg font-medium text-gray-700">{{ optionType.name }}</span>
            <div class="space-x-3">
              <button
                @click="openManageValuesModal(optionType)"
                class="text-sm bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm transition duration-150"
              >
                Manage Values
              </button>
              <button
                @click="openEditOptionTypeModal(optionType)"
                class="text-sm bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm transition duration-150"
              >
                Edit
              </button>
              <button
                @click="confirmDeleteOptionType(optionType.id)"
                class="text-sm bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md shadow-sm transition duration-150"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add/Edit Option Type Modal -->
    <div v-if="showAddEditOptionTypeModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div class="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md mx-auto">
        <h2 class="text-2xl font-semibold mb-6 text-gray-800">{{ isEditingOptionType ? 'Edit Option Type' : 'Add New Option Type' }}</h2>
        <form @submit.prevent="saveOptionType">
          <div>
            <label for="optionTypeName" class="block text-sm font-medium text-gray-700 mb-1">Option Type Name</label>
            <input
              type="text"
              id="optionTypeName"
              v-model="currentOptionType.name"
              class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div class="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              @click="closeAddEditOptionTypeModal"
              class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-150"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Manage Values Modal -->
    <div v-if="showManageValuesModal && selectedOptionTypeForValues" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
      <div class="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg mx-auto min-h-[300px]">
        <h2 class="text-2xl font-semibold mb-1 text-gray-800">Manage Values for:</h2>
        <h3 class="text-xl mb-6 text-blue-600">{{ selectedOptionTypeForValues.name }}</h3>

        <div v-if="isLoadingValues" class="text-center py-5">
          <p class="text-gray-500">Loading values...</p>
        </div>
        <div v-if="valueManagementError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <span class="block sm:inline">{{ valueManagementError.message || valueManagementError }}</span>
        </div>

        <form @submit.prevent="addOptionValue" class="mb-6 flex gap-3">
          <input
            type="text"
            v.model="newValueName"
            placeholder="Enter new value name"
            class="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
          />
          <button
            type="submit"
            class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-150"
          >
            Add Value
          </button>
        </form>

        <div v-if="!isLoadingValues && selectedOptionTypeForValues.values && selectedOptionTypeForValues.values.length === 0" class="text-center py-5">
          <p class="text-gray-500">No values found for this option type. Add some!</p>
        </div>

        <ul v-if="!isLoadingValues && selectedOptionTypeForValues.values && selectedOptionTypeForValues.values.length > 0" class="divide-y divide-gray-200 max-h-60 overflow-y-auto">
          <li v-for="value in selectedOptionTypeForValues.values" :key="value.id" class="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded">
            <div v-if="editingValue && editingValue.id === value.id" class="flex-grow flex gap-2">
              <input
                type="text"
                v-model="editingValue.value"
                class="flex-grow px-3 py-1 border border-blue-500 rounded-md shadow-sm sm:text-sm"
                @keyup.enter="updateOptionValue"
                @keyup.esc="cancelEditValue"
              />
              <button @click="updateOptionValue" class="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-md">Save</button>
              <button @click="cancelEditValue" class="text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 py-1 px-2 rounded-md">Cancel</button>
            </div>
            <span v-else class="text-gray-700 flex-grow">{{ value.value }}</span>

            <div v-if="!editingValue || editingValue.id !== value.id" class="space-x-2 flex-shrink-0">
              <button @click="startEditValue(value)" class="text-xs text-yellow-600 hover:text-yellow-800 font-medium">Edit</button>
              <button @click="confirmDeleteOptionValue(value.id)" class="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
            </div>
          </li>
        </ul>

        <div class="mt-8 flex justify-end">
          <button
            @click="closeManageValuesModal"
            class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-150"
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
import { useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Product Options',
});

const { $axios } = useNuxtApp();
const toast = useToast(); // Import and use toast

// Reactive State for Option Types
const optionTypes = ref([]);
const isLoadingOptionTypes = ref(true); // Renamed for clarity
const fetchOptionTypesError = ref(null); // Renamed for clarity
const showAddEditOptionTypeModal = ref(false);
const currentOptionType = ref({ id: null, name: '' });
const isEditingOptionType = ref(false);
const isSavingOptionType = ref(false); // Added
const saveOptionTypeError = ref(null); // Added

// Reactive State for Option Values (Modal for managing values of a selected Option Type)
const showManageValuesModal = ref(false);
const selectedOptionTypeForValues = ref(null); // { id, name, values: [] }
const isLoadingValues = ref(false);
const valueManagementError = ref(null);
const newValueName = ref(''); // For adding a new value
const editingValue = ref(null); // { id, value } for editing a specific value

// Fetch Option Types
const fetchOptionTypes = async () => {
  isLoadingOptionTypes.value = true;
  fetchOptionTypesError.value = null;
  try {
    const response = await $axios.get('/admin/options');
    optionTypes.value = response.data.data || response.data || [];
  } catch (err) {
    console.error('Error fetching option types:', err);
    fetchOptionTypesError.value = err.response?.data?.message || err.message || 'Failed to load option types.';
    toast.error(fetchOptionTypesError.value);
  } finally {
    isLoadingOptionTypes.value = false;
  }
};

// Open Modals
const openAddOptionTypeModal = () => {
  isEditingOptionType.value = false;
  currentOptionType.value = { id: null, name: '' };
  saveOptionTypeError.value = null; // Clear previous save errors
  showAddEditOptionTypeModal.value = true;
};

const openEditOptionTypeModal = (optionType) => {
  isEditingOptionType.value = true;
  currentOptionType.value = { ...optionType };
  saveOptionTypeError.value = null; // Clear previous save errors
  showAddEditOptionTypeModal.value = true;
};

const closeAddEditOptionTypeModal = () => {
  showAddEditOptionTypeModal.value = false;
};

// Save Option Type (Add/Edit)
const handleSaveOptionType = async () => {
  if (!currentOptionType.value.name || currentOptionType.value.name.trim().length < 2) {
    saveOptionTypeError.value = "Option Type name must be at least 2 characters.";
    toast.error(saveOptionTypeError.value);
    return;
  }
  isSavingOptionType.value = true;
  saveOptionTypeError.value = null;
  fetchOptionTypesError.value = null; // Clear general page error

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
    closeAddEditOptionTypeModal();
  } catch (err) {
    console.error('Error saving option type:', err.response?.data || err.message);
    saveOptionTypeError.value = err.response?.data?.message || err.message || 'Failed to save option type.';
    toast.error(saveOptionTypeError.value);
  } finally {
    isSavingOptionType.value = false;
  }
};

// Delete Option Type
const confirmDeleteOptionType = (optionTypeId, optionTypeName) => { // Added optionTypeName
  if (confirm(`Are you sure you want to delete the option type '${optionTypeName}' (ID: ${optionTypeId})? This cannot be undone and might fail if the option type is in use.`)) {
    deleteOptionType(optionTypeId, optionTypeName);
  }
};

const deleteOptionType = async (optionTypeId, optionTypeName) => {
  fetchOptionTypesError.value = null; // Clear general page error
  try {
    await $axios.delete(`/admin/options/${optionTypeId}`);
    toast.success(`Option type '${optionTypeName}' deleted successfully!`);
    fetchOptionTypes(); // Refresh list
  } catch (err) {
    console.error('Error deleting option type:', err.response?.data || err.message);
    const deleteError = err.response?.data?.message || `Failed to delete option type '${optionTypeName}'. It might be in use.`;
    toast.error(deleteError);
    fetchOptionTypesError.value = deleteError; // Show error on main page if needed
  }
};

// Manage Global Values Modal Logic (Button text can be "Manage Global Values")
const openManageValuesModal = async (optionType) => {
  selectedOptionTypeForValues.value = { ...optionType, values: [] }; // Reset values initially
  showManageValuesModal.value = true;
  await fetchValuesForOptionType(optionType.id);
};

const closeManageValuesModal = () => {
  showManageValuesModal.value = false;
  selectedOptionTypeForValues.value = null;
  valueManagementError.value = null;
  newValueName.value = '';
  editingValue.value = null;
};

// Fetch Values for a specific Option Type
const fetchValuesForOptionType = async (optionTypeId) => {
  if (!selectedOptionTypeForValues.value || selectedOptionTypeForValues.value.id !== optionTypeId) {
     // If the modal was opened for a different type, or not opened at all.
     // Find the option type from the main list to ensure we have its name.
     const currentType = optionTypes.value.find(ot => ot.id === optionTypeId);
     if (currentType) {
        selectedOptionTypeForValues.value = { ...currentType, values: [] };
     } else {
        valueManagementError.value = "Could not identify the option type.";
        return;
     }
  }

  isLoadingValues.value = true;
  valueManagementError.value = null;
  try {
    const response = await $axios.get(`/admin/options/${optionTypeId}/values`);
    if (selectedOptionTypeForValues.value && selectedOptionTypeForValues.value.id === optionTypeId) {
        selectedOptionTypeForValues.value.values = response.data.data || response.data;
    }
  } catch (err) {
    console.error('Error fetching values:', err);
    valueManagementError.value = err.response?.data?.message || err.message || 'Failed to load values.';
  } finally {
    isLoadingValues.value = false;
  }
};

// Add Option Value
const addOptionValue = async () => {
  if (!newValueName.value.trim() || !selectedOptionTypeForValues.value?.id) return;
  valueManagementError.value = null;
  try {
    await $axios.post(`/admin/options/${selectedOptionTypeForValues.value.id}/values`, { value: newValueName.value.trim() });
    newValueName.value = ''; // Clear input
    await fetchValuesForOptionType(selectedOptionTypeForValues.value.id); // Refresh list
    // alert('Value added successfully');
  } catch (err) {
    console.error('Error adding value:', err);
    valueManagementError.value = err.response?.data?.message || err.message || 'Failed to add value.';
    // alert(`Error: ${valueManagementError.value}`);
  }
};

// Edit Option Value
const startEditValue = (value) => {
  editingValue.value = { ...value };
};

const cancelEditValue = () => {
  editingValue.value = null;
};

const updateOptionValue = async () => {
  if (!editingValue.value?.id || !editingValue.value.value.trim()) return;
  valueManagementError.value = null;
  try {
    await $axios.put(`/admin/option-values/${editingValue.value.id}`, { value: editingValue.value.value.trim() });
    const typeId = selectedOptionTypeForValues.value.id;
    editingValue.value = null; // Exit editing mode
    await fetchValuesForOptionType(typeId); // Refresh list
    // alert('Value updated successfully');
  } catch (err) {
    console.error('Error updating value:', err);
    valueManagementError.value = err.response?.data?.message || err.message || 'Failed to update value.';
    // alert(`Error: ${valueManagementError.value}`);
  }
};

// Delete Option Value
const confirmDeleteOptionValue = (valueId) => {
  if (confirm('Are you sure you want to delete this value? This might fail if it is currently in use by product variants.')) {
    deleteOptionValue(valueId);
  }
};

const deleteOptionValue = async (valueId) => {
  valueManagementError.value = null;
  try {
    await $axios.delete(`/admin/option-values/${valueId}`);
    // alert('Value deleted successfully');
    if (selectedOptionTypeForValues.value?.id) {
      await fetchValuesForOptionType(selectedOptionTypeForValues.value.id); // Refresh list
    }
  } catch (err) {
    console.error('Error deleting value:', err);
    valueManagementError.value = err.response?.data?.message || err.message || 'Failed to delete value. It might be in use.';
    alert(`Error: ${valueManagementError.value}`);
  }
};


onMounted(() => {
  fetchOptionTypes();
});

</script>

<style scoped>
/* Scoped styles if needed, Tailwind is preferred */
/* Example: Style for better modal transitions or specific element tweaks */
.fixed.inset-0 {
  transition: opacity 0.3s ease;
}
</style>

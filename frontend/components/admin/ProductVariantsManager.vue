<template>
  <div class="p-4 border border-gray-200 rounded-lg shadow-sm mt-6 bg-white">
    <h2 class="text-xl font-semibold text-gray-800 mb-4">Product Variants Manager (Product ID: {{ productId }})</h2>

    <div v-if="isLoadingConfiguredOptions || isLoadingVariants" class="text-center py-6">
      <p class="text-gray-500">Loading variant configuration data...</p>
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mt-2"></div>
    </div>
    <div v-else-if="fetchError" class="my-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm">
      <p>Error loading data: {{ fetchError }}</p>
      <button @click="loadAllData" class="mt-2 px-3 py-1.5 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
    </div>
    <div v-else>
      <div>
        <h3 class="text-lg font-medium text-gray-700 mb-2">Configured Options for Variant Creation:</h3>
        <div v-if="configuredProductOptions.length === 0" class="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-md">
          No options configured for this product to create variants from. Please assign options and their allowed values first.
        </div>
        <pre v-else class="text-xs bg-gray-100 p-3 rounded-md overflow-x-auto max-h-96">{{ configuredProductOptions }}</pre>
      </div>

      <div class="mt-6">
        <h3 class="text-lg font-medium text-gray-700 mb-2">Existing Product Variants</h3>
        <div v-if="isLoadingVariants" class="text-sm text-gray-500 italic p-3">Loading variants list...</div>
        <div v-else-if="!isLoadingVariants && existingVariants.length === 0 && !fetchError" class="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-md">
          No variants have been created for this product yet.
        </div>
        <div v-else-if="existingVariants.length > 0" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant Details</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Mod.</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="variant in existingVariants" :key="variant.id" class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap">
                  <img v-if="variant.image_url" :src="variant.image_url" :alt="`Variant ${variant.sku || variant.id}`" class="w-10 h-10 object-cover rounded-md border">
                  <span v-else class="text-xs text-gray-400 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-md border">No Img</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  <div v-if="variant.selected_options && variant.selected_options.length > 0">
                    <span v-for="(opt, index) in variant.selected_options" :key="opt.option_value_id">
                      <strong>{{ opt.option_name }}:</strong> {{ opt.value_name }}<span v-if="index < variant.selected_options.length - 1">, </span>
                    </span>
                  </div>
                  <span v-else class="text-xs text-gray-400 italic">Base product or no options defined</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ variant.sku || 'N/A' }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {{ variant.price_modifier >= 0 ? '+' : '' }}${{ parseFloat(variant.price_modifier || 0).toFixed(2) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ variant.stock_quantity }}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    @click="openEditVariantModal(variant)"
                    :disabled="actionLoading.id === variant.id"
                    class="text-indigo-600 hover:text-indigo-900 hover:underline focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                  <button
                    @click="handleDeleteVariant(variant.id)"
                    :disabled="actionLoading.id === variant.id"
                    class="text-red-600 hover:text-red-900 hover:underline focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="actionLoading.type === 'delete' && actionLoading.id === variant.id">
                      <div class="inline-block animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-red-600 mr-1"></div>Deleting...
                    </span>
                    <span v-else>Delete</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add New Variant Button -->
      <div class="mt-6 mb-4 text-right">
        <button
          @click="openAddVariantModal"
          class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition ease-in-out duration-150 shadow-sm"
          :disabled="configuredProductOptions.length === 0"
          title="Add a new product variant"
        >
          Add New Variant
        </button>
        <p v-if="configuredProductOptions.length === 0" class="text-xs text-gray-500 mt-1 text-right">
          (Please configure product options before adding variants)
        </p>
      </div>

      <!-- Add/Edit Variant Modal -->
      <div v-if="showAddOrEditVariantModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all">
          <div class="p-5 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              {{ isEditingVariant ? 'Edit Variant' : 'Add New Variant' }}
            </h3>
            <button @click="closeAddOrEditVariantModal" class="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <form @submit.prevent="handleVariantFormSubmit" class="p-5 space-y-4">
            <div v-if="configuredProductOptions.length > 0">
              <div v-for="configOpt in configuredProductOptions" :key="configOpt.option_id" class="mb-4">
                <label :for="'variant_opt_' + configOpt.option_id" class="block text-sm font-medium text-gray-700 mb-1">{{ configOpt.option_name }}</label>
                <select
                  :id="'variant_opt_' + configOpt.option_id"
                  v-model="newVariantForm.selected_option_values[configOpt.option_id]"
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                >
                  <option :value="undefined" disabled>Select {{ configOpt.option_name }}</option>
                  <option v-for="valueObj in configOpt.allowed_values" :key="valueObj.value_id" :value="valueObj.value_id">{{ valueObj.value_name }}</option>
                </select>
              </div>
            </div>
            <!-- This outer div is shown when configuredProductOptions.length === 0 -->
            <div v-else class="text-sm p-3 rounded-md border">
              <p v-if="isEditingVariant" class="text-gray-700 bg-blue-50 border-blue-300 p-3 rounded-md">
                This product's current option setup is incomplete for directly modifying this variant's options (e.g., Color, Size) using the dropdowns below. You can still update other fields like SKU, price, and stock. To change the variant's actual option combination, please ensure the product's options are fully configured with specific, selectable values via the 'Product Specific Options' manager first.
              </p>
              <p v-else class="text-gray-600 bg-yellow-50 border-yellow-300 p-3 rounded-md">
                No options configured for this product with selectable values. Please assign options and select their allowed values for this product first (via 'Product Specific Options' manager) before adding new variants.
              </p>
            </div>

            <div>
              <label for="variant_sku" class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input type="text" id="variant_sku" v-model="newVariantForm.sku" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>

            <div>
              <label for="variant_price_modifier" class="block text-sm font-medium text-gray-700 mb-1">Price Modifier ($)</label>
              <input type="number" step="0.01" id="variant_price_modifier" v-model.number="newVariantForm.price_modifier" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., -2.50 or 5.00" />
            </div>

            <div>
              <label for="variant_stock_quantity" class="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
              <input type="number" step="1" min="0" id="variant_stock_quantity" v-model.number="newVariantForm.stock_quantity" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
            </div>

            <div>
              <label for="variant_image_url" class="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
              <input type="text" id="variant_image_url" v-model="newVariantForm.image_url" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://example.com/image.jpg" />
            </div>

            <div v-if="addVariantFormError" class="my-3 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm">
              {{ addVariantFormError }}
            </div>

            <div class="pt-4 border-t border-gray-200 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                :disabled="isSubmittingNewVariant || (!isEditingVariant && configuredProductOptions.length === 0)"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSubmittingNewVariant ? (isEditingVariant ? 'Saving...' : 'Adding...') : (isEditingVariant ? 'Save Changes' : 'Add Variant') }}
              </button>
              <button
                type="button"
                @click="closeAddOrEditVariantModal"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
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
import { ref, onMounted, watch, toRefs, reactive } from 'vue';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true,
  }
});

const { productId: propProductId } = toRefs(props);

const configuredProductOptions = ref([]);
const existingVariants = ref([]);
const isLoadingConfiguredOptions = ref(false);
const isLoadingVariants = ref(false);
const fetchError = ref(null);

const { $axios } = useNuxtApp();
const toast = useToast();

// State for "Add Variant" Modal & Form
const showAddOrEditVariantModal = ref(false);
const isEditingVariant = ref(false);
const editingVariantId = ref(null);
const newVariantForm = reactive({
  sku: '',
  price_modifier: 0.00,
  stock_quantity: 0,
  image_url: '',
  selected_option_values: {} // Object to store { <global_option_id>: <global_value_id> }
});
const isSubmittingNewVariant = ref(false); // Used for Add/Edit form submission
const addVariantFormError = ref(null);
const actionLoading = ref({ type: null, id: null }); // For row-specific actions like delete

// Modal Control Methods
function openAddVariantModal() {
  isEditingVariant.value = false;
  editingVariantId.value = null;

  // Reset form fields
  newVariantForm.sku = '';
  newVariantForm.price_modifier = 0.00;
  newVariantForm.stock_quantity = 0;
  newVariantForm.image_url = '';
  newVariantForm.selected_option_values = {};
  // Ensure selected_option_values are initialized for configured options
  configuredProductOptions.value.forEach(opt => {
    newVariantForm.selected_option_values[opt.option_id] = undefined;
  });

  addVariantFormError.value = null;
  showAddOrEditVariantModal.value = true;
}

function closeAddOrEditVariantModal() {
  showAddOrEditVariantModal.value = false;
}

function openEditVariantModal(variantToEdit) {
  if (!variantToEdit) {
    console.error("openEditVariantModal: variantToEdit is undefined");
    toast.error("Could not open edit modal: variant data missing.");
    return;
  }

  isEditingVariant.value = true;
  editingVariantId.value = variantToEdit.id;

  // Populate form with variant data
  newVariantForm.sku = variantToEdit.sku || '';
  newVariantForm.price_modifier = variantToEdit.price_modifier === null || variantToEdit.price_modifier === undefined
                                  ? 0.00
                                  : parseFloat(variantToEdit.price_modifier);
  newVariantForm.stock_quantity = variantToEdit.stock_quantity === null || variantToEdit.stock_quantity === undefined
                                  ? 0
                                  : parseInt(variantToEdit.stock_quantity);
  newVariantForm.image_url = variantToEdit.image_url || '';

  // Populate selected_option_values
  const newSelectedOptionValues = {};
  if (configuredProductOptions.value && Array.isArray(configuredProductOptions.value)) {
    configuredProductOptions.value.forEach(configOpt => {
      const foundSelectedOpt = variantToEdit.selected_options?.find(
        selectedOpt => selectedOpt.option_id === configOpt.option_id
      );
      if (foundSelectedOpt) {
        newSelectedOptionValues[configOpt.option_id] = foundSelectedOpt.value_id;
      } else {
        // This option from configuredProductOptions was not in the variant's selected_options
        // This might happen if an option was removed from the product after variant creation,
        // or if data is inconsistent. Set to undefined to show placeholder.
        newSelectedOptionValues[configOpt.option_id] = undefined;
      }
    });
  }
  newVariantForm.selected_option_values = newSelectedOptionValues;

  addVariantFormError.value = null;
  showAddOrEditVariantModal.value = true;
}

async function handleVariantFormSubmit() {
  addVariantFormError.value = null; // Clear previous errors at the beginning for both add/edit

  // Client-Side Validation (common for both add and edit)
  for (const configOpt of configuredProductOptions.value) {
    if (newVariantForm.selected_option_values[configOpt.option_id] === null || newVariantForm.selected_option_values[configOpt.option_id] === undefined) {
      addVariantFormError.value = `Please select a value for ${configOpt.option_name}.`;
      toast.error(addVariantFormError.value);
      return;
    }
  }

  if (typeof newVariantForm.stock_quantity !== 'number' || newVariantForm.stock_quantity < 0 || !Number.isInteger(newVariantForm.stock_quantity)) {
    addVariantFormError.value = "Stock quantity must be a non-negative integer.";
    toast.error(addVariantFormError.value);
    return;
  }

  if (typeof newVariantForm.price_modifier !== 'number') {
    newVariantForm.price_modifier = parseFloat(newVariantForm.price_modifier) || 0.00;
    if (isNaN(newVariantForm.price_modifier)) {
      addVariantFormError.value = "Price modifier must be a valid number.";
      toast.error(addVariantFormError.value);
      return;
    }
  }

  // Prepare Payload
  const calculated_option_value_ids = Object.values(newVariantForm.selected_option_values).filter(id => id !== null && id !== undefined);

  const payload = {
    sku: newVariantForm.sku || null,
    price_modifier: newVariantForm.price_modifier,
    stock_quantity: newVariantForm.stock_quantity,
    image_url: newVariantForm.image_url || null
    // cost_price and wholesale_price_modifier would be added here if they were part of newVariantForm
  };

  if (isEditingVariant.value) {
    // Only send option_value_ids if there were configured options to select from.
    // This implies if configuredProductOptions is empty, the user couldn't have changed options,
    // so we don't send option_value_ids, meaning "no change to options".
    if (configuredProductOptions.value.length > 0) {
      // Client-side validation (loop over configuredProductOptions) should ensure
      // that calculated_option_value_ids is non-empty here because all available options must be selected.
      payload.option_value_ids = calculated_option_value_ids;
    }
    // If configuredProductOptions.value.length is 0, option_value_ids is NOT added to payload.
  } else {
    // ADD MODE: option_value_ids are mandatory.
    // Client-side validation (loop over configuredProductOptions) ensures selections are made.
    payload.option_value_ids = calculated_option_value_ids;
  }

  isSubmittingNewVariant.value = true;

  if (isEditingVariant.value) {
    // EDIT MODE
    if (!editingVariantId.value) {
      addVariantFormError.value = "Editing variant ID is missing. Cannot update.";
      toast.error(addVariantFormError.value);
      isSubmittingNewVariant.value = false;
      return;
    }
    try {
      const response = await $axios.put(`/admin/variants/${editingVariantId.value}`, payload);
      if (response && (response.status === 200 || response.status === 204)) { // 204 for No Content is also success
        toast.success('Variant updated successfully!');
        fetchProductVariants();
        closeAddOrEditVariantModal();
      } else {
        addVariantFormError.value = 'Variant update may not have been successful. Status: ' + response.status;
        toast.error(addVariantFormError.value);
      }
    } catch (error) {
      console.error("Error updating variant:", error.response || error);
      if (error.response && error.response.data && error.response.data.message) {
        addVariantFormError.value = error.response.data.message;
        toast.error(error.response.data.message);
      } else if (error.response && error.response.data && Array.isArray(error.response.data.errors)) {
        const formattedErrors = error.response.data.errors.map(e => e.msg).join('; ');
        addVariantFormError.value = formattedErrors;
        toast.error(formattedErrors);
      } else {
        addVariantFormError.value = 'An unexpected error occurred while updating the variant.';
        toast.error(addVariantFormError.value);
      }
    } finally {
      isSubmittingNewVariant.value = false;
    }
  } else {
    // ADD MODE (existing logic)
    try {
      const response = await $axios.post(`/admin/products/${propProductId.value}/variants`, payload);
      if (response && (response.status === 201 || response.status === 200)) {
        toast.success('Variant added successfully!');
        fetchProductVariants();
        closeAddOrEditVariantModal();
      } else {
        addVariantFormError.value = 'Variant creation may not have been successful. Status: ' + response.status;
        toast.error(addVariantFormError.value);
      }
    } catch (error) {
      console.error("Error adding variant:", error.response || error);
      if (error.response && error.response.data && error.response.data.message) {
        addVariantFormError.value = error.response.data.message;
        toast.error(error.response.data.message);
      } else if (error.response && error.response.data && Array.isArray(error.response.data.errors)) {
        const formattedErrors = error.response.data.errors.map(e => e.msg).join('; ');
        addVariantFormError.value = formattedErrors;
        toast.error(formattedErrors);
      } else {
        addVariantFormError.value = 'An unexpected error occurred while adding the variant.';
        toast.error(addVariantFormError.value);
      }
    } finally {
      isSubmittingNewVariant.value = false;
    }
  }
}

async function handleDeleteVariant(variantId) {
  if (!window.confirm('Are you sure you want to delete this variant? This action cannot be undone.')) {
    return;
  }

  actionLoading.value = { type: 'delete', id: variantId };
  addVariantFormError.value = null; // Clear form error if any, though not directly related

  try {
    await $axios.delete(`/admin/variants/${variantId}`);
    toast.success('Variant deleted successfully!');
    fetchProductVariants(); // Refresh the list
  } catch (error) {
    console.error("Error deleting variant:", error.response || error);
    if (error.response && error.response.data && error.response.data.message) {
      toast.error(error.response.data.message);
    } else {
      toast.error('An error occurred while deleting the variant.');
    }
  } finally {
    actionLoading.value = { type: null, id: null };
  }
}

async function fetchConfiguredProductOptions() {
  if (!propProductId.value) return;
  isLoadingConfiguredOptions.value = true;
  try {
    // This endpoint now returns assigned options with their specifically selected/allowed values
    const assignedOptionsResponse = await $axios.get(`/admin/products/${propProductId.value}/assigned-options`);

    const fetchedConfiguredOptions = assignedOptionsResponse.data.map(assignedOpt => {
      if (!assignedOpt.global_option_name) {
        console.warn('[ProductVariantsManager] Encountered an assigned option without a global_option_name:', JSON.stringify(assignedOpt));
        // Potentially skip this malformed option or provide a default name to avoid "undefined" in toast
      }
      // The 'selected_values' array from the backend IS the list of allowed values for this product's option assignment.
      // These are global product_option_values that have been specifically chosen for this product-option link.
      if (!assignedOpt.selected_values || assignedOpt.selected_values.length === 0) {
        // Use a placeholder if global_option_name is missing, to make the toast more informative than "undefined"
        const optionNameForToast = assignedOpt.global_option_name || `(Unknown Option ID: ${assignedOpt.global_option_id})`;
        toast.warning(`Option type "${optionNameForToast}" has no specific values configured for this product. Variants cannot be created with it until values are selected.`);
      }
      return {
        assigned_option_id: assignedOpt.assigned_option_id, // This is product_assigned_options.id
        option_id: assignedOpt.global_option_id,          // This is product_options.id (the global option type)
        option_name: assignedOpt.global_option_name,
        // 'allowed_values' for the variant form should be the 'selected_values' from this product's specific configuration
        allowed_values: Array.isArray(assignedOpt.selected_values) ? assignedOpt.selected_values.map(val => ({
          value_id: val.id,      // This is product_option_values.id
          value_name: val.value  // This is product_option_values.value
        })) : []
      };
    });

    configuredProductOptions.value = fetchedConfiguredOptions.filter(opt => opt.allowed_values.length > 0);

    if (configuredProductOptions.value.length === 0 && assignedOptionsResponse.data.length > 0) {
        toast.info("None of the assigned options for this product have any specific values configured. Please configure values for each option type to enable variant creation.");
    }

  } catch (err) {
    console.error(`Error fetching configured options for product ${propProductId.value}:`, err);
    if (!fetchError.value) fetchError.value = err.response?.data?.message || err.message || `Failed to load configured options.`;
    throw err;
  } finally {
    isLoadingConfiguredOptions.value = false;
  }
}

async function fetchProductVariants() {
  if (!propProductId.value) return;
  isLoadingVariants.value = true;
  try {
    const response = await $axios.get(`/admin/products/${propProductId.value}/variants`);
    existingVariants.value = response.data;
  } catch (err) {
    console.error(`Error fetching variants for product ${propProductId.value}:`, err);
    throw err;
  } finally {
    isLoadingVariants.value = false;
  }
}

async function loadAllData() {
  fetchError.value = null;
  isLoadingConfiguredOptions.value = true; // Ensure these are true at the start
  isLoadingVariants.value = true;

  const results = await Promise.allSettled([
    fetchConfiguredProductOptions(),
    fetchProductVariants()
  ]);

  let combinedErrorMessages = [];
  if (results[0].status === 'rejected') {
    console.error("loadAllData: Failed to load configured options:", results[0].reason);
    combinedErrorMessages.push(results[0].reason?.response?.data?.message || results[0].reason?.message || 'Failed to load configured options.');
  }
  if (results[1].status === 'rejected') {
     console.error("loadAllData: Failed to load existing variants:", results[1].reason);
    combinedErrorMessages.push(results[1].reason?.response?.data?.message || results[1].reason?.message || 'Failed to load existing variants.');
  }

  if (combinedErrorMessages.length > 0) {
    fetchError.value = combinedErrorMessages.join(' ');
  }
  // Individual loading flags are set within their respective functions.
}

onMounted(() => {
  if (propProductId.value) {
    loadAllData();
  }
});

watch(propProductId, (newProductId, oldProductId) => {
  if (newProductId && newProductId !== oldProductId) {
    configuredProductOptions.value = [];
    existingVariants.value = [];
    loadAllData();
  } else if (!newProductId) {
    configuredProductOptions.value = [];
    existingVariants.value = [];
    fetchError.value = null;
  }
}, { immediate: false });

</script>

<style scoped>
/* Tailwind placeholder classes used:
  - For general buttons: px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition ease-in-out duration-150 shadow-sm
  - For form inputs/selects: block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
  - For primary submit button: w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed
  - For secondary/cancel button: mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm
*/
.max-h-96 {
  max-height: 24rem; /* 384px, if not already defined by Tailwind */
}
</style>

<template>
  <div class="variants-manager card">
    <h3>Product Variants Management</h3>

    <div v-if="isLoading" class="loading-state">Loading variants...</div>
    <div v-if="fetchError" class="error-message">{{ fetchError }}</div>
    <div v-if="actionFeedback.message" :class="['action-feedback', actionFeedback.isError ? 'error' : 'success']">
      {{ actionFeedback.message }}
    </div>

    <!-- Add/Edit Variant Form -->
    <div class="variant-form-section card">
      <h4>{{ isEditing ? 'Edit Variant (ID: ' + editingVariantId + ')' : 'Add New Variant' }}</h4>
      <form @submit.prevent="handleSaveVariant">
        <div class="form-row" v-for="option in productOptions" :key="option.id">
          <div class="form-group">
            <label :for="`variant-option-${option.id}`">{{ option.name }}:</label>
            <select :id="`variant-option-${option.id}`" v-model="newVariantForm.selected_option_values[option.id]" required>
              <option :value="undefined" disabled>-- Select {{ option.name }} --</option>
              <option v-for="value in option.option_values" :key="value.id" :value="value.id">
                {{ value.value }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="variant-sku">SKU (Optional):</label>
            <input type="text" id="variant-sku" v-model.trim="newVariantForm.sku" />
          </div>
          <div class="form-group">
            <label for="variant-price_modifier">Price Modifier ($):</label>
            <input type="number" id="variant-price_modifier" v-model.number="newVariantForm.price_modifier" step="0.01" required />
            <small>Relative to base product price. Can be negative.</small>
          </div>
        </div>
        <div class="form-row">
           <div class="form-group">
            <label for="variant-stock_quantity">Stock Quantity:</label>
            <input type="number" id="variant-stock_quantity" v-model.number="newVariantForm.stock_quantity" min="0" required />
          </div>
        </div>
         <div class="form-group">
            <label for="variant-image">Variant Image (Optional):</label>
            <input type="file" id="variant-image" @change="handleImageFileChange" accept="image/*" />
            <div v-if="newVariantForm.image_preview_url" class="image-preview">
                <p>New Image Preview:</p>
                <img :src="newVariantForm.image_preview_url" alt="New variant image preview" />
            </div>
            <div v-else-if="isEditing && editingVariant && editingVariant.image_url" class="image-preview">
                <p>Current Image:</p>
                <img :src="editingVariant.image_url" alt="Current variant image" />
                 <button type="button" @click="removeVariantImage" class="remove-image-button">Remove Image</button>
            </div>
        </div>


        <div class="form-actions">
          <button type="submit" :disabled="isLoadingAction">
            {{ isLoadingAction ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Variant' : 'Save New Variant') }}
          </button>
          <button type="button" @click="cancelEdit" v-if="isEditing" :disabled="isLoadingAction">Cancel Edit</button>
        </div>
      </form>
    </div>

    <!-- Existing Variants Table -->
    <div v-if="productVariants.length > 0" class="existing-variants-section section">
      <h4>Existing Variants ({{ productVariants.length }})</h4>
      <table class="variants-table">
        <thead>
          <tr>
            <th>Variant Details</th>
            <th>SKU</th>
            <th>Price Mod.</th>
            <th>Stock</th>
            <th>Image</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="variant in productVariants" :key="variant.id">
            <td>
              <ul class="variant-options-display">
                <li v-for="optVal in variant.options" :key="optVal.option_value_id">
                  <strong>{{ optVal.option_name }}:</strong> {{ optVal.value_name || optVal.value }}
                </li>
              </ul>
            </td>
            <td>{{ variant.sku || 'N/A' }}</td>
            <td>{{ variant.price_modifier >= 0 ? '+' : '' }}${{ parseFloat(variant.price_modifier).toFixed(2) }}</td>
            <td>{{ variant.stock_quantity }}</td>
            <td>
              <img v-if="variant.image_url" :src="variant.image_url" :alt="`Variant ${variant.sku || variant.id}`" class="thumbnail" />
              <span v-else>N/A</span>
            </td>
            <td class="actions-cell">
              <button @click="startEditVariant(variant)" class="edit-link-button" :disabled="isLoadingAction">Edit</button>
              <button @click="handleDeleteVariant(variant.id)" class="delete-link-button" :disabled="isLoadingAction">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
     <div v-else-if="!isLoading && !fetchError" class="empty-state">
      No variants created for this product yet.
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useNuxtApp } from '#app';

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true
  },
  productOptions: { // Expects array: [{ id, name, option_values: [{id, value}, ...] }, ...]
    type: Array,
    default: () => []
  }
});

const { $axios } = useNuxtApp();

const productVariants = ref([]);
const isLoading = ref(false); // For fetching list
const fetchError = ref('');

const initialNewVariantForm = () => ({
  sku: '',
  price_modifier: 0.00,
  stock_quantity: 0,
  image_file: null,
  image_preview_url: null,
  image_removal_flag: false, // To signal image removal on update
  selected_option_values: {} // { <optionId>: <optionValueId> }
});
const newVariantForm = reactive(initialNewVariantForm());

const isEditing = ref(false);
const editingVariantId = ref(null);
const editingVariant = ref(null); // To store full variant data being edited for image display

const isLoadingAction = ref(false); // For CUD actions
const actionFeedback = reactive({ message: '', isError: false });

function setActionFeedback(message, isError = false) {
  actionFeedback.message = message;
  actionFeedback.isError = isError;
  setTimeout(() => { actionFeedback.message = ''; actionFeedback.isError = false; }, 4000);
}

async function fetchProductVariants() {
  if (!props.productId) return;
  isLoading.value = true;
  fetchError.value = '';
  try {
    const response = await $axios.get(`/admin/products/${props.productId}/variants`);
    productVariants.value = response.data;
  } catch (error) {
    console.error('Error fetching product variants:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load product variants.';
  } finally {
    isLoading.value = false;
  }
}

function handleImageFileChange(event) {
  const file = event.target.files[0];
  if (file) {
    newVariantForm.image_file = file;
    newVariantForm.image_preview_url = URL.createObjectURL(file);
    newVariantForm.image_removal_flag = false;
  } else {
    newVariantForm.image_file = null;
    newVariantForm.image_preview_url = null;
  }
}
function removeVariantImage() {
    newVariantForm.image_file = null;
    newVariantForm.image_preview_url = null;
    newVariantForm.image_removal_flag = true; // Signal to backend to nullify image_url
    if(isEditing.value && editingVariant.value) {
        editingVariant.value.image_url = null; // Optimistic UI update
    }
}


function resetForm() {
  Object.assign(newVariantForm, initialNewVariantForm());
  isEditing.value = false;
  editingVariantId.value = null;
  editingVariant.value = null;
  // Clear file input visually (difficult to do programmatically reliably)
  const fileInput = document.getElementById('variant-image');
  if (fileInput) fileInput.value = '';
}

function startEditVariant(variant) {
  isEditing.value = true;
  editingVariantId.value = variant.id;
  editingVariant.value = { ...variant }; // Store for image display

  newVariantForm.sku = variant.sku || '';
  newVariantForm.price_modifier = parseFloat(variant.price_modifier);
  newVariantForm.stock_quantity = variant.stock_quantity;
  newVariantForm.image_file = null; // Clear file input, user must re-select to change image
  newVariantForm.image_preview_url = null;
  newVariantForm.image_removal_flag = false;

  const selected = {};
  if (variant.options) { // variant.options comes from getVariantOptionDetails
    variant.options.forEach(optVal => {
      selected[optVal.option_id] = optVal.option_value_id;
    });
  }
  newVariantForm.selected_option_values = selected;
  window.scrollTo({ top: document.querySelector('.variant-form-section').offsetTop - 20, behavior: 'smooth' });
}

function cancelEdit() {
  resetForm();
}

async function handleSaveVariant() {
  // Validation: Ensure all product options are selected
  if (props.productOptions.some(opt => newVariantForm.selected_option_values[opt.id] === undefined || newVariantForm.selected_option_values[opt.id] === null)) {
    setActionFeedback('All options must be selected for a variant.', true);
    return;
  }

  isLoadingAction.value = true;
  const option_value_ids = Object.values(newVariantForm.selected_option_values).filter(id => id !== null && id !== undefined);

  const formData = new FormData();
  if (newVariantForm.sku) formData.append('sku', newVariantForm.sku);
  formData.append('price_modifier', newVariantForm.price_modifier);
  formData.append('stock_quantity', newVariantForm.stock_quantity);
  option_value_ids.forEach(id => formData.append('option_value_ids[]', id));

  if (newVariantForm.image_file) {
    formData.append('productImage', newVariantForm.image_file); // Backend expects 'productImage' for variants too
  } else if (newVariantForm.image_removal_flag && isEditing.value) {
    formData.append('image_url', null); // Signal to remove image
  }
  // If no new image and not removing, don't append image_url; backend PUT will keep existing if field not present.

  try {
    if (isEditing.value) {
      await $axios.put(`/admin/variants/${editingVariantId.value}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setActionFeedback('Variant updated successfully.', false);
    } else {
      await $axios.post(`/admin/products/${props.productId}/variants`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setActionFeedback('Variant created successfully.', false);
    }
    resetForm();
    await fetchProductVariants();
  } catch (error) {
    console.error('Error saving variant:', error);
    setActionFeedback(error.response?.data?.message || `Failed to ${isEditing.value ? 'update' : 'create'} variant.`, true);
  } finally {
    isLoadingAction.value = false;
  }
}

async function handleDeleteVariant(variantId) {
  if (!confirm(`Are you sure you want to delete variant ID ${variantId}? This cannot be undone.`)) return;
  isLoadingAction.value = true;
  try {
    await $axios.delete(`/admin/variants/${variantId}`);
    setActionFeedback('Variant deleted successfully.', false);
    await fetchProductVariants();
  } catch (error) {
    console.error('Error deleting variant:', error);
    setActionFeedback(error.response?.data?.message || 'Failed to delete variant.', true);
  } finally {
    isLoadingAction.value = false;
  }
}

onMounted(fetchProductVariants);

watch(() => props.productId, (newVal, oldVal) => {
  if (newVal !== oldVal) fetchProductVariants();
});
// Initialize selected_option_values keys based on productOptions
watch(() => props.productOptions, (newOptions) => {
    const currentSelections = { ...newVariantForm.selected_option_values };
    const defaultSelections = {};
    if (newOptions && newOptions.length > 0) {
        newOptions.forEach(opt => {
            // Keep existing selection if option still exists, otherwise undefined
            defaultSelections[opt.id] = currentSelections[opt.id] || undefined;
        });
        newVariantForm.selected_option_values = defaultSelections;
    }
}, { immediate: true, deep: true });

</script>

<style scoped>
.variants-manager { margin-top: 2rem; padding: 1.5rem; }
.variants-manager h3, .variant-form-section h4, .existing-variants-section h4 {
    margin-top:0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem;
}
.variant-form-section { margin-bottom: 2rem; padding:1.5rem; }
.existing-variants-section { margin-top: 1rem; }

.form-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.form-group { flex: 1; min-width: 180px; margin-bottom: 0.5rem; } /* Adjusted margin for tighter rows */
.form-group label { display: block; margin-bottom: 0.3rem; font-weight: bold; font-size: 0.9em;}
.form-group input, .form-group select {
  width: 100%; padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
}
.form-group small { font-size: 0.8em; color: #666; margin-top: 0.2rem; }

.image-preview { margin-top: 0.5rem; }
.image-preview img { max-width: 100px; max-height: 100px; border-radius: 4px; border: 1px solid #eee; }
.remove-image-button { font-size: 0.8em; color: #dc3545; background: transparent; border: none; cursor: pointer; display: block; margin-top: 0.25rem; }


.form-actions { margin-top: 1rem; display: flex; gap: 1rem; }
.form-actions button { padding: 0.6rem 1.2rem; border: none; border-radius: 4px; cursor: pointer; }
.form-actions button[type="submit"] { background-color: #28a745; color: white; }
.form-actions button[type="submit"]:hover:not(:disabled) { background-color: #218838; }
.form-actions button[type="button"] { background-color: #6c757d; color: white; }
.form-actions button[type="button"]:hover:not(:disabled) { background-color: #5a6268; }
.form-actions button:disabled { background-color: #aaa; }


.variants-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
.variants-table th, .variants-table td { border: 1px solid #ddd; padding: 0.6rem; text-align: left; vertical-align: middle; }
.variants-table th { background-color: #f2f2f2; }
.thumbnail { width: 40px; height: 40px; object-fit: cover; border-radius: 3px; }
.variant-options-display { list-style: none; padding: 0; margin: 0; font-size:0.9em; }
.variant-options-display li { white-space: nowrap; }

.actions-cell { white-space: nowrap; }
.actions-cell button { font-size: 0.9em; margin-right: 0.3rem; padding: 0.3rem 0.5rem; }
.edit-link-button { background-color: #ffc107; color:#333; border:none; border-radius:3px; cursor:pointer; }
.delete-link-button { background-color: #dc3545; color:white; border:none; border-radius:3px; cursor:pointer; }
.edit-link-button:hover:not(:disabled) { background-color: #e0a800; }
.delete-link-button:hover:not(:disabled) { background-color: #c82333; }


.loading-state, .error-message, .empty-state, .action-feedback { text-align: center; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
.loading-state { background-color: #eef; }
.error-message, .action-feedback.error { background-color: #fdd; color: #900; }
.action-feedback.success { background-color: #dfd; color: #070; }
.empty-state { background-color: #f8f9fa; padding: 1rem; }

.card { background-color: #fff; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
</style>

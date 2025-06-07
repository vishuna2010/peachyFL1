<template>
  <div class="options-manager card">
    <h3>Product Options Management</h3>

    <div v-if="isLoading" class="loading-state">Loading options...</div>
    <div v-if="fetchError" class="error-message">{{ fetchError }}</div>
    <div v-if="actionFeedback.message" :class="['action-feedback', actionFeedback.isError ? 'error' : 'success']">
      {{ actionFeedback.message }}
    </div>

    <!-- Add New Option Type -->
    <div class="add-new-option-type section">
      <h4>Add New Option Type</h4>
      <form @submit.prevent="handleAddOptionType" class="form-inline">
        <input type="text" v-model="newOptionName" placeholder="e.g., Color, Size" required :disabled="isLoadingAction"/>
        <button type="submit" :disabled="isLoadingAction || !newOptionName.trim()">
          {{ isLoadingAction && currentAction === 'addOptionType' ? 'Adding...' : 'Add Option Type' }}
        </button>
      </form>
    </div>

    <!-- Existing Options and Values -->
    <div v-if="productOptions.length > 0" class="existing-options section">
      <h4>Existing Options</h4>
      <ul class="options-list">
        <li v-for="option in productOptions" :key="option.id" class="option-item card">
          <div class="option-header">
            <!-- Edit Option Name (Simplified: for now, just display; edit would need more UI) -->
            <strong>{{ option.name }}</strong> (ID: {{ option.id }})
            <div class="option-actions">
                <!-- <button @click="promptEditOptionName(option)" class="edit-link-button" :disabled="isLoadingAction">Rename</button> -->
                <button @click="handleDeleteOptionType(option.id)" class="delete-link-button" :disabled="isLoadingAction">Delete Option Type</button>
            </div>
          </div>

          <ul class="values-list">
            <li v-for="value in option.option_values" :key="value.id" class="value-item">
              <span>{{ value.value }} (ID: {{value.id}})</span>
              <div class="value-actions">
                <!-- <button @click="promptEditOptionValue(value, option.id)" class="edit-link-button" :disabled="isLoadingAction">Rename</button> -->
                <button @click="handleDeleteOptionValue(value.id, option.id)" class="delete-link-button" :disabled="isLoadingAction">Delete Value</button>
              </div>
            </li>
            <li v-if="option.option_values.length === 0" class="no-values">No values yet for this option.</li>
          </ul>

          <form @submit.prevent="handleAddOptionValue(option.id)" class="form-inline add-value-form">
            <input type="text" v-model="newOptionValues[option.id]" placeholder="e.g., Red, Small" required :disabled="isLoadingAction"/>
            <button type="submit" :disabled="isLoadingAction || !newOptionValues[option.id]?.trim()">
              {{ isLoadingAction && currentAction === `addValue-${option.id}` ? 'Adding...' : 'Add Value to ' + option.name }}
            </button>
          </form>
        </li>
      </ul>
    </div>
    <div v-else-if="!isLoading && !fetchError" class="empty-state">
      No options defined for this product yet.
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useNuxtApp } from '#app';

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true
  }
});

const { $axios } = useNuxtApp();

const productOptions = ref([]); // Array of { id, name, product_id, option_values: [{ id, value }, ...] }
const isLoading = ref(false);
const fetchError = ref('');

const newOptionName = ref('');
const newOptionValues = reactive({}); // { <optionId>: 'NewValueString' }

const isLoadingAction = ref(false); // Generic loading for any CUD action
const currentAction = ref(''); // To specify which action is loading e.g. 'addOptionType', 'addValue-123'
const actionFeedback = reactive({ message: '', isError: false });

function setActionFeedback(message, isError = false) {
  actionFeedback.message = message;
  actionFeedback.isError = isError;
  setTimeout(() => {
    actionFeedback.message = '';
    actionFeedback.isError = false;
  }, 4000);
}

async function fetchProductOptions() {
  if (!props.productId) return;
  isLoading.value = true;
  fetchError.value = '';
  try {
    const response = await $axios.get(`/admin/products/${props.productId}/options`);
    productOptions.value = response.data;
    // Initialize newOptionValues keys for existing options
    response.data.forEach(opt => {
      if (!newOptionValues[opt.id]) {
        newOptionValues[opt.id] = '';
      }
    });
  } catch (error) {
    console.error('Error fetching product options:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load product options.';
  } finally {
    isLoading.value = false;
  }
}

async function handleAddOptionType() {
  if (!newOptionName.value.trim()) return;
  isLoadingAction.value = true;
  currentAction.value = 'addOptionType';
  try {
    await $axios.post(`/admin/products/${props.productId}/options`, { name: newOptionName.value.trim() });
    newOptionName.value = '';
    setActionFeedback('Option type added successfully.', false);
    await fetchProductOptions(); // Refresh list
  } catch (error) {
    console.error('Error adding option type:', error);
    setActionFeedback(error.response?.data?.message || 'Failed to add option type.', true);
  } finally {
    isLoadingAction.value = false;
    currentAction.value = '';
  }
}

async function handleDeleteOptionType(optionId) {
  if (!confirm(`Are you sure you want to delete this option type? All its values and associations with variants will be removed.`)) return;
  isLoadingAction.value = true;
  currentAction.value = `deleteOptionType-${optionId}`;
  try {
    await $axios.delete(`/admin/product-options/${optionId}`);
    setActionFeedback('Option type deleted successfully.', false);
    await fetchProductOptions(); // Refresh list
  } catch (error) {
    console.error('Error deleting option type:', error);
    setActionFeedback(error.response?.data?.message || 'Failed to delete option type.', true);
  } finally {
    isLoadingAction.value = false;
    currentAction.value = '';
  }
}

async function handleAddOptionValue(optionId) {
  const value = newOptionValues[optionId]?.trim();
  if (!value) return;
  isLoadingAction.value = true;
  currentAction.value = `addValue-${optionId}`;
  try {
    await $axios.post(`/admin/product-options/${optionId}/values`, { value: value });
    newOptionValues[optionId] = ''; // Clear input
    setActionFeedback('Option value added successfully.', false);
    await fetchProductOptions(); // Refresh list
  } catch (error) {
    console.error('Error adding option value:', error);
    setActionFeedback(error.response?.data?.message || 'Failed to add option value.', true);
  } finally {
    isLoadingAction.value = false;
    currentAction.value = '';
  }
}

async function handleDeleteOptionValue(valueId, optionIdForFeedback) {
   if (!confirm(`Are you sure you want to delete this option value? This may affect existing product variants.`)) return;
  isLoadingAction.value = true;
  currentAction.value = `deleteValue-${valueId}`;
  try {
    await $axios.delete(`/admin/product-option-values/${valueId}`);
    setActionFeedback('Option value deleted successfully.', false);
    await fetchProductOptions(); // Refresh list
  } catch (error) {
    console.error('Error deleting option value:', error);
    setActionFeedback(error.response?.data?.message || 'Failed to delete option value.', true);
  } finally {
    isLoadingAction.value = false;
    currentAction.value = '';
  }
}

// Edit functions are simplified for now (not implemented with inline edit or modals)
// async function promptEditOptionName(option) {
//   const newName = prompt("Enter new name for option:", option.name);
//   if (newName && newName.trim() !== option.name) {
//     // Call PUT /api/admin/product-options/:optionId { name: newName }
//   }
// }
// async function promptEditOptionValue(value, optionId) {
//   const newValue = prompt("Enter new value:", value.value);
//   if (newValue && newValue.trim() !== value.value) {
//     // Call PUT /api/admin/product-option-values/:valueId { value: newValue }
//   }
// }


onMounted(fetchProductOptions);

// Watch for productId changes if this component can be reused for different products without remounting
watch(() => props.productId, (newProductId, oldProductId) => {
  if (newProductId !== oldProductId && newProductId) {
    fetchProductOptions();
  }
});

</script>

<style scoped>
.options-manager {
  margin-top: 2rem;
  padding: 1.5rem;
}
.options-manager h3 { margin-top:0; }
.section { margin-bottom: 1.5rem; }
.form-inline { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.form-inline input[type="text"] { flex-grow: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.form-inline button { padding: 0.5rem 1rem; background-color: #007bff; color: white; border:none; border-radius: 4px; cursor:pointer; }
.form-inline button:disabled { background-color: #aaa; }
.form-inline button:hover:not(:disabled) { background-color: #0056b3; }

.options-list { list-style: none; padding: 0; }
.option-item {
  margin-bottom: 1rem;
  padding: 1rem;
  /* background-color: #f9f9f9; */
  /* border: 1px solid #eee; */
  /* border-radius: 4px; */
}
.option-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.option-header strong { font-size: 1.1em; }
.option-actions button, .value-actions button { font-size: 0.8em; margin-left: 0.5rem; }

.values-list { list-style: none; padding-left: 1rem; margin-top: 0.5rem; }
.value-item { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px dotted #eee; }
.value-item:last-child { border-bottom: none; }
.no-values { color: #777; font-style: italic; }
.add-value-form { margin-top: 0.75rem; }

.delete-link-button { background-color: #dc3545; color:white; }
.delete-link-button:hover:not(:disabled) { background-color: #c82333; }
.edit-link-button { background-color: #ffc107; color:#333; }
.edit-link-button:hover:not(:disabled) { background-color: #e0a800; }


.loading-state, .error-message, .empty-state, .action-feedback { text-align: center; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
.loading-state { background-color: #eef; }
.error-message, .action-feedback.error { background-color: #fdd; color: #900; }
.action-feedback.success { background-color: #dfd; color: #070; }
.empty-state { background-color: #f8f9fa; }

.card { /* Re-added basic card style for nested items */
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
</style>

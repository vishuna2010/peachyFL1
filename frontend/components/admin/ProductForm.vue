<template>
  <form @submit.prevent="handleSubmit" class="space-y-6 bg-white shadow sm:rounded-lg p-6">
    <div>
      <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Product Name:</label>
      <input type="text" id="name" v-model="formData.name" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditCoreDetails && props.isEditMode" />
    </div>

    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description:</label>
      <textarea id="description" v-model="formData.description" rows="4" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditCoreDetails && props.isEditMode"></textarea>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
      <div>
        <label for="price" class="block text-sm font-medium text-gray-700 mb-1">Selling Price:</label>
        <input type="number" id="price" v-model.number="formData.price" required min="0" step="0.01" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditPrice && props.isEditMode" />
      </div>
      <div>
        <label for="cost_price" class="block text-sm font-medium text-gray-700 mb-1">Cost Price:</label>
        <input type="number" id="cost_price" v-model.number="formData.cost_price" min="0" step="0.01" placeholder="0.00" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditPrice && props.isEditMode" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
      <div>
        <label for="category_id" class="block text-sm font-medium text-gray-700 mb-1">Category:</label>
        <select id="category_id" v-model="formData.category_id" class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditCategory && props.isEditMode">
          <option :value="null">-- Select Category --</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>
      <div>
        <label for="supplier_id" class="block text-sm font-medium text-gray-700 mb-1">Supplier:</label>
        <select id="supplier_id" v-model="formData.supplier_id" class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditSupplier && props.isEditMode">
          <option :value="null">-- No Supplier --</option>
          <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
            {{ supplier.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div class="sm:col-span-2">
            <label for="sku" class="block text-sm font-medium text-gray-700 mb-1">SKU (Stock Keeping Unit):</label>
            <input type="text" id="sku" v-model="formData.sku" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditCoreDetails && props.isEditMode" />
        </div>
        <div class="sm:col-span-2">
            <label for="stock_quantity" class="block text-sm font-medium text-gray-700 mb-1">Stock Quantity:</label>
            <input type="number" id="stock_quantity" v-model.number="formData.stock_quantity" required min="0" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditStock && props.isEditMode" />
        </div>
        <div class="sm:col-span-2">
            <label for="reorder_threshold" class="block text-sm font-medium text-gray-700 mb-1">Reorder Threshold (Optional):</label>
            <input type="number" id="reorder_threshold" v-model.number="formData.reorder_threshold" min="0" placeholder="Leave empty for no threshold" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditStock && props.isEditMode" />
        </div>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <!-- Tax Class Selector - Placed within the form grid -->
        <div class="sm:col-span-2"> <!-- Spanning full width like Tags input -->
          <label for="product_tax_class_id" class="block text-sm font-medium text-gray-700 mb-1">Tax Class</label>
          <div v-if="props.isLoadingTaxClasses" class="mt-1 text-sm text-gray-500">Loading tax classes...</div>
          <div v-else-if="props.taxClassesError" class="mt-1 text-sm text-red-600">{{ props.taxClassesError }}</div>
          <select
            v-else
            id="product_tax_class_id"
            name="tax_class_id"
            v-model="formData.tax_class_id"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm"
            :disabled="!props.canEditTaxClass && props.isEditMode"
          >
            <option :value="null">-- No Tax Class --</option>
            <option v-for="taxClass in props.availableTaxClasses" :key="taxClass.id" :value="taxClass.id">
              {{ taxClass.name }}
            </option>
          </select>
          <p v-if="!props.isLoadingTaxClasses && props.availableTaxClasses.length === 0 && !props.taxClassesError" class="mt-1 text-xs text-gray-500">
            No tax classes available.
          </p>
        </div>
    </div>

    <div>
        <label for="tags" class="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated):</label>
        <input type="text" id="tags" v-model="tagsInput" placeholder="e.g., electronics, new, popular" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" :disabled="!props.canEditTags && props.isEditMode" />
        <p class="mt-2 text-xs text-gray-500">Product tags will be created if they don't exist.</p>
    </div>

    <div>
      <label for="productImage" class="block text-sm font-medium text-gray-700 mb-1">Product Image:</label>
      <input type="file" id="productImage" @change="handleFileChange" accept="image/*" class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-peach-pink/10 file:text-peach-pink hover:file:bg-peach-pink/20" :disabled="!props.canManageImage && props.isEditMode" />
      <div v-if="isEditMode && formData.image_url && !newImagePreview" class="mt-3">
        <p class="text-sm text-gray-700 mb-1">Current Image:</p>
        <img :src="formData.image_url.startsWith('http') ? formData.image_url : `${backendUrl}${formData.image_url}`" alt="Current product image" class="max-h-48 rounded border border-gray-200 shadow-sm" />
        <button v-if="props.canManageImage" type="button" @click="removeCurrentImage" class="mt-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">Remove Image</button>
      </div>
      <div v-if="newImagePreview" class="mt-3">
        <p class="text-sm text-gray-700 mb-1">New Image Preview:</p>
        <img :src="newImagePreview" alt="New image preview" class="max-h-48 rounded border border-gray-200 shadow-sm" />
      </div>
    </div>

    <div v-if="apiError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <span class="block sm:inline">{{ apiError }}</span>
    </div>

    <div class="pt-5">
      <div class="flex justify-end space-x-3">
         <!-- Placeholder for a cancel button/link if needed in future -->
         <!-- <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink">Cancel</button> -->
        <button type="submit" :disabled="isSubmitting" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-50 disabled:cursor-not-allowed">
          <span v-if="isSubmitting" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isEditMode ? 'Updating...' : 'Creating...' }}
          </span>
          <span v-else>
            {{ isEditMode ? 'Update Product' : 'Create Product' }}
          </span>
        </button>
      </div>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref, watch, computed } from 'vue';
import { useRuntimeConfig } from '#app';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      price: 0,
      stock_quantity: 0,
      category_id: null,
      supplier_id: null,
      sku: '',
      reorder_threshold: null, // Added default
      tags: [],
      image_url: null,
    })
  },
  categories: {
    type: Array,
    default: () => []
  },
  suppliers: {
    type: Array,
    default: () => []
  },
  isEditMode: {
    type: Boolean,
    default: false
  },
  isSubmitting: {
    type: Boolean,
    default: false
  },
  apiError: {
    type: String,
    default: ''
  },
  availableTaxClasses: { // New
    type: Array,
    default: () => []
  },
  isLoadingTaxClasses: { // New
    type: Boolean,
    default: false
  },
  taxClassesError: { // New
    type: String,
    default: null
  },
  // Permissions props
  canEditCoreDetails: { type: Boolean, default: true }, // General edit access for name, desc, sku, etc.
  canEditPrice: { type: Boolean, default: true },
  canEditStock: { type: Boolean, default: true },
  canEditCategory: { type: Boolean, default: true },
  canEditSupplier: { type: Boolean, default: true },
  canEditTaxClass: { type: Boolean, default: true },
  canEditTags: { type: Boolean, default: true },
  canManageImage: { type: Boolean, default: true }
});

const emit = defineEmits(['submit']);
const runtimeConfig = useRuntimeConfig();
const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

// Initialize formData with a structure that includes all fields
const initialFormData = {
  name: '',
  description: '',
  price: 0,
  stock_quantity: 0,
  category_id: null,
  supplier_id: null,
  sku: '',
  reorder_threshold: null,
  tags: [],
  image_url: null,
  tax_class_id: null,
  cost_price: null, // Add cost_price
  ...props.initialData // Spread initialData to overwrite defaults
};
const formData = reactive(initialFormData);
const tagsInput = ref(initialFormData.tags ? initialFormData.tags.join(', ') : '');


const selectedFile = ref(null);
const newImagePreview = ref(null);
const imageRemovalFlag = ref(false);


watch(() => props.initialData, (newData) => {
  if (newData) {
    // Update each field individually to maintain reactivity if initialData is not fully structured
    formData.name = newData.name || '';
    formData.description = newData.description || '';
    formData.price = newData.price || 0;
    formData.stock_quantity = newData.stock_quantity || 0;
    formData.category_id = newData.category_id === undefined ? null : newData.category_id; // Ensure null if not present
    formData.supplier_id = newData.supplier_id === undefined ? null : newData.supplier_id;
    formData.sku = newData.sku || '';
    formData.reorder_threshold = newData.reorder_threshold === undefined ? null : newData.reorder_threshold;
    formData.image_url = newData.image_url || null;
    formData.tags = newData.tags || []; // Ensure tags is an array
    formData.tax_class_id = newData.tax_class_id === undefined ? null : newData.tax_class_id;
    formData.cost_price = newData.cost_price === undefined ? null : newData.cost_price; // Update cost_price

    tagsInput.value = newData.tags ? newData.tags.join(', ') : '';
    selectedFile.value = null;
    newImagePreview.value = null;
    imageRemovalFlag.value = false;
  }
}, { immediate: true, deep: true });

function handleFileChange(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    imageRemovalFlag.value = false;
    const reader = new FileReader();
    reader.onload = (e) => {
      newImagePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    selectedFile.value = null;
    newImagePreview.value = null;
  }
}

function removeCurrentImage() {
    imageRemovalFlag.value = true;
    formData.image_url = null;
    selectedFile.value = null;
    newImagePreview.value = null;
}


const handleSubmit = () => {
  if (!formData.name.trim()) {
    alert('Product name is required.'); // Consider replacing alert with a more integrated error display
    return;
  }

  const submissionData = new FormData();

  // Process and append formData fields
  const processedFormData = { ...formData };

  // Ensure numeric fields that can be empty/null are handled correctly
  processedFormData.category_id = processedFormData.category_id === '' ? null : processedFormData.category_id;
  processedFormData.supplier_id = processedFormData.supplier_id === '' ? null : processedFormData.supplier_id;
  processedFormData.reorder_threshold = (processedFormData.reorder_threshold === '' || processedFormData.reorder_threshold === undefined)
                                        ? null
                                        : parseInt(processedFormData.reorder_threshold);
  if (isNaN(processedFormData.reorder_threshold)) processedFormData.reorder_threshold = null;

  // Note: The ProductForm doesn't currently have a 'specifications' field in its template or formData.
  // If it were to be added, its handling would be here.
  // For now, this loop correctly handles existing fields.

  for (const key in processedFormData) {
    if (key === 'tags') continue; // Tags are handled separately

    let valueToAppend = processedFormData[key];

    // Special handling for tax_class_id and cost_price to send empty string for null
    if (key === 'tax_class_id' || key === 'cost_price') {
      if (valueToAppend === null) {
        submissionData.append(key, ''); // Backend may convert '' to null for numeric/date types if validator is set up
      } else if (valueToAppend !== undefined) {
        submissionData.append(key, valueToAppend);
      }
      continue;
    }

    if (key === 'specifications') { // Existing logic for specifications if any
      if (typeof valueToAppend === 'object' && valueToAppend !== null) {
        valueToAppend = JSON.stringify(valueToAppend);
      } else if (valueToAppend === undefined) {
        continue; // Skip undefined specifications
      }
    }

    if (valueToAppend !== null && valueToAppend !== undefined) {
      submissionData.append(key, valueToAppend);
    } else if (key === 'image_url' && imageRemovalFlag.value) {
      submissionData.append('image_url', '');
    }
    // For other fields that are null/undefined and not image_url with removal flag, they are omitted.
    // This is generally fine if backend treats missing optional fields as no-change.
    // Note: FormData converts null to the string "null". If the backend expects actual null
    // for empty optional fields and not the string "null", those fields should ideally be omitted
    // from appending if their value is null. The current backend PUT route handles empty strings as null for some fields.
    // The `valueToAppend !== null` check handles this for most fields.
  }

  // Handle tags
  if (tagsInput.value.trim()) {
    const tagsArray = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (tagsArray.length > 0) {
        tagsArray.forEach(tag => submissionData.append('tags[]', tag));
    } else {
        submissionData.append('tags[]', '');
    }
  } else {
     submissionData.append('tags[]', '');
  }

  if (selectedFile.value) {
    submissionData.append('productImage', selectedFile.value);
  }

  if (imageRemovalFlag.value && !selectedFile.value && props.isEditMode) {
      submissionData.set('image_url', '');
  }


  emit('submit', submissionData);
};
</script>

<!-- <style scoped> removed -->

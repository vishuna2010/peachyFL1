<template>
  <form @submit.prevent="handleSubmit" class="product-form">
    <div class="form-group">
      <label for="name">Product Name:</label>
      <input type="text" id="name" v-model="formData.name" required />
    </div>

    <div class="form-group">
      <label for="description">Description:</label>
      <textarea id="description" v-model="formData.description"></textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="price">Price:</label>
        <input type="number" id="price" v-model.number="formData.price" required min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label for="stock_quantity">Stock Quantity:</label>
        <input type="number" id="stock_quantity" v-model.number="formData.stock_quantity" required min="0" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="category_id">Category:</label>
        <select id="category_id" v-model="formData.category_id">
          <option :value="null">-- Select Category --</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="supplier_id">Supplier:</label>
        <select id="supplier_id" v-model="formData.supplier_id">
          <option :value="null">-- No Supplier --</option>
          <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
            {{ supplier.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="sku">SKU (Stock Keeping Unit):</label>
            <input type="text" id="sku" v-model="formData.sku" />
        </div>
        <div class="form-group">
            <label for="reorder_threshold">Reorder Threshold (Optional):</label>
            <input type="number" id="reorder_threshold" v-model.number="formData.reorder_threshold" min="0" placeholder="Leave empty for no threshold" />
        </div>
    </div>

    <div class="form-group">
        <label for="tags">Tags (comma-separated):</label>
        <input type="text" id="tags" v-model="tagsInput" placeholder="e.g., electronics, new, popular" />
        <small>Product tags will be created if they don't exist.</small>
    </div>

    <div class="form-group">
      <label for="productImage">Product Image:</label>
      <input type="file" id="productImage" @change="handleFileChange" accept="image/*" />
      <div v-if="isEditMode && formData.image_url && !newImagePreview" class="image-preview">
        <p>Current Image:</p>
        <img :src="formData.image_url.startsWith('http') ? formData.image_url : `${backendUrl}${formData.image_url}`" alt="Current product image" />
        <button type="button" @click="removeCurrentImage" class="remove-image-button">Remove Image</button>
      </div>
      <div v-if="newImagePreview" class="image-preview">
        <p>New Image Preview:</p>
        <img :src="newImagePreview" alt="New image preview" />
      </div>
    </div>

    <div v-if="apiError" class="error-message">{{ apiError }}</div>

    <button type="submit" :disabled="isSubmitting" class="submit-button">
      {{ isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Product' : 'Create Product') }}
    </button>
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
  }
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
    alert('Product name is required.');
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


  for (const key in processedFormData) {
    if (key === 'tags') continue; // Tags handled separately below

    if (processedFormData[key] !== null && processedFormData[key] !== undefined) {
      submissionData.append(key, processedFormData[key]);
    } else if (key === 'image_url' && imageRemovalFlag.value) {
        // If imageRemovalFlag is true, it means formData.image_url was already set to null.
        // We want to tell the backend to set image_url to null.
        // Sending an empty string for 'image_url' can be interpreted by backend as nullification.
        submissionData.append('image_url', ''); // Or explicit 'null' string if backend handles that
    }
    // If a field in processedFormData is null (e.g. category_id after processing) and it's not image_url removal case,
    // it simply won't be appended if the condition is `!== null && !== undefined`.
    // This is generally fine for optional fields.
    // If backend expects null for empty optional fields, ensure they are appended as empty string or explicit null.
    // Example: For supplier_id, if it's null, it won't be appended. Backend should treat missing field as no change or null for new.
  }

  // Handle tags
  if (tagsInput.value.trim()) {
    const tagsArray = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (tagsArray.length > 0) {
        tagsArray.forEach(tag => submissionData.append('tags[]', tag));
    } else {
        submissionData.append('tags[]', ''); // Send empty array signal if all tags removed
    }
  } else {
     submissionData.append('tags[]', ''); // Send empty array signal if field was cleared
  }

  if (selectedFile.value) {
    submissionData.append('productImage', selectedFile.value);
  }
  // Note: if `imageRemovalFlag.value` is true, `formData.image_url` was already set to null.
  // The loop for `processedFormData` will skip appending `image_url` if it's null,
  // unless we explicitly handle it like `submissionData.append('image_url', '')` as above.
  // The PUT logic in backend `routes/products.js` for `image_url` checks:
  // `else if (newImageUrlFromRequest === null && currentImageUrl)`
  // `newImageUrlFromRequest` comes from `req.body.image_url`.
  // FormData does not directly send `null`. If `image_url` is `null` in `formData`, it might not be sent.
  // To signal removal, `image_url` should be sent as an empty string or a specific keyword if needed.
  // The current `removeCurrentImage` sets `formData.image_url = null`.
  // The loop for `submissionData.append` might skip it.
  // Let's ensure explicit removal signal:
  if (imageRemovalFlag.value && !selectedFile.value && props.isEditMode) {
      submissionData.set('image_url', ''); // Use .set to ensure it's there, or make it 'null_flag'
  }


  emit('submit', submissionData);
};
</script>

<style scoped>
.product-form {
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}
.form-group input[type="text"],
.form-group input[type="number"],
.form-group input[type="file"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.form-group textarea {
  min-height: 100px;
}
.form-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}
.form-row .form-group {
    flex: 1;
    min-width: 200px;
}
.image-preview {
  margin-top: 0.5rem;
}
.image-preview img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  border: 1px solid #eee;
}
.remove-image-button {
    display: block;
    margin-top: 0.5rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.8em;
    color: #dc3545;
    background-color: transparent;
    border: 1px solid #dc3545;
    border-radius: 4px;
    cursor: pointer;
}
.remove-image-button:hover {
    background-color: #dc3545;
    color: white;
}
.submit-button {
  padding: 0.75rem 1.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}
.submit-button:disabled {
  background-color: #aaa;
}
.submit-button:hover:not(:disabled) {
  background-color: #0056b3;
}
.error-message {
  color: red;
  background-color: #ffe0e0;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  text-align: center;
}
small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85em;
  color: #6c757d;
}
</style>

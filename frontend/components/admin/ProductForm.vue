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

    <div class="form-group">
      <label for="sku">SKU (Stock Keeping Unit):</label>
      <input type="text" id="sku" v-model="formData.sku" />
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
      supplier_id: null, // Added
      sku: '',           // Added
      tags: [],          // Expect tags as an array of names
      image_url: null,
    })
  },
  categories: { // Expect categories to be passed as a prop
    type: Array,
    default: () => []
  },
  suppliers: { // Expect suppliers to be passed as a prop
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

const formData = reactive({ ...props.initialData });
const tagsInput = ref(props.initialData.tags ? props.initialData.tags.join(', ') : '');
const selectedFile = ref(null);
const newImagePreview = ref(null);
// Reactive flag to indicate if current image should be removed (by setting image_url to null)
const imageRemovalFlag = ref(false);


watch(() => props.initialData, (newData) => {
  if (newData) {
    Object.assign(formData, newData);
    tagsInput.value = newData.tags ? newData.tags.join(', ') : '';
    selectedFile.value = null; // Reset file input on data change
    newImagePreview.value = null;
    imageRemovalFlag.value = false;
  }
}, { immediate: true, deep: true });

function handleFileChange(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    imageRemovalFlag.value = false; // If new file is selected, don't remove current image based on button
    // Generate preview
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
    formData.image_url = null; // Clear current image_url from formData immediately for UI feedback
    selectedFile.value = null; // Ensure no new file is selected
    newImagePreview.value = null; // Clear preview
    // The parent component will need to handle newImageUrlFromRequest: null when submitting
}


const handleSubmit = () => {
  if (!formData.name.trim()) {
    alert('Product name is required.');
    return;
  }

  // Create a FormData object to handle file upload along with other data
  const submissionData = new FormData();

  // Append all formData fields. Convert nulls appropriately.
  for (const key in formData) {
    if (key === 'tags') continue; // Tags handled separately
    if (formData[key] !== null && formData[key] !== undefined) {
      submissionData.append(key, formData[key]);
    }
  }

  // Handle tags
  if (tagsInput.value.trim()) {
    const tagsArray = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    if (tagsArray.length > 0) {
        tagsArray.forEach(tag => submissionData.append('tags[]', tag)); // Send as array
    }
  } else {
     submissionData.append('tags[]', ''); // Send empty array if no tags to clear them
  }

  // Handle file
  if (selectedFile.value) {
    submissionData.append('productImage', selectedFile.value);
  } else if (imageRemovalFlag.value && props.isEditMode) {
    // This tells the backend to set image_url to null
    submissionData.append('image_url', null);
  }
  // If no new file and not removing, existing image_url in formData (if any) will be used by backend if it supports not sending the field

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

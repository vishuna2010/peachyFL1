<template>
  <div class="p-4 border border-gray-200 rounded-lg shadow-sm mt-6 bg-white">
    <h3 class="text-xl font-semibold text-gray-800 mb-4">Product Image Gallery</h3>

    <div v-if="isLoading" class="text-center py-6">
      <p class="text-gray-500">Loading images...</p>
      <!-- You can add a spinner here -->
    </div>

    <div v-else-if="error" class="my-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm">
      <p>Error loading images: {{ error }}</p>
      <button @click="fetchImages" class="mt-2 px-3 py-1.5 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
    </div>

    <div v-else>
      <!-- Add New Image Button -->
      <div class="mb-4 text-right">
        <button @click="openImageUploadModal" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
          Add New Image
        </button>
      </div>

      <!-- Image Grid Display -->
      <div v-if="images.length === 0" class="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-md">
        No images in the gallery for this product yet.
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div v-for="image in images" :key="image.id" class="border rounded-md p-2 shadow-sm relative">
          <img :src="image.image_url" :alt="image.alt_text || 'Product Image'" class="w-full h-32 object-cover rounded-md mb-2" />
          <p class="text-xs text-gray-600 truncate" :title="image.alt_text || 'No alt text'">Alt: {{ image.alt_text || 'N/A' }}</p>
          <p class="text-xs text-gray-500">Order: {{ image.display_order }}</p>
          <div class="mt-1" v-if="image.is_primary">
            <span class="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
              Primary
            </span>
          </div>

          <div class="mt-2 space-x-1 text-xs">
            <button @click="promptEditImageDetails(image)" class="text-blue-600 hover:text-blue-800">Edit</button>
            <button
              @click="handleSetAsPrimary(image.id)"
              v-if="!image.is_primary"
              :disabled="actionLoading.type === 'set_primary' && actionLoading.id === image.id"
              class="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              Set Primary
            </button>
            <button
              @click="handleDeleteImage(image.id)"
              :disabled="actionLoading.type === 'delete' && actionLoading.id === image.id"
              class="text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              <span v-if="actionLoading.type === 'delete' && actionLoading.id === image.id">Deleting...</span>
              <span v-else>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Basic Image Upload Modal (Placeholder) -->
    <div v-if="showUploadModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h4 class="text-lg font-medium text-gray-900 mb-4">Upload New Image</h4>
        <input type="file" @change="onFileSelected" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
        <div class="mt-2">
          <label for="upload_alt_text" class="block text-sm font-medium text-gray-700">Alt Text (Optional)</label>
          <input type="text" id="upload_alt_text" v-model="uploadForm.alt_text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
        </div>
        <div class="mt-2">
          <label for="upload_display_order" class="block text-sm font-medium text-gray-700">Display Order (Optional)</label>
          <input type="number" id="upload_display_order" v-model.number="uploadForm.display_order" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" placeholder="0" />
        </div>
        <div class="mt-3 flex items-center">
            <input id="upload_is_primary" type="checkbox" v-model="uploadForm.is_primary" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
            <label for="upload_is_primary" class="ml-2 block text-sm text-gray-900">Set as primary image</label>
        </div>
        <div v-if="uploadError" class="mt-3 text-sm text-red-600">{{ uploadError }}</div>
        <div class="mt-6 flex justify-end space-x-3">
          <button @click="closeImageUploadModal" type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button @click="submitNewImage" :disabled="!selectedFile || isUploading" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            <span v-if="isUploading">Uploading...</span>
            <span v-else>Upload</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Basic Edit Image Details Modal (Placeholder) -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h4 class="text-lg font-medium text-gray-900 mb-4">Edit Image Details (ID: {{ editForm.id }})</h4>
         <div class="mt-2">
          <label :for="'edit_alt_text_' + editForm.id" class="block text-sm font-medium text-gray-700">Alt Text</label>
          <input type="text" :id="'edit_alt_text_' + editForm.id" v-model="editForm.alt_text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
        </div>
        <div class="mt-2">
          <label :for="'edit_display_order_' + editForm.id" class="block text-sm font-medium text-gray-700">Display Order</label>
          <input type="number" :id="'edit_display_order_' + editForm.id" v-model.number="editForm.display_order" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
        </div>
        <div class="mt-3 flex items-center">
            <input :id="'edit_is_primary_' + editForm.id" type="checkbox" v-model="editForm.is_primary" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
            <label :for="'edit_is_primary_' + editForm.id" class="ml-2 block text-sm text-gray-900">Set as primary image</label>
        </div>
        <div v-if="editError" class="mt-3 text-sm text-red-600">{{ editError }}</div>
        <div class="mt-6 flex justify-end space-x-3">
          <button @click="closeEditModal" type="button" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button @click="submitEditImageDetails" :disabled="isUpdating" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            <span v-if="isUpdating">Saving...</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true,
  }
});

const { $axios } = useNuxtApp();
const toast = useToast();

const images = ref([]);
const isLoading = ref(false);
const error = ref(null);
const actionLoading = ref({ type: null, id: null }); // For row-specific actions

// Upload Modal State
const showUploadModal = ref(false);
const selectedFile = ref(null);
const uploadForm = reactive({
  alt_text: '',
  display_order: 0,
  is_primary: false,
});
const isUploading = ref(false);
const uploadError = ref(null);

// Edit Modal State
const showEditModal = ref(false);
const editForm = reactive({
  id: null,
  alt_text: '',
  display_order: 0,
  is_primary: false,
});
const isUpdating = ref(false);
const editError = ref(null);


async function fetchImages() {
  if (!props.productId) {
    images.value = [];
    return;
  }
  isLoading.value = true;
  error.value = null;
  try {
    // The new endpoint: GET /admin/products/:productId/images
    // Note: axios instance might have /api prefix, so path is relative to that.
    const response = await $axios.get(`/admin/products/${props.productId}/images`);
    images.value = response.data;
  } catch (err) {
    console.error('Error fetching product images:', err);
    error.value = err.response?.data?.message || 'Could not load images.';
    toast.error(error.value);
  } finally {
    isLoading.value = false;
  }
}

function openImageUploadModal() {
  selectedFile.value = null;
  uploadForm.alt_text = '';
  uploadForm.display_order = images.value.length > 0 ? Math.max(...images.value.map(img => img.display_order)) + 1 : 0;
  uploadForm.is_primary = images.value.length === 0; // Make first image primary by default
  uploadError.value = null;
  showUploadModal.value = true;
}

function closeImageUploadModal() {
  showUploadModal.value = false;
}

function onFileSelected(event) {
  selectedFile.value = event.target.files[0] || null;
}

async function submitNewImage() {
  if (!selectedFile.value) {
    uploadError.value = "Please select an image file.";
    return;
  }
  isUploading.value = true;
  uploadError.value = null;

  const formData = new FormData();
  formData.append('productImage', selectedFile.value);
  formData.append('alt_text', uploadForm.alt_text);
  formData.append('display_order', uploadForm.display_order);
  formData.append('is_primary', uploadForm.is_primary);

  try {
    // POST /admin/products/:productId/images
    await $axios.post(`/admin/products/${props.productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    toast.success('Image uploaded successfully!');
    await fetchImages(); // Refresh gallery
    closeImageUploadModal();
  } catch (err) {
    console.error('Error uploading image:', err.response?.data || err);
    uploadError.value = err.response?.data?.message || 'Image upload failed.';
    toast.error(uploadError.value);
  } finally {
    isUploading.value = false;
  }
}

function promptEditImageDetails(image) {
  editForm.id = image.id;
  editForm.alt_text = image.alt_text || '';
  editForm.display_order = image.display_order || 0;
  editForm.is_primary = image.is_primary || false;
  editError.value = null;
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
}

async function submitEditImageDetails() {
  if (editForm.id === null) return;
  isUpdating.value = true;
  editError.value = null;
  try {
    // PUT /admin/images/:imageId
    await $axios.put(`/admin/images/${editForm.id}`, {
      alt_text: editForm.alt_text,
      display_order: editForm.display_order,
      is_primary: editForm.is_primary,
    });
    toast.success('Image details updated!');
    await fetchImages(); // Refresh gallery
    closeEditModal();
  } catch (err) {
    console.error('Error updating image details:', err.response?.data || err);
    editError.value = err.response?.data?.message || 'Failed to update image details.';
    toast.error(editError.value);
  } finally {
    isUpdating.value = false;
  }
}

async function handleSetAsPrimary(imageId) {
  actionLoading.value = { type: 'set_primary', id: imageId };
  try {
    // PUT /admin/images/:imageId with is_primary: true
    await $axios.put(`/admin/images/${imageId}`, { is_primary: true });
    toast.success('Image set as primary.');
    await fetchImages(); // Refresh to show updated primary status and potentially main product image
  } catch (err) {
    console.error('Error setting image as primary:', err.response?.data || err);
    toast.error(err.response?.data?.message || 'Failed to set primary image.');
  } finally {
    actionLoading.value = { type: null, id: null };
  }
}

async function handleDeleteImage(imageId) {
  if (!window.confirm('Are you sure you want to delete this image?')) return;
  actionLoading.value = { type: 'delete', id: imageId };
  try {
    // DELETE /admin/images/:imageId
    await $axios.delete(`/admin/images/${imageId}`);
    toast.success('Image deleted successfully.');
    await fetchImages(); // Refresh gallery
  } catch (err) {
    console.error('Error deleting image:', err.response?.data || err);
    toast.error(err.response?.data?.message || 'Failed to delete image.');
  } finally {
    actionLoading.value = { type: null, id: null };
  }
}

onMounted(() => {
  fetchImages();
});

watch(() => props.productId, (newId, oldId) => {
  if (newId !== oldId) {
    fetchImages();
  }
});

</script>

<style scoped>
/* Basic styling for image cards, can be enhanced */
</style>

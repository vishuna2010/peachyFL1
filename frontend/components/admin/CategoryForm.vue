<template>
  <form @submit.prevent="handleSubmit" class="space-y-6 bg-white shadow-md rounded-lg p-6 border border-gray-200">
    <FormField id="categoryName" label="Category Name">
      <input
        type="text"
        id="categoryName"
        v-model="editableName"
        required
        :disabled="isSubmitting"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
        placeholder="e.g., Electronics"
      />
    </FormField>

    <FormField id="categoryDescription" label="Description (Optional)">
      <textarea
        id="categoryDescription"
        v-model="editableDescription"
        rows="3"
        :disabled="isSubmitting"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
        placeholder="Enter a brief description for the category."
      ></textarea>
    </FormField>

    <FormField id="categoryImage" label="Category Image (Optional)">
      <div class="space-y-3">
        <!-- Image Upload -->
        <div class="flex items-center space-x-4">
          <label for="imageUpload" class="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            Upload Image
          </label>
          <input
            type="file"
            id="imageUpload"
            ref="imageInput"
            accept="image/*"
            @change="handleImageUpload"
            class="hidden"
            :disabled="isSubmitting"
          />
          <span v-if="imageUploading" class="text-sm text-gray-500">Uploading...</span>
        </div>
        
        <!-- Or enter URL -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">Or enter URL</span>
          </div>
        </div>
        
        <input
          type="url"
          id="categoryImageUrl"
          v-model="editableImageUrl"
          :disabled="isSubmitting"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
          placeholder="https://example.com/image.jpg"
        />
        <p class="text-sm text-gray-500">
          Upload an image or enter a URL. Recommended size: 400x300 pixels.
        </p>
        
        <!-- Image Preview -->
        <div v-if="editableImageUrl && isValidImageUrl" class="mt-3">
          <p class="text-sm font-medium text-gray-700 mb-2">Preview:</p>
          <div class="relative w-32 h-24 border border-gray-300 rounded-md overflow-hidden">
            <img 
              :src="editableImageUrl" 
              :alt="`Preview of ${editableName || 'category'} image`"
              class="w-full h-full object-cover"
              @error="handleImageError"
              @load="handleImageLoad"
            />
            <div v-if="imageLoading" class="absolute inset-0 bg-gray-200 flex items-center justify-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-peach-pink"></div>
            </div>
          </div>
        </div>
        
        <!-- Image Error State -->
        <div v-if="editableImageUrl && !isValidImageUrl && !imageLoading" class="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">Invalid image URL or image failed to load.</p>
        </div>
      </div>
    </FormField>

    <!-- Menu Settings -->
    <div class="space-y-4">
      <FormField id="showInMenu" label="Menu Settings">
        <div class="space-y-3">
          <label class="flex items-center">
            <input
              type="checkbox"
              id="showInMenu"
              v-model="editableShowInMenu"
              :disabled="isSubmitting"
              class="h-4 w-4 text-peach-pink focus:ring-peach-pink border-gray-300 rounded"
            />
            <span class="ml-2 text-sm text-gray-700">Show this category in the top menu bar</span>
          </label>
          
          <div v-if="editableShowInMenu" class="ml-6">
            <label for="menuOrder" class="block text-sm font-medium text-gray-700 mb-1">Menu Order</label>
            <input
              type="number"
              id="menuOrder"
              v-model="editableMenuOrder"
              :disabled="isSubmitting"
              min="0"
              class="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
              placeholder="0"
            />
            <p class="text-sm text-gray-500 mt-1">Lower numbers appear first in the menu</p>
          </div>
        </div>
      </FormField>
    </div>

     <div v-if="apiError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
      <span class="block sm:inline">{{ apiError }}</span>
    </div>

    <div class="mt-6 flex items-center justify-end space-x-4">
      <NuxtLink
        :to="cancelLink"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
      >
        Cancel
      </NuxtLink>
      <button
        type="submit"
        :disabled="isSubmitting || !isChanged"
        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isSubmitting" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ submitButtonText }}
        </span>
        <span v-else>{{ submitButtonText }}</span>
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { NuxtLink } from '#components'; // Explicit import if needed, usually auto-imported
import FormField from '~/components/admin/FormField.vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
    }),
  },
  isEditMode: {
    type: Boolean,
    default: false,
  },
  isSubmitting: {
    type: Boolean,
    default: false,
  },
  apiError: {
    type: String,
    default: '',
  },
  cancelLink: {
    type: String,
    default: '/admin/categories',
  }
});

const emit = defineEmits(['submit']);

const editableName = ref('');
const editableDescription = ref('');
const editableImageUrl = ref('');
const editableShowInMenu = ref(false);
const editableMenuOrder = ref(0);
const imageLoading = ref(false);
const isValidImageUrl = ref(false);
const imageUploading = ref(false);
const imageInput = ref(null);

watch(() => props.initialData, (newData) => {
  editableName.value = newData?.name || '';
  editableDescription.value = newData?.description || '';
  editableImageUrl.value = newData?.image_url || '';
  editableShowInMenu.value = newData?.show_in_menu || false;
  editableMenuOrder.value = newData?.menu_order || 0;
  if (newData?.image_url) {
    validateImageUrl(newData.image_url);
  }
}, { immediate: true, deep: true });

const isChanged = computed(() => {
  if (!props.isEditMode) return true; // Always enabled for new categories if fields are filled
  return (editableName.value.trim() !== (props.initialData?.name || '').trim() ||
          editableDescription.value.trim() !== (props.initialData?.description || '').trim() ||
          editableImageUrl.value.trim() !== (props.initialData?.image_url || '').trim() ||
          editableShowInMenu.value !== (props.initialData?.show_in_menu || false) ||
          editableMenuOrder.value !== (props.initialData?.menu_order || 0));
});

const submitButtonText = computed(() => {
  if (props.isSubmitting) {
    return props.isEditMode ? 'Updating...' : 'Creating...';
  }
  return props.isEditMode ? 'Update Category' : 'Create Category';
});

// Image validation and handling
const validateImageUrl = (url) => {
  if (!url) {
    isValidImageUrl.value = false;
    return;
  }
  
  // Basic URL validation
  try {
    new URL(url);
    imageLoading.value = true;
    isValidImageUrl.value = false;
  } catch {
    isValidImageUrl.value = false;
    imageLoading.value = false;
  }
};

const handleImageError = () => {
  imageLoading.value = false;
  isValidImageUrl.value = false;
};

const handleImageLoad = () => {
  imageLoading.value = false;
  isValidImageUrl.value = true;
};

// Watch for image URL changes
watch(editableImageUrl, (newUrl) => {
  if (newUrl) {
    validateImageUrl(newUrl);
  } else {
    imageLoading.value = false;
    isValidImageUrl.value = false;
  }
});

// Image upload handler
const handleImageUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  imageUploading.value = true;
  
  try {
    const formData = new FormData();
    formData.append('productImage', file);

    const response = await $fetch('/api/admin/categories/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (response.image_url) {
      editableImageUrl.value = response.image_url;
      validateImageUrl(response.image_url);
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Failed to upload image. Please try again.');
  } finally {
    imageUploading.value = false;
    // Reset the file input
    if (imageInput.value) {
      imageInput.value.value = '';
    }
  }
};

const handleSubmit = () => {
  if (!editableName.value.trim()) {
    // Consider using a prop for error display or emitting an error event
    return;
  }
   if (editableName.value.trim().length < 2) {
    return;
  }

  emit('submit', {
    name: editableName.value.trim(),
    description: editableDescription.value.trim() || null, // Send null if description is empty
    image_url: editableImageUrl.value.trim() || null, // Send null if image URL is empty
    show_in_menu: editableShowInMenu.value,
    menu_order: editableMenuOrder.value,
  });
};
</script>

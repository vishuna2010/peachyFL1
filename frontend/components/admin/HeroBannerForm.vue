<template>
  <form @submit.prevent="handleSubmit" class="space-y-6 bg-white shadow sm:rounded-lg p-6">
    <FormField label="Title" :error="fieldErrors.title">
      <input type="text" id="title" v-model="formData.title" required class="mt-1 block w-full" />
    </FormField>

    <FormField label="Subtitle" :error="fieldErrors.subtitle">
      <textarea id="subtitle" v-model="formData.subtitle" rows="3" class="mt-1 block w-full"></textarea>
    </FormField>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
      <FormField label="Button Text" :error="fieldErrors.buttonText">
        <input type="text" id="buttonText" v-model="formData.buttonText" class="mt-1 block w-full" />
      </FormField>
      <FormField label="Button Link" :error="fieldErrors.buttonLink">
        <input type="text" id="buttonLink" v-model="formData.buttonLink" placeholder="/products/some-product or https://example.com" class="mt-1 block w-full" />
      </FormField>
    </div>

    <FormField label="Image Alt Text" :error="fieldErrors.altText">
      <input type="text" id="altText" v-model="formData.altText" class="mt-1 block w-full" />
    </FormField>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Banner Image</label>
      <input type="file" id="bannerImage" @change="handleFileChange" accept="image/*" class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-peach-pink/10 file:text-peach-pink hover:file:bg-peach-pink/20" />
      <div v-if="previewImageUrl" class="mt-3">
        <p class="text-sm text-gray-700 mb-1">Image Preview:</p>
        <img :src="previewImageUrl" alt="Banner image preview" class="max-h-48 rounded border border-gray-200 shadow-sm" />
      </div>
      <input type="hidden" v-model="formData.imageUrl" /> <!-- To potentially hold existing image URL if not changed -->
       <button v-if="isEditMode && formData.imageUrl && !selectedFile" type="button" @click="markImageForRemoval" class="mt-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50">
        Remove Current Image
      </button>
      <p v-if="imageMarkedForRemoval" class="text-xs text-red-500 mt-1">Current image will be removed upon saving.</p>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
      <FormField label="Sort Order" :error="fieldErrors.sortOrder">
        <input type="number" id="sortOrder" v-model.number="formData.sortOrder" class="mt-1 block w-full" />
      </FormField>

      <div class="pt-5">
        <div class="flex items-center">
          <input id="isActive" v-model="formData.isActive" type="checkbox" class="h-4 w-4 text-peach-pink border-gray-300 rounded focus:ring-peach-pink" />
          <label for="isActive" class="ml-2 block text-sm font-medium text-gray-700">
            Active
          </label>
        </div>
      </div>
    </div>

    <div v-if="apiError" class="my-3 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm">
      {{ apiError }}
    </div>

    <div class="pt-5">
      <div class="flex justify-end space-x-3">
        <button type="button" @click="$router.push('/admin/marketing/hero-banners')" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" :disabled="isSubmitting" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-50">
          <span v-if="isSubmitting">{{ isEditMode ? 'Updating...' : 'Creating...' }}</span>
          <span v-else>{{ isEditMode ? 'Update Banner' : 'Create Banner' }}</span>
        </button>
      </div>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref, watch, computed } from 'vue';
import FormField from '~/components/admin/FormField.vue'; // Assuming a generic FormField component
import { useRuntimeConfig } from '#app';


const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      title: '',
      subtitle: '',
      buttonText: '',
      buttonLink: '',
      imageUrl: null,
      altText: '',
      isActive: true,
      sortOrder: 0,
    })
  },
  isEditMode: Boolean,
  isSubmitting: Boolean,
  apiError: String,
});

const emit = defineEmits(['submit']);
const runtimeConfig = useRuntimeConfig();
const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

const defaultFormData = () => ({
  title: '',
  subtitle: '',
  buttonText: '',
  buttonLink: '',
  imageUrl: null, // Stores existing image URL for display, not directly submitted unless no new file
  altText: '',
  isActive: true,
  sortOrder: 0,
});

const formData = reactive({ ...defaultFormData(), ...props.initialData });
const selectedFile = ref(null);
const previewImageUrl = ref(null);
const imageMarkedForRemoval = ref(false);

// Basic client-side validation errors (can be expanded)
const fieldErrors = reactive({
  title: '',
  buttonLink: '',
  altText: '',
  sortOrder: '',
});

watch(() => props.initialData, (newData) => {
  if (newData) {
    Object.assign(formData, defaultFormData(), newData); // Reset then apply new data
    selectedFile.value = null;
    imageMarkedForRemoval.value = false;
    if (newData.imageUrl) {
      // If imageUrl is already an absolute URL (starts with http/https), use it directly.
      // Otherwise, assume it might be a relative path and prepend backend URL.
      // Given cmsService returns full S3 URLs, it should usually be absolute.
      if (newData.imageUrl.startsWith('http://') || newData.imageUrl.startsWith('https://')) {
        previewImageUrl.value = newData.imageUrl;
      } else if (backendUrl.value) { // Only prepend if backendUrl is available
        previewImageUrl.value = `${backendUrl.value}${newData.imageUrl}`;
      } else {
        previewImageUrl.value = newData.imageUrl; // Fallback or if backendUrl not configured client-side
      }
    } else {
      previewImageUrl.value = null;
    }
  }
}, { immediate: true, deep: true });

function handleFileChange(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    imageMarkedForRemoval.value = false; // If a new file is chosen, don't remove
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImageUrl.value = e.target.result;
    };
    reader.readAsDataURL(file);
    formData.imageUrl = null; // Clear existing imageUrl if new file is selected
  }
}

function markImageForRemoval() {
  selectedFile.value = null;
  previewImageUrl.value = null; // Clear preview
  formData.imageUrl = null; // Clear existing URL from form data being displayed
  imageMarkedForRemoval.value = true;
}

function validateForm() {
  let isValid = true;
  fieldErrors.title = formData.title ? '' : 'Title is required.';
  if (!formData.title) isValid = false;

  // Basic URL validation for buttonLink (if present)
  if (formData.buttonLink && !formData.buttonLink.startsWith('/') && !formData.buttonLink.startsWith('http')) {
    fieldErrors.buttonLink = 'Button link must be a valid relative path (e.g., /products) or absolute URL (e.g., https://example.com).';
    isValid = false;
  } else {
    fieldErrors.buttonLink = '';
  }

  // Alt text is good practice if there's an image
  if ((selectedFile.value || formData.imageUrl) && !formData.altText) {
    fieldErrors.altText = 'Image Alt Text is recommended for accessibility.';
    // Not making it a blocking error for now, but could: isValid = false;
  } else {
    fieldErrors.altText = '';
  }

  if (typeof formData.sortOrder !== 'number') {
    fieldErrors.sortOrder = 'Sort order must be a number.';
    isValid = false;
  } else {
    fieldErrors.sortOrder = '';
  }
  return isValid;
}

const handleSubmit = () => {
  if (!validateForm()) {
    return;
  }

  const submissionData = new FormData();
  for (const key in formData) {
    if (key === 'imageUrl' && selectedFile.value) continue; // Don't send old imageUrl if new file is present
    if (formData[key] !== null && formData[key] !== undefined) {
       // FormData converts booleans to strings "true"/"false"
      submissionData.append(key, formData[key]);
    }
  }

  if (selectedFile.value) {
    submissionData.append('bannerImage', selectedFile.value); // Backend expects 'bannerImage'
  } else if (imageMarkedForRemoval.value && props.isEditMode) {
    submissionData.append('remove_image', 'true'); // Signal to backend to remove image
    // Ensure imageUrl is not sent or is explicitly nulled if remove_image is true
    if (submissionData.has('imageUrl')) {
        submissionData.delete('imageUrl');
    }
  }

  emit('submit', submissionData);
};

</script>

<style scoped>
/* Using Tailwind utilities, so minimal custom CSS needed here */
input[type="file"] {
  @apply file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-peach-pink/10 file:text-peach-pink hover:file:bg-peach-pink/20;
}
/* Standardize input styles if FormField doesn't handle it all */
input[type="text"], input[type="number"], textarea, select {
  @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm;
}
</style>

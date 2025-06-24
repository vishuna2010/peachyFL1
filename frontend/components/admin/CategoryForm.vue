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

watch(() => props.initialData, (newData) => {
  editableName.value = newData?.name || '';
  editableDescription.value = newData?.description || '';
}, { immediate: true, deep: true });

const isChanged = computed(() => {
  if (!props.isEditMode) return true; // Always enabled for new categories if fields are filled
  return (editableName.value.trim() !== (props.initialData?.name || '').trim() ||
          editableDescription.value.trim() !== (props.initialData?.description || '').trim());
});

const submitButtonText = computed(() => {
  if (props.isSubmitting) {
    return props.isEditMode ? 'Updating...' : 'Creating...';
  }
  return props.isEditMode ? 'Update Category' : 'Create Category';
});

const handleSubmit = () => {
  if (!editableName.value.trim()) {
    // Consider using a prop for error display or emitting an error event
    alert('Category name is required.'); // Placeholder for better error handling
    return;
  }
   if (editableName.value.trim().length < 2) {
    alert('Category name must be at least 2 characters long.'); // Placeholder
    return;
  }

  emit('submit', {
    name: editableName.value.trim(),
    description: editableDescription.value.trim() || null, // Send null if description is empty
  });
};
</script>

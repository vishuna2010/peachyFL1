<template>
  <form @submit.prevent="handleSubmit" class="space-y-6 bg-white shadow sm:rounded-lg p-6 border border-gray-200">
    <div>
      <label for="code" class="block text-sm font-medium text-gray-700 mb-1">Discount Code:</label>
      <input type="text" id="code" v-model="formData.code"
             :disabled="isEditMode" required
             @input="formData.code = formData.code.toUpperCase()"
             class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" />
      <p v-if="isEditMode" class="mt-1 text-xs text-gray-500">Code cannot be changed after creation.</p>
    </div>

    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description (Optional):</label>
      <textarea id="description" v-model="formData.description" rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm"></textarea>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
      <div>
        <label for="type" class="block text-sm font-medium text-gray-700 mb-1">Type:</label>
        <select id="type" v-model="formData.type" required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm">
          <option value="percentage">Percentage (%)</option>
          <option value="fixed_amount">Fixed Amount ($)</option>
        </select>
      </div>

      <div>
        <label for="value" class="block text-sm font-medium text-gray-700 mb-1">Value:</label>
        <input type="number" id="value" v-model.number="formData.value" required min="0" step="0.01"
               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" />
        <p v-if="formData.type === 'percentage'" class="mt-1 text-xs text-gray-500">Enter value between 0 and 100 (e.g., 10 for 10%).</p>
        <p v-else class="mt-1 text-xs text-gray-500">Enter fixed monetary value (e.g., 5.50 for $5.50).</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div>
            <label for="valid_from" class="block text-sm font-medium text-gray-700 mb-1">Valid From (Optional):</label>
            <input type="datetime-local" id="valid_from" v-model="formData.valid_from"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" />
        </div>

        <div>
            <label for="valid_until" class="block text-sm font-medium text-gray-700 mb-1">Valid Until (Optional):</label>
            <input type="datetime-local" id="valid_until" v-model="formData.valid_until"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" />
        </div>
    </div>

    <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div>
            <label for="usage_limit" class="block text-sm font-medium text-gray-700 mb-1">Usage Limit (Optional):</label>
            <input type="number" id="usage_limit" v-model.number="formData.usage_limit" min="0" placeholder="Leave blank for no limit"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" />
        </div>

        <div>
            <label for="min_order_amount" class="block text-sm font-medium text-gray-700 mb-1">Minimum Order Amount (Optional):</label>
            <input type="number" id="min_order_amount" v-model.number="formData.min_order_amount" min="0" step="0.01" placeholder="Leave blank for no minimum"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm" />
        </div>
    </div>

    <div class="flex items-center">
      <input type="checkbox" id="is_active" v-model="formData.is_active"
             class="h-4 w-4 text-peach-pink border-gray-300 rounded focus:ring-peach-pink" />
      <label for="is_active" class="ml-2 block text-sm text-gray-900">Is Active</label>
    </div>

    <div v-if="apiError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
      <span class="block sm:inline">{{ apiError }}</span>
    </div>

    <div class="pt-5">
      <div class="flex justify-end">
        <button type="submit" :disabled="isSubmitting"
                class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-50 disabled:cursor-not-allowed">
          <span v-if="isSubmitting" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isEditMode ? 'Updating...' : 'Creating...' }}
          </span>
          <span v-else>
            {{ isEditMode ? 'Update Discount' : 'Create Discount' }}
          </span>
        </button>
      </div>
    </div>
  </form>
</template>

<script setup>
import { ref, watch, reactive } from 'vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      code: '',
      description: '',
      type: 'percentage',
      value: 0,
      is_active: true,
      valid_from: null,
      valid_until: null,
      usage_limit: null,
      min_order_amount: null,
    })
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

// Use reactive for formData to correctly handle nested object properties if any,
// or for simpler overall reactivity management for the form object.
// Using reactive also means we don't need .value for formData's properties.
const formData = reactive({ ...props.initialData });

// Helper to format date for datetime-local input
const formatDateForInput = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  // Format: YYYY-MM-DDTHH:mm
  return date.toISOString().slice(0, 16);
};

// Watch initialData to update formData when prop changes (e.g., in edit mode after fetch)
watch(() => props.initialData, (newData) => {
  if (newData) {
    Object.assign(formData, newData);
    // Ensure dates are correctly formatted for datetime-local input
    formData.valid_from = formatDateForInput(newData.valid_from);
    formData.valid_until = formatDateForInput(newData.valid_until);
  }
}, { immediate: true, deep: true });


const handleSubmit = () => {
  // Basic client-side validation (can be expanded)
  if (!formData.code && !props.isEditMode) { // Code is required for new, not for edit (as it's disabled)
    alert('Discount code is required.'); // TODO: Replace with a non-blocking notification
    return;
  }
  if (formData.type === 'percentage' && (formData.value < 0 || formData.value > 100)) {
    alert('Percentage value must be between 0 and 100.'); // TODO: Replace
    return;
  }
  if (formData.value < 0 && (formData.type === 'percentage' || formData.type === 'fixed_amount')) {
    alert('Discount value must be non-negative.'); // TODO: Replace
    return;
  }
  // Convert empty strings for nullable number fields to null
  const payload = {
    ...formData,
    usage_limit: formData.usage_limit === '' || formData.usage_limit === null || isNaN(parseInt(formData.usage_limit)) ? null : parseInt(formData.usage_limit),
    min_order_amount: formData.min_order_amount === '' || formData.min_order_amount === null || isNaN(parseFloat(formData.min_order_amount)) ? null : parseFloat(formData.min_order_amount),
    // Ensure dates are sent in a format backend expects (ISO string or null)
    valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
    valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
  };
  emit('submit', payload);
};
</script>

<!-- <style scoped> block removed, Tailwind classes used instead -->

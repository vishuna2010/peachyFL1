<template>
  <form @submit.prevent="handleSubmit" class="discount-form">
    <div class="form-group">
      <label for="code">Discount Code:</label>
      <input type="text" id="code" v-model="formData.code" :disabled="isEditMode" required
             @input="formData.code = formData.code.toUpperCase()" />
      <small v-if="isEditMode">Code cannot be changed after creation.</small>
    </div>

    <div class="form-group">
      <label for="description">Description (Optional):</label>
      <textarea id="description" v-model="formData.description"></textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="type">Type:</label>
        <select id="type" v-model="formData.type" required>
          <option value="percentage">Percentage (%)</option>
          <option value="fixed_amount">Fixed Amount ($)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="value">Value:</label>
        <input type="number" id="value" v-model.number="formData.value" required min="0" step="0.01" />
        <small v-if="formData.type === 'percentage'">Enter value between 0 and 100 (e.g., 10 for 10%).</small>
        <small v-else>Enter fixed monetary value (e.g., 5.50 for $5.50).</small>
      </div>
    </div>

    <div class="form-group checkbox-group">
      <input type="checkbox" id="is_active" v-model="formData.is_active" />
      <label for="is_active">Is Active</label>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="valid_from">Valid From (Optional):</label>
            <input type="datetime-local" id="valid_from" v-model="formData.valid_from" />
        </div>

        <div class="form-group">
            <label for="valid_until">Valid Until (Optional):</label>
            <input type="datetime-local" id="valid_until" v-model="formData.valid_until" />
        </div>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="usage_limit">Usage Limit (Optional):</label>
            <input type="number" id="usage_limit" v-model.number="formData.usage_limit" min="0" placeholder="Leave blank for no limit" />
        </div>

        <div class="form-group">
            <label for="min_order_amount">Minimum Order Amount (Optional):</label>
            <input type="number" id="min_order_amount" v-model.number="formData.min_order_amount" min="0" step="0.01" placeholder="Leave blank for no minimum" />
        </div>
    </div>

    <div v-if="apiError" class="error-message">{{ apiError }}</div>

    <button type="submit" :disabled="isSubmitting" class="submit-button">
      {{ isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Discount' : 'Create Discount') }}
    </button>
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
    alert('Discount code is required.');
    return;
  }
  if (formData.type === 'percentage' && (formData.value < 0 || formData.value > 100)) {
    alert('Percentage value must be between 0 and 100.');
    return;
  }
  if (formData.value < 0) {
    alert('Discount value must be non-negative.');
    return;
  }
  // Convert empty strings for nullable number fields to null
  const payload = {
    ...formData,
    usage_limit: formData.usage_limit === '' || formData.usage_limit === null ? null : parseInt(formData.usage_limit),
    min_order_amount: formData.min_order_amount === '' || formData.min_order_amount === null ? null : parseFloat(formData.min_order_amount),
    // Ensure dates are sent in a format backend expects (ISO string or null)
    valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
    valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
  };
  emit('submit', payload);
};
</script>

<style scoped>
.discount-form {
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
.form-group input[type="datetime-local"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.form-group input[type="text"]:disabled {
    background-color: #e9ecef;
    cursor: not-allowed;
}
.form-group textarea {
  min-height: 80px;
}
.form-group small {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.85em;
  color: #666;
}
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.checkbox-group input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}
.form-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap; /* Allow wrapping on smaller screens */
}
.form-row .form-group {
    flex: 1;
    min-width: 200px; /* Minimum width for inputs in a row */
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
</style>

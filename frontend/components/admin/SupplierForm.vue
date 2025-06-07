<template>
  <form @submit.prevent="handleSubmit" class="supplier-form">
    <div class="form-group">
      <label for="name">Supplier Name:</label>
      <input type="text" id="name" v-model="formData.name" required />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="contact_person">Contact Person (Optional):</label>
        <input type="text" id="contact_person" v-model="formData.contact_person" />
      </div>
      <div class="form-group">
        <label for="email">Email (Optional):</label>
        <input type="email" id="email" v-model="formData.email" />
      </div>
    </div>

    <div class="form-group">
      <label for="phone">Phone (Optional):</label>
      <input type="tel" id="phone" v-model="formData.phone" />
    </div>

    <h3>Address (Optional)</h3>
    <div class="form-group">
      <label for="address_line1">Address Line 1:</label>
      <input type="text" id="address_line1" v-model="formData.address_line1" />
    </div>
    <div class="form-group">
      <label for="address_line2">Address Line 2:</label>
      <input type="text" id="address_line2" v-model="formData.address_line2" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="city">City:</label>
        <input type="text" id="city" v-model="formData.city" />
      </div>
      <div class="form-group">
        <label for="postal_code">Postal Code:</label>
        <input type="text" id="postal_code" v-model="formData.postal_code" />
      </div>
    </div>
    <div class="form-group">
      <label for="country">Country:</label>
      <input type="text" id="country" v-model="formData.country" />
    </div>

    <div class="form-group">
      <label for="notes">Notes (Optional):</label>
      <textarea id="notes" v-model="formData.notes"></textarea>
    </div>

    <div v-if="apiError" class="error-message">{{ apiError }}</div>

    <button type="submit" :disabled="isSubmitting" class="submit-button">
      {{ isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Supplier' : 'Create Supplier') }}
    </button>
  </form>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      postal_code: '',
      country: '',
      notes: '',
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

const formData = reactive({ ...props.initialData });

watch(() => props.initialData, (newData) => {
  if (newData) {
    Object.assign(formData, newData);
  }
}, { immediate: true, deep: true });

const handleSubmit = () => {
  if (!formData.name.trim()) {
    alert('Supplier name is required.');
    return;
  }
  // Create a payload with only non-empty or specifically defined values
  // to avoid sending empty strings for optional fields if not intended.
  // Or, ensure backend handles empty strings as null for nullable fields.
  // For this form, we'll send what's in formData.
  const payload = { ...formData };
  // Convert empty strings for optional fields to null if backend expects null
  for (const key in payload) {
      if (payload[key] === '') {
          payload[key] = null;
      }
  }
  emit('submit', payload);
};
</script>

<style scoped>
.supplier-form {
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
.form-group input[type="email"],
.form-group input[type="tel"],
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
h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-size: 1.1em;
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.3rem;
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

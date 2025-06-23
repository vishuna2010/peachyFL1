<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">Edit User</h2>

    <div v-if="isLoadingDetails" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading user details...</p>
    </div>

    <div v-else-if="fetchDetailsError" class="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
      <span class="block sm:inline">Error loading user details: {{ fetchDetailsError }}</span>
      <div class="mt-4">
         <button
          type="button"
          @click="navigateTo('/admin/users')"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back to User List
        </button>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6 bg-white p-6 shadow-md rounded-lg">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          id="name"
          v-model="form.name"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
      </div>

      <div>
        <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          id="email"
          v-model="form.email"
          required
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <p v-if="errors.email" class="mt-1 text-xs text-red-500">{{ errors.email }}</p>
      </div>

      <div>
        <label for="role" class="block text-sm font-medium text-gray-700">Role</label>
        <select
          id="role"
          v-model="form.role"
          required
          :disabled="isEditingSelf && originalRole === 'admin'"
          class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:opacity-70 disabled:bg-gray-100"
        >
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
        </select>
         <p v-if="isEditingSelf && originalRole === 'admin'" class="mt-1 text-xs text-gray-500">Admins cannot change their own role.</p>
        <p v-if="errors.role" class="mt-1 text-xs text-red-500">{{ errors.role }}</p>
      </div>

      <fieldset class="mt-6">
        <legend class="text-sm font-medium text-gray-700">Tax Exemption</legend>
        <div class="mt-2 space-y-4">
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="is_tax_exempt"
                name="is_tax_exempt"
                type="checkbox"
                v-model="form.is_tax_exempt"
                class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="is_tax_exempt" class="font-medium text-gray-700">Is Tax Exempt</label>
            </div>
          </div>
           <p v-if="errors.is_tax_exempt" class="mt-1 text-xs text-red-500">{{ errors.is_tax_exempt }}</p>

          <div v-if="form.is_tax_exempt">
            <div>
              <label for="tax_exemption_certificate_id" class="block text-sm font-medium text-gray-700">Tax Exemption Certificate ID</label>
              <input
                type="text"
                id="tax_exemption_certificate_id"
                v-model="form.tax_exemption_certificate_id"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Optional"
              />
              <p v-if="errors.tax_exemption_certificate_id" class="mt-1 text-xs text-red-500">{{ errors.tax_exemption_certificate_id }}</p>
            </div>
            <div class="mt-4">
              <label for="tax_exemption_notes" class="block text-sm font-medium text-gray-700">Tax Exemption Notes</label>
              <textarea
                id="tax_exemption_notes"
                v-model="form.tax_exemption_notes"
                rows="3"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Optional notes"
              ></textarea>
              <p v-if="errors.tax_exemption_notes" class="mt-1 text-xs text-red-500">{{ errors.tax_exemption_notes }}</p>
            </div>
          </div>
        </div>
      </fieldset>

      <div v-if="apiError" class="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <span class="block sm:inline">{{ apiError }}</span>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          @click="navigateTo('/admin/users')"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <span v-if="isSubmitting" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
          <span v-else>Save Changes</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, navigateTo } from '#app';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';
import { useHead } from '#imports';
import { useAuth } from '~/composables/useAuth';


definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const toast = useToast();
const { authUser } = useAuth();

const userId = ref(route.params.id);
const originalRole = ref(null); // To store the role before editing

const form = ref({
  name: '',
  email: '',
  role: 'customer', // Default, will be overridden by fetched data
  is_tax_exempt: false,
  tax_exemption_certificate_id: '',
  tax_exemption_notes: '',
});

const errors = ref({});
const apiError = ref('');
const isSubmitting = ref(false);
const isLoadingDetails = ref(true);
const fetchDetailsError = ref('');

useHead({
  title: computed(() => isLoadingDetails.value ? 'Admin - Edit User' : `Admin - Edit User: ${form.value.name || '...'}`),
});

const isEditingSelf = computed(() => {
  return authUser.value && authUser.value.id === parseInt(userId.value);
});

async function fetchUserDetails() {
  isLoadingDetails.value = true;
  fetchDetailsError.value = '';
  try {
    const response = await $axios.get(`/admin/users/${userId.value}`);
    const userData = response.data;
    form.value.name = userData.name || '';
    form.value.email = userData.email || '';
    form.value.role = userData.role || 'customer';
    originalRole.value = userData.role; // Store original role
    form.value.is_tax_exempt = userData.is_tax_exempt || false;
    form.value.tax_exemption_certificate_id = userData.tax_exemption_certificate_id || '';
    form.value.tax_exemption_notes = userData.tax_exemption_notes || '';
  } catch (err) {
    console.error('Error fetching user details:', err);
    fetchDetailsError.value = err.response?.data?.message || err.message || 'Failed to load user data.';
    toast.error(fetchDetailsError.value);
  } finally {
    isLoadingDetails.value = false;
  }
}

onMounted(() => {
  if (userId.value) {
    fetchUserDetails();
  } else {
    fetchDetailsError.value = 'User ID not found in route.';
    isLoadingDetails.value = false;
    toast.error(fetchDetailsError.value);
  }
});

const validateForm = () => {
  errors.value = {};
  let isValid = true;
  if (!form.value.name.trim()) {
    errors.value.name = 'Name is required.';
    isValid = false;
  }
  if (!form.value.email.trim()) {
    errors.value.email = 'Email is required.';
    isValid = false;
  } else if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    errors.value.email = 'Please enter a valid email address.';
    isValid = false;
  }
  if (!form.value.role) {
    errors.value.role = 'Role is required.';
    isValid = false;
  }
  if (form.value.is_tax_exempt && !form.value.tax_exemption_certificate_id?.trim()) {
    // Making certificate ID conditionally required if tax exempt is true
    // errors.value.tax_exemption_certificate_id = 'Certificate ID is required if user is tax exempt.';
    // isValid = false;
    // Decided to keep it optional as per schema. Can be enforced if business rule changes.
  }
  return isValid;
};

async function handleSubmit() {
  apiError.value = '';
  if (!validateForm()) {
    return;
  }

  if (isEditingSelf.value && form.value.role !== 'admin' && originalRole.value === 'admin') {
      apiError.value = "Administrators cannot change their own role to non-admin.";
      toast.error(apiError.value);
      form.value.role = 'admin'; // Revert role change in form
      return;
  }

  isSubmitting.value = true;
  try {
    // Construct payload with only fields that are meant to be updated
    const payload = {
      name: form.value.name,
      email: form.value.email,
      role: form.value.role,
      is_tax_exempt: form.value.is_tax_exempt,
      tax_exemption_certificate_id: form.value.tax_exemption_certificate_id?.trim() || null,
      tax_exemption_notes: form.value.tax_exemption_notes?.trim() || null,
    };

    await $axios.put(`/admin/users/${userId.value}`, payload);
    toast.success(`User "${form.value.name}" updated successfully.`);
    navigateTo('/admin/users');
  } catch (err) {
    console.error('Error updating user:', err);
    if (err.response && err.response.data) {
      if (err.response.data.errors) {
        const backendErrors = {};
        err.response.data.errors.forEach(e => {
          backendErrors[e.path] = e.msg;
        });
        errors.value = backendErrors;
        apiError.value = 'Please correct the errors above.';
      } else {
        apiError.value = err.response.data.message || 'An unexpected error occurred while updating.';
      }
    } else {
      apiError.value = 'An unexpected error occurred. Please try again.';
    }
    toast.error(apiError.value);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
/* Add any specific styles if needed */
</style>

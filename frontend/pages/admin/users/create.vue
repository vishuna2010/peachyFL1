<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">Create New User</h2>

    <form @submit.prevent="handleSubmit" class="space-y-6 bg-white p-6 shadow-md rounded-lg">
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
        <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          id="password"
          v-model="form.password"
          required
          minlength="8"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <p class="mt-1 text-xs text-gray-500">Must be at least 8 characters long.</p>
        <p v-if="errors.password" class="mt-1 text-xs text-red-500">{{ errors.password }}</p>
      </div>

      <div>
        <label for="role" class="block text-sm font-medium text-gray-700">Role</label>
        <select
          id="role"
          v-model="form.role_id"
          required
          class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option v-if="isLoadingRoles || availableRoles.length === 0" :value="null" disabled>
            {{ isLoadingRoles ? 'Loading roles...' : (rolesFetchError ? rolesFetchError : 'No roles available') }}
          </option>
          <option v-for="role_option in availableRoles" :key="role_option.id" :value="role_option.id">
            {{ role_option.name }}
          </option>
        </select>
        <p v-if="errors.role_id" class="mt-1 text-xs text-red-500">{{ errors.role_id }}</p>
      </div>

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
            Creating...
          </span>
          <span v-else>Create User</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, navigateTo } from '#app'; // For Nuxt 3 route access and navigation
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';
import { useHead } from '#imports';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Create User',
});

const { $axios } = useNuxtApp();
const route = useRoute();
// const router = useRouter(); // Not strictly needed if using navigateTo
const toast = useToast();

const form = ref({
  name: '',
  email: '',
  password: '',
  role_id: null, // Changed from role to role_id, initialized to null
});

const availableRoles = ref([]);
const isLoadingRoles = ref(true);
const rolesFetchError = ref(null);

const errors = ref({});
const apiError = ref('');
const isSubmitting = ref(false);

async function fetchAvailableRoles() {
  isLoadingRoles.value = true;
  rolesFetchError.value = null;
  try {
    const response = await $axios.get('/admin/roles');
    availableRoles.value = response.data || [];
    // Set default role_id based on query param after roles are fetched
    const queryRoleName = route.query.role; // e.g., 'admin' or 'customer'
    if (queryRoleName) {
      const targetRole = availableRoles.value.find(r => r.name.toLowerCase() === queryRoleName.toLowerCase());
      if (targetRole) {
        form.value.role_id = targetRole.id;
      } else {
        // Fallback if queryRoleName doesn't match any fetched role names
        const customerRole = availableRoles.value.find(r => r.name.toLowerCase() === 'customer');
        if (customerRole) form.value.role_id = customerRole.id;
      }
    } else {
      // Default to 'Customer' if no query param
      const customerRole = availableRoles.value.find(r => r.name.toLowerCase() === 'customer');
      if (customerRole) form.value.role_id = customerRole.id;
    }
  } catch (err) {
    console.error('Error fetching available roles:', err);
    rolesFetchError.value = err.response?.data?.message || err.message || 'Failed to load roles.';
    toast.error(rolesFetchError.value);
  } finally {
    isLoadingRoles.value = false;
  }
}

onMounted(() => {
  fetchAvailableRoles();
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
  if (!form.value.password) {
    errors.value.password = 'Password is required.';
    isValid = false;
  } else if (form.value.password.length < 8) {
    errors.value.password = 'Password must be at least 8 characters long.';
    isValid = false;
  }
  if (!form.value.role_id) { // Validate role_id
    errors.value.role_id = 'Role is required.'; // Error message for role_id
    isValid = false;
  }
  return isValid;
};

async function handleSubmit() {
  apiError.value = '';
  if (!validateForm()) {
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      name: form.value.name,
      email: form.value.email,
      password: form.value.password,
      role_id: parseInt(form.value.role_id, 10), // Ensure role_id is an integer
    };
    await $axios.post('/admin/users', payload);
    const selectedRoleName = availableRoles.value.find(r => r.id === payload.role_id)?.name || 'the selected role';
    toast.success(`User "${form.value.name}" created successfully as ${selectedRoleName}.`);
    navigateTo('/admin/users');
  } catch (err) {
    console.error('Error creating user:', err);
    if (err.response && err.response.data) {
      if (err.response.data.errors) { // Handle express-validator errors
        const backendErrors = {};
        err.response.data.errors.forEach(e => {
          backendErrors[e.path] = e.msg;
        });
        errors.value = backendErrors;
        apiError.value = 'Please correct the errors above.';
      } else {
        apiError.value = err.response.data.message || 'An unexpected error occurred.';
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

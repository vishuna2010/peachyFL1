<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">Create New Role</h2>

    <form @submit.prevent="handleSubmit" class="space-y-6 bg-white p-6 shadow-md rounded-lg">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700">Role Name</label>
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
        <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          id="description"
          v-model="form.description"
          rows="3"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        ></textarea>
        <p v-if="errors.description" class="mt-1 text-xs text-red-500">{{ errors.description }}</p>
      </div>

      <div v-if="isLoadingPermissions" class="py-4">
        <p class="text-sm text-gray-500">Loading permissions...</p>
      </div>
      <div v-else-if="permissionFetchError" class="text-red-500 py-4">
        <p>Error loading permissions: {{ permissionFetchError }}</p>
      </div>
      <fieldset v-else class="space-y-5">
        <legend class="text-lg font-medium text-gray-900 mb-2">Assign Permissions</legend>
        <div v-for="(group, groupName) in groupedPermissions" :key="groupName" class="border border-gray-200 p-4 rounded-md">
          <h4 class="text-md font-semibold text-gray-700 mb-3">{{ groupName }}</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="permission in group.permissions" :key="permission.id" class="relative flex items-start">
              <div class="flex items-center h-5">
                <input
                  :id="`permission-${permission.id}`"
                  :value="permission.id"
                  v-model="selectedPermissionIds"
                  type="checkbox"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
              </div>
              <div class="ml-3 text-sm">
                <label :for="`permission-${permission.id}`" class="font-medium text-gray-700">{{ permission.name }}</label>
                <p v-if="permission.description" class="text-gray-500 text-xs">{{ permission.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </fieldset>
      <p v-if="errors.permissionIds" class="mt-1 text-xs text-red-500">{{ errors.permissionIds }}</p>


      <div v-if="apiError" class="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <span class="block sm:inline">{{ apiError }}</span>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <NuxtLink
          to="/admin/roles"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </NuxtLink>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <span v-if="isSubmitting">Creating...</span>
          <span v-else>Create Role</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, navigateTo } from '#app';
import { useToast } from 'vue-toastification';
import { useHead } from '#imports';
// No need to import usePermissions here as this page should only be accessible if rbac:manage is true,
// which is handled by middleware or v-if on the link leading here.

definePageMeta({
  layout: 'admin',
  // middleware: ['check-permission:rbac:manage'] // Example for route-level protection if needed
});

useHead({
  title: 'Admin - Create Role',
});

const { $axios } = useNuxtApp();
const toast = useToast();

const form = ref({
  name: '',
  description: '',
});
const selectedPermissionIds = ref([]);
const groupedPermissions = ref({}); // To store permissions grouped by group_name

const errors = ref({});
const apiError = ref('');
const isSubmitting = ref(false);
const isLoadingPermissions = ref(true);
const permissionFetchError = ref(null);

async function fetchAllPermissions() {
  isLoadingPermissions.value = true;
  permissionFetchError.value = null;
  try {
    const response = await $axios.get('/admin/permissions');
    // The API returns data structured as [{ groupName: 'X', permissions: [...] }, ...]
    // We can convert this to an object for easier iteration in template if preferred, or use as is.
    // For template: v-for="(group, groupName) in groupedPermissions"
    // The API already returns it in a good format for v-for
    groupedPermissions.value = response.data;
  } catch (err) {
    console.error('Error fetching permissions:', err);
    permissionFetchError.value = err.response?.data?.message || err.message || 'Failed to load permissions list.';
    toast.error(permissionFetchError.value);
  } finally {
    isLoadingPermissions.value = false;
  }
}

onMounted(fetchAllPermissions);

const validateForm = () => {
  errors.value = {};
  let isValid = true;
  if (!form.value.name.trim()) {
    errors.value.name = 'Role name is required.';
    isValid = false;
  }
  // selectedPermissionIds can be empty, that's valid.
  return isValid;
};

async function handleSubmit() {
  apiError.value = '';
  if (!validateForm()) {
    return;
  }

  isSubmitting.value = true;
  try {
    // 1. Create the role
    const roleResponse = await $axios.post('/admin/roles', {
      name: form.value.name,
      description: form.value.description,
    });
    const newRole = roleResponse.data;

    // 2. If role creation is successful and there are permissions to assign, assign them
    if (newRole && newRole.id && selectedPermissionIds.value.length > 0) {
      await $axios.put(`/admin/roles/${newRole.id}/permissions`, {
        permissionIds: selectedPermissionIds.value,
      });
    }

    toast.success(`Role "${newRole.name}" created successfully.`);
    navigateTo('/admin/roles');
  } catch (err) {
    console.error('Error creating role:', err);
    if (err.response && err.response.data) {
      if (err.response.data.errors) {
        const backendErrors = {};
        err.response.data.errors.forEach(e => {
          backendErrors[e.path || e.param] = e.msg; // express-validator uses path or param
        });
        errors.value = backendErrors;
        apiError.value = 'Please correct the form errors.';
      } else {
        apiError.value = err.response.data.message || 'An unexpected error occurred while creating the role.';
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

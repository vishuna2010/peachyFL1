<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">Edit Role: {{ form.name || '...' }}</h2>

    <div v-if="isLoadingInitialData" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading role details and permissions...</p>
    </div>
    <div v-if="initialDataFetchError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> {{ initialDataFetchError }}</span>
       <div class="mt-4">
         <NuxtLink
          to="/admin/roles"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back to Roles List
        </NuxtLink>
      </div>
    </div>

    <form v-if="!isLoadingInitialData && !initialDataFetchError" @submit.prevent="handleSubmit" class="space-y-6 bg-white p-6 shadow-md rounded-lg">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700">Role Name</label>
        <input
          type="text"
          id="name"
          v-model="form.name"
          required
          :disabled="isCoreRole(originalRoleName)"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
        <p v-if="isCoreRole(originalRoleName)" class="mt-1 text-xs text-gray-500">Core role names cannot be changed.</p>
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

      <fieldset class="space-y-5">
        <legend class="text-lg font-medium text-gray-900 mb-2">Manage Permissions</legend>
        <div v-if="isLoadingPermissions" class="py-4">
            <p class="text-sm text-gray-500">Loading available permissions...</p>
        </div>
         <div v-else-if="permissionFetchError" class="text-red-500 py-4">
            <p>Error loading permissions: {{ permissionFetchError }}</p>
        </div>
        <div v-else v-for="(group, groupName) in groupedPermissions" :key="groupName" class="border border-gray-200 p-4 rounded-md mb-4">
          <h4 class="text-md font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">{{ groupName }}</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div v-for="permission in group.permissions" :key="permission.id" class="flex items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div class="flex items-center h-5 mt-0.5">
                <input
                  :id="`permission-${permission.id}`"
                  :value="permission.id"
                  v-model="selectedPermissionIds"
                  type="checkbox"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
              </div>
              <div class="ml-3 flex-1 min-w-0">
                <label :for="`permission-${permission.id}`" class="block text-sm font-medium text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors">
                  {{ permission.name }}
                </label>
                <p v-if="permission.description" class="text-gray-500 text-xs mt-1 leading-relaxed">
                  {{ permission.description }}
                </p>
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
          :disabled="isSubmitting || isLoadingInitialData"
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <span v-if="isSubmitting">Saving Changes...</span>
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

definePageMeta({
  layout: 'admin',
  // middleware: ['check-permission:rbac:manage'] // Example for route-level protection
});

const { $axios } = useNuxtApp();
const route = useRoute();
const toast = useToast();

const roleId = ref(route.params.id);
const originalRoleName = ref(''); // To store the initial role name for core role check

const form = ref({
  name: '',
  description: '',
});
const selectedPermissionIds = ref([]);
const groupedPermissions = ref({});

const errors = ref({});
const apiError = ref('');
const isSubmitting = ref(false);
const isLoadingInitialData = ref(true);
const initialDataFetchError = ref(null);
const isLoadingPermissions = ref(false); // Separate loading for all permissions list
const permissionFetchError = ref(null);

const CORE_ROLES = ['Super Admin', 'Customer']; // Roles that cannot have their names changed

const isCoreRole = (roleName) => {
  return CORE_ROLES.map(r => r.toLowerCase()).includes(roleName?.toLowerCase() || '');
};

useHead({
  title: computed(() => `Admin - Edit Role: ${form.value.name || '...'}`),
});

async function fetchData() {
  isLoadingInitialData.value = true;
  initialDataFetchError.value = null;
  try {
    // Fetch role details and its current permissions in parallel
    const [roleDetailsResponse, currentPermissionsResponse, allPermissionsResponse] = await Promise.all([
      $axios.get(`/admin/roles/${roleId.value}`),
      $axios.get(`/admin/roles/${roleId.value}/permissions`),
      $axios.get('/admin/permissions') // Fetch all available permissions for the checkboxes
    ]);

    const roleData = roleDetailsResponse.data;
    form.value.name = roleData.name;
    originalRoleName.value = roleData.name; // Store original name
    form.value.description = roleData.description || '';

    selectedPermissionIds.value = currentPermissionsResponse.data || []; // API returns array of IDs
    groupedPermissions.value = allPermissionsResponse.data; // API returns grouped permissions

  } catch (err) {
    console.error('Error fetching role data or permissions:', err);
    initialDataFetchError.value = err.response?.data?.message || err.message || 'Failed to load role data.';
    toast.error(initialDataFetchError.value);
  } finally {
    isLoadingInitialData.value = false;
  }
}

onMounted(() => {
  if (!roleId.value) {
    initialDataFetchError.value = 'Role ID not found in route.';
    isLoadingInitialData.value = false;
    toast.error(initialDataFetchError.value);
    navigateTo('/admin/roles');
    return;
  }
  fetchData();
});


const validateForm = () => {
  errors.value = {};
  let isValid = true;
  if (!form.value.name.trim() && !isCoreRole(originalRoleName.value)) { // Name is required unless it's a core role (name disabled)
    errors.value.name = 'Role name is required.';
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
    // 1. Update role name/description (if name is not a core role name)
    if (!isCoreRole(originalRoleName.value)) {
        await $axios.put(`/admin/roles/${roleId.value}`, {
        name: form.value.name,
        description: form.value.description,
        });
    } else if (form.value.description !== (await $axios.get(`/admin/roles/${roleId.value}`)).data.description) {
        // If only description changed for a core role
         await $axios.put(`/admin/roles/${roleId.value}`, {
            name: originalRoleName.value, // Send original name
            description: form.value.description,
        });
    }


    // 2. Update role permissions
    await $axios.put(`/admin/roles/${roleId.value}/permissions`, {
      permissionIds: selectedPermissionIds.value,
    });

    toast.success(`Role "${form.value.name}" updated successfully.`);
    navigateTo('/admin/roles');

  } catch (err) {
    console.error('Error updating role:', err);
    if (err.response && err.response.data) {
      if (err.response.data.errors) {
        const backendErrors = {};
        err.response.data.errors.forEach(e => {
          backendErrors[e.path || e.param] = e.msg;
        });
        errors.value = backendErrors;
        apiError.value = 'Please correct the form errors.';
      } else {
        apiError.value = err.response.data.message || 'An unexpected error occurred while updating the role.';
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

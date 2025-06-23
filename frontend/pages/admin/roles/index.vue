<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800">Role Management</h2>
      <NuxtLink
        v-if="can('rbac:manage').value"
        to="/admin/roles/create"
        class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Create New Role
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading roles...</p>
    </div>

    <div v-if="fetchError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> Error fetching roles: {{ fetchError }}</span>
    </div>
     <div v-if="actionError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 mt-4" role="alert">
      <span class="block sm:inline">{{ actionError }}</span>
    </div>
    <div v-if="actionSuccessMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 mt-4" role="alert">
      <span class="block sm:inline">{{ actionSuccessMessage }}</span>
    </div>


    <div v-if="roles.length > 0 && !isLoading" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="role in roles" :key="role.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ role.id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{{ role.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{{ role.description || '-' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
              <NuxtLink
                v-if="can('rbac:manage').value"
                :to="`/admin/roles/edit/${role.id}`"
                class="px-3 py-1.5 text-xs font-medium text-white bg-gray-500 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Edit / Manage Permissions
              </NuxtLink>
              <button
                v-if="can('rbac:manage').value && !isCoreRole(role.name)"
                @click="confirmDeleteRole(role)"
                :disabled="actionLoading.roleId === role.id && actionLoading.type === 'delete'"
                class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                 <span v-if="actionLoading.roleId === role.id && actionLoading.type === 'delete'">Deleting...</span>
                 <span v-else>Delete</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
     <div v-if="roles.length === 0 && !isLoading && !fetchError" class="text-center py-10">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zm3-12V3m0 18v-2" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No roles found</h3>
      <p class="mt-1 text-sm text-gray-500" v-if="can('rbac:manage').value">Get started by creating a new role.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, navigateTo } from '#app';
import { usePermissions } from '~/composables/usePermissions';
import { useHead } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});
useHead({
  title: 'Admin - Role Management',
});

const { $axios } = useNuxtApp();
const { can } = usePermissions();
const toast = useToast();

const roles = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const actionError = ref('');
const actionSuccessMessage = ref('');
const actionLoading = ref({ roleId: null, type: null });

const CORE_ROLES = ['Super Admin', 'Customer']; // Roles that cannot be deleted

const isCoreRole = (roleName) => {
  return CORE_ROLES.map(r => r.toLowerCase()).includes(roleName.toLowerCase());
};

async function fetchRoles() {
  isLoading.value = true;
  fetchError.value = null;
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    const response = await $axios.get('/admin/roles');
    roles.value = response.data;
  } catch (err) {
    console.error('Failed to fetch roles:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load roles.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
}

const confirmDeleteRole = (role) => {
  if (isCoreRole(role.name)) {
    toast.error(`Core role "${role.name}" cannot be deleted.`);
    return;
  }
  if (confirm(`Are you sure you want to delete the role "${role.name}" (ID: ${role.id})? This action cannot be undone.`)) {
    deleteRole(role.id);
  }
};

async function deleteRole(roleId) {
  actionLoading.value = { roleId: roleId, type: 'delete' };
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    await $axios.delete(`/admin/roles/${roleId}`);
    actionSuccessMessage.value = `Successfully deleted role ID ${roleId}.`;
    toast.success(actionSuccessMessage.value);
    roles.value = roles.value.filter(r => r.id !== roleId);
  } catch (err) {
    console.error('Failed to delete role:', err);
    actionError.value = err.response?.data?.message || `Failed to delete role ID ${roleId}.`;
    toast.error(actionError.value);
  } finally {
    actionLoading.value = { roleId: null, type: null };
     setTimeout(() => { // Clear messages after a delay
      actionError.value = '';
      actionSuccessMessage.value = '';
    }, 7000);
  }
}

onMounted(() => {
  if (can('rbac:manage').value || can('users:assign_roles').value) { // Check if user can even see the page conceptually
    fetchRoles();
  } else {
    isLoading.value = false;
    fetchError.value = "You do not have permission to view roles."; // Or redirect
    // Consider redirecting if no permission: navigateTo('/admin');
  }
});
</script>

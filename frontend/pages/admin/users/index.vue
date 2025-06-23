<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800">User Management</h2>
      <div class="space-x-2">
        <button
          @click="navigateToCreateUserPage('customer')"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create Customer
        </button>
        <button
          @click="navigateToCreateUserPage('admin')"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Create Admin User
        </button>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="mb-6 border-b border-gray-200">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          @click="selectTab('all')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'all' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          All Users
        </button>
        <button
          @click="selectTab('admin')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'admin' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Administrators
        </button>
        <button
          @click="selectTab('customer')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'customer' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Customers
        </button>
      </nav>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading users...</p>
    </div>

    <div v-if="fetchError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> Error fetching users: {{ fetchError.message || fetchError }}</span>
    </div>

    <div v-if="actionError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 mt-4" role="alert">
      <span class="block sm:inline">{{ actionError }}</span>
    </div>
    <div v-if="actionSuccessMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 mt-4" role="alert">
      <span class="block sm:inline">{{ actionSuccessMessage }}</span>
    </div>

    <div v-if="users.length > 0 && !isLoading" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered At</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ user.id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ user.email }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              <select
                v-model="user.role"
                @change="promptRoleChange(user, $event.target.value)"
                :disabled="isCurrentUser(user.id) || actionLoading.userId === user.id"
                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:opacity-50 disabled:bg-gray-100"
              >
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ new Date(user.created_at).toLocaleDateString() }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
              <button
                @click="confirmDeleteUser(user)"
                :disabled="isCurrentUser(user.id) || actionLoading.userId === user.id"
                class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="actionLoading.type === 'delete' && actionLoading.userId === user.id">
                  <div class="inline-block animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white mr-1"></div>Deleting...
                </span>
                <span v-else>Delete</span>
              </button>
              <button
                @click="navigateToEditUserPage(user.id)"
                class="px-3 py-1.5 text-xs font-medium text-white bg-gray-500 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Edit
              </button>
              <span v-if="actionLoading.type === 'role' && actionLoading.userId === user.id" class="text-xs text-indigo-600 italic">
                <div class="inline-block animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-indigo-500 mr-1"></div>Updating role...
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
     <div v-if="users.length === 0 && !isLoading && !fetchError" class="text-center py-10">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zm3-12V3m0 18v-2" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No users found</h3>
      <p class="mt-1 text-sm text-gray-500">There are currently no users registered in the system.</p>
    </div>
    <!-- Pagination controls would go here if implemented -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useNuxtApp } from '#app'; // Import useNuxtApp for $axios
import { useHead } from '#imports'; // Import useHead

// This is crucial for Nuxt 3 to assign the layout
definePageMeta({
  layout: 'admin',
  // title: 'User Management' // Title is set via useHead now
});

const { $axios } = useNuxtApp();
const { authUser } = useAuth(); // To check current user ID

const users = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const activeTab = ref('all'); // 'all', 'admin', 'customer'

const actionLoading = ref({ userId: null, type: null }); // { userId: number, type: 'role' | 'delete' }
const actionError = ref('');
const actionSuccessMessage = ref('');

const isCurrentUser = (userId) => {
  return authUser.value?.id === userId;
};

const navigateToCreateUserPage = (role) => {
  navigateTo(`/admin/users/create?role=${role}`);
};

const navigateToEditUserPage = (userId) => {
  navigateTo(`/admin/users/edit/${userId}`);
};

const selectTab = (tabName) => {
  activeTab.value = tabName;
  fetchUsers(); // Refetch users when tab changes
};

async function fetchUsers() {
  isLoading.value = true;
  fetchError.value = null;
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    let url = '/admin/users';
    const params = {};
    if (activeTab.value && activeTab.value !== 'all') {
      params.role = activeTab.value; // 'admin' or 'customer'
    }

    const response = await $axios.get(url, { params });
    // Store original role for comparison or reset if API call fails for role change
    users.value = response.data.map(u => ({ ...u, originalRole: u.role }));
  } catch (err) {
    console.error(`Failed to fetch users (filter: ${activeTab.value}):`, err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

const promptRoleChange = (user, newRole) => {
  if (confirm(`Are you sure you want to change the role of ${user.email} from ${user.originalRole} to ${newRole}?`)) {
    updateUserRole(user, newRole);
  } else {
    // Revert optimistic UI update if user cancels
    user.role = user.originalRole;
  }
};

async function updateUserRole(user, newRole) {
  actionLoading.value = { userId: user.id, type: 'role' };
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    await $axios.put(`/admin/users/${user.id}/role`, { role: newRole });
    actionSuccessMessage.value = `Successfully updated role for ${user.email} to ${newRole}.`;
    user.originalRole = newRole; // Update original role on success
  } catch (err) {
    console.error('Failed to update user role:', err);
    actionError.value = `Failed to update role for ${user.email}: ${err.response?.data?.message || err.message}`;
    user.role = user.originalRole; // Revert UI on error
  } finally {
    actionLoading.value = { userId: null, type: null };
    setTimeout(() => {
      actionError.value = '';
      actionSuccessMessage.value = '';
    }, 5000);
  }
}

const confirmDeleteUser = (user) => {
  if (confirm(`Are you sure you want to delete user ${user.email} (ID: ${user.id})? This action cannot be undone.`)) {
    deleteUser(user.id);
  }
};

async function deleteUser(userId) {
  actionLoading.value = { userId: userId, type: 'delete' };
  actionError.value = '';
  actionSuccessMessage.value = '';
  try {
    await $axios.delete(`/admin/users/${userId}`);
    actionSuccessMessage.value = `Successfully deleted user ID ${userId}.`;
    users.value = users.value.filter(u => u.id !== userId); // Refresh list locally
  } catch (err) {
    console.error('Failed to delete user:', err);
    actionError.value = `Failed to delete user ID ${userId}: ${err.response?.data?.message || err.message}`;
  } finally {
    actionLoading.value = { userId: null, type: null };
    setTimeout(() => {
      actionError.value = '';
      actionSuccessMessage.value = '';
    }, 5000);
  }
}

onMounted(fetchUsers);

useHead({
  title: 'Admin - User Management',
});
</script>

<!-- Removed <style scoped> section -->

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800">User Management</h2>
      <!-- Create buttons will be moved into tabs -->
    </div>

    <!-- Tabs Navigation -->
    <div class="mb-6 border-b border-gray-200">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          @click="selectTab('all')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'all' ? 'border-peach-pink text-peach-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          All Users
        </button>
        <button
          @click="selectTab('admin')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'admin' ? 'border-peach-pink text-peach-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Administrators
        </button>
        <button
          @click="selectTab('customer')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'customer' ? 'border-peach-pink text-peach-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Customers
        </button>
      </nav>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-peach-pink"></div> <!-- Themed spinner -->
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

    <!-- Tab Content Area -->
    <div>
      <!-- Button for Create Admin User - Shown only on Admin Tab -->
      <div v-if="activeTab === 'admin' && can('users:create').value" class="mb-4 text-right">
        <button
          @click="navigateToCreateUserPage('admin')"
          class="px-4 py-2 text-sm font-medium text-white bg-peach-pink rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-peach-pink focus:ring-offset-2"
        >
          Create Admin User
        </button>
      </div>

      <!-- Button for Create Customer User - Shown only on Customer Tab -->
      <div v-if="activeTab === 'customer' && can('users:create').value" class="mb-4 text-right">
        <button
          @click="navigateToCreateUserPage('customer')"
          class="px-4 py-2 text-sm font-medium text-white bg-sky-blue rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-blue focus:ring-offset-2"
        >
          Create Customer
        </button>
      </div>

      <div v-if="users.length > 0 && !isLoading" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-sky-blue/10"> <!-- Themed table header -->
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-sky-blue uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-sky-blue uppercase tracking-wider">Email</th>
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
              <!-- Role selection dropdown -->
              <select
                v-if="can('users:assign_roles').value"
                :value="user.role_id"
                @change="(event) => { console.log('SELECT @change event fired for user ID:', user.id, 'with value:', event.target.value); promptRoleChange(user, event.target.value); }"
                :disabled="isCurrentUser(user.id) || actionLoading.userId === user.id || isLoadingRoles"
                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm rounded-md disabled:opacity-50 disabled:bg-gray-100"
                :data-user-id="user.id"
              >
                <!-- Note: Using :value for one-way binding to allow programmatic revert if needed -->
                <option v-if="isLoadingRoles" :value="user.originalRoleId" disabled>Loading roles...</option>
                <option v-else-if="rolesFetchError" :value="user.originalRoleId" disabled>{{ rolesFetchError }}</option>
                <template v-else>
                  <option v-for="roleOpt in availableRoles" :key="roleOpt.id" :value="roleOpt.id">
                    {{ roleOpt.name }}
                  </option>
                </template>
              </select>
              <span v-else>{{ user.role_name || user.legacy_role || 'N/A' }}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ new Date(user.created_at).toLocaleDateString() }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
              <button
                v-if="can('users:delete').value"
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
                v-if="can('users:edit').value"
                @click="navigateToEditUserPage(user.id)"
                class="px-3 py-1.5 text-xs font-medium text-white bg-gray-500 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Edit
              </button>
              <span v-if="actionLoading.type === 'role' && actionLoading.userId === user.id && can('users:assign_roles').value" class="text-xs text-indigo-600 italic">
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
  </div> <!-- This is the closing div for "Tab Content Area" -->
</div> <!-- This is the main closing div for the page -->
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';
import { useNuxtApp } from '#app';
import { useHead } from '#imports';
import { useToast } from 'vue-toastification'; // Import useToast

const { can } = usePermissions();
const toast = useToast(); // Initialize toast

// This is crucial for Nuxt 3 to assign the layout
definePageMeta({
  layout: 'admin',
  // title: 'User Management' // Title is set via useHead now
});

const { $axios } = useNuxtApp();
const { authUser } = useAuth(); // To check current user ID
// Removed redundant: const { can } = usePermissions();

const users = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const activeTab = ref('all'); // 'all', 'admin', 'customer'

const availableRoles = ref([]);
const isLoadingRoles = ref(true); // For loading the roles dropdown
const rolesFetchError = ref(null);

const actionLoading = ref({ userId: null, type: null }); // { userId: number, type: 'role' | 'delete' }
const actionError = ref('');
const actionSuccessMessage = ref('');

const isCurrentUser = (userId) => {
  return authUser.value?.id === userId;
};

// const logUserRowDetails = (user) => { // Cleaned
//   console.log(`[UserRowDetails] User ID: ${user.id}, Email: ${user.email}`);
//   console.log(`  - can('users:assign_roles').value: ${can('users:assign_roles').value}`);
//   console.log(`  - isCurrentUser(user.id): ${isCurrentUser(user.id)}`);
//   console.log(`  - actionLoading.value.userId: ${actionLoading.value.userId}`);
//   console.log(`  - actionLoading.value.type: ${actionLoading.value.type}`);
//   console.log(`  - isLoadingRoles.value: ${isLoadingRoles.value}`);
//   const isDisabled = isCurrentUser(user.id) || actionLoading.value.userId === user.id || isLoadingRoles.value;
//   console.log(`  - Calculated :disabled state: ${isDisabled}`);
//   return '';
// };

const navigateToCreateUserPage = (role) => {
  navigateTo(`/admin/users/create?role=${role}`);
};

const navigateToEditUserPage = (userId) => {
  console.log('[navigateToEditUserPage] Navigating to edit page for userId:', userId);
  if (userId === undefined || userId === null) {
    console.error('[navigateToEditUserPage] Attempted to navigate with undefined/null userId.');
    toast.error('Cannot edit user: User ID is missing.');
    return;
  }
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
    if (activeTab.value === 'customer') {
      params.role_group = 'customer';
    } else if (activeTab.value === 'admin') {
      params.role_group = 'administrator';
    }
    // For 'all', no role_group parameter is sent, backend will interpret as all users.

    // console.log('[fetchUsers] Fetching with params:', params); // Cleaned
    const response = await $axios.get(url, { params });
    // console.log('[fetchUsers] Backend response.data:', JSON.stringify(response.data, null, 2));

    if (response.data && Array.isArray(response.data.data) && response.data.pagination) {
      users.value = response.data.data.map(u => ({
        ...u,
        originalRoleId: u.role_id,
        originalRoleName: u.role_name
      }));

      pagination.value.total_suppliers = response.data.pagination.total; // Note: Key was total_suppliers, should be total_users or generic total
      pagination.value.total_pages = response.data.pagination.totalPages;
      pagination.value.current_page = response.data.pagination.page;
      // pagination.value.limit is managed by the component's state / query params

      // console.log('[fetchUsers] Users processed. Count:', users.value.length);
      // if (users.value.length > 0) {
      //  console.log('[fetchUsers] First user object after mapping (frontend state):', JSON.stringify(users.value[0], null, 2));
      // }
    } else {
      // Handle cases where response.data.data might be missing or not an array, or pagination is missing
      users.value = [];
      pagination.value.total_suppliers = 0; // Reset relevant pagination fields
      pagination.value.total_pages = 1;
      // pagination.value.current_page might be kept or reset to 1
      console.error('[fetchUsers] Unexpected response structure from /api/admin/users:', response.data);
      fetchError.value = 'Failed to parse user data from server: Unexpected response structure.';
      toast.error(fetchError.value);
    }

  } catch (err) {
    console.error(`[fetchUsers] Failed to fetch users (filter: ${activeTab.value}):`, err.response?.data || err.message || err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load users.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
}

async function fetchAvailableRoles() {
  isLoadingRoles.value = true;
  rolesFetchError.value = null;
  try {
    const response = await $axios.get('/admin/roles');
    availableRoles.value = response.data || [];
  } catch (err) {
    console.error('Error fetching available roles:', err);
    rolesFetchError.value = err.response?.data?.message || err.message || 'Failed to load roles for dropdown.';
    toast.error(rolesFetchError.value);
  } finally {
    isLoadingRoles.value = false;
  }
}


const promptRoleChange = (user, newRoleIdString) => {
  // console.log('[promptRoleChange] Entry. User:', JSON.parse(JSON.stringify(user)), 'New Role ID String:', newRoleIdString); // Cleaned
  if (user.originalRoleId === undefined || user.originalRoleName === undefined) {
    // console.error('[promptRoleChange] User object is missing originalRoleId or originalRoleName.', user); // Keep if "User data incomplete" is still an issue
    toast.error("User data is incomplete. Cannot change role at this moment.");
    const selectElement = document.querySelector(`select[data-user-id="${user.id}"]`);
    if (selectElement && user.role_id !== undefined) {
        selectElement.value = user.role_id;
    }
    return;
  }

  const newRoleId = parseInt(newRoleIdString, 10);
  const newRole = availableRoles.value.find(r => r.id === newRoleId);
  const oldRoleName = user.originalRoleName || user.legacy_role || 'unknown';

  if (!newRole) {
    // console.log('[promptRoleChange] newRole is not found. Exiting.'); // Cleaned
    toast.error("Invalid role selected. The selection will revert.");
    return;
  }

  if (confirm(`Are you sure you want to change the role of ${user.email} from "${oldRoleName}" to "${newRole.name}"?`)) {
    // console.log('[promptRoleChange] Confirmation successful. Calling updateUserRole.'); // Cleaned
    updateUserRole(user, newRoleId, newRoleName);
  } else {
    // console.log('[promptRoleChange] Confirmation denied by user.'); // Cleaned
    // UI should revert due to :value binding
  }
};

async function updateUserRole(user, newRoleId, newRoleName) {
  // console.log(`[updateUserRole] Attempting to update user ${user.id} to roleId: ${newRoleId}`); // Cleaned
  actionLoading.value = { userId: user.id, type: 'role' };
  actionError.value = '';
  actionSuccessMessage.value = '';

  const payload = { role_id: newRoleId };
  // console.log('[updateUserRole] Payload for API:', payload); // Cleaned

  try {
    const response = await $axios.put(`/admin/users/${user.id}`, payload);
    // console.log('[updateUserRole] API Success Response:', response.data); // Cleaned
    actionSuccessMessage.value = `Successfully updated role for ${user.email} to ${newRoleName}.`;
    toast.success(actionSuccessMessage.value);

    const updatedUserFromServer = response.data;
    const userInArray = users.value.find(u => u.id === user.id);
    if (userInArray) {
      userInArray.role_id = updatedUserFromServer.role_id;
      userInArray.role_name = updatedUserFromServer.role_name;
      userInArray.legacy_role = updatedUserFromServer.legacy_role;
      userInArray.originalRoleId = updatedUserFromServer.role_id;
      userInArray.originalRoleName = updatedUserFromServer.role_name;
      // console.log(`[updateUserRole] Local user data updated for ${user.id}:`, JSON.parse(JSON.stringify(userInArray))); // Cleaned
    } else {
      // console.warn(`[updateUserRole] User ${user.id} not found in local array after update.`); // Cleaned
    }

  } catch (err) {
    // console.error('[updateUserRole] Failed to update user role API error:', err.response?.data || err.message || err); // Keep if errors persist
    actionError.value = `Failed to update role for ${user.email}: ${err.response?.data?.message || err.message}`;
    toast.error(actionError.value);

    const userInArray = users.value.find(u => u.id === user.id);
    if (userInArray && userInArray.originalRoleId !== undefined) {
      // console.log(`[updateUserRole] Error caught. Reverting role_id for ${user.id} to ${userInArray.originalRoleId}`); // Cleaned
      userInArray.role_id = userInArray.originalRoleId;
    } else {
      // console.error(`[updateUserRole] Could not revert role for user ${user.id} as originalRoleId is undefined or user not found.`); // Cleaned
    }
  } finally {
    // console.log(`[updateUserRole] Finally block for user ${user.id}. Clearing actionLoading.`); // Cleaned
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

onMounted(() => {
  fetchUsers();
  fetchAvailableRoles(); // Fetch roles when component mounts
});

useHead({
  title: 'Admin - User Management',
});
</script>

<!-- Removed <style scoped> section -->

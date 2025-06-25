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
            <!-- Log user row details (this will output to console for each row) -->
            {{ logUserRowDetails(user) }}
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

const logUserRowDetails = (user) => {
  console.log(`[UserRowDetails] User ID: ${user.id}, Email: ${user.email}`);
  console.log(`  - can('users:assign_roles').value: ${can('users:assign_roles').value}`);
  console.log(`  - isCurrentUser(user.id): ${isCurrentUser(user.id)}`);
  console.log(`  - actionLoading.value.userId: ${actionLoading.value.userId}`);
  console.log(`  - actionLoading.value.type: ${actionLoading.value.type}`);
  console.log(`  - isLoadingRoles.value: ${isLoadingRoles.value}`);
  const isDisabled = isCurrentUser(user.id) || actionLoading.value.userId === user.id || isLoadingRoles.value;
  console.log(`  - Calculated :disabled state: ${isDisabled}`);
  // Return a value that Vue can render, like an empty string or null,
  // as template expressions are expected to produce renderable output.
  return '';
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
      // Backend expects specific lowercase role names based on its validator
      if (activeTab.value === 'admin') {
        params.role = 'admin'; // Use lowercase 'admin'
      } else if (activeTab.value === 'customer') {
        params.role = 'customer'; // Use lowercase 'customer'
      }
      // Add other specific role filters here if new tabs are created,
      // ensuring they match backend validation or that backend validation is updated.
    }

    const response = await $axios.get(url, { params });
    users.value = response.data.map(u => ({
      ...u,
      originalRoleId: u.role_id, // Store original role_id
      originalRoleName: u.role_name // Store original role_name
      // The v-model for select will now bind to u.role_id directly if we change users.value structure
    }));
  } catch (err) {
    console.error(`Failed to fetch users (filter: ${activeTab.value}):`, err);
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
  console.log('[promptRoleChange] Entry. User:', JSON.parse(JSON.stringify(user)), 'New Role ID String:', newRoleIdString);
  // Ensure originalRoleId and originalRoleName are actually present on the user object from fetchUsers
  if (user.originalRoleId === undefined || user.originalRoleName === undefined) {
    console.error('[promptRoleChange] User object is missing originalRoleId or originalRoleName. Refetching users might be needed or initial fetch is incomplete.', user);
    toast.error("User data is incomplete. Cannot change role at this moment.");
    // Attempt to revert select visually if possible, though data binding should handle it
    const selectElement = document.querySelector(`select[data-user-id="${user.id}"]`);
    if (selectElement && user.role_id) { // check user.role_id to prevent error if it's also missing
        selectElement.value = user.role_id; // Revert to current role_id
    }
    return;
  }

  console.log('[promptRoleChange] User (full):', JSON.parse(JSON.stringify(user)));
  console.log('[promptRoleChange] newRoleIdString:', newRoleIdString);

  const newRoleId = parseInt(newRoleIdString, 10);
  console.log('[promptRoleChange] Parsed newRoleId:', newRoleId);
  console.log('[promptRoleChange] availableRoles.value:', JSON.parse(JSON.stringify(availableRoles.value)));

  const newRole = availableRoles.value.find(r => r.id === newRoleId);
  console.log('[promptRoleChange] Found newRole:', JSON.parse(JSON.stringify(newRole)));

  const oldRoleName = user.originalRoleName || user.legacy_role || 'unknown';
  console.log('[promptRoleChange] Old role name:', oldRoleName);

  if (!newRole) {
    console.log('[promptRoleChange] newRole is not found. Exiting.');
    toast.error("Invalid role selected. The selection will revert.");
    // No direct DOM manipulation here. Vue should revert the select based on :value="user.role_id"
    // if user.role_id wasn't actually changed to the invalid newRoleIdString.
    // To be certain, we can force a re-render or ensure the original value is still set.
    // However, since we don't update user.role_id to newRoleId until API success,
    // the select should visually snap back to user.originalRoleId if the user clicks away
    // or if Vue re-renders based on the unchanged user.role_id.
    // Forcing a re-render can be tricky; let Vue handle it based on data.
    return;
  }

  console.log(`[promptRoleChange] About to confirm: Change role of ${user.email} from "${oldRoleName}" to "${newRole.name}"?`);
  if (confirm(`Are you sure you want to change the role of ${user.email} from "${oldRoleName}" to "${newRole.name}"?`)) {
    console.log('[promptRoleChange] Confirmation successful. Calling updateUserRole.');
    updateUserRole(user, newRoleId, newRoleName);
  } else {
    console.log('[promptRoleChange] Confirmation denied by user. UI should revert due to one-way binding.');
    // No action needed here, :value="user.role_id" will ensure the select shows the current (original) role_id
    // as we haven't updated it in the data yet.
  }
};

async function updateUserRole(user, newRoleId, newRoleName) {
  console.log(`[updateUserRole] Attempting to update user ${user.id} (${user.email}) to roleId: ${newRoleId}, roleName: ${newRoleName}`);
  actionLoading.value = { userId: user.id, type: 'role' };
  actionError.value = '';
  actionSuccessMessage.value = '';

  const payload = { role_id: newRoleId };
  console.log('[updateUserRole] Payload for API:', payload);

  try {
    const response = await $axios.put(`/admin/users/${user.id}`, payload);
    console.log('[updateUserRole] API Success Response:', response.data);
    actionSuccessMessage.value = `Successfully updated role for ${user.email} to ${newRoleName}.`;
    toast.success(actionSuccessMessage.value);

    // Update local user data from the response to ensure consistency
    const updatedUserFromServer = response.data;
    const userInArray = users.value.find(u => u.id === user.id);
    if (userInArray) {
      console.log(`[updateUserRole] Updating local user data for ${user.id}. Old role_id: ${userInArray.role_id}, new: ${updatedUserFromServer.role_id}`);
      userInArray.role_id = updatedUserFromServer.role_id;
      userInArray.role_name = updatedUserFromServer.role_name; // Make sure backend returns this
      userInArray.legacy_role = updatedUserFromServer.legacy_role; // And this
      userInArray.originalRoleId = updatedUserFromServer.role_id;
      userInArray.originalRoleName = updatedUserFromServer.role_name;
      console.log(`[updateUserRole] Local user data updated for ${user.id}:`, JSON.parse(JSON.stringify(userInArray)));
    } else {
      console.warn(`[updateUserRole] User ${user.id} not found in local array after update.`);
    }

  } catch (err) {
    console.error('[updateUserRole] Failed to update user role API error:', err.response?.data || err.message || err);
    actionError.value = `Failed to update role for ${user.email}: ${err.response?.data?.message || err.message}`;
    toast.error(actionError.value);

    // Revert UI by restoring originalRoleId to the reactive user.role_id
    const userInArray = users.value.find(u => u.id === user.id);
    if (userInArray && userInArray.originalRoleId !== undefined) {
      console.log(`[updateUserRole] Error caught. Reverting role_id for ${user.id} to ${userInArray.originalRoleId}`);
      userInArray.role_id = userInArray.originalRoleId;
      // We might need to force Vue to re-render the select if it doesn't pick this up.
      // For now, relying on Vue's reactivity.
    } else {
      console.error(`[updateUserRole] Could not revert role for user ${user.id} as originalRoleId is undefined or user not found.`);
    }
  } finally {
    console.log(`[updateUserRole] Finally block for user ${user.id}. Clearing actionLoading.`);
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

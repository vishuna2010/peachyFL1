<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800 dark:text-neutral-200">User Management</h2>
      <!-- Create buttons will be moved into tabs -->
    </div>

    <!-- Tabs Navigation -->
    <div class="mb-6 border-b border-gray-200 dark:border-neutral-700">
      <nav class="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          @click="selectTab('all')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'all' ? 'border-peach-pink text-peach-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-600'
          ]"
        >
          All Users
        </button>
        <button
          @click="selectTab('administrator')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'administrator' ? 'border-peach-pink text-peach-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-600'
          ]"
        >
          Administrators
        </button>
        <button
          @click="selectTab('customer')"
          :class="[
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm',
            activeTab === 'customer' ? 'border-peach-pink text-peach-pink' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-600'
          ]"
        >
          Customers
        </button>
      </nav>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-peach-pink"></div>
      <p class="mt-2 text-sm text-gray-500 dark:text-neutral-400">Loading users...</p>
    </div>

    <div v-if="fetchError" class="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> Error fetching users: {{ fetchError }}</span>
    </div>

    <div v-if="actionError" class="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-4 mt-4" role="alert">
      <span class="block sm:inline">{{ actionError }}</span>
    </div>
    <div v-if="actionSuccessMessage" class="bg-green-100 border border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200 px-4 py-3 rounded relative mb-4 mt-4" role="alert">
      <span class="block sm:inline">{{ actionSuccessMessage }}</span>
    </div>

    <!-- Tab Content Area -->
    <div class="bg-white dark:bg-neutral-800 shadow sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-neutral-700">
        <div class="flex justify-between items-center">
          <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-neutral-100">
            {{ activeTab === 'all' ? 'All Users' : activeTab === 'administrator' ? 'Administrators' : 'Customers' }}
          </h3>
          <div v-if="activeTab === 'administrator' && can('users:create').value" class="ml-4">
            <button
              @click="navigateToCreateUserPage('admin')"
              class="px-4 py-2 text-sm font-medium text-white bg-peach-pink rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-peach-pink focus:ring-offset-2"
            >
              Create Admin User
            </button>
          </div>
           <div v-else-if="activeTab === 'customer' && can('users:create').value" class="ml-4">
            <button
              @click="navigateToCreateUserPage('customer')"
              class="px-4 py-2 text-sm font-medium text-white bg-sky-blue rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-blue focus:ring-offset-2"
            >
              Create Customer
            </button>
          </div>
        </div>
      </div>

      <div v-if="users.length > 0 && !isLoading" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
          <thead class="bg-gray-50 dark:bg-neutral-700/50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Role</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Registered At</th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50 dark:hover:bg-neutral-700/30">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-300">{{ user.id }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-neutral-100">{{ user.email }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-300">{{ user.name || 'N/A' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-300">
              <select
                v-if="can('users:assign_roles').value"
                :value="user.role_id"
                @change="(event) => { promptRoleChange(user, event.target.value); }"
                :disabled="isCurrentUser(user.id) || actionLoading.userId === user.id || isLoadingRoles"
                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-neutral-600 focus:outline-none focus:ring-peach-pink focus:border-peach-pink sm:text-sm rounded-md disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-neutral-700 dark:bg-neutral-700 dark:text-neutral-50"
                :data-user-id="user.id"
              >
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
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-300">{{ new Date(user.created_at).toLocaleDateString() }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <button
                v-if="can('users:edit').value"
                @click="navigateToEditUserPage(user.id)"
                class="text-sky-blue hover:text-sky-blue-dark dark:hover:text-sky-blue-light font-medium"
                title="Edit User Details"
              >
                Edit
              </button>
              <button
                v-if="can('users:delete').value && !isCurrentUser(user.id)"
                @click="confirmDeleteUser(user)"
                :disabled="actionLoading.userId === user.id"
                class="text-red-600 hover:text-red-800 dark:hover:text-red-400 font-medium disabled:opacity-50"
                title="Delete User"
              >
                <span v-if="actionLoading.type === 'delete' && actionLoading.userId === user.id">Deleting...</span>
                <span v-else>Delete</span>
              </button>
              <span v-if="actionLoading.type === 'role' && actionLoading.userId === user.id && can('users:assign_roles').value" class="text-xs text-indigo-600 dark:text-indigo-400 italic">
                Updating role...
              </span>
            </td>
          </tr>
        </tbody>
        </table>
      </div>
      <div v-else-if="!isLoading && !fetchError" class="text-center py-10 border border-gray-200 dark:border-neutral-700 rounded-md">
        <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zm3-12V3m0 18v-2" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-neutral-100">No users found</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">
          There are currently no users matching your criteria for "{{ activeTab }}" tab.
        </p>
      </div>

      <!-- Pagination Controls -->
      <div class="mt-6 flex justify-between items-center" v-if="pagination.total_pages > 1 && !isLoading">
        <button
          @click="changePage(pagination.current_page - 1)"
          :disabled="pagination.current_page === 1 || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <div class="text-sm text-gray-700 dark:text-neutral-300">
          Page <span class="font-medium">{{ pagination.current_page }}</span> of <span class="font-medium">{{ pagination.total_pages }}</span>
          (Total: {{ pagination.total_users }} users)
        </div>
        <button
          @click="changePage(pagination.current_page + 1)"
          :disabled="pagination.current_page >= pagination.total_pages || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';
import { useNuxtApp, useRoute, useRouter, definePageMeta, useHead, navigateTo } from '#app';
import { useToast } from 'vue-toastification';

const { can } = usePermissions();
const toast = useToast();

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - User Management',
});

const { $axios } = useNuxtApp();
const { authUser } = useAuth();
const route = useRoute();
const router = useRouter();

const users = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const activeTab = ref(route.query.role_group || 'all');

const availableRoles = ref([]);
const isLoadingRoles = ref(true);
const rolesFetchError = ref(null);

const actionLoading = ref({ userId: null, type: null });
const actionError = ref('');
const actionSuccessMessage = ref('');

const pagination = ref({
  total_users: 0, // Corrected key
  current_page: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 15,
  total_pages: 1,
});

const isCurrentUser = (userId) => {
  return authUser.value?.id === userId;
};

const navigateToCreateUserPage = (roleType) => {
  navigateTo(`/admin/users/create?role_type=${roleType}`);
};

const navigateToEditUserPage = (userId) => {
  if (userId === undefined || userId === null) {
    toast.error('Cannot edit user: User ID is missing.');
    return;
  }
  navigateTo(`/admin/users/edit/${userId}`);
};

const selectTab = (tabName) => {
  activeTab.value = tabName;
  router.push({ query: { ...route.query, role_group: tabName === 'all' ? undefined : tabName, page: '1' } });
};

async function fetchUsers(page = pagination.value.current_page, limit = pagination.value.limit) {
  isLoading.value = true;
  fetchError.value = null;

  try {
    let url = '/admin/users';
    const params = { page, limit };

    const roleGroupToFetch = activeTab.value;
    if (roleGroupToFetch && roleGroupToFetch !== 'all') {
      // Assuming backend expects 'admin' for 'administrator' tab, and 'customer' for 'customer' tab
      if (roleGroupToFetch === 'administrator') params.role = 'admin';
      else if (roleGroupToFetch === 'customer') params.role = 'customer';
    }

    console.log('[DEBUG fetchUsers] Requesting users with params:', params);
    const response = await $axios.get(url, { params });
    console.log('[DEBUG fetchUsers] Full response.data:', JSON.stringify(response.data, null, 2));

    if (response.data && Array.isArray(response.data.data) && response.data.pagination && typeof response.data.pagination === 'object') {
      users.value = response.data.data.map(u => ({
        ...u,
        originalRoleId: u.role_id,
        originalRoleName: u.role_name
      }));

      const backendPagination = response.data.pagination;

      pagination.value.total_users = typeof backendPagination.total === 'number' ? backendPagination.total : 0;
      pagination.value.total_pages = typeof backendPagination.totalPages === 'number' && backendPagination.totalPages > 0 ? backendPagination.totalPages : 1;
      pagination.value.current_page = typeof backendPagination.page === 'number' ? backendPagination.page : 1;
      pagination.value.limit = typeof backendPagination.limit === 'number' ? backendPagination.limit : limit;

    } else {
      console.error('[fetchUsers] Unexpected response structure from /api/admin/users. Full response.data:', JSON.stringify(response.data, null, 2));
      users.value = [];
      pagination.value.total_users = 0;
      pagination.value.total_pages = 1;
      pagination.value.current_page = 1;
      fetchError.value = 'Failed to parse user data or pagination from server.';
      if (toast && typeof toast.error === 'function') {
        toast.error(fetchError.value);
      }
    }
  } catch (err) {
    console.error(`[fetchUsers] Failed to fetch users (tab: ${activeTab.value}, params: ${JSON.stringify(params)}):`, err.response?.data || err.message || err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load users.';
    if (toast && typeof toast.error === 'function') {
      toast.error(fetchError.value);
    }
    users.value = [];
    pagination.value.total_users = 0;
    pagination.value.total_pages = 1;
    pagination.value.current_page = 1;
  } finally {
    isLoading.value = false;
  }
}

async function fetchAvailableRoles() {
  isLoadingRoles.value = true;
  rolesFetchError.value = null;
  try {
    const response = await $axios.get('/admin/roles');
    availableRoles.value = response.data.data || response.data || [];
  } catch (err) {
    console.error('Error fetching available roles:', err);
    rolesFetchError.value = err.response?.data?.message || err.message || 'Failed to load roles for dropdown.';
    if (toast && typeof toast.error === 'function') {
     toast.error(rolesFetchError.value);
    }
  } finally {
    isLoadingRoles.value = false;
  }
}

const promptRoleChange = (user, newRoleIdString) => {
  if (user.originalRoleId === undefined || user.originalRoleName === undefined) {
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
    toast.error("Invalid role selected. The selection will revert.");
     const selectElement = document.querySelector(`select[data-user-id="${user.id}"]`);
    if (selectElement && user.originalRoleId !== undefined) {
        selectElement.value = user.originalRoleId;
    }
    return;
  }

  if (confirm(`Are you sure you want to change the role of ${user.email} from "${oldRoleName}" to "${newRole.name}"?`)) {
    updateUserRole(user, newRoleId, newRole.name);
  } else {
    const selectElement = document.querySelector(`select[data-user-id="${user.id}"]`);
    if (selectElement && user.originalRoleId !== undefined) {
        selectElement.value = user.originalRoleId;
    }
  }
};

async function updateUserRole(user, newRoleId, newRoleNameParam) {
  actionLoading.value = { userId: user.id, type: 'role' };
  actionError.value = '';
  actionSuccessMessage.value = '';
  const payload = { role_id: newRoleId };

  try {
    const response = await $axios.put(`/admin/users/${user.id}`, payload);
    actionSuccessMessage.value = `Successfully updated role for ${user.email} to ${newRoleNameParam}.`;
    toast.success(actionSuccessMessage.value);

    const updatedUserFromServer = response.data.data || response.data;
    const userInArray = users.value.find(u => u.id === user.id);
    if (userInArray) {
      userInArray.role_id = updatedUserFromServer.role_id;
      userInArray.role_name = updatedUserFromServer.role_name;
      userInArray.legacy_role = updatedUserFromServer.legacy_role;
      userInArray.originalRoleId = updatedUserFromServer.role_id;
      userInArray.originalRoleName = updatedUserFromServer.role_name;
    }
  } catch (err) {
    actionError.value = `Failed to update role for ${user.email}: ${err.response?.data?.message || err.message}`;
    toast.error(actionError.value);
    const userInArray = users.value.find(u => u.id === user.id);
    if (userInArray && userInArray.originalRoleId !== undefined) {
      userInArray.role_id = userInArray.originalRoleId;
      const selectEl = document.querySelector(`select[data-user-id="${user.id}"]`);
      if(selectEl) selectEl.value = userInArray.originalRoleId;
    }
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
    users.value = users.value.filter(u => u.id !== userId);
  } catch (err) {
    console.error('Failed to delete user:', err);
    actionError.value = `Failed to delete user ID ${userId}: ${err.response?.data?.message || err.message}`;
    toast.error(actionError.value);
  } finally {
    actionLoading.value = { userId: null, type: null };
    setTimeout(() => {
      actionError.value = '';
      actionSuccessMessage.value = '';
    }, 5000);
  }
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.total_pages && newPage !== pagination.value.current_page) {
    router.push({ query: { ...route.query, page: newPage, limit: pagination.value.limit } });
  }
}

onMounted(() => {
  const initialPage = parseInt(route.query.page) || 1;
  const initialLimit = parseInt(route.query.limit) || pagination.value.limit;
  const initialRoleGroup = route.query.role_group || 'all';

  if (initialRoleGroup !== activeTab.value) {
      activeTab.value = initialRoleGroup;
  }
  pagination.value.current_page = initialPage;
  pagination.value.limit = initialLimit;

  fetchUsers(initialPage, initialLimit);
  fetchAvailableRoles();
});

watch(() => route.query, (newQuery, oldQuery) => {
    const newPage = parseInt(newQuery.page) || 1;
    const newLimit = parseInt(newQuery.limit) || pagination.value.limit;
    const newRoleGroup = newQuery.role_group || 'all';

    let needsFetch = false;

    if (newRoleGroup !== activeTab.value) {
        activeTab.value = newRoleGroup;
        needsFetch = true;
    }
    // Check if page or limit from query is different from current pagination state
    if (newPage !== pagination.value.current_page || newLimit !== pagination.value.limit) {
        needsFetch = true;
    }

    if (needsFetch) {
        // Update local pagination state from query before fetching
        pagination.value.current_page = newPage;
        pagination.value.limit = newLimit;
        fetchUsers(newPage, newLimit);
    }
}, { deep: true });

</script>
```

Now applying this.

<template>
  <div class="container mx-auto p-4 sm:p-6">
    <div class="bg-white shadow-lg rounded-lg p-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">User Management</h1>

      <!-- Filters and Search -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 items-end">
        <div>
          <label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search Users</label>
          <input
            type="text"
            id="search"
            v-model="searchQuery"
            placeholder="Search by name or email..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
        <div>
          <label for="role-filter" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            id="role-filter"
            v-model="selectedRole"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">All Roles</option>
            <option v-for="role in availableRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
          </select>
        </div>
        <div>
          <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            id="status-filter"
            v-model="selectedStatus"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="verified">Email Verified</option>
            <option value="unverified">Email Unverified</option>
          </select>
        </div>
        <div class="flex space-x-2">
          <button
            @click="applyFilters"
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-150 ease-in-out text-sm flex-grow"
          >
            Apply
          </button>
           <NuxtLink
            v-if="can('users:create').value"
            to="/admin/users/create"
            class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-150 ease-in-out text-sm text-center"
          >
            Add User
          </NuxtLink>
        </div>
      </div>

      <!-- Loading and Error States -->
      <div v-if="pending" class="text-center py-10">
        <p class="text-lg text-gray-600">Loading users...</p>
        <!-- You can add a spinner here -->
      </div>
      <div v-else-if="error" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-lg text-red-600">Error loading users: {{ error.message || 'Unknown error' }}</p>
        <button @click="refreshUsers" class="mt-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md text-sm">
          Retry
        </button>
      </div>

      <!-- Users Table -->
      <div v-else-if="usersToDisplay.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg shadow">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="user in usersToDisplay" :key="user.id" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ user.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ user.email }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ user.role }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
                    'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                    user.is_email_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
                  ]"
                >
                  {{ user.is_email_verified ? 'Verified' : 'Unverified' }}
                </span>
                <!-- Add more status indicators if needed, e.g. Active/Inactive -->
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ user.created_at }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <NuxtLink
                  v-if="can('users:edit').value"
                  :to="`/admin/users/${user.id}/edit`"
                  class="text-indigo-600 hover:text-indigo-900 transition-colors"
                >
                  Edit
                </NuxtLink>
                <button
                  v-if="can('users:delete').value"
                  @click="confirmDeleteUser(user)"
                  class="text-red-600 hover:text-red-900 transition-colors"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
       <div v-else class="text-center py-10">
        <p class="text-lg text-gray-600">No users found matching your criteria.</p>
      </div>

      <!-- Pagination -->
      <div v-if="!pending && !error && usersToDisplay.length > 0 && totalUsers > itemsPerPage" class="mt-6 flex items-center justify-between">
        <p class="text-sm text-gray-700">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }}
          to {{ Math.min(currentPage * itemsPerPage, totalUsers) }}
          of {{ totalUsers }} results
        </p>
        <div class="flex space-x-1">
          <button
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            v-for="page in paginationPages"
            :key="page"
            @click="changePage(page)"
            :class="[
              'px-3 py-1 border border-gray-300 rounded-md text-sm font-medium',
              currentPage === page ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700 hover:bg-gray-50',
            ]"
          >
            {{ page }}
          </button>
          <button
            @click="changePage(currentPage + 1)"
            :disabled="currentPage * itemsPerPage >= totalUsers"
            class="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Modal :is-open="showDeleteModal" @close="showDeleteModal = false" title="Confirm Deletion">
      <p class="text-gray-700 mb-4">Are you sure you want to delete user: <strong>{{ userToDelete?.name }}</strong> ({{ userToDelete?.email }})?</p>
      <p class="text-sm text-red-600 mb-4">This action cannot be undone.</p>
      <div class="flex justify-end space-x-3">
        <button @click="showDeleteModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">
          Cancel
        </button>
        <button @click="deleteUser" class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">
          Delete User
        </button>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useNuxtApp, useAsyncData, useRouter } from '#app';
import { usePermissions } from '~/composables/usePermissions';
import Modal from '~/components/common/Modal.vue'; // Assuming a common modal component

// Corrected: Only layout in definePageMeta
definePageMeta({
  layout: 'admin',
  // title: 'User Management' // Optional: for dynamic titles in layout
});

const { $axios } = useNuxtApp();
const router = useRouter();
const { can } = usePermissions();

// Filters and Pagination
const searchQuery = ref('');
const selectedRole = ref('');
const selectedStatus = ref('');
const currentPage = ref(1);
const itemsPerPage = ref(10); // Or make this configurable
const totalUsers = ref(0);

// For role filter dropdown
const availableRoles = ref([]); // Populate this from an API or define statically

const fetchAvailableRoles = async () => {
  try {
    // Corrected endpoint to fetch all roles
    const response = await $axios.get('/admin/roles');
    // The GET /api/admin/roles route returns an array of role objects directly
    if (response.data && Array.isArray(response.data)) {
      availableRoles.value = response.data; // The response itself is the array of roles
    } else {
      availableRoles.value = [{id: 1, name: 'Admin (Fallback)'}, {id: 2, name: 'User (Fallback)'}];
    }
  } catch (err) {
    // Fallback or default roles if API fails
    availableRoles.value = [{id: 1, name: 'Admin (Fallback)'}, {id: 2, name: 'User (Fallback)'}];
  }
};

onMounted(() => {
  fetchAvailableRoles();
});

// Computed query parameters for fetching users
const queryParams = computed(() => {
  const params = new URLSearchParams();
  if (searchQuery.value) params.append('search', searchQuery.value);
  if (selectedRole.value) params.append('role_id', selectedRole.value);
  if (selectedStatus.value) params.append('status', selectedStatus.value);
  params.append('page', currentPage.value.toString());
  params.append('limit', itemsPerPage.value.toString());
  // console.log('[UsersPage] Computed queryParams:', Object.fromEntries(params.entries()));
  return params;
});

// Fetching users data
const { data: usersApiResponse, pending, error, refresh: refreshUsers } = await useAsyncData(
  'admin-users',
  () => {
    const paramsObject = Object.fromEntries(queryParams.value.entries());
    // console.log('[UsersPage] Fetching users with params:', paramsObject);
    return $axios.get('/admin/users', { params: paramsObject });
  },
  {
    watch: [currentPage, itemsPerPage],
    default: () => ({ data: { users: [], total_users: 0 } })
  }
);

watch(error, (newError) => {
  if (newError) {
    // console.error('[UsersPage] Error fetching users (useAsyncData):', newError);
  }
});

const usersToDisplay = computed(() => {
  // console.log('[UsersPage CPTD] Evaluating usersToDisplay. usersApiResponse.value:', usersApiResponse.value);

  const responseData = usersApiResponse.value?.data; // This is {data: Array, pagination: Object}

  if (responseData && responseData.data && Array.isArray(responseData.data)) {
    // console.log('[UsersPage CPTD] Condition TRUE. Mapping users from responseData.data. Length:', responseData.data.length);
    const mappedUsers = responseData.data.map(user => ({
      ...user,
      role: user.role_name || user.legacy_role || 'N/A',
      created_at: new Date(user.created_at).toLocaleDateString(),
    }));
    // console.log('[UsersPage CPTD] Mapped usersToDisplay:', mappedUsers);
    return mappedUsers;
  }
  // console.log('[UsersPage CPTD] Condition FALSE or data not in expected format. Returning empty array. responseData:', responseData);
  return [];
});

// Update totalUsers when data is fetched/updated
watch(usersApiResponse, (newResponse) => {
  // console.log('[UsersPage] usersApiResponse watcher triggered. New response:', newResponse);
  if (newResponse && newResponse.data) {
    try {
      // console.log('[UsersPage] RAW API newResponse.data:', JSON.parse(JSON.stringify(newResponse.data)));
    } catch (e) {
      // console.error('[UsersPage] Could not stringify newResponse.data', e);
      // console.log('[UsersPage] RAW API newResponse.data (direct):', newResponse.data);
    }

    const apiData = newResponse.data;

    if (apiData && apiData.pagination) {
      totalUsers.value = apiData.pagination.total || 0;
      // console.log('[UsersPage] Attempted to set total_users from apiData.pagination.total. Value found:', apiData.pagination.total);
    } else {
      totalUsers.value = 0;
      // console.warn('[UsersPage] apiData.pagination or apiData.pagination.total is missing.');
    }
    // console.log('[UsersPage] Total users set to:', totalUsers.value);

    if (apiData && Array.isArray(apiData.data)) {
      // console.log('[UsersPage] apiData.data (formerly users) is an array. Length:', apiData.data.length);
    } else {
      // console.warn('[UsersPage] apiData.data (formerly users) is NOT an array or is missing. Value:', apiData ? apiData.data : 'apiData is null/undefined');
    }

  } else {
    totalUsers.value = 0;
    // console.log('[UsersPage] Total users set to 0 due to invalid newResponse or missing newResponse.data.');
  }
  // console.log(`[UsersPage] Pagination state: currentPage=${currentPage.value}, itemsPerPage=${itemsPerPage.value}, totalUsers=${totalUsers.value}`);
}, { immediate: true, deep: true });


const applyFilters = () => {
  // console.log('[UsersPage] applyFilters called.');
  currentPage.value = 1;
  refreshUsers();
};

// Watch for individual filter changes to trigger applyFilters
watch([searchQuery, selectedRole, selectedStatus], () => {
  // console.log(`[UsersPage] Filters changed: searchQuery=${searchQuery.value}, selectedRole=${selectedRole.value}, selectedStatus=${selectedStatus.value}`);
  applyFilters();
});


const changePage = (page) => {
  // console.log(`[UsersPage] changePage called with page: ${page}. Current totalUsers: ${totalUsers.value}`);
  if (page > 0 && (page - 1) * itemsPerPage.value < totalUsers.value) {
    currentPage.value = page;
  }
};

// Pagination display logic
const paginationPages = computed(() => {
  const total = Math.ceil(totalUsers.value / itemsPerPage.value);
  const current = currentPage.value;
  const maxPagesToShow = 5; // Show 5 page numbers max
  let startPage = Math.max(1, current - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(total, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow && total >= maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  return pages;
});

// Delete User Functionality
const showDeleteModal = ref(false);
const userToDelete = ref(null);

const confirmDeleteUser = (user) => {
  userToDelete.value = user;
  showDeleteModal.value = true;
};

const deleteUser = async () => {
  if (!userToDelete.value) return;
  try {
    await $axios.delete(`/admin/users/${userToDelete.value.id}`);
    showDeleteModal.value = false;
    userToDelete.value = null;
    // Add notification for success (e.g., using a toast library)
    await refreshUsers(); // Refresh the list
  } catch (err) {
    // Add notification for error
    showDeleteModal.value = false; // Still close modal on error, or handle differently
  }
};

</script>

<style scoped>
/* Add any page-specific styles if necessary */
</style>

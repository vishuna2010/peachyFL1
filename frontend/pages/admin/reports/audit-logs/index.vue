<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">System Audit Logs</h1>

    <!-- Filters Section (Basic Placeholder) -->
    <div class="mb-6 p-4 bg-white shadow rounded-lg">
      <h2 class="text-lg font-semibold text-gray-800 mb-3">Filters</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label for="userEmail" class="block text-sm font-medium text-gray-700">User Email</label>
          <input type="text" id="userEmail" v-model="filters.userEmail" @input="debouncedFetchAuditLogs"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                 placeholder="user@example.com" />
        </div>
        <div>
          <label for="actionType" class="block text-sm font-medium text-gray-700">Action Type</label>
          <input type="text" id="actionType" v-model="filters.actionType" @input="debouncedFetchAuditLogs"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                 placeholder="e.g., LOGIN_SUCCESS, CREATE_CATEGORY" />
        </div>
        <!-- Add more filters later: Date From, Date To, Resource Type, Resource ID -->
      </div>
    </div>

    <!-- Loading and Error States -->
    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading audit logs...</p>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load audit logs: {{ fetchError }}</p>
      <button @click="fetchAuditLogs(pagination.currentPage)" class="mt-2 px-3 py-1.5 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
    </div>

    <!-- Audit Log Table -->
    <div v-else-if="auditLogs.length > 0" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action Type</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="log in auditLogs" :key="log.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{{ formatTimestamp(log.timestamp) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.user_email || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ log.action_type }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              <span v-if="log.resource_type">{{ log.resource_type }}<span v-if="log.resource_id">: {{ log.resource_id }}</span></span>
              <span v-else>N/A</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ log.ip_address || 'N/A' }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">
              <button @click="showDetails(log.details)" class="text-indigo-600 hover:underline" v-if="log.details">View</button>
              <span v-else>N/A</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl">No audit logs found matching your criteria.</p>
    </div>

    <!-- Pagination (Basic Placeholder) -->
    <div v-if="!isLoading && !fetchError && auditLogs.length > 0 && pagination.totalPages > 1" class="mt-6 flex items-center justify-between">
      <p class="text-sm text-gray-700">
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }}. Total logs: {{ pagination.totalItems }}
      </p>
      <div class="flex space-x-2">
        <button @click="changePage(pagination.currentPage - 1)" :disabled="pagination.currentPage <= 1 || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <button @click="changePage(pagination.currentPage + 1)" :disabled="pagination.currentPage >= pagination.totalPages || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>

    <!-- Details Modal (Placeholder) -->
    <div v-if="showingDetails" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div class="bg-white p-5 rounded-lg shadow-xl w-full max-w-2xl">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-medium">Log Details</h3>
          <button @click="showingDetails = null" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <pre class="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96">{{ JSON.stringify(showingDetails, null, 2) }}</pre>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter, useRoute } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Audit Logs' });

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const auditLogs = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const showingDetails = ref(null); // Holds the details object for the modal

const filters = reactive({
  userEmail: route.query.userEmail || '',
  actionType: route.query.actionType || '',
  // Add other filters here: resourceType, resourceId, dateFrom, dateTo
});

const pagination = reactive({
  currentPage: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 20, // Default limit
  totalPages: 1,
  totalItems: 0,
});

const sortBy = ref(route.query.sortBy || 'timestamp');
const sortOrder = ref(route.query.sortOrder || 'DESC');

const formatTimestamp = (ts) => ts ? new Date(ts).toLocaleString() : 'N/A';

const fetchAuditLogs = async (page = pagination.currentPage) => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const params = {
      page,
      limit: pagination.limit,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...filters // Spread active filters
    };
    // Remove empty filters
    for (const key in params) {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    }

    const response = await $axios.get('/api/admin/audit-logs', { params });
    auditLogs.value = response.data.data;
    pagination.currentPage = response.data.pagination.currentPage;
    pagination.totalPages = response.data.pagination.totalPages;
    pagination.totalItems = response.data.pagination.totalItems;

    // Update router query without triggering navigation if page/filters changed
    // This helps with bookmarking/sharing filtered views
    if (Object.keys(params).length > 0) {
         router.replace({ query: { ...route.query, ...params } });
    }

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    fetchError.value = error.response?.data?.message || error.message || 'Could not fetch audit logs.';
    toast.error(fetchError.value);
    auditLogs.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Debounce function
let debounceTimer;
const debouncedFetchAuditLogs = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pagination.currentPage = 1; // Reset to first page on filter change
    fetchAuditLogs(1);
  }, 500); // 500ms debounce
};

const changePage = (newPage) => {
  if (newPage > 0 && newPage <= pagination.totalPages && newPage !== pagination.currentPage) {
    fetchAuditLogs(newPage);
  }
};

const showDetails = (details) => {
  showingDetails.value = details;
};

onMounted(() => {
  fetchAuditLogs();
});

// Watch for route query changes if pagination/filters are driven by URL updates from elsewhere
watch(() => route.query, (newQuery) => {
    // Update filters and pagination from route query if they differ from current state
    // This handles browser back/forward or direct URL changes
    let needsFetch = false;
    if (newQuery.page && parseInt(newQuery.page) !== pagination.currentPage) {
        pagination.currentPage = parseInt(newQuery.page);
        needsFetch = true;
    }
    if (newQuery.userEmail && newQuery.userEmail !== filters.userEmail) {
        filters.userEmail = newQuery.userEmail;
        needsFetch = true;
    }
    if (newQuery.actionType && newQuery.actionType !== filters.actionType) {
        filters.actionType = newQuery.actionType;
        needsFetch = true;
    }
    // ... add other filters if needed ...
    if (needsFetch) {
        fetchAuditLogs(pagination.currentPage);
    }
}, { deep: true });

</script>

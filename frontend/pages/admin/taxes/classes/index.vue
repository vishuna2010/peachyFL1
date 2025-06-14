<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Tax Classes</h1>
      <NuxtLink to="/admin/taxes/classes/new"
        class="inline-flex items-center justify-center rounded-md border border-transparent bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light focus:ring-offset-2 sm:w-auto">
        Add New Tax Class
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading tax classes...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-lg text-red-600">Could not load tax classes.</p>
      <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
      <button @click="fetchTaxClasses"
        class="mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="taxClasses.length === 0" class="text-center py-10">
      <p class="text-lg text-gray-500">No tax classes found.</p>
      <p class="mt-2 text-sm text-gray-600">Get started by adding a new tax class.</p>
    </div>

    <!-- Table Display -->
    <div v-else class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="tc in taxClasses" :key="tc.id">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ tc.id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{{ tc.name }}</td>
            <td class="px-4 py-3 whitespace-normal text-sm text-gray-600 max-w-md">{{ tc.description || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{{ formatTimestamp(tc.updated_at) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
              <NuxtLink :to="`/admin/taxes/classes/edit/${tc.id}`"
                class="text-indigo-600 hover:text-indigo-800 transition-colors duration-150 mr-3">Edit</NuxtLink>
              <button @click="deleteTaxClass(tc.id, tc.name)"
                class="text-red-600 hover:text-red-800 transition-colors duration-150">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination UI -->
    <div v-if="!isLoading && !fetchError && taxClasses.length > 0 && totalPages > 1" class="flex justify-between items-center mt-6">
      <div>
        <span class="text-sm text-gray-700">
          Page {{ currentPage }} of {{ totalPages }}. Total classes: {{ totalClasses }}
        </span>
      </div>
      <div class="space-x-2">
        <button @click="currentPage--" :disabled="currentPage <= 1"
          class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <button @click="currentPage++" :disabled="currentPage >= totalPages"
          class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Tax Classes' });

const { $axios } = useNuxtApp();
const router = useRouter(); // Not strictly needed for this page yet, but good for consistency
const toast = useToast();

const taxClasses = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(15); // Items per page
const totalClasses = ref(0);

const formatTimestamp = (ts) => ts ? new Date(ts).toLocaleString() : 'N/A';

const fetchTaxClasses = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/api/admin/tax-classes', {
      params: {
        page: currentPage.value,
        limit: limit.value,
      }
    });
    taxClasses.value = response.data.data;
    totalPages.value = response.data.pagination.totalPages || 1;
    totalClasses.value = response.data.pagination.total;
    currentPage.value = response.data.pagination.page;
  } catch (error) {
    console.error('Error fetching tax classes:', error);
    fetchError.value = error.response?.data?.message || error.message || 'Could not fetch tax classes.';
    toast.error(fetchError.value);
    taxClasses.value = []; // Clear data on error
    totalPages.value = 1;
    totalClasses.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const deleteTaxClass = async (classId, className) => {
  if (!confirm(`Are you sure you want to delete tax class "${className}" (ID: ${classId})? This action cannot be undone.`)) {
    return;
  }
  try {
    await $axios.delete(`/api/admin/tax-classes/${classId}`);
    toast.success(`Tax class "${className}" deleted successfully.`);
    // Refresh the list. If on last page and it becomes empty, go to prev page.
    if (taxClasses.value.length === 1 && currentPage.value > 1) {
      currentPage.value--;
    } else {
      fetchTaxClasses();
    }
  } catch (error) {
    console.error(`Error deleting tax class ${classId}:`, error);
    toast.error(error.response?.data?.message || `Failed to delete tax class "${className}".`);
  }
};

onMounted(() => {
  fetchTaxClasses();
});

watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    fetchTaxClasses();
  }
});
</script>

<style scoped>
/* Using global Tailwind classes, specific styles can be added here if needed */
</style>

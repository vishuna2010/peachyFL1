<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Tax Rates</h1>
      <NuxtLink to="/admin/taxes/rates/new"
        class="inline-flex items-center justify-center rounded-md border border-transparent bg-peach-pink px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-blue-deep focus:outline-none focus:ring-2 focus:ring-peach-pink focus:ring-offset-2 sm:w-auto">
        Add New Tax Rate
      </NuxtLink>
    </div>

    <!-- Filter Section (Note: Filters may need alignment with backend capabilities) -->
    <div class="mb-6 p-4 border rounded-md bg-gray-50 shadow">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label for="filter_tax_class_id" class="block text-sm font-medium text-gray-700">Tax Class</label>
          <select v-model="filters.tax_class_id" id="filter_tax_class_id"
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
            <option :value="null">All Tax Classes</option>
            <option v-for="tc in availableTaxClassesForFilter" :key="tc.id" :value="tc.id">{{ tc.name }}</option>
          </select>
        </div>
        <div>
          <label for="filter_country" class="block text-sm font-medium text-gray-700">Country Code</label>
          <input type="text" v-model="filters.country" id="filter_country" placeholder="e.g., US, GB (2 letters)"
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
        </div>
        <!-- Add more relevant filters if needed, e.g., state_province -->
      </div>
      <div class="mt-4 flex space-x-3 justify-end">
         <button @click="applyFilters"
                class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-sky-blue-deep focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink">
          Apply Filters
        </button>
        <button @click="resetFilters"
                class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
          Reset Filters
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading tax rates...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-lg text-red-600">Could not load tax rates.</p>
      <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
      <button @click="fetchTaxRates"
        class="mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-sky-blue-deep focus:outline-none focus:ring-2 focus:ring-peach-pink focus:ring-offset-2">
        Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="taxRates.length === 0" class="text-center py-10">
      <p class="text-lg text-gray-500">No tax rates found.</p>
      <p class="mt-2 text-sm text-gray-600">Get started by adding a new tax rate.</p>
    </div>

    <!-- Table Display -->
    <div v-else class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jurisdiction</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Class</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compound</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="rate in taxRates" :key="rate.id">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ rate.id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{{ rate.name }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ formatPercentage(rate.rate) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ formatJurisdiction(rate) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ rate.tax_class_name || rate.tax_class_id }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              <span :class="rate.is_compound ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                {{ rate.is_compound ? 'Yes' : 'No' }}
              </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ rate.priority }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{{ formatDate(rate.updated_at) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
              <NuxtLink :to="`/admin/taxes/rates/edit/${rate.id}`"
                class="text-indigo-600 hover:text-indigo-800 transition-colors duration-150 mr-3">Edit</NuxtLink>
              <button @click="deleteTaxRate(rate.id, rate.name)"
                class="text-red-600 hover:text-red-800 transition-colors duration-150">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination UI -->
    <div v-if="!isLoading && !fetchError && taxRates.length > 0 && totalPages > 1" class="flex justify-between items-center mt-6">
      <div>
        <span class="text-sm text-gray-700">
          Page {{ currentPage }} of {{ totalPages }}. Total rates: {{ totalRates }}
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
import { ref, onMounted, watch, computed } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Tax Rates' });

const { $axios } = useNuxtApp();
const router = useRouter();
const toast = useToast();

const taxRates = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(15);
const totalRates = ref(0);

const availableTaxClassesForFilter = ref([]);

const initialFilters = {
  tax_class_id: null,
  country: ''
};
const filters = ref({ ...initialFilters });

const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
const formatPercentage = (decimalRate) => {
  if (typeof decimalRate === 'number') {
    return (decimalRate * 100).toFixed(2) + '%';
  }
  return '0.00%';
};
const formatJurisdiction = (rate) => {
  const parts = [rate.country, rate.state_province, rate.postal_code].filter(Boolean); // Filter out null/empty strings
  return parts.length > 0 ? parts.join(', ') : 'Global';
};


const fetchTaxClassesForFilter = async () => {
  try {
    const response = await $axios.get('/admin/tax-classes', { params: { limit: 500 } }); // Fetch a large number for filter
    availableTaxClassesForFilter.value = response.data.data;
  } catch (error) {
    console.error('Error fetching tax classes for filter dropdown:', error);
    toast.error('Could not load tax classes for filter.');
  }
};


const fetchTaxRates = async () => {
  isLoading.value = true;
  fetchError.value = null;

  const params = {
    page: currentPage.value,
    limit: limit.value,
    sortBy: 'name', // Default sort, can be changed
    sortOrder: 'ASC'
  };

  if (filters.value.tax_class_id) {
    params.tax_class_id = filters.value.tax_class_id;
  }
  if (filters.value.country && filters.value.country.trim()) {
    params.country = filters.value.country.trim().toUpperCase();
  }

  // Note: The backend route for GET /admin/tax-rates was updated to accept tax_class_id and country.
  // The old filters (is_active, tax_type, generic jurisdiction) are no longer sent.

  try {
    const response = await $axios.get('/admin/tax-rates', { params });
    taxRates.value = response.data.data;
    totalPages.value = response.data.pagination.totalPages || 1;
    totalRates.value = response.data.pagination.totalItems || response.data.pagination.total || 0; // Adjusted to match potential variations
    currentPage.value = response.data.pagination.currentPage || response.data.pagination.page || 1;
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    fetchError.value = error.response?.data?.message || error.message || 'Could not fetch tax rates.';
    toast.error(fetchError.value);
    taxRates.value = [];
    totalPages.value = 1;
    totalRates.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const applyFilters = () => {
  currentPage.value = 1;
  fetchTaxRates();
};

const resetFilters = () => {
  filters.value = { ...initialFilters };
  applyFilters();
};

const deleteTaxRate = async (rateId, rateName) => {
  if (!confirm(`Are you sure you want to delete tax rate "${rateName}" (ID: ${rateId})? This action cannot be undone.`)) {
    return;
  }
  try {
    await $axios.delete(`/admin/tax-rates/${rateId}`);
    toast.success(`Tax rate "${rateName}" deleted successfully.`);
    if (taxRates.value.length === 1 && currentPage.value > 1) {
      currentPage.value--; // Go to previous page if last item on current page was deleted
    } else {
      fetchTaxRates(); // Otherwise, just refetch current page
    }
  } catch (error) {
    console.error(`Error deleting tax rate ${rateId}:`, error);
    toast.error(error.response?.data?.message || `Failed to delete tax rate "${rateName}".`);
  }
};

onMounted(() => {
  fetchTaxRates();
  fetchTaxClassesForFilter();
});

watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    fetchTaxRates();
  }
});
</script>

<style scoped>
/* Using global Tailwind classes. */
</style>

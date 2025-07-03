<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <!-- Loading State for initial Tax Class fetch -->
    <div v-if="isLoading && !taxClass" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading tax class details...</p>
    </div>

    <!-- Error State for initial Tax Class fetch -->
    <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-lg text-red-600">Could not load tax class details.</p>
      <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
      <NuxtLink to="/admin/taxes/classes"
        class="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
        Back to List
      </NuxtLink>
    </div>

    <!-- Main Content -->
    <div v-else-if="taxClass" class="max-w-3xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">
          Edit Tax Class: <span class="text-brand-primary">{{ taxClass.name }}</span>
        </h1>
        <NuxtLink to="/admin/taxes/classes"
          class="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to List
        </NuxtLink>
      </div>


      <!-- Form for Name/Description -->
      <form @submit.prevent="handleUpdateSubmit" class="bg-white shadow-md rounded-lg p-6 border border-gray-200 space-y-6 mb-8">
        <div>
          <label for="className" class="block text-sm font-medium text-gray-700 mb-1">
            Tax Class Name <span class="text-red-500">*</span>
          </label>
          <input type="text" id="className" v-model.trim="className" required
                 class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                 :disabled="isSaving">
        </div>
        <div>
          <label for="classDescription" class="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea id="classDescription" v-model.trim="classDescription" rows="3"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    :disabled="isSaving"></textarea>
        </div>
        <div class="flex justify-end">
          <button type="submit" :disabled="isSaving"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            <span v-if="isSaving">Saving...</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </form>

      <!-- Linked Rates Section -->
      <div class="bg-white shadow-md rounded-lg p-6 border border-gray-200 mb-8">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Linked Tax Rates</h2>
        <div v-if="isRatesLoading" class="text-center text-gray-500 py-4">Loading linked rates...</div>
        <div v-else-if="linkedRates.length === 0" class="text-center text-gray-500 py-4">No tax rates are currently linked to this class.</div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jurisdiction</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="rate in linkedRates" :key="rate.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{{ rate.id }}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{{ rate.name }}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{{ (rate.rate * 100).toFixed(2) }}%</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{{ rate.country || 'N/A' }}{{ rate.state_province ? ', ' + rate.state_province : '' }}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm">
                  <button @click="handleUnlinkRate(rate.id, rate.name)" class="text-red-600 hover:text-red-800">Unlink</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Link New Rate Section -->
      <div class="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Link New Tax Rate</h2>
        <div v-if="isRatesLoading || isLoading" class="text-center text-gray-500 py-4">Loading available rates...</div>
        <div v-else-if="availableRatesToLink.length === 0" class="text-center text-gray-500 py-4">
          All available tax rates are already linked or no tax rates exist.
        </div>
        <div v-else class="flex items-center space-x-3">
          <select v-model="selectedRateToLink"
                  class="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option :value="null" disabled>Select a rate to link</option>
            <option v-for="rate in availableRatesToLink" :key="rate.id" :value="rate.id">
              {{ rate.name }} ({{ (rate.rate * 100).toFixed(2) }}%) - {{ rate.country }}{{ rate.state_province ? ', ' + rate.state_province : '' }}
            </option>
          </select>
          <button @click="handleLinkRate" :disabled="!selectedRateToLink"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 whitespace-nowrap">
            Link Selected Rate
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRoute, useRouter } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });

const route = useRoute();
const router = useRouter();
const { $axios } = useNuxtApp();
const toast = useToast();

const classId = computed(() => parseInt(route.params.id));

const taxClass = ref(null);
const className = ref('');
const classDescription = ref('');

const isLoading = ref(true); // For initial tax class load
const isSaving = ref(false); // For saving name/description
const isRatesLoading = ref(true); // For loading linked and all rates

const fetchError = ref(null);

const linkedRates = ref([]);
const allRates = ref([]);
const selectedRateToLink = ref(null);

useHead({
  title: () => `Admin - Edit Tax Class ${taxClass.value ? `"${taxClass.value.name}"` : `ID: ${classId.value}`}`
});

const fetchTaxClass = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/admin/tax-classes/${classId.value}`);
    taxClass.value = response.data;
    className.value = response.data.name;
    classDescription.value = response.data.description || '';
  } catch (error) {
    console.error('Error fetching tax class:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load tax class details.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
};

const fetchLinkedRates = async () => {
  isRatesLoading.value = true;
  try {
    const response = await $axios.get(`/admin/tax-classes/${classId.value}/rates`);
    linkedRates.value = response.data;
  } catch (error) {
    console.error('Error fetching linked rates:', error);
    toast.error(error.response?.data?.message || 'Failed to load linked tax rates.');
  } finally {
    isRatesLoading.value = false;
  }
};

const fetchAllRates = async () => {
  // isRatesLoading can also cover this as they load in parallel often
  try {
    // Use limit 100 to align with backend validator, add sorting for consistent display
    const response = await $axios.get('/admin/tax-rates?limit=100&sortBy=name&sortOrder=ASC');
    allRates.value = response.data.data; // Assuming response.data.data is the array of rates
  } catch (error) {
    console.error('Error fetching all rates:', error);
    toast.error(error.response?.data?.message || 'Failed to load available tax rates for linking.');
  }
};

onMounted(async () => {
  await fetchTaxClass();
  if (taxClass.value) { // Only fetch rates if tax class was loaded successfully
    await Promise.all([fetchLinkedRates(), fetchAllRates()]);
  }
});

const availableRatesToLink = computed(() => {
  return allRates.value.filter(rate => !linkedRates.value.some(linked => linked.id === rate.id));
});

const handleUpdateSubmit = async () => {
  if (!className.value.trim()) {
    toast.error('Tax Class Name is required.');
    return;
  }
  isSaving.value = true;
  const payload = {
    name: className.value.trim(),
    description: classDescription.value.trim() || null,
  };
  try {
    const response = await $axios.put(`/admin/tax-classes/${classId.value}`, payload);
    taxClass.value = response.data; // Update local state with response
    className.value = response.data.name;
    classDescription.value = response.data.description || '';
    toast.success('Tax class updated successfully!');
  } catch (error) {
    console.error('Error updating tax class:', error);
    toast.error(error.response?.data?.message || 'Failed to update tax class.');
  } finally {
    isSaving.value = false;
  }
};

const handleLinkRate = async () => {
  if (!selectedRateToLink.value) {
    toast.error('Please select a tax rate to link.');
    return;
  }
  try {
    await $axios.post(`/admin/tax-classes/${classId.value}/rates`, { tax_rate_id: selectedRateToLink.value });
    toast.success('Tax rate linked successfully.');
    await fetchLinkedRates(); // Refresh linked rates
    selectedRateToLink.value = null; // Reset dropdown
  } catch (error) {
    console.error('Error linking tax rate:', error);
    toast.error(error.response?.data?.message || 'Failed to link tax rate.');
  }
};

const handleUnlinkRate = async (rateId, rateName) => {
  if (!confirm(`Are you sure you want to unlink the tax rate "${rateName}" (ID: ${rateId}) from this class?`)) {
    return;
  }
  try {
    await $axios.delete(`/admin/tax-classes/${classId.value}/rates/${rateId}`);
    toast.success(`Tax rate "${rateName}" unlinked successfully.`);
    await fetchLinkedRates(); // Refresh linked rates
  } catch (error) {
    console.error('Error unlinking tax rate:', error);
    toast.error(error.response?.data?.message || 'Failed to unlink tax rate.');
  }
};

</script>

<style scoped>
/* Using global Tailwind classes. Specific styling can be added here if needed. */
</style>

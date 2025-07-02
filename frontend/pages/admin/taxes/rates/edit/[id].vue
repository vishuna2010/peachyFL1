<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-2xl mx-auto">
      <!-- Loading State for initial Tax Rate fetch -->
      <div v-if="isLoading" class="text-center py-10">
        <p class="text-lg text-gray-500">Loading tax rate details...</p>
      </div>

      <!-- Error State for initial Tax Rate fetch -->
      <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-lg text-red-600">Could not load tax rate details.</p>
        <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
        <NuxtLink to="/admin/taxes/rates"
          class="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-sky-blue-deep focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink">
          Back to List
        </NuxtLink>
      </div>

      <!-- Form Content -->
      <div v-else>
        <h1 class="text-2xl font-semibold text-gray-900 mb-6">
          Edit Tax Rate: <span class="text-peach-pink">{{ formData.name || `ID: ${rateId}` }}</span>
        </h1>
        <form @submit.prevent="handleUpdateSubmit" class="bg-white shadow-md rounded-lg p-6 border border-gray-200 space-y-6">
          <div>
            <label for="rateName" class="block text-sm font-medium text-gray-700 mb-1">
              Rate Name <span class="text-red-500">*</span>
            </label>
            <input type="text" id="rateName" v-model.trim="formData.name" required
                   class="form-input" :disabled="isSaving">
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="rate_display" class="block text-sm font-medium text-gray-700 mb-1">
                Rate Percentage <span class="text-red-500">*</span>
              </label>
              <input type="number" id="rate_display" v-model.number="formData.rate_display" required step="0.01" min="0" max="100"
                     class="form-input" :disabled="isSaving" placeholder="e.g., 7.25 for 7.25%">
              <p class="mt-1 text-xs text-gray-500">Enter value like 7.25 for 7.25%.</p>
            </div>
            <div>
              <label for="taxClassId" class="block text-sm font-medium text-gray-700 mb-1">
                Tax Class <span class="text-red-500">*</span>
              </label>
              <select id="taxClassId" v-model="formData.tax_class_id" required class="form-input" :disabled="isSaving || taxClassesLoading">
                <option v-if="taxClassesLoading" disabled value="">Loading tax classes...</option>
                <option v-else-if="taxClassesError" disabled value="">Error loading classes</option>
                <template v-else>
                  <option disabled value="">Select a tax class</option>
                  <option v-for="tc in taxClasses" :key="tc.id" :value="tc.id">{{ tc.name }}</option>
                </template>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="country" class="block text-sm font-medium text-gray-700 mb-1">
                Country Code <span class="text-red-500">*</span>
              </label>
              <input type="text" id="country" v-model.trim="formData.country" required
                     class="form-input" :disabled="isSaving" placeholder="e.g., US, CA, GB">
              <p class="mt-1 text-xs text-gray-500">Use ISO 3166-1 alpha-2 country codes.</p>
            </div>
            <div>
              <label for="priority" class="block text-sm font-medium text-gray-700 mb-1">
                Priority <span class="text-red-500">*</span>
              </label>
              <input type="number" id="priority" v-model.number="formData.priority" required step="1" min="0"
                     class="form-input" :disabled="isSaving" placeholder="e.g., 0, 1">
               <p class="mt-1 text-xs text-gray-500">Lower numbers apply first. 0 is common.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="stateProvince" class="block text-sm font-medium text-gray-700 mb-1">State/Province (Optional)</label>
              <input type="text" id="stateProvince" v-model.trim="formData.state_province"
                     class="form-input" :disabled="isSaving" placeholder="e.g., NY, QC">
            </div>
            <div>
              <label for="postalCode" class="block text-sm font-medium text-gray-700 mb-1">Postal/Zip Code (Optional)</label>
              <input type="text" id="postalCode" v-model.trim="formData.postal_code"
                     class="form-input" :disabled="isSaving" placeholder="e.g., 10001, K1A 0B1">
            </div>
          </div>

          <div class="pt-2">
            <label class="flex items-center">
              <input type="checkbox" v-model="formData.is_compound"
                     class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" :disabled="isSaving">
              <span class="ml-2 text-sm text-gray-700">Is Compound (tax applied on top of other taxes)</span>
            </label>
          </div>

          <div class="mt-8 flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
            <NuxtLink to="/admin/taxes/rates"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Cancel
            </NuxtLink>
            <button type="submit" :disabled="isSaving"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              <span v-if="isSaving">Saving...</span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
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

const rateId = computed(() => parseInt(route.params.id));

const formData = ref({
  name: '',
  rate_display: null, // User sees as percentage, e.g., 7 for 7%
  country: '',
  state_province: '',
  postal_code: '',
  tax_class_id: '',
  is_compound: false,
  priority: 0,
});

const taxClasses = ref([]);
const taxClassesLoading = ref(true);
const taxClassesError = ref(null);

const isLoading = ref(true); // For initial Tax Rate fetch
const isSaving = ref(false);  // For update submission
const fetchError = ref(null); // For Tax Rate fetch error

useHead({
  title: () => `Admin - Edit Tax Rate ${formData.value.name || `ID: ${rateId.value}`}`
});

const fetchTaxClasses = async () => {
  taxClassesLoading.value = true;
  taxClassesError.value = null;
  try {
    const response = await $axios.get('/admin/tax-classes?limit=1000'); // Fetch all for dropdown
    taxClasses.value = response.data.taxClasses || response.data; // Adapt to potential pagination wrapper
  } catch (error) {
    console.error('Error fetching tax classes:', error);
    taxClassesError.value = 'Failed to load tax classes.';
    toast.error(taxClassesError.value);
  } finally {
    taxClassesLoading.value = false;
  }
};

const fetchTaxRate = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/admin/tax-rates/${rateId.value}`);
    const rateData = response.data;
    formData.value = {
      name: rateData.name,
      rate_display: parseFloat((rateData.rate * 100).toFixed(4)), // Convert 0.075 to 7.5 for display
      country: rateData.country,
      state_province: rateData.state_province || '',
      postal_code: rateData.postal_code || '',
      tax_class_id: rateData.tax_class_id,
      is_compound: rateData.is_compound,
      priority: rateData.priority,
      // Ensure all fields expected by the form are initialized
    };
  } catch (error) {
    console.error('Error fetching tax rate:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load tax rate details.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await fetchTaxClasses(); // Fetch tax classes first or in parallel
  await fetchTaxRate();    // Then fetch the specific tax rate
});

const handleUpdateSubmit = async () => {
  isSaving.value = true;

  // Client-side Validation
  if (!formData.value.name.trim()) {
    toast.error('Rate Name is required.');
    isSaving.value = false; return;
  }
  if (formData.value.rate_display === null || formData.value.rate_display < 0) {
    toast.error('Rate Percentage is required and must be non-negative.');
    isSaving.value = false; return;
  }
   if (formData.value.rate_display > 1000) { // Allow up to 1000% just in case, but usually 100 is max
    toast.warning('Rate Percentage seems high. Please verify.');
  }
  if (!formData.value.country.trim()) {
    toast.error('Country Code is required.');
    isSaving.value = false; return;
  }
  if (formData.value.tax_class_id === '' || formData.value.tax_class_id === null) {
    toast.error('Tax Class is required.');
    isSaving.value = false; return;
  }
  if (formData.value.priority === null || formData.value.priority < 0) {
    toast.error('Priority is required and must be non-negative.');
    isSaving.value = false; return;
  }

  const rateForBackend = parseFloat(formData.value.rate_display) / 100;

  const payload = {
    name: formData.value.name.trim(),
    rate: rateForBackend, // Send as decimal
    country: formData.value.country.trim().toUpperCase(),
    state_province: formData.value.state_province?.trim() || null,
    postal_code: formData.value.postal_code?.trim() || null,
    tax_class_id: parseInt(formData.value.tax_class_id),
    is_compound: formData.value.is_compound,
    priority: parseInt(formData.value.priority),
  };

  try {
    await $axios.put(`/admin/tax-rates/${rateId.value}`, payload);
    toast.success('Tax rate updated successfully!');
    // Optionally, re-fetch the list or navigate away
    router.push('/admin/taxes/rates');
  } catch (error) {
    console.error('Error updating tax rate:', error.response?.data);
    let errorMessage = 'Failed to update tax rate.';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      errorMessage = error.response.data.errors.map(e => e.msg).join(' ');
    }
    toast.error(errorMessage);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.form-input {
  @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100;
}
</style>

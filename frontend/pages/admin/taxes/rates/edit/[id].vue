<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-2xl mx-auto">
      <!-- Loading State for initial Tax Rate fetch -->
      <div v-if="isLoading" class="text-center py-10">
        <p class="text-lg text-gray-500">Loading tax rate details...</p>
        <!-- Optional: Add a spinner component here -->
      </div>

      <!-- Error State for initial Tax Rate fetch -->
      <div v-else-if="fetchError" class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-lg text-red-600">Could not load tax rate details.</p>
        <p class="text-sm text-red-500 mt-1">{{ fetchError }}</p>
        <NuxtLink to="/admin/taxes/rates"
          class="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light">
          Back to List
        </NuxtLink>
      </div>

      <!-- Form Content -->
      <div v-else>
        <h1 class="text-2xl font-semibold text-gray-900 mb-6">
          Edit Tax Rate: <span class="text-brand-primary">{{ formData.name || `ID: ${rateId}` }}</span>
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
              <label for="ratePercentage" class="block text-sm font-medium text-gray-700 mb-1">
                Rate Percentage <span class="text-red-500">*</span>
              </label>
              <input type="number" id="ratePercentage" v-model.number="formData.rate_percentage" required step="0.01" min="0" max="100"
                     class="form-input" :disabled="isSaving" placeholder="e.g., 7.25 for 7.25%">
              <p class="mt-1 text-xs text-gray-500">Enter value like 7.25 for 7.25%.</p>
            </div>
            <div>
              <label for="taxType" class="block text-sm font-medium text-gray-700 mb-1">
                Tax Type <span class="text-red-500">*</span>
              </label>
              <input type="text" id="taxType" v-model.trim="formData.tax_type" required
                     class="form-input" :disabled="isSaving" placeholder="e.g., SALES, VAT, GST">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="jurisdictionCode" class="block text-sm font-medium text-gray-700 mb-1">
                Jurisdiction Code <span class="text-red-500">*</span>
              </label>
              <input type="text" id="jurisdictionCode" v-model.trim="formData.jurisdiction_code" required
                     class="form-input" :disabled="isSaving" placeholder="e.g., CA, EU, US-NY, GLOBAL">
              <p class="mt-1 text-xs text-gray-500">Use ISO codes or 'GLOBAL'.</p>
            </div>
             <div>
              <label for="taxCode" class="block text-sm font-medium text-gray-700 mb-1">
                Tax Code (Optional)
              </label>
              <input type="text" id="taxCode" v-model.trim="formData.tax_code"
                     class="form-input" :disabled="isSaving">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="validFrom" class="block text-sm font-medium text-gray-700 mb-1">Valid From (Optional)</label>
              <input type="date" id="validFrom" v-model="formData.valid_from"
                     class="form-input" :disabled="isSaving">
            </div>
            <div>
              <label for="validUntil" class="block text-sm font-medium text-gray-700 mb-1">Valid Until (Optional)</label>
              <input type="date" id="validUntil" v-model="formData.valid_until"
                     class="form-input" :disabled="isSaving">
            </div>
          </div>

          <div class="pt-2">
            <label class="flex items-center">
              <input type="checkbox" v-model="formData.is_active"
                     class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" :disabled="isSaving">
              <span class="ml-2 text-sm text-gray-700">Is Active</span>
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
  rate_percentage: null, // User sees as percentage, e.g., 7 for 7%
  jurisdiction_code: '',
  tax_type: '',
  tax_code: '',
  is_active: true,
  valid_from: null,
  valid_until: null,
});

const isLoading = ref(true); // For initial fetch
const isSaving = ref(false);  // For update submission
const fetchError = ref(null);

useHead({
  title: () => `Admin - Edit Tax Rate ${formData.value.name || `ID: ${rateId.value}`}`
});

const formatDateForInput = (dateString) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (e) {
    console.warn("Could not format date for input:", dateString, e);
    return null; // Or return original string if it might be already YYYY-MM-DD
  }
};

const fetchTaxRate = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/api/admin/tax-rates/${rateId.value}`);
    const rate = response.data;
    formData.value = {
      ...rate,
      rate_percentage: parseFloat((rate.rate_percentage * 100).toFixed(4)), // Convert 0.075 to 7.5
      valid_from: formatDateForInput(rate.valid_from),
      valid_until: formatDateForInput(rate.valid_until),
    };
  } catch (error) {
    console.error('Error fetching tax rate:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load tax rate details.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchTaxRate);

const handleUpdateSubmit = async () => {
  isSaving.value = true;

  // Basic Client-side Validation (similar to 'new' page)
  if (!formData.value.name.trim()) {
    toast.error('Rate Name is required.');
    isSaving.value = false;
    return;
  }
  if (formData.value.rate_percentage === null || formData.value.rate_percentage < 0) {
    toast.error('Rate Percentage is required and must be non-negative.');
    isSaving.value = false;
    return;
  }
  if (formData.value.rate_percentage > 100) {
    toast.error('Rate Percentage cannot exceed 100.');
    isSaving.value = false;
    return;
  }
  if (!formData.value.jurisdiction_code.trim()) {
    toast.error('Jurisdiction Code is required.');
    isSaving.value = false;
    return;
  }
  if (!formData.value.tax_type.trim()) {
    toast.error('Tax Type is required.');
    isSaving.value = false;
    return;
  }
  if (formData.value.valid_from && formData.value.valid_until && new Date(formData.value.valid_from) > new Date(formData.value.valid_until)) {
    toast.error('Valid From date cannot be after Valid Until date.');
    isSaving.value = false;
    return;
  }

  const rateForBackend = parseFloat(formData.value.rate_percentage) / 100;

  const payload = {
    name: formData.value.name.trim(),
    rate_percentage: rateForBackend,
    jurisdiction_code: formData.value.jurisdiction_code.trim(),
    tax_type: formData.value.tax_type.trim(),
    tax_code: formData.value.tax_code?.trim() || null,
    is_active: formData.value.is_active,
    valid_from: formData.value.valid_from || null,
    valid_until: formData.value.valid_until || null,
  };

  try {
    await $axios.put(`/api/admin/tax-rates/${rateId.value}`, payload);
    toast.success('Tax rate updated successfully!');
    router.push('/admin/taxes/rates');
  } catch (error) {
    console.error('Error updating tax rate:', error.response?.data);
    const errorMessage = error.response?.data?.message ||
                         (error.response?.data?.errors?.[0]?.msg ? `Validation error: ${error.response.data.errors[0].msg}` : 'Failed to update tax rate.');
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

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">Create New Tax Rate</h1>

      <form @submit.prevent="handleSubmit" class="bg-white shadow-md rounded-lg p-6 border border-gray-200 space-y-6">
        <div>
          <label for="rateName" class="block text-sm font-medium text-gray-700 mb-1">
            Rate Name <span class="text-red-500">*</span>
          </label>
          <input type="text" id="rateName" v-model.trim="formData.name" required
                 class="form-input" :disabled="isLoading" placeholder="e.g., California Sales Tax, EU VAT Standard">
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="ratePercentage" class="block text-sm font-medium text-gray-700 mb-1">
              Rate Percentage <span class="text-red-500">*</span>
            </label>
            <input type="number" id="ratePercentage" v-model.number="formData.rate_percentage" required step="0.01" min="0" max="100"
                   class="form-input" :disabled="isLoading" placeholder="e.g., 7.25 for 7.25%">
            <p class="mt-1 text-xs text-gray-500">Enter value like 7.25 for 7.25%.</p>
          </div>
          <div>
            <label for="taxType" class="block text-sm font-medium text-gray-700 mb-1">
              Tax Type <span class="text-red-500">*</span>
            </label>
            <input type="text" id="taxType" v-model.trim="formData.tax_type" required
                   class="form-input" :disabled="isLoading" placeholder="e.g., SALES, VAT, GST">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="jurisdiction" class="block text-sm font-medium text-gray-700 mb-1">
              Jurisdiction Code <span class="text-red-500">*</span>
            </label>
            <input type="text" id="jurisdiction" v-model.trim="formData.jurisdiction" required
                   class="form-input" :disabled="isLoading" placeholder="e.g., CA, EU, US-NY, GLOBAL">
             <p class="mt-1 text-xs text-gray-500">Use ISO codes or 'GLOBAL'.</p>
          </div>
           <div>
            <label for="taxCode" class="block text-sm font-medium text-gray-700 mb-1">
              Tax Code (Optional)
            </label>
            <input type="text" id="taxCode" v-model.trim="formData.tax_code"
                   class="form-input" :disabled="isLoading" placeholder="e.g., specific tax category code">
          </div>
        </div>


        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="validFrom" class="block text-sm font-medium text-gray-700 mb-1">Valid From (Optional)</label>
            <input type="date" id="validFrom" v-model="formData.valid_from"
                   class="form-input" :disabled="isLoading">
          </div>
          <div>
            <label for="validUntil" class="block text-sm font-medium text-gray-700 mb-1">Valid Until (Optional)</label>
            <input type="date" id="validUntil" v-model="formData.valid_until"
                   class="form-input" :disabled="isLoading">
          </div>
        </div>

        <div class="pt-2">
          <label class="flex items-center">
            <input type="checkbox" v-model="formData.is_active"
                   class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" :disabled="isLoading">
            <span class="ml-2 text-sm text-gray-700">Is Active</span>
          </label>
        </div>


        <div class="mt-8 flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
          <NuxtLink to="/admin/taxes/rates"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Cancel
          </NuxtLink>
          <button type="submit" :disabled="isLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            <span v-if="isLoading">Creating...</span>
            <span v-else>Create Tax Rate</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - New Tax Rate' });

const { $axios } = useNuxtApp();
const router = useRouter();
const toast = useToast();

const formData = ref({
  name: '',
  rate_percentage: null, // User enters as percentage, e.g., 7 for 7%
  jurisdiction: '', // Changed from jurisdiction_code to jurisdiction
  tax_type: '',
  tax_code: '',
  is_active: true,
  valid_from: null,
  valid_until: null,
});
const isLoading = ref(false);

const handleSubmit = async () => {
  isLoading.value = true;

  // Basic Client-side Validation
  if (!formData.value.name.trim()) {
    toast.error('Rate Name is required.');
    isLoading.value = false;
    return;
  }
  if (formData.value.rate_percentage === null || formData.value.rate_percentage < 0) {
    toast.error('Rate Percentage is required and must be non-negative.');
    isLoading.value = false;
    return;
  }
   if (formData.value.rate_percentage > 100) {
    toast.error('Rate Percentage cannot exceed 100.');
    isLoading.value = false;
    return;
  }
  if (!formData.value.jurisdiction.trim()) {
    toast.error('Jurisdiction Code is required.');
    isLoading.value = false;
    return;
  }
  if (!formData.value.tax_type.trim()) {
    toast.error('Tax Type is required.');
    isLoading.value = false;
    return;
  }
  if (formData.value.valid_from && formData.value.valid_until && new Date(formData.value.valid_from) > new Date(formData.value.valid_until)) {
    toast.error('Valid From date cannot be after Valid Until date.');
    isLoading.value = false;
    return;
  }

  // Convert rate_percentage from e.g. 7% to 0.07 for backend
  const rateForBackend = parseFloat(formData.value.rate_percentage) / 100;

  const payload = {
    name: formData.value.name.trim(),
    rate_percentage: rateForBackend,
    jurisdiction: formData.value.jurisdiction.trim(), // Changed from jurisdiction_code to jurisdiction
    tax_type: formData.value.tax_type.trim(),
    tax_code: formData.value.tax_code.trim() || null,
    is_active: formData.value.is_active,
    valid_from: formData.value.valid_from || null,
    valid_until: formData.value.valid_until || null,
  };

  try {
    await $axios.post('/admin/tax-rates', payload);
    toast.success('Tax rate created successfully!');
    router.push('/admin/taxes/rates');
  } catch (error) {
    console.error('Error creating tax rate:', error.response?.data);
    const errorMessage = error.response?.data?.message ||
                         (error.response?.data?.errors?.[0]?.msg ? `Validation error: ${error.response.data.errors[0].msg}` : 'Failed to create tax rate.');
    toast.error(errorMessage);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.form-input {
  @apply mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100;
}
</style>

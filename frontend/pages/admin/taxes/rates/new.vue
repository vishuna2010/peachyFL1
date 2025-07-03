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
            <label for="rate" class="block text-sm font-medium text-gray-700 mb-1">
              Rate (Decimal) <span class="text-red-500">*</span>
            </label>
            <input type="number" id="rate" v-model.number="formData.rate" required step="0.0001" min="0"
                   class="form-input" :disabled="isLoading" placeholder="e.g., 0.0725 for 7.25%">
            <p class="mt-1 text-xs text-gray-500">Enter as a decimal (e.g., 0.0725 for 7.25%).</p>
          </div>
          <div>
            <label for="taxClassId" class="block text-sm font-medium text-gray-700 mb-1">
              Tax Class <span class="text-red-500">*</span>
            </label>
            <!-- TODO: Replace with a dropdown populated from /api/admin/tax-classes -->
            <select id="taxClassId" v-model.number="formData.tax_class_id" required class="form-input" :disabled="isLoading || taxClassesLoading">
              <option :value="null" disabled>Select a tax class</option>
              <option v-if="taxClassesLoading" :value="null" disabled>Loading classes...</option>
              <option v-for="tc in availableTaxClasses" :key="tc.id" :value="tc.id">
                {{ tc.name }} (ID: {{ tc.id }})
              </option>
            </select>
             <p v-if="taxClassesError" class="text-xs text-red-500 mt-1">Could not load tax classes.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="country" class="block text-sm font-medium text-gray-700 mb-1">
              Country Code <span class="text-red-500">*</span>
            </label>
            <input type="text" id="country" v-model.trim="formData.country" required maxlength="2"
                   class="form-input uppercase" :disabled="isLoading" placeholder="e.g., US, GB (2-letter ISO code)">
          </div>
           <div>
            <label for="priority" class="block text-sm font-medium text-gray-700 mb-1">
              Priority (Optional)
            </label>
            <input type="number" id="priority" v-model.number="formData.priority" min="0" step="1"
                   class="form-input" :disabled="isLoading" placeholder="e.g., 0, 1, 2">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="stateProvince" class="block text-sm font-medium text-gray-700 mb-1">State/Province (Optional)</label>
            <input type="text" id="stateProvince" v-model.trim="formData.state_province"
                   class="form-input" :disabled="isLoading" placeholder="e.g., CA, NY">
          </div>
          <div>
            <label for="postalCode" class="block text-sm font-medium text-gray-700 mb-1">Postal Code (Optional)</label>
            <input type="text" id="postalCode" v-model.trim="formData.postal_code"
                   class="form-input" :disabled="isLoading" placeholder="e.g., 90210">
          </div>
        </div>

        <div class="pt-2">
          <label class="flex items-center">
            <input type="checkbox" v-model="formData.is_compound"
                   class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" :disabled="isLoading">
            <span class="ml-2 text-sm text-gray-700">Is Compound Tax</span>
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
import { ref, onMounted } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - New Tax Rate' });

const { $axios } = useNuxtApp();
const router = useRouter();
const toast = useToast();

const formData = ref({
  name: '',
  rate: null, // Expects decimal, e.g., 0.0725 for 7.25%
  country: '', // ISO 2-letter code
  state_province: '',
  postal_code: '',
  is_compound: false,
  priority: 0,
  tax_class_id: null,
});
const isLoading = ref(false);
const availableTaxClasses = ref([]);
const taxClassesLoading = ref(true);
const taxClassesError = ref(null);

const fetchAvailableTaxClasses = async () => {
  taxClassesLoading.value = true;
  taxClassesError.value = null;
  try {
    const response = await $axios.get('/admin/tax-classes', { params: { limit: 500 } }); // Fetch all or a large number
    availableTaxClasses.value = response.data.data;
  } catch (error) {
    console.error('Error fetching tax classes for dropdown:', error);
    taxClassesError.value = 'Failed to load tax classes.';
    toast.error('Could not load available tax classes for selection.');
  } finally {
    taxClassesLoading.value = false;
  }
};

onMounted(() => {
  fetchAvailableTaxClasses();
});

const handleSubmit = async () => {
  isLoading.value = true;

  // Client-side Validation
  if (!formData.value.name.trim()) {
    toast.error('Rate Name is required.'); isLoading.value = false; return;
  }
  if (formData.value.rate === null || formData.value.rate < 0) {
    toast.error('Rate is required and must be a non-negative decimal (e.g., 0.0725 for 7.25%).'); isLoading.value = false; return;
  }
  // Add a sensible upper limit for rate, e.g., 1 for 100%
  if (formData.value.rate > 1) {
    toast.error('Rate should be a decimal less than or equal to 1 (e.g., 0.0725 for 7.25%).'); isLoading.value = false; return;
  }
  if (!formData.value.country.trim() || formData.value.country.trim().length !== 2) {
    toast.error('Country Code is required and must be 2 letters.'); isLoading.value = false; return;
  }
  if (formData.value.tax_class_id === null) {
    toast.error('Tax Class is required.'); isLoading.value = false; return;
  }

  const payload = {
    name: formData.value.name.trim(),
    rate: parseFloat(formData.value.rate), // Ensure it's a number
    country: formData.value.country.trim().toUpperCase(),
    state_province: formData.value.state_province?.trim() || null,
    postal_code: formData.value.postal_code?.trim() || null,
    is_compound: formData.value.is_compound,
    priority: Number(formData.value.priority) || 0,
    tax_class_id: Number(formData.value.tax_class_id),
  };
  // Remove optional fields if they are empty strings to send them as null
  if (payload.state_province === '') payload.state_province = null;
  if (payload.postal_code === '') payload.postal_code = null;


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

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">Create New Product</h2>
    <div v-if="isLoadingInitialData" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading necessary data...</p>
    </div>
    <div v-else-if="fetchError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline"> {{ fetchError }}</span>
    </div>
    <ProductForm
      v-else
      :categories="categories"
      :suppliers="suppliers"
      :available-tax-classes="availableTaxClasses"
      :is-loading-tax-classes="isLoadingTaxClasses"
      :tax-classes-error="taxClassesError"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleCreateProduct"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRouter, useHead } from '#app'; // Added useHead
import ProductForm from '~/components/admin/ProductForm.vue';

definePageMeta({
  layout: 'admin',
  // title: 'New Product' // Title managed by useHead
});

const { $axios } = useNuxtApp();
const router = useRouter();

const categories = ref([]);
const suppliers = ref([]);
const availableTaxClasses = ref([]);
const isLoadingInitialData = ref(true);
const isLoadingTaxClasses = ref(false);
const taxClassesError = ref('');
const fetchError = ref('');

const isSubmitting = ref(false);
const apiError = ref('');

async function fetchInitialData() {
  isLoadingInitialData.value = true;
  fetchError.value = '';
  try {
    const [catResponse, supResponse] = await Promise.all([
      $axios.get('/categories'), // Public categories endpoint
      $axios.get('/admin/suppliers') // Admin suppliers endpoint
    ]);
    categories.value = catResponse.data;
    // Assuming supplier API returns { data: suppliersArray } for paginated response
    suppliers.value = supResponse.data.data || supResponse.data;
  } catch (error) {
    console.error('Error fetching initial data for product form:', error);
    fetchError.value = 'Failed to load categories or suppliers. Please try again.';
  } finally {
    isLoadingInitialData.value = false;
  }
}

async function fetchTaxClasses() {
  isLoadingTaxClasses.value = true;
  taxClassesError.value = '';
  try {
    const response = await $axios.get('/admin/tax-classes?limit=1000');
    availableTaxClasses.value = response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching tax classes:', error);
    taxClassesError.value = 'Failed to load tax classes.';
  } finally {
    isLoadingTaxClasses.value = false;
  }
}

async function handleCreateProduct(formDataPayload) { // formDataPayload is already a FormData object
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // The backend expects multipart/form-data due to image upload
    await $axios.post('/admin/products', formDataPayload, { // Admin product creation
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    router.push('/admin/products?created=success'); // Assuming an admin product list page
  } catch (error) {
    console.error('Error creating product:', error);
    apiError.value = error.response?.data?.message || 'Failed to create product.';
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  await fetchInitialData();
  await fetchTaxClasses();
});

useHead({
  title: 'Admin - Create Product',
});
</script>

<!-- <style scoped> removed -->

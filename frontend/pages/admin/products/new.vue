<template>
  <div class="admin-new-product-page">
    <h2>Create New Product</h2>
    <div v-if="isLoadingInitialData" class="loading-state">Loading necessary data...</div>
    <div v-else-if="fetchError" class="error-message">{{ fetchError }}</div>
    <ProductForm
      v-else
      :categories="categories"
      :suppliers="suppliers"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleCreateProduct"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRouter } from '#app';
import ProductForm from '~/components/admin/ProductForm.vue';

definePageMeta({
  layout: 'admin',
  title: 'New Product'
});

const { $axios } = useNuxtApp();
const router = useRouter();

const categories = ref([]);
const suppliers = ref([]);
const isLoadingInitialData = ref(true);
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

async function handleCreateProduct(formDataPayload) { // formDataPayload is already a FormData object
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // The backend expects multipart/form-data due to image upload
    await $axios.post('/products', formDataPayload, { // Public product creation, but admin protected
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

onMounted(fetchInitialData);

useHead({
  title: 'Admin - Create Product',
});
</script>

<style scoped>
.admin-new-product-page {
  max-width: 900px;
  margin: 1.5rem auto;
  padding: 1rem;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}
.loading-state, .error-message {
  text-align: center;
  padding: 1rem;
  border-radius: 4px;
}
.loading-state { background-color: #eef; }
.error-message { background-color: #fdd; color: #900; }
</style>

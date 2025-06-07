<template>
  <div class="admin-edit-product-page">
    <h2>Edit Product</h2>
    <div v-if="isLoadingInitialData || isLoadingProduct" class="loading-state">Loading product data...</div>
    <div v-else-if="fetchError" class="error-message">
      {{ fetchError }}
      <p><NuxtLink :to="adminProductListPath">Back to Product List</NuxtLink></p>
    </div>
    <ProductForm
      v-else-if="productData"
      :initial-data="productData"
      :categories="categories"
      :suppliers="suppliers"
      :is-edit-mode="true"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleUpdateProduct"
    />
    <div v-else class="error-message">
        Product not found.
        <NuxtLink :to="adminProductListPath">Back to Product List</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';
import ProductForm from '~/components/admin/ProductForm.vue';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const productData = ref(null);
const categories = ref([]);
const suppliers = ref([]);

const isLoadingProduct = ref(true);
const isLoadingInitialData = ref(true); // For categories & suppliers
const fetchError = ref('');

const isSubmitting = ref(false);
const apiError = ref('');

const productId = route.params.id;
const adminProductListPath = '/admin/products'; // Define once, or make it dynamic if needed

async function fetchProductAndRelatedData() {
  isLoadingProduct.value = true;
  isLoadingInitialData.value = true;
  fetchError.value = '';
  try {
    // Fetch product, categories, and suppliers in parallel
    const [productResponse, catResponse, supResponse] = await Promise.all([
      $axios.get(`/products/${productId}`), // Public product detail endpoint
      $axios.get('/categories'),
      $axios.get('/admin/suppliers')
    ]);

    productData.value = productResponse.data;
    categories.value = catResponse.data;
    suppliers.value = supResponse.data.data || supResponse.data; // Handle paginated or direct array

  } catch (error) {
    console.error('Error fetching product details or related data:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load necessary data.';
    if (error.response?.status === 404 && error.config.url.includes(`/products/${productId}`)) {
        productData.value = null; // Ensure form is not shown if product 404
        fetchError.value = `Product with ID ${productId} not found.`;
    }
  } finally {
    isLoadingProduct.value = false;
    isLoadingInitialData.value = false;
  }
}

async function handleUpdateProduct(formDataPayload) { // formDataPayload is FormData
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // IMPORTANT: When using FormData with PUT, some servers/frameworks might have issues.
    // Standard way is POST for multipart/form-data. If PUT with FormData fails,
    // a common workaround is to use POST with a _method="PUT" field,
    // or use a specific header like 'X-HTTP-Method-Override': 'PUT'.
    // However, Express with multer should handle PUT with FormData.
    await $axios.put(`/products/${productId}`, formDataPayload, { // Admin protected route in routes/products.js
       headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    router.push(`${adminProductListPath}?updated=success`);
  } catch (error) {
    console.error('Error updating product:', error);
    apiError.value = error.response?.data?.message || 'Failed to update product.';
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(fetchProductAndRelatedData);

useHead({
  title: 'Admin - Edit Product',
});
</script>

<style scoped>
.admin-edit-product-page {
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
.error-message a { color: #007bff; text-decoration: underline; }
</style>

<template>
  <div class="admin-edit-product-page">
    <h2>Edit Product</h2>
    <div v-if="isLoadingInitialData || isLoadingProduct" class="loading-state">Loading product data...</div>
    <div v-else-if="fetchError && !productData" class="error-message">
      {{ fetchError }}
      <p><NuxtLink :to="adminProductListPath">Back to Product List</NuxtLink></p>
    </div>

    <template v-if="productData">
      <ProductForm
        :initial-data="productData"
        :categories="categories"
        :suppliers="suppliers"
        :is-edit-mode="true"
        :is-submitting="isSubmitting"
        :api-error="apiError"
        @submit="handleUpdateProduct"
      />
      <!-- Product Options Management Section -->
      <section class="options-manager-section" v-if="productData && !isLoadingProduct">
        <ProductOptionsManager :product-id="productId" />
      </section>

      <!-- Product Variants Management Section -->
      <section class="variants-manager-section" v-if="productData && !isLoadingProduct && productData.options && productData.options.length > 0">
        <ProductVariantsManager :product-id="productId" :product-options="productData.options" />
      </section>
      <div v-else-if="productData && !isLoadingProduct && (!productData.options || productData.options.length === 0)" class="info-message card">
        <p>This product currently has no options defined. Add options above to start creating variants.</p>
      </div>
    </template>

    <div v-else-if="!isLoadingInitialData && !isLoadingProduct && !fetchError" class="error-message">
        Product not found or failed to load.
        <NuxtLink :to="adminProductListPath">Back to Product List</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';
import ProductForm from '~/components/admin/ProductForm.vue';
import ProductOptionsManager from '~/components/admin/ProductOptionsManager.vue';
import ProductVariantsManager from '~/components/admin/ProductVariantsManager.vue'; // Import the new component

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const productData = ref(null); // This will contain product.options and product.variants after fetch
const categories = ref([]);
const suppliers = ref([]);

const isLoadingProduct = ref(true);
const isLoadingInitialData = ref(true);
const fetchError = ref('');

const isSubmitting = ref(false);
const apiError = ref('');

const productId = route.params.id;
const adminProductListPath = '/admin/products';

async function fetchProductAndRelatedData() {
  isLoadingProduct.value = true;
  isLoadingInitialData.value = true;
  fetchError.value = '';
  try {
    // Product endpoint now returns options and variants
    const [productResponse, catResponse, supResponse] = await Promise.all([
      $axios.get(`/products/${productId}`),
      $axios.get('/categories'),
      $axios.get('/admin/suppliers?limit=1000')
    ]);

    productData.value = productResponse.data; // This includes product.options and product.variants
    categories.value = catResponse.data;
    suppliers.value = supResponse.data.data || supResponse.data;

    isLoadingProduct.value = false;
  } catch (error) {
    console.error('Error fetching product details or related data:', error);
    if (error.response?.status === 404 && error.config.url.includes(`/products/${productId}`)) {
        productData.value = null;
        fetchError.value = `Product with ID ${productId} not found.`;
    } else {
        fetchError.value = error.response?.data?.message || 'Failed to load necessary data.';
    }
    isLoadingProduct.value = false;
  } finally {
    isLoadingInitialData.value = false;
  }
}

async function handleUpdateProduct(formDataPayload) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    await $axios.put(`/products/${productId}`, formDataPayload, {
       headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    // Re-fetch to get all updated data, including potentially changed base product details
    // that might affect variant display (though variants manager fetches its own list)
    // The ProductOptionsManager also re-fetches its own data.
    await fetchProductAndRelatedData();
    // router.push(`${adminProductListPath}?updated=success&id=${productId}`); // Or stay on page with success message
    // For better UX when managing options/variants, stay on the page.
    apiError.value = ''; // Clear previous errors
    // Show a success message locally instead of full redirect for minor product updates
    alert('Base product details updated successfully!'); // Replace with a proper toast/notification
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
.loading-state {
  text-align: center;
  padding: 2rem;
  font-size: 1.1em;
  color: #555;
}
.error-message, .info-message {
  color: #721c24;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 1rem;
  border-radius: 4px;
  text-align: center;
  margin-bottom: 1rem;
}
.info-message { /* For non-error informational messages */
    background-color: #e7f3ff;
    color: #004085;
    border-color: #b8daff;
}
.error-message a, .info-message a {
  color: #007bff;
  text-decoration: underline;
  margin-top: 0.5rem;
  display: inline-block;
}

.options-manager-section, .variants-manager-section {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #007bff;
}
.card { /* General card style if needed by child components implicitly */
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  margin-bottom: 1rem; /* Spacing for cards */
}
</style>

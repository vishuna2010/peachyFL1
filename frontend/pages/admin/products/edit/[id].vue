<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">Edit Product (ID: {{ productId }})</h2>

    <div v-if="isLoadingInitialData || isLoadingProduct" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading product data...</p>
    </div>

    <div v-else-if="fetchError && !productData" class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
      <p class="font-bold">Error Loading Product</p>
      <p>{{ fetchError }}</p>
      <p class="mt-2">
        <NuxtLink :to="adminProductListPath" class="text-red-700 hover:text-red-900 underline font-medium">Back to Product List</NuxtLink>
      </p>
    </div>

    <template v-if="productData">
      <!-- ProductForm is assumed to be styled with Tailwind internally -->
      <ProductForm
        :initial-data="productData"
        :categories="categories"
        :suppliers="suppliers"
        :is-edit-mode="true"
        :is-submitting="isSubmitting"
        :api-error="apiError"
        @submit="handleUpdateProduct"
        class="mb-8"
      />

      <!-- Product Options Management Section -->
      <section class="bg-white shadow-lg rounded-lg p-6 mt-8" v-if="productData && !isLoadingProduct">
        <h3 class="text-xl font-semibold text-gray-700 mb-4">Product Options & Configurations</h3>
        <ProductOptionsManager :product-id="productId" />
      </section>

      <!-- Product Variants Management Section -->
      <div v-if="productData && !isLoadingProduct">
        <section class="bg-white shadow-lg rounded-lg p-6 mt-8" v-if="productData.has_variants || (productData.options && productData.options.length > 0)">
          <h3 class="text-xl font-semibold text-gray-700 mb-4">Product Variants</h3>
          <ProductVariantsManager :product-id="productId" :product-options="productData.options" />
        </section>
        <div v-else class="mt-8 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded-md shadow">
          <p class="font-medium">Manage Variants</p>
          <p>This product currently has no options defined. To create variants, first assign some options in the "Product Options & Configurations" section above.</p>
        </div>
      </div>
    </template>

    <div v-else-if="!isLoadingInitialData && !isLoadingProduct && !fetchError"
         class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
      <p class="font-bold">Product Not Found</p>
      <p>The product with ID {{ productId }} could not be found or failed to load.</p>
      <NuxtLink :to="adminProductListPath" class="mt-2 inline-block text-red-700 hover:text-red-900 underline font-medium">Back to Product List</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRoute, useRouter, useHead } from '#app'; // Added useHead
import ProductForm from '~/components/admin/ProductForm.vue';
import ProductOptionsManager from '~/components/admin/ProductOptionsManager.vue';
import ProductVariantsManager from '~/components/admin/ProductVariantsManager.vue';

definePageMeta({
  layout: 'admin',
  // title: 'Edit Product' // Title managed by useHead
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const productData = ref(null);
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
    const [productResponse, catResponse, supResponse] = await Promise.all([
      $axios.get(`/products/${productId}`), // Public product endpoint includes variants and options
      $axios.get('/categories'),
      $axios.get('/admin/suppliers?limit=1000') // Assuming suppliers list is not excessively large
    ]);

    productData.value = productResponse.data;
    categories.value = catResponse.data;
    suppliers.value = supResponse.data.data || supResponse.data; // Handle paginated or direct array

    isLoadingProduct.value = false;
  } catch (error) {
    console.error('Error fetching product details or related data:', error);
    if (error.response?.status === 404 && error.config.url.includes(`/products/${productId}`)) {
        productData.value = null; // Ensure productData is null on 404
        fetchError.value = `Product with ID ${productId} not found.`;
    } else {
        fetchError.value = error.response?.data?.message || 'Failed to load necessary data for product editing.';
    }
    isLoadingProduct.value = false; // Also set to false on error
  } finally {
    isLoadingInitialData.value = false; // Always set this to false
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
    // Consider a more targeted re-fetch or optimistic update if performance is an issue.
    // For now, re-fetching ensures all data (including options/variants if base product change affects them) is current.
    await fetchProductAndRelatedData();

    // Using Nuxt's useToast (if globally available or imported here) is better than alert
    // For example: const toast = useToast(); toast.success('Product updated successfully!');
    alert('Base product details updated successfully!');
  } catch (error) {
    console.error('Error updating product:', error);
    apiError.value = error.response?.data?.message || 'Failed to update product.';
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(fetchProductAndRelatedData);

useHead({
  title: `Admin - Edit Product ${productId}`,
});
</script>

<!-- <style scoped> removed -->

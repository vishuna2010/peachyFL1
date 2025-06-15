<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800">Edit Product (ID: {{ productId }})</h2>
      <NuxtLink :to="`/admin/products/${productId}`" class="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back to Product View</NuxtLink>
    </div>


    <div v-if="isLoadingInitialData" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      <p class="mt-3 text-gray-600">Loading essential data...</p>
    </div>

    <div v-else-if="fetchError && !productData" class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
      <p class="font-bold">Error Loading Product Data</p>
      <p>{{ fetchError }}</p>
      <p class="mt-2">
        <NuxtLink to="/admin/products" class="text-red-700 hover:text-red-900 underline font-medium">Back to Product List</NuxtLink>
      </p>
    </div>

    <template v-if="productData">
      <!-- ProductForm for base product details -->
      <ProductForm
        :initial-data="productData"
        :categories="categories"
        :suppliers="suppliers"
        :is-edit-mode="true"
        :is-submitting="isSubmittingProductForm"
        :api-error="productFormApiError"
        @submit="handleUpdateProduct"
        class="mb-10 bg-white shadow-md rounded-lg p-6"
      />

      <!-- Product Options Management Section -->
      <section class="bg-white shadow-md rounded-lg p-6 my-10">
        <h3 class="text-xl font-semibold text-gray-700 mb-5 border-b pb-3">Product Specific Options</h3>
        <ProductOptionsManager :product-id="productId" />
      </section>

      <!-- Product Variants Management Section -->
      <section class="bg-white shadow-md rounded-lg p-6 my-10">
        <h3 class="text-xl font-semibold text-gray-700 mb-5 border-b pb-3">Product Variants</h3>
        <div v-if="productData.has_variants || (productData.options && productData.options.length > 0)">
           <!-- Pass product.options (assigned options with their values) if available -->
          <ProductVariantsManager :product-id="productId" :product-options="productData.options || []" />
        </div>
        <div v-else class="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded-md">
          <p class="font-medium">Manage Variants</p>
          <p>To create variants, first assign some options using the "Product Specific Options" section above.</p>
          <p class="mt-2">After assigning options, this product will be marked as "has_variants", and you can manage them here.</p>
        </div>
      </section>

    </template>

    <div v-else-if="!isLoadingInitialData && !fetchError" class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
      <p class="font-bold">Product Not Found</p>
      <p>The product with ID {{ productId }} could not be loaded. It may have been deleted or the ID is incorrect.</p>
      <NuxtLink to="/admin/products" class="mt-2 inline-block text-yellow-700 hover:text-yellow-900 underline font-medium">Back to Product List</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useNuxtApp, useRoute, definePageMeta, useHead } from '#imports';
import ProductForm from '~/components/admin/ProductForm.vue';
import ProductOptionsManager from '~/components/admin/ProductOptionsManager.vue';
import ProductVariantsManager from '~/components/admin/ProductVariantsManager.vue';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const productId = ref(route.params.productId);

const productData = ref(null);
const categories = ref([]);
const suppliers = ref([]);

const isLoadingInitialData = ref(true); // Covers all initial data loading like product, cats, suppliers
const fetchError = ref(''); // General error for initial data load

const isSubmittingProductForm = ref(false);
const productFormApiError = ref('');

useHead({
  title: computed(() => `Admin - Edit Product ${productId.value || ''}`),
});

async function fetchProductForEditing() {
  if (!productId.value) {
    fetchError.value = 'Product ID is missing from URL.';
    return null;
  }
  try {
    // Use admin product endpoint if available, otherwise public. Assume admin for edit context.
    // Ensure path is relative to Axios baseURL (e.g. /admin/products/:id)
    const response = await $axios.get(`/admin/products/${productId.value}`); // Or simply `/products/${productId.value}` if it includes all necessary admin fields
    return response.data.data || response.data; // Adapt to actual response structure
  } catch (error) {
    console.error(`Error fetching product ${productId.value} for editing:`, error);
    if (error.response?.status === 404) {
      throw new Error(`Product with ID ${productId.value} not found.`);
    }
    throw new Error(error.response?.data?.message || `Failed to load product data for ID ${productId.value}.`);
  }
}

async function fetchCategories() {
  try {
    const response = await $axios.get('/categories?limit=1000'); // Fetch all for dropdown
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to load categories.');
  }
}

async function fetchSuppliers() {
  try {
    // Ensure path is relative to Axios baseURL
    const response = await $axios.get('/admin/suppliers?limit=1000'); // Fetch all for dropdown
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    throw new Error('Failed to load suppliers.');
  }
}

async function loadAllInitialData() {
  isLoadingInitialData.value = true;
  fetchError.value = '';
  productData.value = null; // Reset
  try {
    const [productResult, categoriesResult, suppliersResult] = await Promise.allSettled([
      fetchProductForEditing(),
      fetchCategories(),
      fetchSuppliers(),
    ]);

    if (productResult.status === 'rejected') {
      throw productResult.reason; // Prioritize error from product fetching
    }
    productData.value = productResult.value;

    if (categoriesResult.status === 'fulfilled') {
      categories.value = categoriesResult.value;
    } else {
      console.warn('Failed to load categories, ProductForm might be limited.');
      categories.value = []; // Ensure it's an array
    }

    if (suppliersResult.status === 'fulfilled') {
      suppliers.value = suppliersResult.value;
    } else {
      console.warn('Failed to load suppliers, ProductForm might be limited.');
      suppliers.value = []; // Ensure it's an array
    }

  } catch (error) {
    console.error('Error loading initial data for product edit page:', error);
    fetchError.value = error.message || 'An unknown error occurred while loading data.';
    // productData might still be null here, which template handles
  } finally {
    isLoadingInitialData.value = false;
  }
}

async function handleUpdateProduct(formData) {
  if (!productId.value) {
    productFormApiError.value = 'Product ID is missing. Cannot update.';
    return;
  }
  isSubmittingProductForm.value = true;
  productFormApiError.value = '';
  try {
    // Use FormData if file uploads are involved, otherwise direct object. ProductForm handles this.
    // Ensure path is relative to Axios baseURL
    // Assuming ProductForm provides data ready for multipart/form-data if needed
    // The backend for product update (PUT /api/admin/products/:id or /api/products/:id) needs to handle it.
    // For admin, it's usually /api/admin/products/:id
    const response = await $axios.put(`/admin/products/${productId.value}`, formData, {
      headers: {
        // Content-Type will be set by browser for FormData, or explicitly if not FormData
        // 'Content-Type': 'multipart/form-data', // Only if formData is actual FormData object
      }
    });
    // Update productData with the response from the server to reflect changes
    productData.value = response.data.data || response.data;
    alert('Product updated successfully!'); // Replace with a toast notification
    // Optionally, re-fetch all data or navigate, but updating productData is often enough.
    // loadAllInitialData(); // Could re-fetch everything if needed
  } catch (error) {
    console.error('Error updating product:', error);
    productFormApiError.value = error.response?.data?.message || 'An critical error occurred while updating the product.';
  } finally {
    isSubmittingProductForm.value = false;
  }
}

onMounted(() => {
  loadAllInitialData();
});
</script>

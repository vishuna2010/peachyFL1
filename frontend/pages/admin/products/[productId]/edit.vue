<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold text-gray-800">Edit Product Form (ID: {{ productId }})</h2>
      <NuxtLink :to="`/admin/products/${productId}`" class="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back to Product View</NuxtLink>
    </div>
    <div v-if="isLoadingInitialData" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      <p class="mt-3 text-gray-600">Loading essential data...</p>
    </div>
    <div v-else-if="fetchError && !productData" class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
      <p class="font-bold">Error Loading Product Data for Edit</p>
      <p>{{ fetchError }}</p>
      <p class="mt-2"><NuxtLink to="/admin/products" class="text-red-700 hover:text-red-900 underline font-medium">Back to Product List</NuxtLink></p>
    </div>
    <template v-if="productData">
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
      <section class="bg-white shadow-md rounded-lg p-6 my-10">
        <h3 class="text-xl font-semibold text-gray-700 mb-5 border-b pb-3">Product Specific Options</h3>
        <ProductOptionsManager :product-id="productId" />
      </section>
      <section class="bg-white shadow-md rounded-lg p-6 my-10">
        <h3 class="text-xl font-semibold text-gray-700 mb-5 border-b pb-3">Product Variants</h3>
        <div v-if="productData.has_variants || (productData.options && productData.options.length > 0)">
          <ProductVariantsManager :product-id="productId" :product-options="productData.options || []" />
        </div>
        <div v-else class="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700 rounded-md">
          <p class="font-medium">Manage Variants</p>
          <p>To create variants, first assign options using the "Product Specific Options" section above.</p>
        </div>
      </section>
    </template>
    <div v-else-if="!isLoadingInitialData && !fetchError" class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
      <p class="font-bold">Product Data Not Available for Edit</p>
      <p>The product with ID {{ productId }} could not be loaded for editing.</p>
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
definePageMeta({ layout: 'admin' });
const { $axios } = useNuxtApp();
const route = useRoute();
const productId = ref(route.params.productId);
const productData = ref(null);
const categories = ref([]);
const suppliers = ref([]);
const isLoadingInitialData = ref(true);
const fetchError = ref('');
const isSubmittingProductForm = ref(false);
const productFormApiError = ref('');
useHead({ title: computed(() => `Admin - Edit Product Form ${productId.value || ''}`) });
async function fetchProductForEditing() {
  if (!productId.value) { fetchError.value = 'Product ID missing.'; return null; }
  try {
    const response = await $axios.get(`/admin/products/${productId.value}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error(`Error fetching product ${productId.value} for editing:`, error);
    if (error.response?.status === 404) throw new Error(`Product ID ${productId.value} not found.`);
    throw new Error(error.response?.data?.message || 'Failed to load product data.');
  }
}
async function fetchCategories() {
  try {
    const response = await $axios.get('/categories?limit=1000');
    return response.data.data || response.data;
  } catch (error) { console.error('Error fetching categories:', error); throw new Error('Failed to load categories.'); }
}
async function fetchSuppliers() {
  try {
    const response = await $axios.get('/admin/suppliers?limit=1000');
    return response.data.data || response.data;
  } catch (error) { console.error('Error fetching suppliers:', error); throw new Error('Failed to load suppliers.'); }
}
async function loadAllInitialData() {
  isLoadingInitialData.value = true; fetchError.value = ''; productData.value = null;
  try {
    const results = await Promise.allSettled([ fetchProductForEditing(), fetchCategories(), fetchSuppliers()]);
    if (results[0].status === 'rejected') throw results[0].reason;
    productData.value = results[0].value;
    categories.value = results[1].status === 'fulfilled' ? results[1].value : [];
    suppliers.value = results[2].status === 'fulfilled' ? results[2].value : [];
  } catch (error) { console.error('Initial data load error:', error); fetchError.value = error.message; }
  finally { isLoadingInitialData.value = false; }
}
async function handleUpdateProduct(formData) {
  if (!productId.value) { productFormApiError.value = 'Product ID missing.'; return; }
  isSubmittingProductForm.value = true; productFormApiError.value = '';
  try {
    const response = await $axios.put(`/admin/products/${productId.value}`, formData);
    productData.value = response.data.data || response.data;
    alert('Product updated!');
  } catch (error) { console.error('Error updating product:', error); productFormApiError.value = error.response?.data?.message || 'Update error.'; }
  finally { isSubmittingProductForm.value = false; }
}
onMounted(loadAllInitialData);
</script>

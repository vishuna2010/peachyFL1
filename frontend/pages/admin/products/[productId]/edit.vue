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

      {{/* Tax Class Selector Section */}}
      <section class="bg-white shadow-md rounded-lg p-6 my-10">
        <h3 class="text-xl font-semibold text-gray-700 mb-5 border-b pb-3">Tax Configuration</h3>
        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div class="sm:col-span-3">
            <label for="tax_class_id" class="block text-sm font-medium text-gray-700">Tax Class</label>
            <div v-if="isLoadingTaxClasses" class="mt-1 text-sm text-gray-500">Loading tax classes...</div>
            <div v-else-if="taxClassesError" class="mt-1 text-sm text-red-600">{{ taxClassesError }}</div>
            <select
              v-else
              id="tax_class_id"
              name="tax_class_id"
              v-model="productData.tax_class_id"
              class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option :value="null">-- No Tax Class --</option>
              <option v-for="taxClass in availableTaxClasses" :key="taxClass.id" :value="taxClass.id">
                {{ taxClass.name }}
              </option>
            </select>
            <p v-if="!isLoadingTaxClasses && availableTaxClasses.length === 0 && !taxClassesError" class="mt-1 text-xs text-gray-500">
              No tax classes available. You can create them in the Tax Management section.
            </p>
          </div>
        </div>
      </section>

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

const availableTaxClasses = ref([]);
const isLoadingTaxClasses = ref(false); // This might be redundant if using isLoadingInitialData for overall page load
const taxClassesError = ref(null);

useHead({ title: computed(() => `Admin - Edit Product Form ${productId.value || ''}`) });

async function fetchTaxClasses() {
  isLoadingTaxClasses.value = true; // Individual loading state if needed, or rely on global
  taxClassesError.value = null;
  try {
    const response = await $axios.get('/admin/tax-classes?limit=1000');
    if (response.data && response.data.data) {
      return response.data.data; // Return data for Promise.allSettled
    } else {
      return response.data || []; // Fallback
    }
  } catch (err) {
    console.error('Error fetching tax classes:', err);
    taxClassesError.value = 'Failed to load tax classes. Please try again.';
    // For Promise.allSettled, it's better to throw error or return a specific error indicator
    // so that the calling function can see it was rejected.
    throw new Error('Failed to load tax classes.');
  } finally {
    isLoadingTaxClasses.value = false; // Individual loading state if needed
  }
}

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
  availableTaxClasses.value = []; // Reset tax classes on load
  taxClassesError.value = null; // Reset tax classes error
  try {
    const results = await Promise.allSettled([
      fetchProductForEditing(),
      fetchCategories(),
      fetchSuppliers(),
      fetchTaxClasses() // Add fetchTaxClasses to the list
    ]);

    if (results[0].status === 'rejected') throw results[0].reason; // Product data is critical
    productData.value = results[0].value;

    categories.value = results[1].status === 'fulfilled' ? results[1].value : [];
    if (results[1].status === 'rejected') console.warn("Failed to load categories during initial data load.");

    suppliers.value = results[2].status === 'fulfilled' ? results[2].value : [];
    if (results[2].status === 'rejected') console.warn("Failed to load suppliers during initial data load.");

    availableTaxClasses.value = results[3].status === 'fulfilled' ? results[3].value : [];
    if (results[3].status === 'rejected') {
      console.warn("Failed to load tax classes during initial data load.");
      // taxClassesError.value is already set within fetchTaxClasses if it fails
      // but we might want to set a general fetchError if this is critical path
      // For now, individual error state taxClassesError is used.
    }

  } catch (error) {
    console.error('Initial data load error (critical product data failed):', error);
    fetchError.value = error.message;
  }
  finally { isLoadingInitialData.value = false; }
}
async function handleUpdateProduct(formData) {
  if (!productId.value) { productFormApiError.value = 'Product ID missing.'; return; }
  isSubmittingProductForm.value = true;
  productFormApiError.value = '';

  // Add tax_class_id to the FormData object
  if (productData.value && productData.value.tax_class_id !== undefined) {
    if (productData.value.tax_class_id === null) {
      formData.append('tax_class_id', ''); // Send empty string to be treated as NULL by backend
    } else {
      formData.append('tax_class_id', productData.value.tax_class_id);
    }
  }
  // If productData.value.tax_class_id is undefined (e.g. if not loaded yet or error),
  // it won't be appended, and backend will treat as no change unless field is required.
  // The backend validator for tax_class_id is optional({nullable:true}), so not sending it is fine if no change.

  try {
    const response = await $axios.put(`/admin/products/${productId.value}`, formData);
    // Update the entire productData ref with the response to ensure consistency,
    // including the potentially updated tax_class_id from the server.
    if (response.data && response.data.data) {
        productData.value = { ...productData.value, ...(response.data.data) };
    } else if (response.data) {
        productData.value = { ...productData.value, ...response.data };
    }
    // Ensure local productData.tax_class_id also reflects what was just saved,
    // which should be handled by spreading the response.data.data.
    // If tax_class_id might not be in response.data.data but was successfully set,
    // we might need to explicitly set productData.value.tax_class_id from what was sent.
    // However, a good API PUT response returns the updated resource.

    alert('Product updated!'); // Consider using toast
  } catch (error) {
    console.error('Error updating product:', error);
    // Attempt to parse a more specific error message if the response is a Blob (e.g., validation error from backend)
    if (error.response && error.response.data instanceof Blob && error.response.data.type === 'application/json') {
        try {
            const errorText = await error.response.data.text();
            const errorJson = JSON.parse(errorText);
            productFormApiError.value = errorJson.message || (errorJson.errors ? errorJson.errors.map(e => e.msg).join(', ') : 'Update error.');
        } catch (parseError) {
            console.error('Failed to parse error response blob:', parseError);
            productFormApiError.value = 'Update error. Could not parse error details.';
        }
    } else {
        productFormApiError.value = error.response?.data?.message || (error.response?.data?.errors ? error.response.data.errors.map(e => e.msg).join(', ') : 'Update error.');
    }
  }
  finally { isSubmittingProductForm.value = false; }
}
onMounted(loadAllInitialData);
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Manage Products</h1>

    <div class="flex justify-between items-center mb-6">
      <NuxtLink
        v-if="can('products:create').value"
        to="/admin/products/new"
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Add New Product
      </NuxtLink>
      <div v-else></div> <!-- Placeholder to maintain layout if button is hidden -->

      <div class="flex items-center">
        <input
          type="text"
          v-model="searchTerm"
          placeholder="Search products..."
          class="border px-4 py-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          @keyup.enter="fetchProducts"
        />
        <button
          @click="fetchProducts"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-md"
        >
          Search
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-xl text-gray-500">Loading products...</p>
    </div>

    <div v-else-if="error" class="text-center py-10">
      <p class="text-xl text-red-500">Failed to load products. Please try again.</p>
      <p class="text-sm text-gray-400 mt-1">{{ error }}</p>
    </div>

    <div v-else-if="products.length === 0" class="text-center py-10">
      <p class="text-xl text-gray-500">No products found.</p>
      <p v-if="searchTerm" class="text-sm text-gray-400 mt-1">Try adjusting your search term.</p>
    </div>

    <div v-else>
      <div class="overflow-x-auto shadow-md sm:rounded-lg">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="product in products" :key="product.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ product.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.sku }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.category?.name || 'N/A' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${{ (product.price / 100).toFixed(2) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ product.stock_quantity }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span
                  :class="{
                    'bg-gray-200 text-gray-700': product.effective_stock_quantity <= 0, // Sold Out
                    'bg-green-100 text-green-800': product.effective_stock_quantity > 0 && product.product_status === 'active',
                    'bg-yellow-100 text-yellow-800': product.effective_stock_quantity > 0 && (product.product_status === 'draft' || product.product_status === 'inactive'),
                    'bg-red-100 text-red-800': product.effective_stock_quantity > 0 && product.product_status === 'archived',
                  }"
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                >
                  {{ product.effective_stock_quantity <= 0 ? 'Sold Out' : (product.product_status || 'N/A') }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  @click="openPrintLabelModal(product)"
                  class="text-green-600 hover:text-green-900 mr-3"
                >
                  Print Labels
                </button>
                <NuxtLink
                  v-if="can('products:edit').value"
                  :to="`/admin/products/${product.id}/edit`"
                  class="text-indigo-600 hover:text-indigo-900 mr-3"
                >
                  Edit
                </NuxtLink>
                <button
                  v-if="can('products:delete').value"
                  @click="deleteProduct(product.id)"
                  class="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="mt-6 flex justify-between items-center">
        <div>
          <button
            @click="prevPage"
            :disabled="currentPage === 1 || isLoading"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            @click="nextPage"
            :disabled="currentPage === totalPages || isLoading"
            class="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div class="text-sm text-gray-700">
          Page <span class="font-medium">{{ currentPage }}</span> of <span class="font-medium">{{ totalPages }}</span>
        </div>
      </div>
    </div>
  </div>
  <!-- Print Labels Modal -->
  <div v-if="showPrintLabelModal && currentProductForLabel" class="fixed inset-0 z-50 overflow-y-auto bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out" :class="{'opacity-100': showPrintLabelModal, 'opacity-0 pointer-events-none': !showPrintLabelModal}">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out" :class="{'scale-100 opacity-100': showPrintLabelModal, 'scale-95 opacity-0': !showPrintLabelModal}">
      <div class="p-5 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg leading-6 font-medium text-gray-900">Print Labels for: {{ currentProductForLabel.name }}</h3>
        <button @click="showPrintLabelModal = false" class="text-gray-400 hover:text-gray-600 focus:outline-none">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label for="label_quantity" class="block text-sm font-medium text-gray-700 mb-1">Number of labels to print:</label>
          <input type="number" id="label_quantity" v-model.number="labelQuantity" min="1" max="200"
                 class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <p v-if="labelQuantity < 1 || labelQuantity > 200" class="text-xs text-red-600">Please enter a number between 1 and 200.</p>

            <!-- New Variant Selection Section -->
            <div v-if="currentProductForLabel && currentProductForLabel.has_variants" class="mt-4">
              <div v-if="isLoadingProductDetails">
                <p class="text-sm text-gray-500">Loading variant details...</p>
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500 mt-1"></div>
              </div>
              <div v-else-if="detailedProductForLabel && detailedProductForLabel.variants && detailedProductForLabel.variants.length > 0">
                <label for="variant_selection" class="block text-sm font-medium text-gray-700 mb-1">Select Variant:</label>
                <select id="variant_selection" v-model="selectedVariantIdForLabel"
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option :value="null" disabled>-- Select a Variant --</option>
                  <option v-for="variant in detailedProductForLabel.variants" :key="variant.id" :value="variant.id">
                    {{ variant.sku || `Variant (ID: ${variant.id})` }}
                  </option>
                </select>
              </div>
              <div v-else-if="!isLoadingProductDetails && detailedProductForLabel && (!detailedProductForLabel.variants || detailedProductForLabel.variants.length === 0)">
                <p class="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-md">No variants found for this product.</p>
              </div>
            </div>
      </div>
      <div class="px-5 py-4 bg-gray-50 border-t border-gray-200 sm:flex sm:flex-row-reverse rounded-b-lg">
        <button
          type="button"
          @click="handlePrintLabels"
          :disabled="labelQuantity < 1 || labelQuantity > 200 || isPrintingLabel || (currentProductForLabel?.has_variants && isLoadingProductDetails)"
          class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isPrintingLabel">Printing...</span>
          <span v-else>Print</span>
        </button>
        <button
          type="button"
          @click="showPrintLabelModal = false"
          class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp } from '#app';
import { usePermissions } from '~/composables/usePermissions';

const { can } = usePermissions();

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Products',
});

const { $axios } = useNuxtApp();

const products = ref([]);
const isLoading = ref(true);
const error = ref(null);
const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(10); // Number of items per page
const searchTerm = ref('');
// const selectedCategory = ref(null); // For future filter extension

const showPrintLabelModal = ref(false);
const currentProductForLabel = ref(null);
const labelQuantity = ref(1);
const isPrintingLabel = ref(false);
const detailedProductForLabel = ref(null);
const isLoadingProductDetails = ref(false);
const selectedVariantIdForLabel = ref(null);

const openPrintLabelModal = async (product) => {
  currentProductForLabel.value = product;
  labelQuantity.value = 1;
  selectedVariantIdForLabel.value = null;
  detailedProductForLabel.value = null;

  showPrintLabelModal.value = true;

  if (product.has_variants) {
    isLoadingProductDetails.value = true;
    try {
      const response = await $axios.get(`/admin/products/${product.id}`);
      detailedProductForLabel.value = response.data.data;
      if (!detailedProductForLabel.value && response.data) {
         detailedProductForLabel.value = response.data;
      }

    } catch (err) {
      console.error('Error fetching product details for labels:', err);
      alert('Failed to load product details for variant selection. Please try again.');
      showPrintLabelModal.value = false;
    } finally {
      isLoadingProductDetails.value = false;
    }
  } else {
    isLoadingProductDetails.value = false;
  }
};

const handlePrintLabels = async () => {
  if (!currentProductForLabel.value || !currentProductForLabel.value.id) {
    alert('Error: Product information is missing. Cannot print labels.');
    return;
  }

  const quantity = parseInt(labelQuantity.value);
  if (isNaN(quantity) || quantity < 1 || quantity > 200) {
    alert('Error: Invalid number of labels. Please enter a number between 1 and 200.');
    return;
  }

  // New check for variant selection if product has variants -- REMOVED as per instruction
  // if (currentProductForLabel.value.has_variants && !selectedVariantIdForLabel.value) {
  //   alert('This product has variants. Please select a specific variant to print labels for.');
  //   return;
  // }

  isPrintingLabel.value = true;
  let apiUrl = `/admin/products/${currentProductForLabel.value.id}/label?count=${quantity}`;

  if (selectedVariantIdForLabel.value) {
    apiUrl += `&variant_id=${selectedVariantIdForLabel.value}`;
  }

  try {
    const response = await $axios.get(apiUrl, {
      responseType: 'blob', // Important for file downloads
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);

    window.open(objectUrl, '_blank');

    // Clean up the object URL after a short delay to allow the browser to initiate the download/display
    // Some browsers might need more time, or this can be tied to an event if more robustness is needed.
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1000); // Increased delay slightly

    showPrintLabelModal.value = false;

  } catch (error) {
    console.error('Error fetching label PDF:', error);
    let errorMessage = 'Failed to download label PDF. Please try again.';

    if (error.response && error.response.data) {
      // The response data for an error from an $axios request with responseType: 'blob'
      // will itself be a Blob. We need to read it as text to parse as JSON.
      try {
        const errorText = await error.response.data.text();
        const errorJson = JSON.parse(errorText);

        if (errorJson && errorJson.message) {
          if (errorJson.message.includes("Variant with ID") && errorJson.message.includes("not found")) {
            errorMessage = `Error: The selected variant could not be found for this product. It might have been recently changed or deleted. Please try selecting the variant again or refresh the product details. (Backend: ${errorJson.message})`;
          } else {
            errorMessage = errorJson.message; // Use the specific message from backend
          }
        }
      } catch (e) {
        // Could not parse error blob or it wasn't JSON, stick to generic message
        console.error('Could not parse error response blob as JSON:', e);
      }
    } else if (error.message) {
      // For non-Axios errors or network errors where error.response is not available
      errorMessage = error.message;
    }

    alert(errorMessage);
    showPrintLabelModal.value = false;
  } finally {
    isPrintingLabel.value = false;
  }
};

const fetchProducts = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const params = {
      page: currentPage.value,
      limit: limit.value,
      search_term: searchTerm.value || undefined,
      // category_id: selectedCategory.value || undefined, // For future
    };

    const response = await $axios.get('/admin/products', { params });

    if (response.data && response.data.data) {
      products.value = response.data.data;
      totalPages.value = response.data.pagination.totalPages || 1;
      currentPage.value = response.data.pagination.currentPage || 1;
    } else {
      // Fallback for simpler structure if needed
      products.value = response.data.products || response.data || [];
      totalPages.value = response.data.totalPages || 1;
      currentPage.value = response.data.currentPage || 1;
       if (products.value.length === 0 && !response.data.pagination && !response.data.totalPages) {
        // If no pagination info and no products, assume single page with current products
        totalPages.value = 1;
        currentPage.value = 1;
      }
    }

  } catch (err) {
    console.error('Error fetching products:', err);
    const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred.';
    error.value = `Failed to load products. ${errorMessage}`;
  } finally {
    isLoading.value = false;
  }
};

const deleteProduct = async (productId) => {
  if (!confirm('Are you sure you want to delete this product?')) {
    return;
  }
  try {
    await $axios.delete(`/admin/products/${productId}`);
    // alert('Product deleted successfully'); // Replace with a toast notification if available
    fetchProducts(); // Refresh the list
  } catch (err) {
    console.error('Error deleting product:', err);
    const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred.';
    alert(`Failed to delete product: ${errorMessage}`); // Replace with a toast notification if available
    error.value = `Failed to delete product. ${errorMessage}`;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    fetchProducts();
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchProducts();
  }
};

onMounted(() => {
  fetchProducts();
});

// Watch for changes in searchTerm and fetch products
// Debouncing could be added here for better performance on frequent typing
watch(searchTerm, () => {
  currentPage.value = 1; // Reset to first page on new search
  // fetchProducts(); // Trigger search on type, or rely on search button
});

// Watch for changes in selectedCategory (for future filter extension)
// watch(selectedCategory, () => {
//   currentPage.value = 1; // Reset to first page on new filter
//   fetchProducts();
// });

</script>

<style scoped>
/* Scoped styles if needed, Tailwind is preferred for this project */
</style>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Manage Products</h1>

    <div class="flex justify-between items-center mb-6">
      <NuxtLink
        to="/admin/products/new"
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Add New Product
      </NuxtLink>

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
                    'bg-green-100 text-green-800': product.status === 'active',
                    'bg-yellow-100 text-yellow-800': product.status === 'draft',
                    'bg-red-100 text-red-800': product.status === 'archived',
                  }"
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                >
                  {{ product.status || 'N/A' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <NuxtLink
                  :to="`/admin/products/${product.id}/edit`"
                  class="text-indigo-600 hover:text-indigo-900 mr-3"
                >
                  Edit
                </NuxtLink>
                <button
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
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp } from '#app';

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

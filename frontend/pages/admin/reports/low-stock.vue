<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Low Stock Report</h1>

    <div class="mb-4 flex justify-end">
      <button
        @click="fetchLowStockReport"
        :disabled="isLoading"
        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
      >
        <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ isLoading ? 'Refreshing...' : 'Refresh Report' }}
      </button>
    </div>

    <div v-if="isLoading && lowStockProducts.length === 0" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading low stock report...</p>
    </div>
    <div v-if="errorMessage" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Error fetching report: {{ errorMessage }}</p>
       <button @click="fetchLowStockReport" class="mt-2 px-3 py-1.5 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Retry</button>
    </div>

    <div v-if="!isLoading && !errorMessage && lowStockProducts.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="mt-3 text-xl">All Clear!</p>
      <p class="text-sm mt-1">No products are currently low on stock based on their reorder thresholds.</p>
    </div>

    <div v-if="lowStockProducts.length > 0 && !isLoading" class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
            <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
            <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Threshold</th>
            <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Stock Update</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="product in lowStockProducts" :key="product.id"
              :class="{ 'bg-red-50 hover:bg-red-100': product.stock_difference < 0, 'bg-yellow-50 hover:bg-yellow-100': product.stock_difference === 0, 'hover:bg-gray-50': product.stock_difference > 0 }">
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
              <NuxtLink :to="`/admin/products/${product.id}/edit`" :title="`Edit ${product.name}`" class="text-indigo-600 hover:text-indigo-900 hover:underline">
                {{ product.name }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ product.sku || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{{ product.stock_quantity }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{{ product.reorder_threshold }}</td>
            <td
              class="px-4 py-3 whitespace-nowrap text-sm text-center font-medium"
              :class="{ 'text-red-600': product.stock_difference < 0, 'text-yellow-600': product.stock_difference === 0, 'text-green-600': product.stock_difference > 0 }">
              {{ product.stock_difference }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ product.supplier_name || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ product.updated_at ? new Date(product.updated_at).toLocaleDateString() : 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
              <NuxtLink :to="`/admin/products/${product.id}/edit`" class="text-indigo-600 hover:text-indigo-900 hover:underline">Edit Product</NuxtLink>
              <!-- Future: Link to create PO for this supplier -->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useHead, definePageMeta } from '#imports'; // useHead and definePageMeta imported

definePageMeta({
  layout: 'admin',
  title: 'Low Stock Report' // Updated title for consistency
});

useHead({ // Added useHead for consistency
  title: 'Admin - Low Stock Report',
});

const { $axios } = useNuxtApp();

const lowStockProducts = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');

async function fetchLowStockReport() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    // Simulate API call if needed for testing, or use actual endpoint
    const response = await $axios.get('/admin/reports/low-stock-products');
    lowStockProducts.value = response.data.map(p => ({
      ...p,
      // ensure stock_difference is a number for reliable comparison
      stock_difference: Number(p.stock_quantity) - Number(p.reorder_threshold)
    }));
  } catch (error) {
    console.error('Failed to fetch low stock report:', error);
    errorMessage.value = error.response?.data?.message || 'An unexpected error occurred.';
    lowStockProducts.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchLowStockReport();
});

</script>

<!-- <style scoped> block removed, Tailwind classes used instead -->

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-semibold mb-4">Product Details</h1>
    <div v-if="isLoading" class="text-center">Loading product data...</div>
    <div v-else-if="error" class="text-red-500 text-center">{{ error }}</div>
    <div v-else-if="product">
      <p><span class="font-semibold">Product ID:</span> {{ productId }}</p>
      <p><span class="font-semibold">Name:</span> {{ product.name }}</p>
      <p><span class="font-semibold">Description:</span> {{ product.description }}</p>
      <p><span class="font-semibold">Price:</span> {{ product.price ? ($axios.defaults.baseURL.includes('api') ? product.price / 100 : product.price) : 'N/A' }}</p> <!-- Basic price display -->
      <p class="mt-4 italic">Further product details and management options will be displayed here.</p>
      <NuxtLink :to="`/admin/products/${productId}/edit`" class="text-blue-500 hover:underline mt-2 inline-block">Edit Product</NuxtLink>
    </div>
    <div v-else class="text-center">
      <p>Product not found.</p>
    </div>
    <div class="mt-6">
      <NuxtLink to="/admin/products" class="text-blue-500 hover:underline">&larr; Back to Products List</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'; // Added computed
import { useRoute } from 'vue-router'; // Or from '#app'
import { useNuxtApp, definePageMeta, useHead } from '#imports'; // Or from '#app'

definePageMeta({
  layout: 'admin',
});

const route = useRoute();
const { $axios } = useNuxtApp();

const productId = ref(route.params.productId);
const product = ref(null);
const isLoading = ref(true);
const error = ref(null);

useHead({
  title: computed(() => `Admin - Product ${productId.value}`),
});

onMounted(async () => {
  if (!productId.value) {
    error.value = 'Product ID is missing.';
    isLoading.value = false;
    return;
  }
  try {
    // Corrected path relative to Axios baseURL (which is .../api)
    const response = await $axios.get(`/products/${productId.value}`); // Public product detail endpoint
    // Assuming the public endpoint response has product data directly or under a 'data' key
    product.value = response.data.data ? response.data.data : response.data;
  } catch (err) {
    console.error(`Error fetching product ${productId.value}:`, err);
    if (err.response?.status === 404) {
      error.value = `Product with ID ${productId.value} not found.`;
    } else {
      error.value = 'Failed to load product data. ' + (err.response?.data?.message || err.message);
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

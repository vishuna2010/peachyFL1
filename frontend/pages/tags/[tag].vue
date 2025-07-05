<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        Products tagged with "{{ tagName }}"
      </h1>
      <p class="text-gray-600">
        {{ products.length }} product{{ products.length !== 1 ? 's' : '' }} found
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <ProductCardSkeleton v-for="n in 8" :key="n" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600 mb-4">{{ error }}</p>
      <button @click="fetchProducts" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
        Try Again
      </button>
    </div>

    <!-- Products Grid -->
    <div v-else-if="products.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        @open-quick-view="handleOpenQuickView"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 text-lg mb-4">No products found with this tag.</p>
      <NuxtLink to="/products" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
        Browse All Products
      </NuxtLink>
    </div>

    <!-- Quick View Modal -->
    <ProductQuickView
      v-if="showQuickView"
      :product="selectedProduct"
      @close="showQuickView = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

definePageMeta({
  layout: 'default'
});

const route = useRoute();
const { $axios } = useNuxtApp();

const products = ref([]);
const isLoading = ref(true);
const error = ref(null);
const showQuickView = ref(false);
const selectedProduct = ref(null);

const tagName = computed(() => {
  return route.params.tag
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
});

const fetchProducts = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await $axios.get('/products', {
      params: {
        tag: route.params.tag
      }
    });
    
    if (response.data && Array.isArray(response.data.products)) {
      products.value = response.data.products;
    } else {
      products.value = [];
    }
  } catch (err) {
    console.error('Error fetching products by tag:', err);
    error.value = 'Failed to load products. Please try again.';
    products.value = [];
  } finally {
    isLoading.value = false;
  }
};

const handleOpenQuickView = (product) => {
  selectedProduct.value = product;
  showQuickView.value = true;
};

onMounted(() => {
  fetchProducts();
});
</script> 
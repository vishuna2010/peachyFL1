<template>
  <div
    v-if="products && products.length > 0"
    class="w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-4"
    @mouseenter="$emit('mouseenter')"
    @mouseleave="$emit('mouseleave')"
  >
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div v-for="product in displayedProducts" :key="product.id" class="group">
        <NuxtLink :to="`/products/${product.id}`" class="block">
          <img
            :src="product.image_url || 'https://via.placeholder.com/150x150.png?text=No+Image'"
            :alt="product.name"
            class="w-full h-24 object-cover rounded-md mb-2 group-hover:opacity-80 transition-opacity"
          />
          <h4 class="text-xs font-medium text-venus-text-primary truncate group-hover:text-peach-pink" :title="product.name">
            {{ product.name }}
          </h4>
          <p class="text-xs text-orange-gold font-semibold">
            {{ formatCurrency(product.price) }}
            <span v-if="product.original_price && parseFloat(product.original_price) > parseFloat(product.price)" class="text-xxs text-gray-400 line-through ml-1">
              {{ formatCurrency(product.original_price) }}
            </span>
          </p>
        </NuxtLink>
      </div>
    </div>
    <NuxtLink
      :to="categoryLink"
      class="block w-full text-center text-sm font-medium text-peach-pink py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors"
    >
      View all {{ categoryName }} products &rarr;
    </NuxtLink>
  </div>
  <div
    v-else-if="isLoading"
    class="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-4 text-center text-venus-text-secondary"
  >
    Loading products...
  </div>
  <!-- Can add a state for 'no products found' if products array is empty after loading -->
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  products: {
    type: Array,
    default: () => [],
  },
  categoryName: {
    type: String,
    required: true,
  },
  categorySlug: {
    type: String,
    required: true,
  },
  isLoading: { // To show a loading state
    type: Boolean,
    default: false,
  }
});

const MAX_PRODUCTS_TO_DISPLAY = 4;

const displayedProducts = computed(() => {
  return props.products.slice(0, MAX_PRODUCTS_TO_DISPLAY);
});

const categoryLink = computed(() => {
  return `/categories/${props.categorySlug}`;
});

const formatCurrency = (value) => {
  const numericValue = parseFloat(value);
  if (!isNaN(numericValue)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericValue);
  }
  return '';
};
</script>

<style scoped>
/* Minimal additional styles if needed */
.text-xxs {
  font-size: 0.65rem; /* ~10.4px if base is 16px */
  line-height: 0.85rem;
}
</style>

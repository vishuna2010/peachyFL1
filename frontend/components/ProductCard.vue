<template>
  <div class="border border-neutral-medium rounded-lg shadow-sm hover:shadow-2xl transition-all duration-300 ease-in-out overflow-hidden flex flex-col group hover:scale-[1.02]">
    <div class="relative">
      <NuxtLink :to="`/products/${product.id}`" class="block">
        <img
          :src="product.image_url || 'https://via.placeholder.com/300x300.png?text=No+Image'"
          :alt="`Image of ${product.name}`"
          class="w-full h-56 object-cover transition-opacity duration-300 ease-in-out group-hover:opacity-80"
        />
      </NuxtLink>
      <button class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-white text-sm font-semibold px-4 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-accent">
        Quick View
      </button>
      <div class="absolute top-2 right-2 bg-brand-accent text-white text-xs font-semibold px-2.5 py-1 rounded-full">
        SALE
      </div>
    </div>
    <div class="p-4 flex flex-col flex-grow">
      <NuxtLink :to="`/products/${product.id}`" class="block hover:text-brand-primary">
        <h3 class="font-semibold text-lg text-text-primary truncate mb-1" :title="product.name">
          {{ product.name }}
        </h3>
      </NuxtLink>
      <p v.if="product.category_name" class="text-sm text-text-secondary mb-2 truncate">
        {{ product.category_name }}
      </p>
      <p class="text-brand-primary font-bold text-xl mb-3 mt-auto">
        {{ formattedPrice }}
      </p>
      <!-- Add to Cart button or other actions can be added here later -->
      <!-- e.g., <button class="mt-auto bg-brand-primary text-white py-2 px-4 rounded hover:bg-opacity-90 transition-colors">Add to Cart</button> -->
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  product: {
    type: Object,
    required: true,
    default: () => ({
      id: 0,
      name: 'Unnamed Product',
      price: 0.00,
      image_url: '',
      category_name: ''
    })
  }
});

const formattedPrice = computed(() => {
  if (props.product && typeof props.product.price === 'number') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(props.product.price);
  }
  return '$0.00'; // Fallback for invalid price
});
</script>

<style scoped>
/* Scoped styles can be added here if absolutely necessary for complex things
   Tailwind doesn't easily handle, but prefer utility classes. */
</style>

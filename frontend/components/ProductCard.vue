<template>
  <div class="bg-venus-background border border-venus-neutral-light rounded-sm overflow-hidden flex flex-col group relative transition-all duration-300 ease-in-out hover:shadow-lg">
    <div class="relative">
      <NuxtLink :to="`/products/${product.id}`" class="block">
        <img
          :src="product.image_url || 'https://via.placeholder.com/300x300.png?text=No+Image'"
          :alt="`Image of ${product.name}`"
          class="w-full h-56 object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
        />
      </NuxtLink>
      <button class="absolute bottom-4 left-1/2 -translate-x-1/2 w-10/12 bg-white text-venus-text-primary text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out hover:bg-venus-neutral-light focus:outline-none focus:ring-2 focus:ring-venus-accent-gold">
        Quick View
      </button>
      <div class="absolute top-3 left-3 bg-venus-accent-sale text-white text-xs font-bold px-2 py-0.5 rounded-sm">
        SALE
      </div>
    </div>
    <div class="p-4 flex flex-col flex-grow">
      <NuxtLink :to="`/products/${product.id}`" class="block group-hover:underline">
        <h3 class="font-sans text-base text-venus-text-primary mb-1 h-10 overflow-hidden" :title="product.name">
          {{ product.name }}
        </h3>
      </NuxtLink>
      <p v.if="product.category_name" class="text-xs text-venus-text-secondary mb-2 truncate">
        {{ product.category_name }}
      </p>
      <p class="font-sans text-base text-venus-text-primary font-semibold mt-auto pt-2">
        {{ formattedPrice }}
      </p>
      <!-- Add to Cart button or other actions can be added here later -->
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

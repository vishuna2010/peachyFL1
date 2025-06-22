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
      <button
        @click.stop="handleOpenQuickView"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 w-10/12 bg-white text-venus-text-primary text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out hover:bg-venus-neutral-light focus:outline-none focus:ring-2 focus:ring-venus-accent-gold"
      >
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
      <p v-if="product.category_name" class="text-xs text-venus-text-secondary mb-1 truncate">
        {{ product.category_name }}
      </p>
      <p v-if="product.tax_class_name" class="text-xs text-venus-text-secondary mb-1 truncate">
        Tax: {{ product.tax_class_name }}
      </p>
      <p class="font-sans text-base text-venus-text-primary font-semibold mt-auto pt-2">
        {{ formattedPrice }}
      </p>
      <div class="mt-3">
        <NuxtLink
          v-if="product.has_variants"
          :to="`/products/${product.id}`"
          class="block w-full text-center bg-venus-neutral-dark text-white text-sm font-semibold px-4 py-2 rounded-sm shadow-sm hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-venus-accent-gold transition-all duration-200"
        >
          View Options
        </NuxtLink>
        <!-- Placeholder for Add to Cart for simple products -->
        <button
          v-else
          class="block w-full bg-venus-text-primary text-white text-sm font-semibold px-4 py-2 rounded-sm shadow-sm hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-venus-accent-gold transition-all duration-200 disabled:opacity-50"
          :disabled="!product.stock_quantity || product.stock_quantity <= 0"
          @click.stop="handleAddToCart"
        >
          {{ product.stock_quantity && product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCart } from '~/composables/useCart';
import { useToast } from 'vue-toastification';


const { addToCart } = useCart();
const toast = useToast();

const emit = defineEmits(['openQuickView']);

const props = defineProps({
  product: {
    type: Object,
    required: true,
    default: () => ({
      id: 0,
      name: 'Unnamed Product',
      price: 0.00,
      image_url: '',
      category_name: '',
      has_variants: false,
      stock_quantity: 0,
      sku: ''
    })
  }
});

const formattedPrice = computed(() => {
  let priceToParse = null;

  if (props.product.final_price !== undefined && props.product.final_price !== null) {
    priceToParse = props.product.final_price;
  } else if (props.product.price !== undefined && props.product.price !== null) {
    priceToParse = props.product.price;
  }

  const numericPrice = parseFloat(priceToParse);

  if (!isNaN(numericPrice)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericPrice);
  }
  return '$0.00'; // Fallback for invalid or missing price
});

const handleAddToCart = () => {
  const priceForCart = parseFloat(
    (props.product.final_price !== undefined && props.product.final_price !== null)
    ? props.product.final_price
    : props.product.price
  );

  if (props.product && !props.product.has_variants && props.product.stock_quantity && props.product.stock_quantity > 0 && !isNaN(priceForCart)) {
    const cartItemData = {
      id: props.product.id, // Use product ID as item ID if no variants
      product_id: props.product.id,
      variant_id: null,
      name: props.product.name,
      price: priceForCart,
      sku: props.product.sku,
      image_url: props.product.image_url || 'https://via.placeholder.com/300x300.png?text=No+Image',
      type: 'product',
      tax_class_id: props.product.tax_class_id || null,
      tax_class_name: props.product.tax_class_name || null, // Add tax_class_name
    };
    addToCart(cartItemData, 1); // Add 1 quantity
    toast.success(`${props.product.name} added to cart!`);
  } else {
    toast.error("Item is out of stock or unavailable.");
  }
};

const handleOpenQuickView = () => {
  emit('openQuickView', props.product);
};
</script>

<style scoped>
/* Scoped styles can be added here if absolutely necessary for complex things
   Tailwind doesn't easily handle, but prefer utility classes. */
</style>

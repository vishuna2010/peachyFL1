<template>
  <div class="bg-white border border-gray-200 rounded-sm overflow-hidden flex flex-col group relative transition-all duration-300 ease-in-out hover:shadow-lg group-hover:border-peach-pink">
    <div class="relative">
      <NuxtLink :to="`/products/${product.id}`" class="block">
        <img
          :src="product.image_url || '/images/placeholder-product.svg'"
          :alt="`Image of ${sanitizeAttributeValue(product.name)}`"
          class="w-full h-56 object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
        />
      </NuxtLink>
      <button
       @click.stop="handleOpenQuickView"
       class="absolute bottom-4 left-1/2 -translate-x-1/2 w-10/12
              bg-white text-sky-blue border border-sky-blue text-sm font-semibold px-4 py-2.5
              rounded-md shadow-md opacity-0 group-hover:opacity-100
              transition-all duration-300 ease-in-out
              hover:bg-sky-blue hover:text-white
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-blue"
      >
        Quick View
      </button>
      <div
        v-if="isProductOnSale"
        class="absolute top-3 left-3 bg-orange-gold text-white text-xs font-bold px-2 py-0.5 rounded-sm z-10"
      >
        SALE
      </div>
    </div>
    <div class="p-4 flex flex-col flex-grow">
      <NuxtLink :to="`/products/${product.id}`" class="block group-hover:underline">
        <h3 class="font-sans text-base text-venus-text-primary mb-1 h-10 overflow-hidden" :title="sanitizeAttributeValue(product.name)">
          {{ product.name }} <!-- Display original name, sanitize for title attr only -->
        </h3>
      </NuxtLink>
       <p v-if="product.category_name" class="text-xs text-sky-blue mb-1 truncate"> <!-- Changed text color -->
        {{ product.category_name }}
      </p>
      <p v-if="product.tax_class_name" class="text-xs text-venus-text-secondary mb-1 truncate">
        Tax: {{ product.tax_class_name }}
      </p>
      <div class="font-sans text-base font-semibold mt-auto pt-2">
        <span class="text-orange-gold">{{ formattedPrice }}</span>
        <span
          v-if="isProductOnSale && product.original_price"
          class="text-sm text-gray-400 line-through ml-2"
        >
          {{ formatCurrency(product.original_price) }}
        </span>
      </div>
      <div class="mt-3">
        <NuxtLink
          v-if="product.has_variants"
          :to="`/products/${product.id}`"
          class="block w-full text-center bg-peach-pink text-white text-sm font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink transition-all duration-200"
        >
          View Options
        </NuxtLink>
        <button
          v-else
          class="block w-full bg-peach-pink text-white text-sm font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink transition-all duration-200 disabled:opacity-50 disabled:bg-peach-pink/50"
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
import { sanitizeAttributeValue } from '~/utils/sanitize';


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
      original_price: null, // Added for sale detection
      final_price: null,    // Added for sale price
      image_url: '',
      category_name: '',
      has_variants: false,
      stock_quantity: 0,
      sku: ''
    })
  }
});

const formatCurrency = (value) => {
  const numericValue = parseFloat(value);
  if (!isNaN(numericValue)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericValue);
  }
  return ''; // Fallback for invalid value
};

const currentPrice = computed(() => {
  // Use final_price if available (this could be the sale price), otherwise use price
  return parseFloat(props.product.final_price !== undefined && props.product.final_price !== null ? props.product.final_price : props.product.price);
});

const isProductOnSale = computed(() => {
  const original = parseFloat(props.product.original_price);
  const current = currentPrice.value;
  return !isNaN(original) && !isNaN(current) && original > current;
});

const formattedPrice = computed(() => {
  const numericPrice = currentPrice.value;
  if (!isNaN(numericPrice)) {
    return formatCurrency(numericPrice);
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
      name: sanitizeAttributeValue(props.product.name), // Sanitize name before adding to cart
      price: priceForCart,
      sku: sanitizeAttributeValue(props.product.sku), // Sanitize SKU
      image_url: sanitizeAttributeValue(props.product.image_url || 'https://picsum.photos/300/300?random=998'), // Sanitize image_url
      type: 'product',
      tax_class_id: props.product.tax_class_id || null,
      tax_class_name: props.product.tax_class_name || null,
    };
    addToCart(cartItemData, 1); // Add 1 quantity
    toast.success(`${sanitizeAttributeValue(props.product.name)} added to cart!`); // Sanitize for toast as well
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

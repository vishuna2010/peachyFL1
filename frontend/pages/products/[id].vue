<template>
  <div>
    <div v-if="pending" class="loading">Loading product details...</div>
    <div v-if="fetchError" class="error-message">
      <p>Error fetching product: {{ fetchError.message || fetchError }}</p>
      <p v-if="fetchError.response && fetchError.response.status === 404">
        The product you are looking for does not exist.
      </p>
      <NuxtLink to="/">Go back to Home</NuxtLink>
    </div>

    <div v-if="product && !pending && !fetchError" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:grid md:grid-cols-5 lg:grid-cols-2 gap-8 lg:gap-12">
      <!-- Image Column -->
      <div class="md:col-span-3 lg:col-span-1">
        <img
          v-if="displayImage"
          :src="displayImage"
          :alt="`Image of ${product.name}`"
          class="w-full h-auto object-contain rounded-lg shadow-lg max-h-[550px] aspect-[4/5]"
          key="display-image" <!-- Key for re-rendering on change -->
        />
        <div v-else class="w-full h-[400px] md:h-[550px] flex items-center justify-center bg-neutral-medium rounded-lg text-text-secondary">No Image Available</div>
      </div>

      <!-- Details Column -->
      <div class="md:col-span-2 lg:col-span-1 py-4 md:py-0">
        <h1 class="text-3xl font-bold text-text-primary mb-2">{{ product.name }}</h1>
        <p v-if="currentVariant && currentVariant.sku" class="text-sm text-text-secondary mb-4">SKU: {{ currentVariant.sku }}</p>
        <p v-else-if="!currentVariant && product.sku" class="text-sm text-text-secondary mb-4">SKU: {{ product.sku }}</p>

        <p class="text-text-secondary leading-relaxed mb-6">{{ product.description }}</p>

        <p class="text-3xl font-bold text-brand-primary mb-6">${{ displayPrice.toFixed(2) }}</p>

        <p v-if="product.category_name" class="text-sm text-text-secondary mb-2">
          Category: <span class="font-medium text-text-primary">{{ product.category_name }}</span>
        </p>
        <div v-if="product.tags && product.tags.length > 0" class="mb-6">
          <span v-for="tag in product.tags" :key="tag" class="inline-block bg-neutral-medium text-text-secondary text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">
            {{ tag }}
          </span>
        </div>

        <!-- Product Options Selection -->
        <div v-if="product.options && product.options.length > 0" class="space-y-4 mb-6">
          <div v-for="option in product.options" :key="option.id">
            <label :for="`option-${option.id}`" class="block text-sm font-medium text-text-primary mb-1">{{ option.name }}:</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="value in option.values"
                :key="value.id"
                @click="selectOption(option.id, value.id)"
                :class="[
                  'px-4 py-2 border rounded-md text-sm transition-colors duration-150',
                  selectedOptions[option.id] === value.id
                    ? 'bg-brand-primary text-white border-brand-primary ring-2 ring-brand-accent'
                    : 'bg-white hover:bg-neutral-light border-neutral-medium text-text-primary'
                ]"
              >
                {{ value.value }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="product.options && product.options.length > 0 && !currentVariant && Object.keys(selectedOptions).length > 0"
             class="my-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">
          Selected combination is unavailable.
        </div>

        <div
          class="my-4 p-3 rounded-md text-sm font-medium"
          :class="{
            'bg-green-100 text-green-700 border border-green-200': displayStock > 5,
            'bg-yellow-100 text-yellow-700 border border-yellow-200': displayStock > 0 && displayStock <= 5,
            'bg-red-100 text-red-700 border border-red-200': displayStock <= 0
          }"
        >
          {{ stockStatusMessage }}
        </div>

        <div class="flex items-center gap-4 my-6">
          <input
            type="number"
            v-model.number="quantity"
            min="1"
            :max="displayStock > 0 ? displayStock : 1"
            :disabled="addToCartDisabled"
            class="w-20 p-2 border border-neutral-medium rounded-md text-center focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
          />
          <button
            @click="handleAddToCart"
            class="flex-grow bg-brand-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-80 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="addToCartDisabled"
          >
            {{ itemAdded ? 'Added to Cart!' : (displayStock <= 0 ? 'Out of Stock' : 'Add to Cart') }}
          </button>
        </div>
        <div v-if="addToCartError" class="my-2 text-sm text-red-600">{{ addToCartError }}</div>

        <NuxtLink to="/" class="inline-block mt-6 text-brand-primary hover:underline">
          &larr; Back to all products
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive, nextTick } from 'vue';
import { useRoute, useNuxtApp } from '#app';
import { useCart } from '~/composables/useCart';

const { $axios } = useNuxtApp();
const route = useRoute();
const product = ref(null);
const pending = ref(true);
const fetchError = ref(null); // Changed from error to fetchError for clarity

const { addToCart } = useCart();

// --- Variant and Display State ---
const selectedOptions = reactive({}); // { <option_id>: <value_id> }
const currentVariant = ref(null);

const displayPrice = ref(0);
const displaySku = ref('');
const displayStock = ref(0);
const displayImage = ref('');
const addToCartDisabled = ref(true);

const quantity = ref(1);
const itemAdded = ref(false);
const addToCartError = ref('');

// --- Computed properties for dynamic display based on selection ---
const stockStatusMessage = computed(() => {
  if (!product.value && !currentVariant.value) return 'Loading...'; // Or handle better if product never loads
  const stock = displayStock.value;
  if (stock <= 0) return 'Out of Stock';
  if (stock > 0 && stock <= 5) return `Only ${stock} left!`;
  return 'In Stock';
});

const stockStatusClass = computed(() => {
  if (!product.value && !currentVariant.value) return '';
  const stock = displayStock.value;
  if (stock <= 0) return 'stock-out-of-stock';
  if (stock > 0 && stock <= 5) return 'stock-low';
  return 'stock-in-stock';
});

// --- Functions ---
function initializeSelections() {
  if (product.value && product.value.options) {
    for (const option of product.value.options) {
      if (option.values && option.values.length > 0) {
        selectedOptions[option.id] = option.values[0].id; // Default to first value
      }
    }
  }
  updateCurrentVariant();
}

function selectOption(optionId, valueId) {
  selectedOptions[optionId] = valueId;
  updateCurrentVariant();
}

function updateCurrentVariant() {
  if (!product.value) return;

  if (!product.value.variants || product.value.variants.length === 0) {
    // No variants, use base product details
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = product.value.stock_quantity;
    displayImage.value = product.value.image_url || ''; // Already absolute S3 URL
    addToCartDisabled.value = product.value.stock_quantity <= 0;
    quantity.value = 1; // Reset quantity
    return;
  }

  const numSelectedOptions = Object.keys(selectedOptions).length;
  // Ensure all options have a selection before trying to find a variant
  if (product.value.options && numSelectedOptions < product.value.options.length) {
    currentVariant.value = null; // Not all options selected yet
    displayPrice.value = parseFloat(product.value.price); // Show base price
    displaySku.value = product.value.sku || '';
    displayStock.value = 0; // Indicate selection needed or unavailable
    displayImage.value = product.value.image_url || '';
    addToCartDisabled.value = true;
    return;
  }

  const matchedVariant = product.value.variants.find(variant => {
    if (variant.selected_options.length !== numSelectedOptions) return false;
    return variant.selected_options.every(optVal =>
      selectedOptions[optVal.option_id] === optVal.value_id
    );
  });

  if (matchedVariant) {
    currentVariant.value = matchedVariant;
    displayPrice.value = parseFloat(matchedVariant.final_price);
    displaySku.value = matchedVariant.sku || product.value.sku || '';
    displayStock.value = matchedVariant.stock_quantity;
    displayImage.value = matchedVariant.image_url || product.value.image_url || '';
    addToCartDisabled.value = matchedVariant.stock_quantity <= 0;
  } else {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price); // Or some "unavailable price"
    displaySku.value = product.value.sku || ''; // Or "unavailable"
    displayStock.value = 0; // Variant combination doesn't exist or out of stock
    displayImage.value = product.value.image_url || ''; // Fallback to base image
    addToCartDisabled.value = true;
  }
  quantity.value = 1; // Reset quantity on variant change
}


async function fetchProduct() {
  const productId = route.params.id;
  pending.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/products/${productId}`);
    product.value = response.data;
    if (product.value) {
      initializeSelections(); // This will also call updateCurrentVariant
    } else {
      // Handle case where product data is unexpectedly null after successful fetch
      fetchError.value = { message: "Product data is invalid." };
    }
  } catch (err) {
    console.error(`Failed to fetch product ${productId}:`, err);
    fetchError.value = err.response?.data || err;
  } finally {
    pending.value = false;
  }
}

const handleAddToCart = () => {
  addToCartError.value = '';
  const productToAdd = currentVariant.value || product.value; // Prioritize variant
  const stockAvailable = displayStock.value; // Use the dynamically set displayStock

  if (!productToAdd) {
    addToCartError.value = "Product or variant not selected/available.";
    return;
  }
  if (stockAvailable <= 0) {
    addToCartError.value = "This item is out of stock.";
    return;
  }
  if (quantity.value <= 0) {
    addToCartError.value = "Please enter a valid quantity.";
    return;
  }
  if (quantity.value > stockAvailable) {
    addToCartError.value = `Cannot add ${quantity.value} items. Only ${stockAvailable} left in stock.`;
    return;
  }

  // Construct cart item
  const itemForCart = {
    id: product.value.id, // Base product ID
    productVariantId: currentVariant.value ? currentVariant.value.id : null,
    name: currentVariant.value ? `${product.value.name} (${currentVariant.value.selected_options.map(opt => opt.value_name).join(', ')})` : product.value.name,
    price: displayPrice.value, // This is already final_price for variant or base price
    image_url: displayImage.value,
    // Pass other relevant details like SKU if needed by cart/checkout
    sku: displaySku.value,
  };

  addToCart(itemForCart, quantity.value);
  itemAdded.value = true;
  setTimeout(() => {
    itemAdded.value = false;
  }, 1500);
};

onMounted(fetchProduct);

watch(product, (newProductData) => {
    if(newProductData) {
        // This re-initializes selections and current variant if product data itself is refetched/changed.
        initializeSelections();
    }
}, { deep: true });

useHead({
  title: computed(() => product.value ? product.value.name : 'Product Details'),
});

</script>

<style scoped>
.loading, .error-message { /* Keep existing error/loading styles */
  padding: 1rem; margin-bottom: 1rem; border-radius: 4px; text-align: center;
}
.loading { background-color: #e0e0e0; }
.error-message { background-color: #ffdddd; border: 1px solid #ff0000; color: #D8000C; }
.error-message a { color: #D8000C; text-decoration: underline; }

.loading, .error-message { /* Keep existing error/loading styles */
  padding: 1rem; margin-bottom: 1rem; border-radius: 4px; text-align: center;
}
.loading { background-color: #e0e0e0; }
.error-message { background-color: #ffdddd; border: 1px solid #ff0000; color: #D8000C; }
.error-message a { color: #D8000C; text-decoration: underline; }

/* Removed: .product-detail-layout, .image-column, .product-detail-image, .product-detail-image-placeholder */

/* Styles for elements within details-column that are more complex or specific */
.details-column h1 { /* Example if further customization needed beyond Tailwind */
  /* margin-top: 0; */ /* Tailwind: mt-0 (if needed, but usually handled by spacing utilities) */
  /* font-size: 1.8em; */ /* Tailwind: text-3xl */
  /* color: #333; */ /* Tailwind: text-text-primary */
  /* margin-bottom: 0.5rem; */ /* Tailwind: mb-2 */
}
/* .sku { font-size: 0.85em; color: #777; margin-bottom: 1rem; } */ /* Tailwind: text-sm text-text-secondary mb-4 */
/* .description { font-size: 1em; color: #555; margin-bottom: 1rem; line-height: 1.6; } */ /* Tailwind: text-text-secondary leading-relaxed mb-6 */
/* .price { font-size: 1.5em; color: #007bff; font-weight: bold; margin-bottom: 1rem; } */ /* Tailwind: text-3xl font-bold text-brand-primary mb-6 */
/* .category { color: #666; margin-bottom: 1rem; } */ /* Tailwind: text-sm text-text-secondary mb-2 */
/* .tags { margin-bottom: 1.5rem; } */ /* Tailwind: mb-6 */
/* .tag { Tailwind: inline-block bg-neutral-medium text-text-secondary text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full } */

/* .options-section { margin-bottom: 1.5rem; } */ /* Tailwind: space-y-4 mb-6 */
/* .option-group { margin-bottom: 1rem; } */ /* Tailwind: Handled by space-y on parent */
/* .option-name { font-weight: bold; margin-right: 0.5rem; display: block; margin-bottom: 0.5rem;} */ /* Tailwind: block text-sm font-medium text-text-primary mb-1 */
/* .option-values { display: flex; flex-wrap: wrap; gap: 0.5rem; } */ /* Tailwind: flex flex-wrap gap-2 */
/* .option-value-button { Tailwind classes provided in template } */
/* .option-value-button.selected { Tailwind classes provided in template } */
/* .option-value-button:hover:not(.selected) { Tailwind classes provided in template } */
/* .variant-not-found-message { Tailwind classes provided in template } */


/* .stock-info { text-align: left; margin: 1rem 0; padding: 0.5rem; border-radius: 4px; font-weight: bold; } */ /* Tailwind classes provided in template */
/* .stock-in-stock { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;} */
/* .stock-low { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;} */
/* .stock-out-of-stock { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;} */

/* .add-to-cart-section { Tailwind: flex items-center gap-4 my-6 } */
/* .quantity-input { Tailwind classes provided in template } */
/* .quantity-input:disabled { Tailwind: handled by disabled:opacity-50 } */
/* .add-to-cart-button { Tailwind classes provided in template } */
/* .add-to-cart-button:hover:not(:disabled) { Tailwind: hover:bg-opacity-80 } */
/* .add-to-cart-button:disabled { Tailwind: disabled:opacity-50 disabled:cursor-not-allowed } */

/* .back-link { Tailwind: inline-block mt-6 text-brand-primary hover:underline } */
/* .back-link:hover { text-decoration: underline; } */ /* Tailwind: hover:underline */
</style>

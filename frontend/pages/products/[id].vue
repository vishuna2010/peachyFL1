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

    <div v-if="product && !pending && !fetchError" class="product-detail-layout">
      <!-- Image Column -->
      <div class="image-column">
        <img
          v-if="displayImage"
          :src="displayImage"
          :alt="`Image of ${product.name}`"
          class="product-detail-image"
          key="display-image" <!-- Key for re-rendering on change -->
        />
        <div v-else class="product-detail-image-placeholder">No Image Available</div>
      </div>

      <!-- Details Column -->
      <div class="details-column">
        <h1>{{ product.name }}</h1>
        <p v-if="currentVariant && currentVariant.sku" class="sku">SKU: {{ currentVariant.sku }}</p>
        <p v-else-if="!currentVariant && product.sku" class="sku">SKU: {{ product.sku }}</p>

        <p class="description">{{ product.description }}</p>

        <p class="price"><strong>Price:</strong> ${{ displayPrice.toFixed(2) }}</p>

        <p v-if="product.category_name" class="category">
          <strong>Category:</strong> {{ product.category_name }}
        </p>
        <div v-if="product.tags && product.tags.length > 0" class="tags">
          <strong>Tags:</strong>
          <span v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>

        <!-- Product Options Selection -->
        <div v-if="product.options && product.options.length > 0" class="options-section">
          <div v-for="option in product.options" :key="option.id" class="option-group">
            <strong class="option-name">{{ option.name }}:</strong>
            <div class="option-values">
              <button
                v-for="value in option.values"
                :key="value.id"
                @click="selectOption(option.id, value.id)"
                :class="['option-value-button', { selected: selectedOptions[option.id] === value.id }]"
              >
                {{ value.value }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="product.options && product.options.length > 0 && !currentVariant && Object.keys(selectedOptions).length > 0" class="variant-not-found-message">
          Selected combination is unavailable.
        </div>


        <div class="stock-info" :class="stockStatusClass">
          {{ stockStatusMessage }}
        </div>

        <div class="add-to-cart-section">
          <input
            type="number"
            v-model.number="quantity"
            min="1"
            :max="displayStock > 0 ? displayStock : 1"
            :disabled="addToCartDisabled"
            class="quantity-input"
          />
          <button
            @click="handleAddToCart"
            class="add-to-cart-button"
            :disabled="addToCartDisabled"
          >
            {{ itemAdded ? 'Added!' : (displayStock <= 0 ? 'Out of Stock' : 'Add to Cart') }}
          </button>
        </div>
        <div v-if="addToCartError" class="error-message">{{ addToCartError }}</div>

        <NuxtLink to="/" class="back-link">Back to all products</NuxtLink>
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

.product-detail-layout {
  display: grid;
  grid-template-columns: 1fr; /* Single column for mobile */
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
@media (min-width: 768px) {
  .product-detail-layout {
    grid-template-columns: 1fr 1fr; /* Two columns for tablet and up */
  }
}

.image-column, .details-column {
  padding: 1rem;
}
.image-column {
  text-align: center;
}

.product-detail-image, .product-detail-image-placeholder {
  width: 100%;
  max-width: 450px;
  height: auto;
  max-height: 450px;
  object-fit: contain;
  margin: 0 auto 1.5rem auto;
  display: block;
  border-radius: 8px;
  background-color: #f0f0f0;
  border: 1px solid #eee;
}
.product-detail-image-placeholder {
  height: 400px; display: flex; align-items: center; justify-content: center; color: #777; font-size: 1em;
}

.details-column h1 {
  margin-top: 0;
  font-size: 1.8em; /* Slightly larger */
  color: #333;
  margin-bottom: 0.5rem;
}
.sku { font-size: 0.85em; color: #777; margin-bottom: 1rem; }
.description { font-size: 1em; color: #555; margin-bottom: 1rem; line-height: 1.6; }
.price { font-size: 1.5em; color: #007bff; font-weight: bold; margin-bottom: 1rem; }
.category { color: #666; margin-bottom: 1rem; }
.tags { margin-bottom: 1.5rem; }
.tag {
  display: inline-block; background-color: #007bff; color: white;
  padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.9em;
  margin-right: 0.5rem; margin-bottom: 0.5rem;
}

.options-section { margin-bottom: 1.5rem; }
.option-group { margin-bottom: 1rem; }
.option-name { font-weight: bold; margin-right: 0.5rem; display: block; margin-bottom: 0.5rem;}
.option-values { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.option-value-button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background-color: #fff;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s, border-color 0.2s;
}
.option-value-button.selected {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}
.option-value-button:hover:not(.selected) { background-color: #f0f0f0; }
.variant-not-found-message {
    color: #dc3545;
    font-size: 0.9em;
    margin-top: 0.5rem;
    background-color: #f8d7da;
    padding: 0.5rem;
    border-radius: 4px;
}


.stock-info { text-align: left; margin: 1rem 0; padding: 0.5rem; border-radius: 4px; font-weight: bold; }
.stock-in-stock { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;}
.stock-low { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;}
.stock-out-of-stock { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;}

.add-to-cart-section {
  display: flex; align-items: center; gap: 1rem; margin-top: 1.5rem; margin-bottom: 1rem;
}
.quantity-input {
  width: 70px; padding: 0.7rem; text-align: center; border: 1px solid #ccc; border-radius: 4px;
}
.quantity-input:disabled { background-color: #e9ecef; opacity: 0.7; }
.add-to-cart-button {
  background-color: #28a745; color: white; padding: 0.7rem 1.2rem;
  border: none; border-radius: 5px; cursor: pointer; font-size: 1em;
}
.add-to-cart-button:hover:not(:disabled) { background-color: #218838; }
.add-to-cart-button:disabled { background-color: #6c757d; cursor: not-allowed; }

.back-link {
  display: inline-block; margin-top: 1.5rem; color: #007bff; text-decoration: none;
}
.back-link:hover { text-decoration: underline; }
</style>

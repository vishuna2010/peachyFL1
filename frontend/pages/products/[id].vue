<template>
  <div>
    <div v-if="pending" class="loading">Loading product details...</div>
    <div v-if="error" class="error-message">
      <p>Error fetching product: {{ error.message || error }}</p>
      <p v-if="error && error.response && error.response.status === 404">
        The product you are looking for does not exist.
      </p>
      <NuxtLink to="/">Go back to Home</NuxtLink>
    </div>

    <div v-if="product && !pending && !error" class="product-detail">
      <img
        v-if="product.image_url"
        :src="product.image_url" <!-- Removed backendUrl prefix -->
        :alt="`Image of ${product.name}`"
        class="product-detail-image"
      />
      <div v-else class="product-detail-image-placeholder">No Image Available</div>

      <h1>{{ product.name }}</h1>
      <p class="description">{{ product.description }}</p>
      <p class="price"><strong>Price:</strong> ${{ product.price }}</p>
      <p v-if="product.category_name" class="category">
        <strong>Category:</strong> {{ product.category_name }}
      </p>
      <div v-if="product.tags && product.tags.length > 0" class="tags">
        <strong>Tags:</strong>
        <span v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>

      <div class="stock-info" :class="stockStatusClass">
        {{ stockStatusMessage }}
      </div>

      <div class="add-to-cart-section">
        <input
          type="number"
          v-model.number="quantity"
          min="1"
          :max="product.stock_quantity > 0 ? product.stock_quantity : 1"
          :disabled="product.stock_quantity <= 0"
          class="quantity-input"
        />
        <button
          @click="handleAddToCart"
          class="add-to-cart-button"
          :disabled="product.stock_quantity <= 0 || quantity > product.stock_quantity"
        >
          {{ itemAdded ? 'Added!' : (product.stock_quantity <= 0 ? 'Out of Stock' : 'Add to Cart') }}
        </button>
      </div>
      <div v-if="addToCartError" class="error-message">{{ addToCartError }}</div>

      <NuxtLink to="/" class="back-link">Back to all products</NuxtLink>
    </div>
  </div>
</template

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useCart } from '~/composables/useCart'; // Import useCart

const { $axios } = useNuxtApp();
const route = useRoute();
const product = ref(null);
const pending = ref(true);
const error = ref(null);
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart(); // Get addToCart function

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);
const quantity = ref(1);
const itemAdded = ref(false);
const addToCartError = ref('');

// Stock related computed properties
const stockStatusMessage = computed(() => {
  if (!product.value) return '';
  if (product.value.stock_quantity <= 0) return 'Out of Stock';
  if (product.value.stock_quantity > 0 && product.value.stock_quantity <= 5) return `Only ${product.value.stock_quantity} left!`;
  return 'In Stock';
});

const stockStatusClass = computed(() => {
  if (!product.value) return '';
  if (product.value.stock_quantity <= 0) return 'stock-out-of-stock';
  if (product.value.stock_quantity > 0 && product.value.stock_quantity <= 5) return 'stock-low';
  return 'stock-in-stock';
});


async function fetchProduct() {
  const productId = route.params.id;
  pending.value = true;
  error.value = null;
  try {
    const response = await $axios.get(`/products/${productId}`);
    product.value = response.data;
  } catch (err) {
    console.error(`Failed to fetch product ${productId}:`, err);
    error.value = err; // Store the whole error object
  } finally {
    pending.value = false;
  }
}

const handleAddToCart = () => {
  addToCartError.value = '';
  if (!product.value) {
    addToCartError.value = "Product data not loaded yet.";
    return;
  }
  if (product.value.stock_quantity <= 0) {
    addToCartError.value = "This product is out of stock.";
    return;
  }
  if (quantity.value <= 0) {
    addToCartError.value = "Please enter a valid quantity.";
    return;
  }
  if (quantity.value > product.value.stock_quantity) {
    addToCartError.value = `Cannot add ${quantity.value} items. Only ${product.value.stock_quantity} left in stock.`;
    return;
  }

  addToCart(product.value, quantity.value);
  itemAdded.value = true;
  // Potentially re-fetch product to update stock_quantity display if not relying on cart logic to do so
  // Or, optimistically update local product.value.stock_quantity (though this can get out of sync)
  setTimeout(() => {
    itemAdded.value = false;
  }, 1500); // Reset feedback
};

onMounted(fetchProduct);
</script>

<style scoped>
.loading, .error-message {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
}
.loading {
  background-color: #e0e0e0;
}
.error-message {
  background-color: #ffdddd;
  border: 1px solid #ff0000;
  color: #D8000C;
  margin-top: 0.5rem; /* Added margin for addToCartError */
}
.error-message a {
  color: #D8000C;
  text-decoration: underline;
}

.product-detail-image, .product-detail-image-placeholder {
  width: 100%;
  max-width: 400px; /* Max width for detail image */
  height: auto; /* Auto height to maintain aspect ratio */
  max-height: 400px; /* Max height */
  object-fit: contain; /* Show full image, scaled down if needed */
  margin: 0 auto 1.5rem auto; /* Center image and add margin below */
  display: block; /* For centering with margin auto */
  border-radius: 5px;
  background-color: #e0e0e0; /* Placeholder background */
}
.product-detail-image-placeholder {
  height: 300px; /* Fixed height for placeholder */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #777;
  font-size: 1em;
}

.product-detail {
  border: 1px solid #ddd;
  padding: 1.5rem;
  border-radius: 5px;
  background-color: #fff;
}
.product-detail h1 {
  margin-top: 0;
  text-align: center; /* Center product title */
  color: #333;
}
.description {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 1rem;
}
.price {
  font-size: 1.2em;
  color: #007bff;
  font-weight: bold;
  margin-bottom: 0.5rem;
}
.category {
  color: #666;
  margin-bottom: 1rem;
}
.tags {
  margin-bottom: 1.5rem;
}
.stock-info {
  text-align: center;
  margin: 1rem 0;
  padding: 0.5rem;
  border-radius: 4px;
  font-weight: bold;
}
.stock-in-stock { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;}
.stock-low { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;}
.stock-out-of-stock { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;}

.tag {
  display: inline-block;
  background-color: #007bff;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.9em;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
}

.add-to-cart-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  justify-content: center; /* Center this section */
}
.quantity-input {
  width: 70px;
  padding: 0.5rem;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.quantity-input:disabled {
  background-color: #e9ecef;
  opacity: 0.7;
}
.add-to-cart-button {
  background-color: #28a745;
  color: white;
  padding: 0.7rem 1.2rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
}
.add-to-cart-button:hover:not(:disabled) {
  background-color: #218838;
}
.add-to-cart-button:disabled {
  background-color: #6c757d; /* Grey out when disabled */
  cursor: not-allowed;
}

.back-link {
  display: block; /* Make it block to center it */
  margin-top: 1.5rem;
  color: #007bff;
  text-decoration: none;
  text-align: center; /* Center link text */
}
.back-link:hover {
  text-decoration: underline;
}
</style>

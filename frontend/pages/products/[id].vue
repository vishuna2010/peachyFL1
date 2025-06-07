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
        :src="`${backendUrl}${product.image_url}`"
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

      <!-- Conceptual: Add to cart button, related products, etc. -->
      <!-- <button @click="addToCart">Add to Cart</button> -->

      <NuxtLink to="/" class="back-link">Back to all products</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'; // Import computed
import { useRoute } from 'vue-router';

const { $axios } = useNuxtApp();
const route = useRoute();
const product = ref(null);
const pending = ref(true);
const error = ref(null);
const runtimeConfig = useRuntimeConfig(); // Access runtime config

const backendUrl = computed(() => runtimeConfig.public.backendBaseUrl);

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

onMounted(fetchProduct);

// const addToCart = () => {
//   console.log('Conceptual: Add to cart', product.value.id);
//   // Add actual cart logic here
// }
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
.back-link {
  display: inline-block;
  margin-top: 1rem;
  color: #007bff;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}
/* Conceptual button styling
button {
  background-color: #28a745;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1em;
  margin-top: 1rem;
}
button:hover {
  background-color: #218838;
}
*/
</style>

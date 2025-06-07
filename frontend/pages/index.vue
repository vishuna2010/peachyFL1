<template>
  <div>
    <h1>Welcome to Our E-commerce Store!</h1>

    <div v-if="pending" class="loading">Loading products...</div>
    <div v-if="error" class="error-message">
      <p>Error fetching products: {{ error.message || error }}</p>
      <p>Please ensure the backend server is running and accessible at http://localhost:3000/api/products.</p>
    </div>

    <div v-if="!pending && !error && products && products.length > 0" class="product-list">
      <h2>Our Products</h2>
      <ul>
        <li v-for="product in products" :key="product.id" class="product-item">
          <NuxtLink :to="`/products/${product.id}`">
            <h3>{{ product.name }}</h3>
          </NuxtLink>
          <p>{{ product.description }}</p>
          <p><strong>Price:</strong> ${{ product.price }}</p>
          <p v-if="product.category_name"><strong>Category:</strong> {{ product.category_name }}</p>
          <div v-if="product.tags && product.tags.length > 0" class="tags">
            <strong>Tags:</strong>
            <span v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </li>
      </ul>
    </div>
    <div v-if="!pending && !error && products && products.length === 0">
      <p>No products available at the moment.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const { $axios } = useNuxtApp(); // Access the configured axios instance
const products = ref([]);
const pending = ref(true);
const error = ref(null);

async function fetchProducts() {
  pending.value = true;
  error.value = null;
  try {
    const response = await $axios.get('/products');
    products.value = response.data;
  } catch (err) {
    console.error('Failed to fetch products:', err);
    error.value = err.response ? err.response.data : (err.message || 'An unknown error occurred');
  } finally {
    pending.value = false;
  }
}

onMounted(fetchProducts);
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
.product-list {
  margin-top: 1.5rem;
}
.product-list ul {
  list-style-type: none;
  padding: 0;
}
.product-item {
  border: 1px solid #eee;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 5px;
  background-color: #f9f9f9;
}
.product-item h3 {
  margin-top: 0;
}
.product-item a {
  text-decoration: none;
  color: #007bff;
}
.product-item a:hover h3 {
  text-decoration: underline;
}
.tags {
  margin-top: 0.5rem;
}
.tag {
  display: inline-block;
  background-color: #007bff;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8em;
  margin-right: 0.3rem;
}
</style>

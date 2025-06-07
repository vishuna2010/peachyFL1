<template>
  <div class="thank-you-page">
    <div class="message-container">
      <span class="icon">🎉</span>
      <h1>Thank You for Your Order!</h1>
      <p v-if="orderId">Your Order ID is: <strong>#{{ orderId }}</strong></p>
      <p>We have received your order and are processing it now.</p>
      <p>You will receive an email confirmation shortly with the details of your order.</p>
      <NuxtLink to="/" class="home-button">Continue Shopping</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { onMounted, ref } from 'vue';

const route = useRoute();
const orderId = ref(null);

onMounted(() => {
  if (route.query.orderId) {
    orderId.value = route.query.orderId;
  }
});

useHead({
  title: 'Order Confirmation',
});
</script>

<style scoped>
.thank-you-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh; /* Adjust as needed */
  text-align: center;
  padding: 2rem;
  background-color: #f4f7f6; /* Light background */
}

.message-container {
  background-color: #fff;
  padding: 2rem 3rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.icon {
  font-size: 3rem; /* Larger icon */
  display: block;
  margin-bottom: 1rem;
}

h1 {
  color: #28a745; /* Green color for success */
  margin-bottom: 1rem;
  font-size: 1.8em;
}

p {
  color: #555;
  font-size: 1.1em;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

p strong {
  color: #333;
}

.home-button {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.8rem 2rem;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-size: 1em;
  transition: background-color 0.2s;
}

.home-button:hover {
  background-color: #0056b3;
}
</style>

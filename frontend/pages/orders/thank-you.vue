<template>
  <div class="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center bg-neutral-bg-soft py-12 px-4 sm:px-6 lg:px-8 text-center">
    <div class="bg-white p-8 sm:p-12 rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-500 ease-out hover:scale-[1.02]">
      <span class="text-6xl sm:text-7xl block mb-6 animate-bounce">🎉</span>
      <h1 class="text-3xl sm:text-4xl font-serif font-bold text-fresh-green mb-4">Thank You for Your Order!</h1>
      <p v-if="orderId" class="text-lg text-venus-text-primary mb-2">
        Your Order ID is: <strong class="text-orange-gold font-semibold">#{{ orderId }}</strong>
      </p>
      <p class="text-md text-venus-text-secondary leading-relaxed">
        We have received your order and are processing it with care.
      </p>
      <p class="text-md text-venus-text-secondary leading-relaxed mb-8">
        You will receive an email confirmation shortly with all the details.
      </p>
      <NuxtLink
        to="/"
        class="inline-block px-8 py-3 bg-peach-pink text-white font-semibold rounded-md shadow-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink transition-all duration-200 ease-in-out hover:shadow-lg transform hover:-translate-y-0.5"
      >
        Continue Shopping
      </NuxtLink>
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

<!-- Removed scoped CSS block -->

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useCart } from '~/composables/useCart'; // Adjust path if needed

// Initialize the cart from localStorage when the app mounts on the client-side
// This ensures that the cart state is loaded from localStorage as soon as the app is ready on the client.
const { initCart } = useCart();

onMounted(() => {
  initCart();
});
</script>

<style>
/* You can add global styles here or import a CSS file */
/* For example:
body {
  font-family: 'Arial', sans-serif;
  margin: 0;
  background-color: #f4f4f4;
  color: #333;
}
*/
</style>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
import { useCart } from '~/composables/useCart';

// By importing useCart, its setup function runs.
// useCart itself now handles its initialization via its own onMounted hook.
// So, no explicit call to initCart() is needed here in app.vue's onMounted.
useCart(); // This ensures the composable is activated and its onMounted hook is registered.

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

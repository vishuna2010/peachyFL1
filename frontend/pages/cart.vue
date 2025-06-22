<template>
  <div>
    <h1>Cart Page Test</h1>
    <p>If you see this, the template is rendering.</p>
    <p>{{ setupMessage }}</p>
  </div>
</template>

<script setup>
console.log('--- CART.VUE SCRIPT SETUP EXECUTED ---');
const setupMessage = 'Cart.vue script setup is alive!';
</script>

<style scoped>
/* Minimal styles for testing */
div {
  padding: 20px;
  font-family: sans-serif;
}
h1 {
  font-size: 2em;
  color: blue;
}
p {
  margin: 10px 0;
  color: green;
}
</style>

<template>
  <div>
    <h1>ADMIN USERS PAGE - MINIMAL TEST</h1>
    <p>If you see this, Nuxt routing to /admin/users is working at a basic level.</p>
    <p>The original script and complex template have been temporarily removed for this test.</p>
  </div>
</template>

<script setup>
import { definePageMeta, useHead } from '#app';

definePageMeta({
  layout: 'admin',
  // ALL MIDDLEWARE AND PERMISSION CHECKS TEMPORARILY REMOVED FOR THIS TEST
});

useHead({
  title: 'Admin - Users (Minimal Test)',
});

console.log('Minimal Admin Users Page Loaded - Script Executed');
</script>

<style scoped>
h1 {
  color: green;
  font-size: 2em;
  margin-bottom: 10px;
}
p {
  color: darkblue;
}
</style>

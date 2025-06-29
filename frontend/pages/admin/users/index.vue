<template>
  <div>
    <h1>Simplified Admin Users Page Test</h1>
    <p>If you see this, the basic page is rendering.</p>
  </div>
</template>
<script setup>
import { onMounted } from 'vue'; // Corrected import, was 'from vue'

definePageMeta({
  layout: 'admin',
  // Middleware names correspond to global middleware filenames (Nuxt auto-converts .global.js)
  middleware: ['admin-auth', 'rbac-global']
});

onMounted(() => {
  console.log('Simplified Users Page (Test Version with definePageMeta) Mounted.');
});
</script>

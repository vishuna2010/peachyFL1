<template>
  <div>
    <h1>Simplified Admin Users Page Test - definePageMeta (Layout Only)</h1>
    <p>If you see this, the basic page is rendering with layout.</p>
  </div>
</template>
<script setup>
import { onMounted } from 'vue';

definePageMeta({
  layout: 'admin'
  // Middleware removed from here as they are global
});

onMounted(() => {
  console.log('Simplified Users Page (Test Version - definePageMeta with layout ONLY) Mounted.');
});
</script>

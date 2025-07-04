<template>
  <div>
    <h1 class="text-2xl font-bold text-red-600">HERO BANNERS PAGE IS LOADING!</h1>
    <p class="text-green-600">If you can see this, the component is working!</p>
    <div class="mt-4 p-4 bg-blue-100 border border-blue-300 rounded">
      <p>This is a test page to verify the component loads.</p>
      <p>Current time: {{ new Date().toLocaleString() }}</p>
    </div>
  </div>
</template>

<script setup>
console.log('Hero Banners page script setup running - SIMPLIFIED VERSION');

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  permission: 'marketing:manage_hero_banners'
});

useHead({ title: 'Manage Hero Banners' });

onMounted(() => {
  console.log('Hero Banners page mounted - SIMPLIFIED VERSION');
  console.log('Component is loading!');
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Categories Page (Minimal Test)</h1>
    <p class="text-green-600 font-bold">If you see this, navigation to /admin/categories is working!</p>
    <p>The original content of this page has been temporarily replaced for testing.</p>
    <NuxtLink to="/admin" class="mt-4 inline-block text-indigo-600 hover:underline">Back to Admin Dashboard</NuxtLink>
  </div>
</template>

<script setup>
import { definePageMeta, useHead } from '#imports';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Categories (Test)',
});

console.log('Minimal Categories Test Page Loaded');
</script>

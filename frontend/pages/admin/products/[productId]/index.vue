<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold">Product Detail View (Placeholder)</h1>
    <p class="mt-2">Product ID: {{ productId }}</p>
    <p class="mt-1"><i>This is the placeholder for the product detail view.</i></p>
    <p class="mt-4"><NuxtLink :to="`/admin/products/${productId}/edit`" class="text-blue-500 hover:underline">Go to Edit Page</NuxtLink></p>
    <p class="mt-2"><NuxtLink to="/admin/products" class="text-blue-500 hover:underline">&larr; Back to Products List</NuxtLink></p>
  </div>
</template>
<script setup>
import { useRoute, definePageMeta, useHead } from '#imports';
import { ref, computed } from 'vue';
definePageMeta({ layout: 'admin' });
const route = useRoute();
const productId = ref(route.params.productId);
useHead({ title: computed(() => `Admin - Product Detail ${productId.value}`) });
</script>

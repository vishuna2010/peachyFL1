<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold">Assigned Options Base (Placeholder)</h1>
    <p class="mt-4 italic">This is a placeholder page for `/admin/options/assigned/`. Specific functionality TBD.</p>
    <button @click="$router.go(-1)" class="mt-4 px-3 py-1.5 text-sm border rounded hover:bg-gray-100">&larr; Back</button>
  </div>
</template>
<script setup>
import { definePageMeta, useHead } from '#imports';
definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Assigned Options Base' });
</script>

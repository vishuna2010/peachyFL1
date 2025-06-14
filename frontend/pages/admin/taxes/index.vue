<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Tax Overview</h1>
    <p class="text-gray-700">Overview of tax settings and summary will be displayed here.</p>
    <!-- TODO: Implement tax overview dashboard -->
  </div>
</template>
<script setup>
import { definePageMeta, useHead } from '#imports';
definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Tax Overview' });
</script>

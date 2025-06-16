<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold">Manage Specific Values for Assigned Option</h1>
    <p class="mt-2">Assigned Option ID (from route): <strong>{{ $route.params.assignedOptionId }}</strong></p>
    <p class="mt-4 italic">Functionality for managing these values is TBD.</p>
    <button @click="$router.go(-1)" class="mt-4 px-3 py-1.5 text-sm border rounded hover:bg-gray-100">&larr; Back</button>
  </div>
</template>
<script setup>
import { definePageMeta, useHead, useRoute } from '#imports';
import { computed } from 'vue';
definePageMeta({ layout: 'admin' });
const route = useRoute();
useHead({ title: computed(() => `Admin - Manage Values for Assigned Option ${route.params.assignedOptionId}`) });
</script>

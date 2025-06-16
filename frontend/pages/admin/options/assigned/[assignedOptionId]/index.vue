<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold">Assigned Option Detail (Placeholder)</h1>
    <p class="mt-2">Assigned Option ID: <strong>{{ $route.params.assignedOptionId }}</strong></p>
    <p class="mt-4 italic">This is a placeholder for viewing details of an assigned option.</p>
    <p class="mt-4"><NuxtLink :to="`/admin/options/assigned/${$route.params.assignedOptionId}/manage-values`" class="text-blue-500 hover:underline">Manage its Values</NuxtLink></p>
    <button @click="$router.go(-1)" class="mt-4 ml-4 px-3 py-1.5 text-sm border rounded hover:bg-gray-100">Back</button>
  </div>
</template>
<script setup>
import { definePageMeta, useHead, useRoute } from '#imports';
import { computed } from 'vue';
definePageMeta({ layout: 'admin' });
const route = useRoute();
useHead({ title: computed(() => `Assigned Option Detail ${route.params.assignedOptionId}`) });
</script>

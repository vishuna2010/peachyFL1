<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold">Manage Assigned Option Values</h1>
    <p class="mt-2">For Assigned Option ID: <strong>{{ assignedOptionId }}</strong></p>
    <p class="mt-4 italic">
      This page will allow management of specific values for an option that has been assigned to a product.
      Functionality is currently under development.
    </p>
    <div class="mt-6">
      <button
        @click="goBack"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        &larr; Back
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter, definePageMeta, useHead } from '#imports';
import { ref, computed } from 'vue';

definePageMeta({
  layout: 'admin',
});

const route = useRoute();
const router = useRouter();
const assignedOptionId = ref(route.params.assignedOptionId);

useHead({
  title: computed(() => `Admin - Manage Values for Assigned Option ${assignedOptionId.value}`),
});

const goBack = () => {
  // Go back to the previous page, which is likely the product edit page
  router.go(-1);
};
</script>

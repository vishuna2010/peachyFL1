<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Product Options Page (Simplified Test V2)</h1>
    <p class="text-green-600 font-bold">If you see this, navigation to /admin/options is working (V2)!</p>
    <p>The original content of this page has been temporarily replaced for testing.</p>
    <NuxtLink to="/admin" class="mt-4 inline-block text-indigo-600 hover:underline">Back to Admin Dashboard</NuxtLink>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, definePageMeta, useHead } from '#app';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Product Options (Simplified Test V2)',
});

console.log('Simplified Product Options Page (V2) Loaded - Script Setup Start');

const { $axios } = useNuxtApp();

const options = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);

async function fetchOptions() {
  console.log('Simplified Product Options (V2): fetchOptions START');
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/admin/options');
    console.log('Simplified Product Options (V2): API response received', response.data);
    if (Array.isArray(response.data)) {
      options.value = response.data.map(opt => ({ name: opt.name, id: opt.id })); // Simplified mapping
    } else {
      console.error('Simplified Product Options (V2): API response is not an array', response.data);
      options.value = [];
    }
    console.log('Simplified Product Options (V2): Options set', options.value);
  } catch (err) {
    console.error('Simplified Product Options (V2): Error fetching option types:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load option types.';
  } finally {
    isLoading.value = false;
    console.log('Simplified Product Options (V2): fetchOptions END, isLoading:', isLoading.value);
  }
}

onMounted(() => {
  console.log('Simplified Product Options (V2): onMounted, calling fetchOptions');
  fetchOptions();
});

console.log('Simplified Product Options Page (V2) Loaded - Script Setup End');
</script>

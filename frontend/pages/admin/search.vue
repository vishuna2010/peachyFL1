<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-2">Search Results</h1>
    <p v-if="searchQuery" class="text-gray-700 mb-6">
      Showing results for: <strong class="font-medium">{{ searchQuery }}</strong>
    </p>
    <p v-else class="text-gray-700 mb-6">
      Please enter a search term in the global search bar.
    </p>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading search results...</p>
    </div>

    <div v-else>
      <!-- Placeholder for search results sections -->
      <div class="space-y-8">
        <section>
          <h2 class="text-xl font-semibold text-gray-800 mb-4">Products</h2>
          <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200 min-h-[100px] flex items-center justify-center">
            <p class="text-gray-500">Product search results will appear here.</p>
          </div>
          <!-- TODO: Display product results -->
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-800 mb-4">Orders</h2>
           <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200 min-h-[100px] flex items-center justify-center">
            <p class="text-gray-600">Order search results will appear here.</p>
          </div>
          <!-- TODO: Display order results -->
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-800 mb-4">Users</h2>
          <div class="bg-white p-6 rounded-lg shadow-md border border-neutral-200 min-h-[100px] flex items-center justify-center">
            <p class="text-gray-600">User search results will appear here.</p>
          </div>
          <!-- TODO: Display user results -->
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, definePageMeta, useHead } from '#app'; // Or specific imports for Nuxt 3

definePageMeta({
  layout: 'admin',
});

const route = useRoute();
const searchQuery = computed(() => route.query.q || '');
const isLoading = ref(false); // Will be true when actually fetching results

useHead({
  title: computed(() => searchQuery.value ? `Admin Search - "${searchQuery.value}"` : 'Admin Search'),
});

// Placeholder for actual search result fetching logic
// const fetchResults = async () => {
//   if (!searchQuery.value) return;
//   isLoading.value = true;
//   // Make API calls here for different categories (products, orders, users)
//   // e.g., const productResults = await $axios.get('/api/admin/search/products', { params: { q: searchQuery.value } });
//   isLoading.value = false;
// };

// onMounted(() => {
//   if (searchQuery.value) {
//     // fetchResults();
//   }
// });

// watch(() => route.query.q, (newQuery) => {
//   if (newQuery) {
//     // fetchResults();
//   } else {
//     // clearResults();
//   }
// });
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-6">
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-semibold leading-tight text-text-primary">Category Management</h1>
      <div class="mt-3 sm:mt-0 sm:ml-4">
        <NuxtLink
          to="/admin/categories/new"
          class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
        >
          Create New Category
        </NuxtLink>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-10 text-text-secondary">
      Loading categories...
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm">
      <p>Could not load categories: {{ fetchError }}</p>
    </div>
    <div v-else-if="categories.length === 0" class="my-6 p-8 bg-white text-text-secondary rounded-lg shadow border border-neutral-medium text-center">
      <p class="text-lg mb-2">No categories found.</p>
      <p class="text-sm">You can create the first category using the button above.</p>
    </div>
    <div v-else class="bg-white shadow-md rounded-lg border border-neutral-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-neutral-200">
        <thead class="bg-neutral-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">ID</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Name</th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-neutral-200">
          <tr v-for="category in categories" :key="category.id" class="hover:bg-neutral-light transition-colors duration-150">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{{ category.id }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{{ category.name }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <NuxtLink
                :to="`/admin/categories/edit/${category.id}`"
                class="text-brand-primary hover:text-opacity-80 hover:underline"
              >
                Edit
              </NuxtLink>
              <button
                @click="handleDeleteCategory(category.id)"
                class="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                :disabled="isDeleting === category.id"
              >
                {{ isDeleting === category.id ? 'Deleting...' : 'Delete' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useHead, definePageMeta } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Category Management'
});

useHead({
  title: 'Category Management - Admin',
});

const { $axios } = useNuxtApp();
const categories = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const isDeleting = ref(null); // For delete button loading state

async function fetchCategories() {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/api/admin/categories', {
      params: {
        page: 1,
        limit: 500
      }
    });
    if (response.data && response.data.data) {
      categories.value = response.data.data;
    } else {
      categories.value = response.data || [];
    }
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load categories.';
    categories.value = [];
  } finally {
    isLoading.value = false;
  }
}

// Placeholder for delete functionality
const handleDeleteCategory = async (categoryId) => {
  if (confirm(`Are you sure you want to delete category ID ${categoryId}? This might affect products associated with it.`)) {
    isDeleting.value = categoryId;
    console.log(`Mock Deleting category ${categoryId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // alert(`Mock: Category ${categoryId} would be deleted.`);
    // TODO: Call actual API and refresh list or remove item locally
    // For now, just reset isDeleting state
    isDeleting.value = null;
    // fetchCategories(); // Re-fetch after delete
  }
};

onMounted(() => {
  fetchCategories();
});
</script>

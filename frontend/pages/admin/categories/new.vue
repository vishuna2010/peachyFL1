<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-xl mx-auto">
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Add New Category</h1>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <div class="space-y-4">
          <div>
            <label for="categoryName" class="block text-sm font-medium text-gray-700 mb-1">
              Category Name
            </label>
            <input
              type="text"
              id="categoryName"
              v-model="categoryName"
              required
              :disabled="isLoading"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
              placeholder="e.g., Electronics"
            />
          </div>
        </div>

        <div class="mt-6 flex items-center justify-end space-x-4">
          <NuxtLink
            to="/admin/categories"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            :disabled="isLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="animate-pulse">Adding...</span>
            <span v-else>Add Category</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useNuxtApp, definePageMeta, useHead } from '#app';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Add New Category',
});

const categoryName = ref('');
const isLoading = ref(false);
const router = useRouter();
const toast = useToast();
const { $axios } = useNuxtApp();

const handleSubmit = async () => {
  if (!categoryName.value.trim()) {
    toast.error('Category name is required.');
    return;
  }
   if (categoryName.value.trim().length < 2) {
    toast.error('Category name must be at least 2 characters long.');
    return;
  }


  isLoading.value = true;
  try {
    await $axios.post('/api/admin/categories', { name: categoryName.value.trim() });
    toast.success('Category added successfully!');
    router.push('/admin/categories');
  } catch (error) {
    console.error('Error adding category:', error);
    if (error.response && error.response.data && error.response.data.message) {
      toast.error(error.response.data.message);
    } else if (error.response && error.response.data && error.response.data.errors && error.response.data.errors.length > 0) {
      // Handle express-validator errors array
      toast.error(error.response.data.errors.map(e => e.msg).join(', '));
    }
    else {
      toast.error('An unexpected error occurred while adding the category.');
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

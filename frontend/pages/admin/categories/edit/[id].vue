<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-xl mx-auto">
      <div class="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Edit Category</h1>
      </div>

      <div v-if="isFetching" class="text-center py-10">
        <p class="text-lg text-gray-500">Loading category details...</p>
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
      </div>
      <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
        <p>{{ fetchError }}</p>
        <NuxtLink to="/admin/categories" class="mt-4 inline-block font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
          &larr; Back to Categories
        </NuxtLink>
      </div>

      <form v-else @submit.prevent="handleUpdate" class="bg-white shadow-md rounded-lg p-6 border border-gray-200">
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
          <div>
            <label for="categoryDescription" class="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <div class="mt-1">
              <textarea
                id="categoryDescription"
                v-model="categoryDescription"
                rows="3"
                :disabled="isLoading"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                placeholder="Enter a brief description for the category."
              ></textarea>
            </div>
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
            :disabled="isLoading || (categoryName.trim() === originalCategoryName.trim() && categoryDescription.trim() === originalCategoryDescription.trim())"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="animate-pulse">Updating...</span>
            <span v-else>Update Category</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute, useNuxtApp, useHead } from '#app'; // Using #app for Nuxt 3 imports
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

const categoryName = ref('');
const originalCategoryName = ref('');
const categoryDescription = ref('');
const originalCategoryDescription = ref('');
const isLoading = ref(false); // For form submission
const isFetching = ref(true); // For initial data load
const fetchError = ref(null);

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { $axios } = useNuxtApp();

const categoryId = route.params.id;

useHead({
  title: `Admin - Edit Category #${categoryId}`,
});

const fetchCategoryData = async () => {
  isFetching.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/admin/categories/${categoryId}`);
    // The API returns the category object directly, not nested like { category: ... }
    // And it includes product_count, which we don't need for the form, but name is what we need.
    if (response.data) { // Ensure response.data itself is not null
        categoryName.value = response.data.name || ''; // Fallback to empty string if name is null
        originalCategoryName.value = response.data.name || '';
        categoryDescription.value = response.data.description || ''; // Populate description
        originalCategoryDescription.value = response.data.description || '';
    } else {
        throw new Error('Invalid category data structure received from API.');
    }
  } catch (error) {
    console.error('Error fetching category data:', error);
    if (error.response && error.response.status === 404) {
      fetchError.value = `Category with ID #${categoryId} not found.`;
    } else if (error.response && error.response.data && error.response.data.message) {
      fetchError.value = error.response.data.message;
    } else {
      fetchError.value = 'An unexpected error occurred while fetching category details.';
    }
    toast.error(fetchError.value);
  } finally {
    isFetching.value = false;
  }
};

onMounted(() => {
  fetchCategoryData();
});

const handleUpdate = async () => {
  if (!categoryName.value.trim()) {
    toast.error('Category name is required.');
    return;
  }
  if (categoryName.value.trim().length < 2) {
    toast.error('Category name must be at least 2 characters long.');
    return;
  }

  const nameChanged = categoryName.value.trim() !== originalCategoryName.value.trim();
  const descriptionChanged = categoryDescription.value.trim() !== originalCategoryDescription.value.trim();

  if (!nameChanged && !descriptionChanged) {
    toast.info('No changes made to the category name or description.');
    return;
  }

  isLoading.value = true;
  try {
    const payload = {};
    if (nameChanged) {
        payload.name = categoryName.value.trim();
    }
    if (descriptionChanged) {
        payload.description = categoryDescription.value.trim() || null;
    }

    await $axios.put(`/admin/categories/${categoryId}`, payload);
    toast.success('Category updated successfully!');
    router.push('/admin/categories');
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.response && error.response.data && error.response.data.message) {
      toast.error(error.response.data.message);
    } else if (error.response && error.response.data && error.response.data.errors && error.response.data.errors.length > 0) {
      toast.error(error.response.data.errors.map(e => e.msg).join(', '));
    }
    else {
      toast.error('An unexpected error occurred while updating the category.');
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

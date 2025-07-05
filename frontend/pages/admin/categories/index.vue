<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Manage Product Categories</h1>
      <NuxtLink
        to="/admin/categories/new"
        class="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Add New Category
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      <p class="mt-2 text-sm text-gray-500">Loading categories...</p>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load categories: {{ fetchError.message || fetchError }}</p>
      <button @click="fetchCategories(paginationData.currentPage)"
        class="mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        Retry
      </button>
    </div>
    <div v-else-if="categories.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl mb-4">No categories found.</p>
      <p>Get started by <NuxtLink to="/admin/categories/new" class="text-indigo-600 hover:underline">adding a new category</NuxtLink>.</p>
    </div>

    <div v-else class="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="tc in categories" :key="tc.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{{ tc.id }}</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <div v-if="tc.image_url" class="w-12 h-12 rounded-md overflow-hidden border border-gray-200">
                <img :src="tc.image_url" :alt="tc.name" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center">
                <span class="text-xs text-gray-400">No image</span>
              </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{{ tc.name }}</td>
            <td class="px-4 py-3 whitespace-normal text-sm text-gray-600 max-w-sm truncate">{{ tc.description || 'N/A' }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{{ formatTimestamp(tc.updated_at) }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
              <NuxtLink :to="`/admin/categories/edit/${tc.id}`" class="text-indigo-600 hover:text-indigo-800 mr-3">Edit</NuxtLink>
              <button @click="deleteCategory(tc.id, tc.name)" class="text-red-600 hover:text-red-800" :disabled="isDeleting === tc.id">
                {{ isDeleting === tc.id ? 'Deleting...' : 'Delete' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!isLoading && !fetchError && categories.length > 0 && paginationData.totalPages > 1" class="mt-6 flex items-center justify-between">
      <p class="text-sm text-gray-700">
        Page {{ paginationData.currentPage }} of {{ paginationData.totalPages }}. Total categories: {{ paginationData.totalItems }}
      </p>
      <div class="flex space-x-2">
        <button @click="changePage(paginationData.currentPage - 1)" :disabled="paginationData.currentPage <= 1 || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <button @click="changePage(paginationData.currentPage + 1)" :disabled="paginationData.currentPage >= paginationData.totalPages || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, definePageMeta, useHead, useRouter, useRoute } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Admin - Categories' });

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const categories = ref([]);
const isLoading = ref(true);
const fetchError = ref(null);
const isDeleting = ref(null); // Tracks ID of category being deleted

const limit = ref(15); // Items per page, consistent with other list pages
const paginationData = ref({
  totalItems: 0,
  totalPages: 1,
  currentPage: parseInt(route.query.page) || 1,
  // pageSize: limit.value, // pageSize can be derived from limit ref
});

const formatTimestamp = (ts) => ts ? new Date(ts).toLocaleString() : 'N/A';

const fetchCategories = async (pageToFetch = paginationData.value.currentPage) => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/admin/categories', {
      params: {
        page: pageToFetch,
        limit: limit.value, // Use the limit ref
      }
    });
    categories.value = response.data.data;
    paginationData.value.totalItems = response.data.pagination.total;
    paginationData.value.totalPages = response.data.pagination.totalPages;
    paginationData.value.currentPage = response.data.pagination.page;

  } catch (error) {
    console.error('Error fetching categories:', error);
    fetchError.value = error.response?.data?.message || error.message || 'Could not fetch categories.';
    toast.error(fetchError.value);
    categories.value = [];
    paginationData.value.totalItems = 0;
    paginationData.value.totalPages = 1;
  } finally {
    isLoading.value = false;
  }
};

const deleteCategory = async (categoryId, categoryName) => {
  if (!confirm(`Are you sure you want to delete category "${categoryName}" (ID: ${categoryId})?`)) {
    return;
  }
  isDeleting.value = categoryId;
  try {
    await $axios.delete(`/admin/categories/${categoryId}`);
    toast.success(`Category "${categoryName}" deleted successfully.`);

    let newPageToFetch = paginationData.value.currentPage;
    if (categories.value.length === 1 && paginationData.value.currentPage > 1) {
      newPageToFetch--;
    }
    // If the current page becomes empty and it's not the first page,
    // we need to update the route query to reflect the new page.
    // The watcher will then trigger fetchCategories.
    if (newPageToFetch !== paginationData.value.currentPage) {
         router.push({ query: { ...route.query, page: newPageToFetch } });
    } else {
        fetchCategories(newPageToFetch); // Fetch for the current page if it didn't change
    }

  } catch (error) {
    console.error(`Error deleting category ${categoryId}:`, error);
    toast.error(error.response?.data?.message || `Failed to delete category "${categoryName}".`);
  } finally {
    isDeleting.value = null;
  }
};

const changePage = (newPage) => {
  if (newPage > 0 && newPage <= paginationData.value.totalPages && newPage !== paginationData.value.currentPage) {
    // paginationData.value.currentPage = newPage; // Update state immediately for responsiveness
    router.push({ query: { ...route.query, page: newPage } });
  }
};

onMounted(() => {
  fetchCategories(paginationData.value.currentPage);
});

watch(() => route.query.page, (newPageStr) => {
  const newPage = parseInt(newPageStr) || 1;
  if (newPage !== paginationData.value.currentPage) {
    // paginationData.value.currentPage = newPage; // Already set by fetch or changePage
    fetchCategories(newPage);
  }
});
</script>

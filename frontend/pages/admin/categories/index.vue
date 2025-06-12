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
      <p class="text-lg text-gray-500">Loading categories...</p>
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load categories: {{ fetchError }}</p>
    </div>
    <div v-else-if="categories.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl mb-4">No categories found.</p>
      <p>Get started by adding a new category.</p>
    </div>

    <div v-else>
      <div class="bg-white shadow-md rounded-lg border border-neutral-200 overflow-x-auto">
        <table class="min-w-full divide-y divide-neutral-200">
          <thead class="bg-neutral-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Count</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-neutral-200">
            <tr v-for="category in categories" :key="category.id" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ category.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ category.product_count }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <NuxtLink :to="`/admin/categories/edit/${category.id}`" class="text-indigo-600 hover:text-indigo-900 hover:underline">Edit</NuxtLink>
                <button @click="handleDeleteCategory(category.id)" class="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50" :disabled="isDeleting === category.id">
                  {{ isDeleting === category.id ? 'Deleting...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination Controls -->
      <div class="mt-6 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && categories.length > 0 && paginationData.totalPages > 1">
        <button @click="changePage(paginationData.currentPage - 1)" :disabled="paginationData.currentPage <= 1" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Previous
        </button>
        <span class="text-sm text-gray-700">
          Page {{ paginationData.currentPage }} of {{ paginationData.totalPages }}
        </span>
        <button @click="changePage(paginationData.currentPage + 1)" :disabled="paginationData.currentPage >= paginationData.totalPages" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp, useHead, definePageMeta, useRouter, useRoute } from '#app';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
  title: 'Category Management'
});

useHead({
  title: 'Category Management - Admin',
});

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const categories = ref([]);
const paginationData = ref({
  totalItems: 0,
  totalPages: 1,
  currentPage: 1,
  pageSize: 10, // Default page size
});
const isLoading = ref(true);
const fetchError = ref(null);
const isDeleting = ref(null); // For delete button loading state, tracks the ID being deleted

async function fetchCategories(page = 1) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get('/api/admin/categories', {
      params: {
        page: page,
        limit: paginationData.value.pageSize,
      },
    });
    categories.value = response.data.data;
    paginationData.value = response.data.pagination;

    if (String(route.query.page || 1) !== String(paginationData.value.currentPage)) {
      router.push({ query: { ...route.query, page: paginationData.value.currentPage > 1 ? paginationData.value.currentPage : undefined } });
    }
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    const errorMessage = err.response?.data?.message || err.message || 'Could not load categories.';
    fetchError.value = errorMessage;
    toast.error(errorMessage);
    categories.value = [];
    paginationData.value = {
        totalItems: 0,
        totalPages: 1,
        currentPage: 1,
        pageSize: paginationData.value.pageSize
    };
  } finally {
    isLoading.value = false;
  }
}

const handleDeleteCategory = async (categoryId) => {
  if (window.confirm(`Are you sure you want to delete category ID ${categoryId}?`)) {
    isDeleting.value = categoryId;
    try {
      await $axios.delete(`/api/admin/categories/${categoryId}`);
      toast.success(`Category ID ${categoryId} deleted successfully.`);

      let pageToFetch = paginationData.value.currentPage;
      if (categories.value.length === 1 && pageToFetch > 1) {
        pageToFetch--;
      }
      fetchCategories(pageToFetch);
    } catch (err) {
      console.error(`Failed to delete category ${categoryId}:`, err);
      toast.error(err.response?.data?.message || `Failed to delete category ${categoryId}.`);
    } finally {
      isDeleting.value = null;
    }
  }
};

onMounted(() => {
  const initialPage = parseInt(route.query.page) || 1;
  fetchCategories(initialPage);
});

watch(() => route.query.page, (newPageStr) => {
  const newPage = parseInt(newPageStr) || 1;
  if (newPage !== paginationData.value.currentPage && !isLoading.value) {
    fetchCategories(newPage);
  }
}, { immediate: false });

const changePage = (page) => {
  if (page > 0 && page <= paginationData.value.totalPages && page !== paginationData.value.currentPage) {
    router.push({ query: { ...route.query, page: page > 1 ? page : undefined } });
  }
};
</script>

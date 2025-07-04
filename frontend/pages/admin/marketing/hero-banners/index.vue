<template>
  <div>
    <Breadcrumbs :items="breadcrumbs" />
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Manage Hero Banners</h1>
      <NuxtLink
        to="/admin/marketing/hero-banners/new"
        class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors duration-150"
      >
        Create New Banner
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-sm text-gray-500">Loading banners...</p>
    </div>
    <div v-else-if="apiError" class="my-4 p-4 bg-red-100 text-red-700 border border-red-300 rounded-md">
      <div class="flex items-center">
        <ExclamationTriangleIcon class="h-6 w-6 mr-2" />
        <span>Error loading banners: {{ apiError }}</span>
      </div>
    </div>
    <div v-else-if="banners.length === 0" class="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
      <p class="text-gray-500">No hero banners found.</p>
      <p class="mt-1 text-sm text-gray-400">Why not create one now?</p>
    </div>
    <div v-else class="bg-white shadow-md rounded-lg overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Button Text</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Button Link</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sort Order</th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="banner in banners" :key="banner.id" class="hover:bg-gray-50 transition-colors duration-150">
            <td class="px-6 py-4 whitespace-nowrap">
              <img v-if="banner.imageUrl" :src="banner.imageUrl" :alt="banner.altText || banner.title" class="h-10 w-20 object-cover rounded border border-gray-200">
              <span v-else class="text-xs text-gray-400">No Image</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ banner.title }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ banner.buttonText || '-' }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <a v-if="banner.buttonLink" :href="banner.buttonLink" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 hover:underline truncate" :title="banner.buttonLink">
                {{ banner.buttonLink.length > 30 ? banner.buttonLink.substring(0, 27) + '...' : banner.buttonLink }}
              </a>
              <span v-else>-</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <span :class="banner.isActive ? 'text-green-600' : 'text-red-600'" class="flex items-center">
                <CheckCircleIcon v-if="banner.isActive" class="h-5 w-5 mr-1" />
                <XCircleIcon v-else class="h-5 w-5 mr-1" />
                {{ banner.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ banner.sortOrder }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
              <button @click="navigateToEdit(banner.id)" class="text-indigo-600 hover:text-indigo-900" title="Edit Banner">
                <PencilIcon class="h-5 w-5" />
              </button>
              <button @click="handleDeleteBanner(banner.id)" class="text-red-600 hover:text-red-900" title="Delete Banner">
                <TrashIcon class="h-5 w-5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls -->
    <div v-if="!isLoading && banners.length > 0 && pagination.totalPages > 1" class="mt-6 flex justify-between items-center">
      <button
        @click="changePage(pagination.currentPage - 1)"
        :disabled="pagination.currentPage <= 1"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      <span class="text-sm text-gray-700">
        Page {{ pagination.currentPage }} of {{ pagination.totalPages }} (Total: {{ pagination.totalItems }} banners)
      </span>
      <button
        @click="changePage(pagination.currentPage + 1)"
        :disabled="pagination.currentPage >= pagination.totalPages"
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import { useNuxtApp, useRouter, useRoute } from '#app';
import { useToast } from 'vue-toastification';
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';
import { CheckCircleIcon, XCircleIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';


definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  permission: 'marketing:manage_hero_banners'
});

useHead({ title: 'Manage Hero Banners' });

const breadcrumbs = [
  { text: 'Admin', href: '/admin' },
  { text: 'Marketing', href: '/admin/marketing' },
  { text: 'Hero Banners' }
];

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const banners = ref([]);
const isLoading = ref(true);
const apiError = ref(null); // For general page load errors
const pagination = reactive({
  totalItems: 0,
  totalPages: 1,
  currentPage: route.query.page ? parseInt(route.query.page) : 1,
  limit: route.query.limit ? parseInt(route.query.limit) : 10, // Default limit
});
const sortOptions = reactive({
    sortBy: route.query.sortBy || 'sortOrder',
    sortOrder: route.query.sortOrder || 'asc'
});


async function fetchBanners() {
  isLoading.value = true;
  apiError.value = null;
  try {
    const params = {
      page: pagination.currentPage,
      limit: pagination.limit,
      sortBy: sortOptions.sortBy,
      sortOrder: sortOptions.sortOrder,
    };
    const response = await $axios.get('/admin/hero-banners', { params });
    banners.value = response.data.data || [];
    if (response.data.pagination) {
      pagination.totalItems = response.data.pagination.totalItems;
      pagination.totalPages = response.data.pagination.totalPages;
      pagination.currentPage = response.data.pagination.currentPage;
      pagination.limit = response.data.pagination.limit;
    }
  } catch (err) {
    console.error('Error fetching hero banners:', err.response?.data || err.message);
    apiError.value = err.response?.data?.message || 'Failed to load hero banners.';
    toast.error(apiError.value);
  } finally {
    isLoading.value = false;
  }
}

async function handleDeleteBanner(bannerId) {
  if (!confirm('Are you sure you want to delete this hero banner?')) {
    return;
  }
  try {
    await $axios.delete(`/admin/hero-banners/${bannerId}`);
    toast.success('Hero banner deleted successfully!');
    fetchBanners(); // Refresh the list
  } catch (err) {
    console.error(`Error deleting hero banner ${bannerId}:`, err.response?.data || err.message);
    toast.error(err.response?.data?.message || 'Failed to delete hero banner.');
  }
}

function navigateToEdit(bannerId) {
  router.push(`/admin/marketing/hero-banners/edit/${bannerId}`);
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.totalPages) {
    pagination.currentPage = newPage;
    // Update router query to reflect page change for bookmarking/sharing
    router.push({ query: { ...route.query, page: newPage } });
    // fetchBanners will be called by the watcher on route.query
  }
}

watch(
  () => route.query,
  (newQuery) => {
    pagination.currentPage = newQuery.page ? parseInt(newQuery.page) : 1;
    pagination.limit = newQuery.limit ? parseInt(newQuery.limit) : 10;
    sortOptions.sortBy = newQuery.sortBy || 'sortOrder';
    sortOptions.sortOrder = newQuery.sortOrder || 'asc';
    fetchBanners();
  },
  { immediate: true } // Fetch on initial load based on query
);

// onMounted(fetchBanners); // Replaced by immediate watcher

</script>

<template>
  <div>
    <Breadcrumbs :items="breadcrumbs" />
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-800">Manage Hero Banners</h1>
      <NuxtLink
        to="/admin/marketing/hero-banners/new"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
      >
        Add New Banner
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <div class="spinner"></div>
      <p class="text-lg text-gray-600 mt-4">Loading hero banners...</p>
    </div>
    <div v-else-if="fetchError" class="my-3 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg shadow">
      <p class="font-semibold">Error loading hero banners:</p>
      <p>{{ fetchError }}</p>
    </div>
    <div v-else>
      <div v-if="banners.length === 0" class="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <h3 class="mt-2 text-lg font-medium text-gray-900">No Hero Banners Yet</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating a new hero banner.</p>
        <div class="mt-6">
          <NuxtLink
            to="/admin/marketing/hero-banners/new"
            class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
          >
            <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Create Hero Banner
          </NuxtLink>
        </div>
      </div>
      <div v-else>
        <!-- Table to display hero banners -->
        <div class="overflow-x-auto bg-white shadow sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sort Order</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="banner in banners" :key="banner.id">
                <td class="px-6 py-4 whitespace-nowrap">
                  <img v-if="banner.imageUrl" :src="banner.imageUrl" :alt="banner.altText || 'Banner image'" class="h-10 w-20 object-cover rounded border border-gray-200">
                  <span v-else class="text-gray-400 text-sm">No image</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{{ banner.title }}</div>
                  <div v-if="banner.subtitle" class="text-xs text-gray-500">{{ banner.subtitle }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="banner.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ banner.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ banner.sortOrder }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(banner.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <NuxtLink :to="`/admin/marketing/hero-banners/edit/${banner.id}`" class="text-peach-pink hover:text-peach-pink-dark font-medium">Edit</NuxtLink>
                  <button @click="confirmDeleteBanner(banner.id, banner.title)" class="text-red-600 hover:text-red-800 font-medium">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div v-if="pagination.totalPages > 1" class="mt-6 flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Showing page
              <span class="font-medium">{{ pagination.currentPage }}</span>
              of
              <span class="font-medium">{{ pagination.totalPages }}</span>
              pages ({{ pagination.totalItems }} total banners)
            </p>
          </div>
          <div class="flex space-x-2">
            <button
              @click="changePage(pagination.currentPage - 1)"
              :disabled="pagination.currentPage <= 1"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              @click="changePage(pagination.currentPage + 1)"
              :disabled="pagination.currentPage >= pagination.totalPages"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
        <!-- End Pagination Controls -->

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useNuxtApp } from '#app';
import { useRouter } // Import useRouter for navigation if needed, though NuxtLink handles edit
from 'vue-router';
import { useToast } from 'vue-toastification';
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';

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
const toast = useToast();
const router = useRouter(); // Initialize router if needed for programmatic navigation, not strictly for NuxtLink

const banners = ref([]);
const pagination = ref({
  totalItems: 0,
  totalPages: 1,
  currentPage: 1,
  limit: 10
});
const isLoading = ref(true);
const fetchError = ref('');

const currentPage = ref(1);
const itemsPerPage = ref(10);
const sortBy = ref('sortOrder');
const sortOrder = ref('ASC');

async function fetchHeroBanners() {
  isLoading.value = true;
  fetchError.value = '';
  try {
    const response = await $axios.get('/admin/hero-banners', {
      params: {
        page: currentPage.value,
        limit: itemsPerPage.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      }
    });
    banners.value = response.data.data;
    pagination.value = response.data.pagination;
  } catch (err) {
    console.error('Error fetching hero banners:', err.response?.data || err.message);
    fetchError.value = err.response?.data?.message || err.message || 'Failed to load hero banners.';
    if (banners.value.length === 0) { // Only show toast if there's no data displayed
        toast.error(fetchError.value);
    }
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function confirmDeleteBanner(bannerId, bannerTitle) {
  if (window.confirm(`Are you sure you want to delete the banner "${bannerTitle}"? This action cannot be undone.`)) {
    deleteBanner(bannerId);
  }
}

async function deleteBanner(bannerId) {
  try {
    await $axios.delete(`/admin/hero-banners/${bannerId}`);
    toast.success('Hero banner deleted successfully!');
    // Refresh the list:
    // Option 1: Refetch the current page
    fetchHeroBanners();
    // Option 2: Remove from local array (more responsive but might miss pagination changes if last item on a page is deleted)
    // banners.value = banners.value.filter(b => b.id !== bannerId);
    // pagination.value.totalItems--; // Adjust total items, but this can get complex with totalPages
    // For simplicity and data consistency, refetching is often safer unless dealing with large datasets or specific UX needs.
  } catch (err) {
    console.error('Error deleting hero banner:', err.response?.data || err.message);
    toast.error(err.response?.data?.message || 'Failed to delete hero banner.');
  }
}

onMounted(() => {
  fetchHeroBanners();
});

function changePage(newPage) {
  if (newPage > 0 && newPage <= pagination.value.totalPages) {
    currentPage.value = newPage;
    fetchHeroBanners(); // Refetch data for the new page
  }
}

// TODO: Functions for sorting will be added later
</script>

<style scoped>
/* Basic CSS Spinner */
.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #f97316; /* Using peach-pink-like color, adjust if theme color is different */
  animation: spin 1s ease infinite;
  margin-left: auto;
  margin-right: auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Ensure consistent spacing for action buttons if not handled by a global style */
.space-x-2 > :not([hidden]) ~ :not([hidden]) {
  --tw-space-x-reverse: 0;
  margin-right: calc(0.5rem * var(--tw-space-x-reverse)); /* Tailwind's default for space-x-2 is 0.5rem */
  margin-left: calc(0.5rem * calc(1 - var(--tw-space-x-reverse)));
}
</style>

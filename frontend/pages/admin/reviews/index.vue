<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Manage Customer Reviews</h1>
      <!-- Add button can be added here if manual review creation is desired, though typically reviews come from users -->
    </div>

    <!-- Filters Section -->
    <div class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <label for="statusFilter" class="block text-sm font-medium text-gray-700">Status</label>
          <select id="statusFilter" v-model="filters.status" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label for="productIdFilter" class="block text-sm font-medium text-gray-700">Product ID</label>
          <input type="number" id="productIdFilter" v-model.number="filters.productId" placeholder="Enter Product ID" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label for="userIdFilter" class="block text-sm font-medium text-gray-700">User ID</label>
          <input type="number" id="userIdFilter" v-model.number="filters.userId" placeholder="Enter User ID" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div class="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-2 flex items-end space-x-3">
          <button @click="applyFilters" class="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Apply</button>
          <button @click="resetFilters" class="w-full sm:w-auto inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Reset</button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading reviews...</p>
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mt-4"></div>
    </div>
    <div v-else-if="fetchError" class="my-6 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg shadow text-sm text-center">
      <p>Could not load reviews: {{ fetchError.message || fetchError }}</p>
    </div>
    <div v-else-if="reviews.length === 0" class="my-6 p-8 bg-gray-50 text-gray-500 rounded-lg shadow text-center">
      <p class="text-xl mb-4">No reviews found matching your criteria.</p>
    </div>

    <div v-else>
      <div class="bg-white shadow-md rounded-lg border border-neutral-200 overflow-x-auto">
        <table class="min-w-full divide-y divide-neutral-200">
          <thead class="bg-neutral-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-neutral-200">
            <tr v-for="review in reviews" :key="review.id" class="hover:bg-gray-50 transition-colors duration-150">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <NuxtLink :to="`/admin/products/edit/${review.product_id}`" class="text-indigo-600 hover:underline">{{ review.product_name || review.product_id }}</NuxtLink>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ review.user_name || review.user_email || review.user_id }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span class="flex items-center">
                  <span v-for="i in 5" :key="i" class="h-4 w-4" :class="getStarClasses(review.rating, i)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  </span>
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" :title="review.comment">
                {{ review.title ? `"${review.title}" - ` : '' }}{{ review.comment ? (review.comment.substring(0, 50) + (review.comment.length > 50 ? '...' : '')) : 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                 <span :class="statusBadgeClass(review.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ review.status }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ new Date(review.created_at).toLocaleDateString() }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button v-if="review.status !== 'approved'" @click="updateReviewStatus(review.id, 'approved')" :disabled="actionLoading.id === review.id && actionLoading.type === 'approved'" class="text-green-600 hover:text-green-800 hover:underline disabled:opacity-50">
                  <span v-if="actionLoading.id === review.id && actionLoading.type === 'approved'">...</span><span v-else>Approve</span>
                </button>
                <button v-if="review.status !== 'rejected'" @click="updateReviewStatus(review.id, 'rejected')" :disabled="actionLoading.id === review.id && actionLoading.type === 'rejected'" class="text-yellow-600 hover:text-yellow-800 hover:underline disabled:opacity-50">
                   <span v-if="actionLoading.id === review.id && actionLoading.type === 'rejected'">...</span><span v-else>Reject</span>
                </button>
                <button @click="deleteReview(review.id)" class="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50" :disabled="actionLoading.id === review.id && actionLoading.type === 'delete'">
                  <span v-if="actionLoading.id === review.id && actionLoading.type === 'delete'">...</span><span v-else>Delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination Controls -->
      <div class="mt-6 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && reviews.length > 0 && paginationData.totalPages > 1">
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
import { ref, reactive, onMounted, watch } from 'vue';
import { useNuxtApp, useRouter, useRoute, definePageMeta, useHead } from '#app';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Manage Reviews',
});

const { $axios } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const reviews = ref([]);
const paginationData = ref({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 10 });
const isLoading = ref(true);
const fetchError = ref(null);
const filters = reactive({
  status: route.query.status || '',
  productId: route.query.productId ? parseInt(route.query.productId) : '',
  userId: route.query.userId ? parseInt(route.query.userId) : '',
  page: route.query.page ? parseInt(route.query.page) : 1,
  limit: route.query.limit ? parseInt(route.query.limit) : 10,
  sort: route.query.sort || 'created_at_desc',
});
const actionLoading = ref({ type: '', id: null }); // type: 'approve', 'reject', 'delete'

const fetchReviews = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const queryParams = { ...filters };
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === '' || queryParams[key] === null || queryParams[key] === undefined) {
        delete queryParams[key];
      }
    });

    const response = await $axios.get('/api/admin/reviews', { params: queryParams });
    reviews.value = response.data.reviews;
    paginationData.value = response.data.pagination;
  } catch (err) {
    console.error('Error fetching reviews:', err);
    fetchError.value = err.response?.data?.message || err.message || 'Could not load reviews.';
    toast.error(fetchError.value);
  } finally {
    isLoading.value = false;
  }
};

const applyFilters = () => {
  filters.page = 1;
  router.push({ query: { ...filters } });
};

const resetFilters = () => {
  filters.status = '';
  filters.productId = '';
  filters.userId = '';
  filters.page = 1;
  filters.sort = 'created_at_desc';
  router.push({ query: {} });
};

watch(() => route.query, (newQuery) => {
    filters.status = newQuery.status || '';
    filters.productId = newQuery.productId ? parseInt(newQuery.productId) : '';
    filters.userId = newQuery.userId ? parseInt(newQuery.userId) : '';
    filters.page = newQuery.page ? parseInt(newQuery.page) : 1;
    filters.sort = newQuery.sort || 'created_at_desc';
    fetchReviews();
  },
  { deep: true, immediate: true }
);

const updateReviewStatus = async (reviewId, newStatus) => {
  actionLoading.value = { type: newStatus, id: reviewId };
  try {
    await $axios.put(`/api/admin/reviews/${reviewId}/status`, { status: newStatus });
    toast.success(`Review ${reviewId} status updated to ${newStatus}.`);
    const reviewIndex = reviews.value.findIndex(r => r.id === reviewId);
    if (reviewIndex !== -1) {
      reviews.value[reviewIndex].status = newStatus;
      // If product average rating is displayed on this page, might need to update that too,
      // or assume it's updated on next full fetch if navigating away and back.
      // For now, just updating local status. A full fetch might be better for consistency
      // if average_rating of the product itself could change other displayed info.
      // fetchReviews(); // Option for full refresh
    } else {
      fetchReviews();
    }
  } catch (error) {
    console.error(`Error updating review ${reviewId} status:`, error);
    toast.error(error.response?.data?.message || 'Failed to update review status.');
  } finally {
    actionLoading.value = { type: '', id: null };
  }
};

const deleteReview = async (reviewId) => {
  if (!window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
    return;
  }
  actionLoading.value = { type: 'delete', id: reviewId };
  try {
    await $axios.delete(`/api/admin/reviews/${reviewId}`);
    toast.success(`Review ${reviewId} deleted successfully.`);
    let currentPageToFetch = filters.page;
    if (reviews.value.length === 1 && currentPageToFetch > 1) {
      currentPageToFetch--;
      filters.page = currentPageToFetch;
    }
    if (filters.page !== (parseInt(route.query.page) || 1) ) {
         router.push({ query: { ...filters } });
    } else {
        fetchReviews();
    }
  } catch (error) {
    console.error(`Error deleting review ${reviewId}:`, error);
    toast.error(error.response?.data?.message || 'Failed to delete review.');
  } finally {
    actionLoading.value = { type: '', id: null };
  }
};

const getStarClasses = (rating, starIndex) => {
  return starIndex <= rating ? 'text-yellow-400' : 'text-gray-300';
};

const statusBadgeClass = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const changePage = (page) => {
  if (page > 0 && page <= paginationData.value.totalPages && page !== filters.page) {
    filters.page = page;
    router.push({ query: { ...filters } });
  }
};

</script>

<style scoped>
/* Scoped styles if necessary */
</style>

<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-semibold mb-6 text-gray-800">Manage Product Reviews</h1>

    <!-- Filters -->
    <div class="mb-6 flex items-center">
      <label for="statusFilter" class="mr-2 text-sm font-medium text-gray-700">Filter by status:</label>
      <select
        id="statusFilter"
        v-model="selectedStatus"
        class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-auto p-2.5 shadow-sm"
      >
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.text }}
        </option>
      </select>
    </div>

    <!-- Loading and Error Display -->
    <div v-if="isLoading" class="text-center py-10">
      <p class="text-lg text-gray-500">Loading reviews...</p>
      <!-- Optional: Add a spinner SVG or component here -->
    </div>
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
      <strong class="font-bold">Error!</strong>
      <span class="block sm:inline">{{ error.message || error }}</span>
    </div>

    <!-- No Reviews Found -->
    <div v-if="!isLoading && !error && reviews.length === 0" class="text-center py-10 bg-white shadow-md rounded-lg">
      <p class="text-lg text-gray-500">
        No reviews found<span v-if="selectedStatus !== 'all'"> for the selected status</span>.
      </p>
    </div>

    <!-- Reviews Table -->
    <div v-if="!isLoading && reviews.length > 0" class="bg-white shadow-xl rounded-lg overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th scope="col" class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="review in reviews" :key="review.id" class="hover:bg-gray-50 transition duration-150">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">{{ review.product_name || 'N/A' }}</div>
              <!-- Optional: Link to product page -->
              <!-- <NuxtLink :to="`/products/${review.product_id}`" class="text-sm text-blue-600 hover:underline">{{ review.product_name }}</NuxtLink> -->
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-700">{{ review.user_name || review.user_email || 'Anonymous' }}</div>
            </td>
            <td class="px-4 py-4 whitespace-nowrap text-center">
              <span class="text-sm font-semibold text-yellow-500">{{ review.rating }} ★</span>
            </td>
            <td class="px-6 py-4">
              <p class="text-sm text-gray-700 max-w-xs truncate" :title="review.comment">
                {{ review.comment }}
              </p>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ new Date(review.created_at).toLocaleDateString() }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <span
                :class="statusBadgeClass(review.status)"
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
              >
                {{ review.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <select
                @change="updateReviewStatus(review.id, $event.target.value)"
                :value="review.status"
                class="text-xs border border-gray-300 rounded-md p-1 focus:ring-blue-500 focus:border-blue-500"
                title="Change Status"
              >
                <option v-for="sOpt in statusOptions.filter(s => s.value !== 'all')" :key="`status-${review.id}-${sOpt.value}`" :value="sOpt.value">
                  {{ sOpt.text }}
                </option>
              </select>
              <button
                @click="confirmDeleteReview(review.id)"
                class="text-red-600 hover:text-red-800 transition duration-150"
                title="Delete Review"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="!isLoading && reviews.length > 0 && totalPages > 1" class="mt-6 flex justify-between items-center">
      <div>
        <button
          @click="prevPage"
          :disabled="currentPage === 1 || isLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Previous
        </button>
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages || isLoading"
          class="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Next
        </button>
      </div>
      <div class="text-sm text-gray-700">
        Page <span class="font-medium">{{ currentPage }}</span> of <span class="font-medium">{{ totalPages }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Manage Reviews',
});

const { $axios } = useNuxtApp();

const reviews = ref([]);
const isLoading = ref(true);
const error = ref(null);
const currentPage = ref(1);
const totalPages = ref(1);
const limit = ref(15); // Items per page

const selectedStatus = ref('all'); // Default filter
const statusOptions = ref([
  { value: 'all', text: 'All Statuses' },
  { value: 'pending', text: 'Pending' },
  { value: 'approved', text: 'Approved' },
  { value: 'rejected', text: 'Rejected' },
]);

const statusBadgeClass = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const fetchReviews = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const params = {
      page: currentPage.value,
      limit: limit.value,
      status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
    };
    const response = await $axios.get('/admin/reviews', { params });
    reviews.value = response.data.data || []; // Assuming API returns { data: [], pagination: {} }
    totalPages.value = response.data.pagination?.totalPages || 1;
    currentPage.value = response.data.pagination?.currentPage || 1;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to load reviews.';
  } finally {
    isLoading.value = false;
  }
};

const updateReviewStatus = async (reviewId, newStatus) => {
  try {
    await $axios.put(`/admin/reviews/${reviewId}/status`, { status: newStatus });
    // alert('Review status updated successfully.'); // Or use a toast notification
    // Find the review in the list and update its status locally for immediate feedback
    const reviewIndex = reviews.value.findIndex(r => r.id === reviewId);
    if (reviewIndex !== -1) {
      reviews.value[reviewIndex].status = newStatus;
    } else {
      fetchReviews(); // Fallback to re-fetch all if not found (should not happen)
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to update status.';
    // Optionally, revert the status in UI or re-fetch to ensure consistency
    fetchReviews();
  }
};

const confirmDeleteReview = (reviewId) => {
  if (confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
    deleteReview(reviewId);
  }
};

const deleteReview = async (reviewId) => {
  try {
    await $axios.delete(`/admin/reviews/${reviewId}`);
    // alert('Review deleted successfully.'); // Or use a toast
    fetchReviews(); // Refresh the list
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to delete review.';
  }
};

// Pagination
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    // Watcher will trigger fetchReviews
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    // Watcher will trigger fetchReviews
  }
};

// Watch for changes in filters or page

// Watch for changes in selectedStatus
watch(selectedStatus, (newStatus, oldStatus) => {
  if (newStatus !== oldStatus) {
    if (currentPage.value !== 1) {
      currentPage.value = 1; // This will trigger the currentPage watcher
    } else {
      // If already on page 1, the currentPage watcher won't fire by itself,
      // so trigger fetchReviews directly.
      fetchReviews();
    }
  }
});

// Watch for changes in currentPage
watch(currentPage, (newPage, oldPage) => {
  if (newPage !== oldPage) {
    fetchReviews();
  }
});


onMounted(() => {
  fetchReviews();
});

</script>

<style scoped>
/* Minimal scoped styles, Tailwind is primary */
select:focus {
  box-shadow: 0 0 0 2px #bfdbfe; /* Example focus style like focus:ring-blue-300 */
}
.max-w-xs {
  max-width: 20rem; /* Tailwind's sm is 24rem, xs is 20rem */
}
</style>

<template>
  <form @submit.prevent="handleSubmitReview" class="space-y-6 py-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Your Rating <span class="text-red-500">*</span></label>
      <div class="flex items-center space-x-1" @mouseleave="resetHoverRating">
        <button
          v-for="star in 5"
          :key="`rating-${star}`"
          type="button"
          @click="setRating(star)"
          @mouseover="hoverRating(star)"
          class="focus:outline-none"
          :aria-label="`Rate ${star} out of 5 stars`"
        >
          <svg
            :class="getStarClass(star)"
            class="w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-150"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
          </svg>
        </button>
      </div>
    </div>

    <div>
      <label for="reviewTitle" class="block text-sm font-medium text-gray-700 mb-1">Review Title (Optional)</label>
      <input
        type="text"
        id="reviewTitle"
        v-model="title"
        :disabled="isSubmitting"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
        placeholder="e.g., Great product!"
      />
    </div>

    <div>
      <label for="reviewComment" class="block text-sm font-medium text-gray-700 mb-1">Your Review <span class="text-red-500">*</span></label>
      <textarea
        id="reviewComment"
        v-model="comment"
        rows="4"
        required
        :disabled="isSubmitting"
        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
        placeholder="Tell us what you think..."
      ></textarea>
    </div>

    <div v-if="apiError" class="p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-200">
      {{ apiError }}
    </div>

    <div>
      <button
        type="submit"
        :disabled="isSubmitting || rating === 0"
        class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isSubmitting" class="animate-pulse">Submitting...</span>
        <span v-else>Submit Review</span>
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref } from 'vue';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';
// useAuth might be needed if we need to check login status directly here, but API protection should handle it.

const props = defineProps({
  productId: {
    type: [String, Number],
    required: true,
  },
});

const emit = defineEmits(['reviewSubmittedSuccessfully']);

const rating = ref(0); // 0 means no rating selected yet
const title = ref('');
const comment = ref('');
const currentHoverRating = ref(0); // For interactive star hover effect
const isSubmitting = ref(false);
const apiError = ref(null);

const { $axios } = useNuxtApp();
const toast = useToast();
// const { isLoggedIn } = useAuth(); // API endpoint is protected, so this is mostly for UI hints if needed

const setRating = (starValue) => {
  rating.value = starValue;
  currentHoverRating.value = 0; // Reset hover when a rating is clicked
};

const hoverRating = (starValue) => {
  currentHoverRating.value = starValue;
};

const resetHoverRating = () => {
  currentHoverRating.value = 0;
};

const getStarClass = (starIndex) => {
  const effectiveRating = currentHoverRating.value || rating.value;
  if (starIndex <= effectiveRating) {
    return 'text-yellow-400 hover:text-yellow-500';
  }
  return 'text-gray-300 hover:text-yellow-400';
};

const handleSubmitReview = async () => {
  apiError.value = null; // Clear previous errors

  if (rating.value === 0) {
    apiError.value = 'Please select a rating (1-5 stars).';
    toast.error(apiError.value);
    return;
  }
  if (!comment.value.trim()) {
    apiError.value = 'Please enter your review comment.';
    toast.error(apiError.value);
    return;
  }
   if (comment.value.trim().length < 5) { // Example: min comment length
    apiError.value = 'Your comment should be at least 5 characters long.';
    toast.error(apiError.value);
    return;
  }


  isSubmitting.value = true;
  try {
    const payload = {
      rating: rating.value,
      comment: comment.value.trim(),
    };
    if (title.value.trim()) {
      payload.title = title.value.trim();
    }

    // The API endpoint /products/:productId/reviews is protected by isAuthenticated middleware
    await $axios.post(`/products/${props.productId}/reviews`, payload);

    toast.success('Review submitted successfully! It will appear after moderation.');
    emit('reviewSubmittedSuccessfully');

    // Reset form
    rating.value = 0;
    title.value = '';
    comment.value = '';
    currentHoverRating.value = 0;

  } catch (error) {
    if (error.response && error.response.data) {
        if (error.response.data.message) {
             apiError.value = error.response.data.message;
             toast.error(error.response.data.message);
        } else if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
            // Handle express-validator errors array
            const messages = error.response.data.errors.map(e => e.message || e.msg).join(' ');
            apiError.value = messages;
            toast.error(messages || 'Validation failed.');
        } else {
            apiError.value = 'An unexpected error occurred.';
            toast.error(apiError.value);
        }
    } else {
      apiError.value = 'An unexpected error occurred while submitting your review.';
      toast.error(apiError.value);
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
/* Add any specific scoped styles if necessary, though Tailwind should cover most. */
/* Example for slightly larger stars on hover, if desired beyond color change */
/* .star-button svg:hover { transform: scale(1.1); } */
</style>

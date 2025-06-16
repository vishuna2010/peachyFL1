<template>
  <div>
    <ProductDetailSkeleton v-if="pending" />
    <div v-else-if="fetchError" class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <h2 class="text-2xl font-semibold text-red-600 mb-4">Error Loading Product</h2>
      <p class="text-gray-600 mb-2">{{ fetchError.message || fetchError }}</p>
      <p v-if="fetchError.response && fetchError.response.status === 404" class="text-gray-600 mb-6">
        The product you are looking for does not exist.
      </p>
      <NuxtLink to="/" class="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">&larr; Back to Home</NuxtLink>
    </div>

    <div v-if="product && !pending && !fetchError" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="md:grid md:grid-cols-5 lg:grid-cols-2 gap-8 lg:gap-12">
        <!-- Image Column -->
        <div class="md:col-span-3 lg:col-span-1">
          <img
            @click="openZoomModal(selectedImage.value?.url)"
            v-if="selectedImage && selectedImage.value?.url"
            :src="selectedImage.value.url"
            :alt="selectedImage.value.alt_text || product.name"
            class="w-full h-auto object-contain rounded-lg shadow-lg max-h-[550px] aspect-[4/5] cursor-zoom-in"
            key="selected-image"
          />
          <div v-if="!selectedImage || !selectedImage.value?.url" class="w-full h-[400px] md:h-[550px] flex items-center justify-center bg-neutral-medium rounded-lg text-text-secondary">No Image Available</div>

          <!-- Thumbnail Section with Arrows -->
          <div v-if="galleryImages.length > 1" class="mt-4 relative flex items-center justify-center">
            <!-- Previous Arrow -->
            <button
              v-if="galleryImages.length > 5"
              @click="scrollThumbnails('prev')"
              class="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-700 bg-opacity-50 hover:bg-opacity-75 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="isPrevDisabled"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>

            <div ref="thumbnailContainer" class="flex space-x-2 sm:space-x-3 overflow-x-auto py-2 px-1 no-scrollbar scroll-smooth">
              <img
                v-for="imageItem in galleryImages"
                :key="imageItem.id"
                :src="imageItem.url"
                @click="selectedImage.value = imageItem"
                :alt="imageItem.alt_text || product.name + ' thumbnail ' + imageItem.id"
                class="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-md border-2 cursor-pointer transition-all duration-200 ease-in-out hover:border-gray-400 flex-shrink-0"
                :class="selectedImage?.value?.url === imageItem.url ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-1' : 'border-transparent'"
              />
            </div>

            <!-- Next Arrow -->
            <button
              v-if="galleryImages.length > 5"
              @click="scrollThumbnails('next')"
              class="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-700 bg-opacity-50 hover:bg-opacity-75 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="isNextDisabled"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>

        <!-- Details Column -->
        <div class="md:col-span-2 lg:col-span-1 py-4 md:py-0">
          <h1 class="text-3xl font-bold text-text-primary mb-2">{{ product.name }}</h1>

          <div v-if="product && product.review_count !== undefined" class="flex items-center mb-3">
            <div v-if="product.review_count > 0" class="flex items-center">
              <div class="flex items-center">
                <span v-for="i in 5" :key="`star-${i}`" class="h-5 w-5" :class="i <= Math.round(product.average_rating) ? 'text-yellow-400' : 'text-gray-300'">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </span>
              </div>
              <button @click="scrollToReviewsAndOpenTab()" class="ml-2 text-sm text-gray-600 hover:text-indigo-500 hover:underline">
                ({{ product.review_count }} {{ product.review_count === 1 ? 'review' : 'reviews' }})
              </button>
            </div>
            <div v-else class="text-sm text-gray-500">
              <button @click="scrollToReviewsAndOpenTab(true)" class="hover:text-indigo-500 hover:underline">
                Be the first to review!
              </button>
            </div>
          </div>

          <p v-if="currentVariant && currentVariant.sku" class="text-sm text-text-secondary mb-4">SKU: {{ currentVariant.sku }}</p>
          <p v-else-if="!currentVariant && product.sku" class="text-sm text-text-secondary mb-4">SKU: {{ product.sku }}</p>

          <p class="text-text-secondary leading-relaxed mb-6 text-sm">{{ product.description?.substring(0, 150) + (product.description?.length > 150 ? '...' : '') }}</p>

          <p class="text-3xl font-bold text-brand-primary mb-6">${{ displayPrice.toFixed(2) }}</p>

          <p v-if="product.category_name" class="text-sm text-text-secondary mb-2">
            Category: <span class="font-medium text-text-primary">{{ product.category_name }}</span>
          </p>
          <div v-if="product.tags && product.tags.length > 0" class="mb-6">
            <span v-for="tag in product.tags" :key="tag" class="inline-block bg-neutral-medium text-text-secondary text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">
              {{ tag }}
            </span>
          </div>

          <div v-if="product.has_variants && product.available_options && product.available_options.length > 0" class="space-y-4 mb-6">
            <div v-for="option_type in product.available_options" :key="option_type.option_id">
              <label :for="`option-${option_type.option_id}`" class="block text-sm font-medium text-gray-700 mb-1">
                {{ option_type.option_name }}:
                <span v-if="selectedOptions[option_type.option_id]" class="text-sm text-gray-500 ml-1">
                  ({{ getSelectedValueName(option_type, selectedOptions[option_type.option_id]) }})
                </span>
              </label>
              <div class="flex flex-wrap gap-2">
                <template v-for="valueDetail in availableValuesMap[option_type.option_id]" :key="valueDetail.value_id">
                  <button
                    v-if="isColorOption(option_type.option_name)"
                    type="button"
                    @click="valueDetail.isPotentiallyAvailable && selectOption(option_type.option_id, valueDetail.value_id)"
                    :disabled="!valueDetail.isPotentiallyAvailable"
                    :class="[
                      'p-1.5 border rounded-lg flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-150',
                      selectedOptions[option_type.option_id] === valueDetail.value_id
                        ? 'border-indigo-600 ring-2 ring-indigo-500 shadow-md' // Selected
                        : !valueDetail.isPotentiallyAvailable
                          ? 'border-gray-200 opacity-40 cursor-not-allowed' // Fully unavailable
                          : 'border-gray-300 hover:border-gray-400 focus:ring-indigo-500', // Available (stock hint by text/icon)
                       // Add a subtle indicator for OOS if it's not selected but available
                      valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id ? 'bg-yellow-50' : ''
                    ]"
                    :aria-pressed="selectedOptions[option_type.option_id] === valueDetail.value_id"
                    :title="valueDetail.isPotentiallyAvailable
                              ? (valueDetail.anyResultingVariantInStock ? valueDetail.value_name : `${valueDetail.value_name} (Out of stock with current selections)`)
                              : `${valueDetail.value_name} (Unavailable with current selections)`"
                  >
                    <span
                      class="w-6 h-6 rounded-md border border-gray-400 inline-block relative"
                      :style="{ backgroundColor: valueDetail.value_name.toLowerCase() }"
                      :class="{
                        'opacity-40': !valueDetail.isPotentiallyAvailable,
                        'group-hover:opacity-75': valueDetail.isPotentiallyAvailable
                      }"
                    >
                      <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id"
                            class="absolute inset-0 flex items-center justify-center text-yellow-700 font-bold text-xs">
                        !
                      </span>
                    </span>
                    <span
                      class="text-sm text-gray-700 pr-1"
                      :class="{
                        'opacity-60 line-through': !valueDetail.isPotentiallyAvailable,
                        'text-yellow-700': valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id
                      }"
                    >
                      {{ valueDetail.value_name }}
                       <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id" class="text-xs">(OOS)</span>
                    </span>
                  </button>
                  <button
                    v-else
                    type="button"
                    @click="valueDetail.isPotentiallyAvailable && selectOption(option_type.option_id, valueDetail.value_id)"
                    :disabled="!valueDetail.isPotentiallyAvailable"
                    :class="[
                      'px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors duration-150',
                      selectedOptions[option_type.option_id] === valueDetail.value_id
                        ? 'bg-indigo-600 text-white border-indigo-600 focus:ring-indigo-500' // Selected
                        : !valueDetail.isPotentiallyAvailable
                          ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-75 cursor-not-allowed line-through' // Fully unavailable
                          : !valueDetail.anyResultingVariantInStock
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100 focus:ring-yellow-500' // Available, but leads to OOS
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-indigo-500' // Available and in stock
                    ]"
                    :aria-pressed="selectedOptions[option_type.option_id] === valueDetail.value_id"
                    :title="valueDetail.isPotentiallyAvailable
                              ? (valueDetail.anyResultingVariantInStock ? valueDetail.value_name : `${valueDetail.value_name} (Out of stock with current selections)`)
                              : `${valueDetail.value_name} (Unavailable with current selections)`"
                  >
                    {{ valueDetail.value_name }}
                    <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id" class="text-xs ml-1">(Out of Stock)</span>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <div v-if="product.has_variants && product.available_options && product.available_options.length > 0 && !currentVariant && Object.keys(selectedOptions).length === product.available_options.length" class="my-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">
            Selected combination is unavailable. Please try different options.
          </div>

          <div class="my-4 p-3 rounded-md text-sm font-medium" :class="{'bg-green-100 text-green-700 border border-green-200': displayStock > 5, 'bg-yellow-100 text-yellow-700 border border-yellow-200': displayStock > 0 && displayStock <= 5, 'bg-red-100 text-red-700 border border-red-200': displayStock <= 0}">
            {{ stockStatusMessage }}
          </div>

          <div class="flex items-center gap-4 my-6">
            <input type="number" v-model.number="quantity" min="1" :max="displayStock > 0 ? displayStock : 1" :disabled="addToCartDisabled" class="w-20 p-2 border border-neutral-medium rounded-md text-center focus:ring-1 focus:ring-brand-primary focus:border-brand-primary" />
            <button @click="handleAddToCart" class="flex-grow bg-brand-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-80 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="addToCartDisabled">
              {{ (displayStock <= 0 ? 'Out of Stock' : 'Add to Cart') }}
            </button>
          </div>
          <NuxtLink to="/" class="inline-block mt-6 text-brand-primary hover:underline">&larr; Back to all products</NuxtLink>
        </div>
      </div>

      <!-- Tabs Section -->
      <div v-if="product && !pending && !fetchError" class="mt-12">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button v-for="tab in tabs" :key="tab.key" @click="selectTab(tab.key)" :class="[activeTab === tab.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none']">
              {{ tab.label }}
            </button>
          </nav>
        </div>
        <div class="mt-8" id="product-tabs-content">
          <div v-if="activeTab === 'description'">
            <h3 class="sr-only">Product Description</h3>
            <div class="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none text-gray-700 leading-relaxed" v-html="product.description"></div>
          </div>
          <div v-if="activeTab === 'specifications'">
            <h3 class="sr-only">Specifications</h3>
            <dl class="space-y-4">
              <div v-if="product.category_name"><dt class="text-sm font-medium text-gray-500">Category</dt><dd class="mt-1 text-sm text-gray-900">{{ product.category_name }}</dd></div>
              <div v-if="displaySku"><dt class="text-sm font-medium text-gray-500">SKU</dt><dd class="mt-1 text-sm text-gray-900">{{ displaySku }}</dd></div>
              <div v-if="!product.category_name && !displaySku"><p class="text-gray-600">Detailed specifications are not available for this product. Please refer to the product description.</p></div>
            </dl>
          </div>
          <div v-if="activeTab === 'reviews'">
            <h3 class="sr-only">Customer Reviews</h3>
            <div class="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div v-if="!isLoggedIn" class="text-center"><p class="text-gray-700">Please <NuxtLink to="/login" class="text-indigo-600 hover:underline font-medium">login</NuxtLink> to write a review.</p></div>
              <div v-else>
                <div v-if="isLoadingUserReview" class="text-center text-gray-600"><p>Loading your review status...</p><div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mt-2"></div></div>
                <div v-else-if="userHasReviewed && userReview">
                  <h4 class="text-md font-semibold text-gray-800 mb-2">Your Review:</h4>
                  <div class="p-3 bg-white border border-gray-200 rounded-md">
                    <div class="flex items-center mb-1"><span v-for="i in 5" :key="`user-review-star-${i}`" class="h-5 w-5" :class="i <= userReview.rating ? 'text-yellow-400' : 'text-gray-300'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></span></div>
                    <h5 v-if="userReview.title" class="text-md font-medium text-gray-700">{{ userReview.title }}</h5>
                    <p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{{ userReview.comment }}</p>
                    <p class="text-xs text-gray-400 mt-2">Status: <span class="font-medium" :class="{'text-yellow-500': userReview.status === 'pending', 'text-green-500': userReview.status === 'approved', 'text-red-500': userReview.status === 'rejected'}">{{ userReview.status }}</span></p>
                  </div>
                </div>
                <div v-else-if="!showReviewForm" class="text-center"><button @click="openReviewForm" class="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors">Write a Review</button></div>
                <div v-if="showReviewForm && !userHasReviewed">
                  <ReviewForm :product-id="product.id" @review-submitted-successfully="handleReviewSubmittedSuccessfully" />
                  <button @click="showReviewForm = false" class="mt-2 w-full text-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md">Cancel</button>
                </div>
              </div>
            </div>
            <div class="mt-10 pt-6 border-t border-gray-200" id="public-reviews-section">
              <h4 class="text-lg font-medium text-gray-800 mb-4">Customer Feedback</h4>
              <div v-if="isLoadingPublicReviews" class="text-center py-6"><p class="text-gray-500">Loading reviews...</p><div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mt-2"></div></div>
              <div v-else-if="publicReviewsError" class="p-4 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm"><p>Could not load reviews: {{ publicReviewsError }}</p></div>
              <div v-else-if="!productPublicReviews || productPublicReviews.length === 0" class="text-center py-6"><p class="text-gray-500">This product has no approved reviews yet.</p></div>
              <ul v-else class="space-y-6">
                <li v-for="review in productPublicReviews" :key="review.id" class="pb-6 border-b border-gray-100 last:border-b-0">
                  <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">{{ review.user_name ? review.user_name.charAt(0).toUpperCase() : 'U' }}</div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between"><p class="text-sm font-medium text-gray-900">{{ review.user_name || 'Anonymous User' }}</p><p class="text-xs text-gray-500">{{ new Date(review.created_at).toLocaleDateString() }}</p></div>
                      <div class="flex items-center mt-1"><span v-for="i in 5" :key="`pub-star-${review.id}-${i}`" class="h-4 w-4" :class="getPublicReviewStarClass(review.rating, i)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></span></div>
                      <h5 v-if="review.title" class="mt-2 text-sm font-semibold text-gray-800">{{ review.title }}</h5>
                      <p class="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{{ review.comment }}</p>
                    </div>
                  </div>
                </li>
              </ul>
              <div class="mt-8 flex justify-center items-center space-x-3" v-if="reviewPaginationData && reviewPaginationData.totalPages > 1">
                <button @click="currentPublicReviewsPage = reviewPaginationData.currentPage - 1" :disabled="reviewPaginationData.currentPage <= 1" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                <span class="text-sm text-gray-700">Page {{ reviewPaginationData.currentPage }} of {{ reviewPaginationData.totalPages }}</span>
                <button @click="currentPublicReviewsPage = reviewPaginationData.currentPage + 1" :disabled="reviewPaginationData.currentPage >= reviewPaginationData.totalPages" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ImageZoomModal :is-open="isZoomModalOpen" :image-url="zoomedImageUrl" @close="closeZoomModal" />
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive, useHead, nextTick } from 'vue';
import { useRoute, useNuxtApp } from '#app';
import { useCart } from '~/composables/useCart';
import { useAuth } from '~/composables/useAuth';
import { useToast } from 'vue-toastification';
import ProductDetailSkeleton from '~/components/ProductDetailSkeleton.vue';
import ImageZoomModal from '~/components/ImageZoomModal.vue';
import ReviewForm from '~/components/reviews/ReviewForm.vue';

const { $axios } = useNuxtApp();
const route = useRoute();
const product = ref(null);
const pending = ref(true);
const fetchError = ref(null);
const toast = useToast();

const { addToCart } = useCart();
const { isLoggedIn, user } = useAuth();

// Review specific state
const showReviewForm = ref(false);
const userHasReviewed = ref(false);
const userReview = ref(null);
const isLoadingUserReview = ref(false);

// Image Zoom Modal State
const isZoomModalOpen = ref(false);
const zoomedImageUrl = ref('');

const openZoomModal = (imageUrl) => {
  if (imageUrl) {
    zoomedImageUrl.value = imageUrl;
    isZoomModalOpen.value = true;
  }
};
const closeZoomModal = () => {
  isZoomModalOpen.value = false;
};

// Tab Management
const activeTab = ref('description');
const tabs = ref([
  { key: 'description', label: 'Product Description' },
  { key: 'specifications', label: 'Specifications' },
  { key: 'reviews', label: 'Customer Reviews' }
]);

function selectTab(tabKey) {
  activeTab.value = tabKey;
}

// --- Variant and Display State ---
const selectedOptions = reactive({});
const currentVariant = ref(null);
const galleryImages = ref([]);
const selectedImage = ref(null); // New ref for selected image object

const displayPrice = ref(0);
const displaySku = ref('');
const displayStock = ref(0);
const addToCartDisabled = ref(true);

const quantity = ref(1);

const thumbnailContainer = ref(null);
const scrollStep = 200; // Or calculate based on thumbnail width + margin

const isPrevDisabled = computed(() => thumbnailContainer.value && thumbnailContainer.value.scrollLeft <= 0);
const isNextDisabled = computed(() => {
  if (!thumbnailContainer.value) return true;
  // -5 for a small tolerance, ensures the very end can be reached by clicking next.
  return thumbnailContainer.value.scrollLeft + thumbnailContainer.value.clientWidth >= thumbnailContainer.value.scrollWidth - 5;
});

function scrollThumbnails(direction) {
  if (!thumbnailContainer.value) return;
  const container = thumbnailContainer.value;
  let newScrollLeft;
  if (direction === 'prev') {
    newScrollLeft = Math.max(0, container.scrollLeft - scrollStep);
  } else {
    newScrollLeft = Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + scrollStep);
  }
  container.scrollLeft = newScrollLeft;
}

// Public Reviews State
const productPublicReviews = ref([]);
const reviewPaginationData = ref({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 5 });
const isLoadingPublicReviews = ref(false);
const publicReviewsError = ref(null);
const currentPublicReviewsPage = ref(1);


// --- Computed properties for dynamic display based on selection ---
const stockStatusMessage = computed(() => {
  if (!product.value && !currentVariant.value && !pending.value) return 'Loading stock...';
  if (!product.value && pending.value) return 'Loading...';
  if (!product.value && !pending.value && fetchError.value) return 'Error loading product';

  const stock = displayStock.value;
  if (product.value && product.value.has_variants && Object.keys(selectedOptions).length < (product.value.available_options?.length || 0) ) {
    return "Select options to see stock";
  }
  if (product.value && product.value.has_variants && !currentVariant.value && Object.keys(selectedOptions).length === (product.value.available_options?.length || 0) ) {
    return "Combination unavailable";
  }

  if (stock <= 0) return 'Out of Stock';
  if (stock > 0 && stock <= 5) return `Only ${stock} left!`;
  return 'In Stock';
});

// --- Functions ---

const isColorOption = (optionName) => {
  return optionName?.toLowerCase() === 'color';
};

const getSelectedValueName = (optionType, selectedValueId) => {
  if (!optionType || !optionType.values || !selectedValueId) return '';
  const selectedValue = optionType.values.find(v => v.value_id === selectedValueId);
  return selectedValue ? selectedValue.value_name : '';
};

// Helper to check if a variant's options include all values from a given selection object
function variantMatchesSelection(variant, selectionsToMatch) {
  if (!variant || !variant.option_value_ids) return false;

  const selectionValueIds = Object.values(selectionsToMatch);

  if (selectionValueIds.length === 0 && Object.keys(selectionsToMatch).length > 0) {
    return Object.keys(selectionsToMatch).length === 0;
  }
  if (selectionValueIds.length === 0) return true;

  return selectionValueIds.every(selectedValueId => variant.option_value_ids.includes(selectedValueId));
}

// Determines available values for a specific option type, considering other current selections
// and provides stock status hints for those potential selections.
const getAvailableValuesForOption = (optionToFilter, currentSelectionsForOtherTypes) => {
  const detailedOptionValues = [];
  if (!product.value || !product.value.variants || !optionToFilter || !optionToFilter.values) {
    // If no product variants or option values, return empty or all values as not potentially available
    if (optionToFilter && optionToFilter.values) {
      return optionToFilter.values.map(val => ({
        value_id: val.value_id,
        value_name: val.value_name,
        isPotentiallyAvailable: false,
        anyResultingVariantInStock: false,
      }));
    }
    return detailedOptionValues;
  }

  for (const potentialValue of optionToFilter.values) {
    let isPotentiallyAvailable = false;
    let anyResultingVariantInStock = false;

    const testSelections = {
      ...currentSelectionsForOtherTypes,
      [optionToFilter.option_id]: potentialValue.value_id,
    };

    for (const variant of product.value.variants) {
      if (variantMatchesSelection(variant, testSelections)) {
        isPotentiallyAvailable = true;
        if (variant.stock_quantity > 0) {
          anyResultingVariantInStock = true;
          // Optimization: if we only care that *any* variant is in stock for this specific potentialValue combination,
          // and we've found one, we can break this inner loop.
          // However, if other logic might depend on checking ALL variants that match testSelections, remove break.
          // For current usage (disabling buttons, showing stock hints), this break is fine.
          break;
        }
        // If a variant matches but is out of stock, we continue checking other variants
        // that might also match this testSelection and *are* in stock.
      }
    }
    detailedOptionValues.push({
      value_id: potentialValue.value_id,
      value_name: potentialValue.value_name,
      isPotentiallyAvailable,
      anyResultingVariantInStock,
    });
  }
  return detailedOptionValues;
};

const availableValuesMap = computed(() => {
  const map = {};
  if (product.value && product.value.has_variants && product.value.available_options) {
    product.value.available_options.forEach(optionType => {
      // Create a true copy for 'otherSelections' to avoid modifying 'selectedOptions' directly
      // when deleting a key for the current option type being processed.
      const otherSelections = { ...selectedOptions };
      if (Object.prototype.hasOwnProperty.call(otherSelections, optionType.option_id)) {
        delete otherSelections[optionType.option_id];
      }
      map[optionType.option_id] = getAvailableValuesForOption(optionType, otherSelections);
    });
  }
  return map;
});

function initializeSelections() {
  if (!product.value || !product.value.has_variants || !product.value.available_options || product.value.available_options.length === 0) {
    for (const key in selectedOptions) { delete selectedOptions[key]; }
    updateCurrentVariant();
    return;
  }

  const tempSelectedOptions = {};
  let allOptionsHaveDefault = true;
  for (const optionType of product.value.available_options) {
    if (optionType.values && optionType.values.length > 0) {
      const firstAvailableValue = optionType.values[0].value_id;
      tempSelectedOptions[optionType.option_id] = firstAvailableValue;
    } else {
      allOptionsHaveDefault = false; break;
    }
  }

  if (allOptionsHaveDefault && Object.keys(tempSelectedOptions).length === product.value.available_options.length) {
    const selectedValuesArray = Object.values(tempSelectedOptions).sort((a, b) => a - b);
    const defaultMatchedVariant = product.value.variants.find(variant => {
      if (!variant.option_value_ids || variant.option_value_ids.length !== selectedValuesArray.length) return false;
      const sortedVariantValues = [...variant.option_value_ids].sort((a, b) => a - b);
      return JSON.stringify(sortedVariantValues) === JSON.stringify(selectedValuesArray);
    });

    if (defaultMatchedVariant && defaultMatchedVariant.stock_quantity > 0) {
      for (const key in tempSelectedOptions) { selectedOptions[key] = tempSelectedOptions[key]; }
    } else {
      for (const key in selectedOptions) { delete selectedOptions[key]; }
    }
  } else {
     for (const key in selectedOptions) { delete selectedOptions[key]; }
  }
  updateCurrentVariant();
}

function selectOption(optionId, valueId) {
  if (selectedOptions[optionId] === valueId) {
    delete selectedOptions[optionId];
  } else {
    selectedOptions[optionId] = valueId;
  }

  if (product.value && product.value.has_variants && product.value.available_options) {
    for (const optType of product.value.available_options) {
      const optId = optType.option_id;
      if (optId === optionId) continue;

      if (selectedOptions[optId]) {
        const otherSelsForThisCheck = { ...selectedOptions };
        delete otherSelsForThisCheck[optId];

        const availableValsForThisOpt = getAvailableValuesForOption(optType, otherSelsForThisCheck);
        if (!availableValsForThisOpt.has(selectedOptions[optId])) {
          delete selectedOptions[optId];
        }
      }
    }
  }
  updateCurrentVariant();
}

function updateCurrentVariant() {
  if (!product.value) return;

  if (!product.value.has_variants || !product.value.variants || product.value.variants.length === 0) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = product.value.stock_quantity;
    // Update selectedImage based on product or gallery, similar to fetchProduct
    if (galleryImages.value.length > 0) {
        selectedImage.value = galleryImages.value[0];
    } else if (product.value.image_url) {
        selectedImage.value = { url: product.value.image_url, alt_text: product.value.name, id: 'product_primary_' + product.value.id };
    } else {
        selectedImage.value = null;
    }
    addToCartDisabled.value = product.value.stock_quantity <= 0;
    quantity.value = 1;
    return;
  }

  const numAvailableOptionTypes = product.value.available_options?.length || 0;
  const numSelectedOptions = Object.keys(selectedOptions).length;

  if (numSelectedOptions < numAvailableOptionTypes) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = 0;
    addToCartDisabled.value = true;
    return;
  }

  const selectedValuesArray = Object.values(selectedOptions).sort((a, b) => a - b);
  const matchedVariant = product.value.variants.find(variant => {
    if (!variant.option_value_ids || variant.option_value_ids.length !== selectedValuesArray.length) return false;
    const sortedVariantValues = [...variant.option_value_ids].sort((a, b) => a - b);
    return JSON.stringify(sortedVariantValues) === JSON.stringify(selectedValuesArray);
  });

  if (matchedVariant) {
    currentVariant.value = matchedVariant;
    displayPrice.value = parseFloat(matchedVariant.final_price);
    displaySku.value = matchedVariant.sku || product.value.sku || '';
    displayStock.value = matchedVariant.stock_quantity;
    // Update selectedImage based on variant
    if (matchedVariant.image_url) {
        const existingGalleryImage = galleryImages.value.find(img => img.url === matchedVariant.image_url);
        if (existingGalleryImage) {
            selectedImage.value = existingGalleryImage;
        } else {
            selectedImage.value = { url: matchedVariant.image_url, alt_text: currentVariant.value.sku || product.value.name, id: 'variant_' + currentVariant.value.id };
        }
    } else if (galleryImages.value.length > 0) { // Fallback to first gallery image if variant has no specific image
        selectedImage.value = galleryImages.value[0];
    } else if (product.value.image_url) { // Fallback to main product image
        selectedImage.value = { url: product.value.image_url, alt_text: product.value.name, id: 'product_primary_' + product.value.id };
    } else {
        selectedImage.value = null; // No image available
    }
    addToCartDisabled.value = matchedVariant.stock_quantity <= 0;
  } else {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = 0;
    // Fallback selectedImage if no variant matches
    if (galleryImages.value.length > 0) {
        selectedImage.value = galleryImages.value[0];
    } else if (product.value.image_url) {
        selectedImage.value = { url: product.value.image_url, alt_text: product.value.name, id: 'product_primary_' + product.value.id };
    } else {
        selectedImage.value = null;
    }
    addToCartDisabled.value = true;
  }
  quantity.value = 1;
}

async function fetchProduct() {
  const productId = route.params.id;
  pending.value = true;
  fetchError.value = null;
  Object.keys(selectedOptions).forEach(key => delete selectedOptions[key]);
  currentVariant.value = null;
  galleryImages.value = [];
  selectedImage.value = null; // Initialize selectedImage
  productPublicReviews.value = [];
  currentPublicReviewsPage.value = 1;

  try {
    const response = await $axios.get(`/products/${productId}`);
    product.value = response.data;
    if (product.value) {
      // Use gallery_images from product data
      galleryImages.value = product.value.gallery_images || [];

      initializeSelections();

      // Initialize selectedImage based on the new galleryImages or product.image_url
      if (galleryImages.value.length > 0) {
        selectedImage.value = galleryImages.value[0];
      } else if (product.value.image_url) {
        selectedImage.value = { url: product.value.image_url, alt_text: product.value.name, id: 'product_primary_' + product.value.id };
      } else {
        selectedImage.value = null;
      }
    } else {
      fetchError.value = { message: "Product data is invalid or not found." };
       toast.error(fetchError.value.message);
    }
  } catch (err) {
    console.error(`Failed to fetch product ${productId}:`, err);
    fetchError.value = err.response?.data || { message: err.message || "Unknown error occurred" };
    toast.error(fetchError.value.message || "Failed to load product.");
  } finally {
    pending.value = false;
  }
}

const handleAddToCart = () => {
  const stockAvailable = displayStock.value;
  if (product.value.has_variants && !currentVariant.value && Object.keys(selectedOptions).length === (product.value.available_options?.length || 0) ) {
    toast.error("This combination of options is unavailable.");
    return;
  }
  if (product.value.has_variants && !currentVariant.value) {
    toast.error("Please select all product options to choose a variant.");
    return;
  }
  if (addToCartDisabled.value || stockAvailable <= 0) {
    toast.error("This item is out of stock or unavailable.");
    return;
  }
  if (quantity.value <= 0) { toast.error("Please enter a valid quantity."); return; }
  if (quantity.value > stockAvailable) { toast.error(`Cannot add ${quantity.value} items. Only ${stockAvailable} left in stock.`); return; }

  let cartItemData;
  if (currentVariant.value) {
    let variantOptionString = "";
    if (currentVariant.value.selected_options && currentVariant.value.selected_options.length > 0) {
         variantOptionString = currentVariant.value.selected_options.map(opt => opt.value_name).join(', ');
    } else {
        const parts = [];
        if (product.value.available_options) {
            for (const optionType of product.value.available_options) {
                const selectedValueId = selectedOptions[optionType.option_id];
                if (selectedValueId) {
                    const valueObj = optionType.values.find(v => v.value_id === selectedValueId);
                    if (valueObj) parts.push(valueObj.value_name);
                }
            }
        }
        variantOptionString = parts.join(', ');
    }
    cartItemData = {
      id: currentVariant.value.id, product_id: product.value.id, variant_id: currentVariant.value.id,
      name: `${product.value.name}${variantOptionString ? ` - ${variantOptionString}` : ''}`,
      price: parseFloat(currentVariant.value.final_price), sku: currentVariant.value.sku || product.value.sku,
      image_url: selectedImage.value?.url || product.value.image_url, type: 'variant',
    };
  } else {
    cartItemData = {
      id: product.value.id, product_id: product.value.id, variant_id: null,
      name: product.value.name, price: parseFloat(product.value.price), sku: product.value.sku,
      image_url: selectedImage.value?.url || product.value.image_url, type: 'product',
    };
  }
  addToCart(cartItemData, quantity.value);
};

onMounted(() => {
  fetchProduct();
});

watch(product, (newProduct) => {
  if (newProduct && newProduct.id) {
    checkUserReviewStatus();
    productPublicReviews.value = [];
    currentPublicReviewsPage.value = 1;
    if (activeTab.value === 'reviews') {
      fetchPublicProductReviews(1);
    }
  }
}, { deep: true });

watch(isLoggedIn, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    checkUserReviewStatus();
  }
});

watch(activeTab, (newTab) => {
  if (newTab === 'reviews' && product.value?.id && (!productPublicReviews.value || productPublicReviews.value.length === 0) && !isLoadingPublicReviews.value && !publicReviewsError.value) {
    fetchPublicProductReviews(currentPublicReviewsPage.value);
  }
});

watch(currentPublicReviewsPage, (newPage, oldPage) => {
    if (newPage !== oldPage && activeTab.value === 'reviews' && product.value?.id) {
        fetchPublicProductReviews(newPage);
    }
});

async function checkUserReviewStatus() {
  if (!isLoggedIn.value || !product.value?.id) {
    userHasReviewed.value = false; userReview.value = null;
    showReviewForm.value = false;
    return;
  }
  isLoadingUserReview.value = true;
  try {
    const response = await $axios.get(`/products/${product.value.id}/reviews/my-review`);
    if (response.data && response.data.id) {
      userReview.value = response.data; userHasReviewed.value = true; showReviewForm.value = false;
    } else {
      userReview.value = null; userHasReviewed.value = false; showReviewForm.value = false;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      userReview.value = null; userHasReviewed.value = false; showReviewForm.value = false;
    } else {
      console.error('Error checking user review status:', error); showReviewForm.value = false;
    }
  } finally {
    isLoadingUserReview.value = false;
  }
}

function handleReviewSubmittedSuccessfully() {
  toast.info("Your review is submitted and pending approval.");
  userHasReviewed.value = true; showReviewForm.value = false;
  checkUserReviewStatus();
  if(activeTab.value === 'reviews') {
    fetchPublicProductReviews(currentPublicReviewsPage.value || 1);
  }
}

const scrollToReviewsAndOpenTab = async (openForm = false) => {
  activeTab.value = 'reviews';
  if (openForm && isLoggedIn.value && !userHasReviewed.value && !isLoadingUserReview.value) {
    showReviewForm.value = true;
  }
  await nextTick();
  const el = document.getElementById('product-tabs-content');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

const openReviewForm = () => {
    if(isLoggedIn.value && !userHasReviewed.value) {
        activeTab.value = 'reviews';
        showReviewForm.value = true;
        nextTick(() => {
            const el = document.getElementById('product-tabs-content');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
    } else if (!isLoggedIn.value) {
        toast.info("Please login to write a review.");
    }
};

const getPublicReviewStarClass = (rating, starIndex) => {
  return starIndex <= rating ? 'text-yellow-400' : 'text-gray-300';
};

useHead({
  title: computed(() => product.value ? product.value.name : 'Product Details'),
});
</script>

<template>
  <div>
    <ProductDetailSkeleton v-if="pending" />
    <div v-else-if="fetchError" class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <h2 class="text-2xl font-semibold text-red-600 mb-4">Error Loading Product</h2>
      <p class="text-venus-text-secondary mb-2">{{ fetchError.message || fetchError }}</p>
      <p v-if="fetchError.response && fetchError.response.status === 404" class="text-venus-text-secondary mb-6">
        The product you are looking for does not exist.
      </p>
      <NuxtLink to="/" class="font-medium text-peach-pink hover:text-opacity-80 hover:underline">&larr; Back to Home</NuxtLink>
    </div>

    <div v-if="product && !pending && !fetchError" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <!-- Refactored Main Grid: Image Left, Details Right -->
      <div class="lg:grid lg:grid-cols-12 lg:gap-x-8 items-start">

        <!-- Image Column (e.g., takes 5 or 6 cols on lg) -->
        <div class="lg:col-span-6 xl:col-span-5">
          <div class="mb-4">
            <img
              @click="openZoomModal(selectedImage.value?.url)"
              v-if="selectedImage && selectedImage.value?.url"
              :src="selectedImage.value.url"
              :alt="selectedImage.value.alt_text || product.name"
              class="w-full h-auto object-contain rounded-lg shadow-lg max-h-[450px] sm:max-h-[500px] lg:max-h-[550px] aspect-[4/5] cursor-zoom-in hover:opacity-90 transition-opacity duration-200 border border-neutral-bg-soft"
              key="selected-image"
            />
            <div v-if="!selectedImage || !selectedImage.value?.url" class="w-full h-[400px] md:h-[500px] flex items-center justify-center bg-neutral-bg-soft rounded-lg text-venus-text-secondary shadow-inner">No Image Available</div>
          </div>

          <!-- Thumbnail Section with Arrows -->
          <div v-if="galleryImages.length > 1" class="mt-3 relative flex items-center justify-center px-6 sm:px-8">
            <button
              v-if="galleryImages.length > 3"
              @click="scrollThumbnails('prev')"
              class="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 sm:p-2 bg-sky-blue/60 hover:bg-sky-blue text-white rounded-full shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              :disabled="isPrevDisabled"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>

            <div ref="thumbnailContainer" class="flex space-x-2 sm:space-x-3 overflow-x-auto py-2 no-scrollbar scroll-smooth">
              <img
                v-for="imageItem in galleryImages"
                :key="imageItem.id"
                :src="imageItem.url"
                @click="selectedImage.value = imageItem"
                :alt="imageItem.alt_text || product.name + ' thumbnail ' + imageItem.id"
                class="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-md border-2 cursor-pointer transition-all duration-200 ease-in-out flex-shrink-0 hover:shadow-md"
                :class="selectedImage?.value?.url === imageItem.url ? 'border-orange-gold ring-2 ring-orange-gold/50' : 'border-neutral-bg-soft hover:border-sky-blue/70'"
              />
            </div>
            <button
              v-if="galleryImages.length > 3"
              @click="scrollThumbnails('next')"
              class="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 sm:p-2 bg-sky-blue/60 hover:bg-sky-blue text-white rounded-full shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              :disabled="isNextDisabled"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>

        <!-- Details Column (e.g., takes 7 or 6 cols on lg) -->
        <div class="lg:col-span-6 xl:col-span-7 mt-6 lg:mt-0 py-4 md:py-0">
          <div class="mb-3 text-xs text-venus-text-secondary">
            <NuxtLink to="/" class="hover:text-peach-pink">Home</NuxtLink>
            <span class="mx-1">/</span>
            <NuxtLink :to="`/categories/${product.category_slug || product.category_id}`" class="hover:text-peach-pink" v-if="product.category_name">{{ product.category_name }}</NuxtLink>
            <span class="mx-1" v-if="product.category_name">/</span>
            <span class="text-venus-text-primary">{{ product.name }}</span>
          </div>

          <h1 class="text-3xl lg:text-4xl font-bold text-venus-text-primary mb-2">{{ product.name }}</h1>

          <p v-if="currentVariant && currentVariant.sku" class="text-xs text-venus-text-secondary mb-3">SKU: {{ currentVariant.sku }}</p>
          <p v-else-if="!currentVariant && product.sku" class="text-xs text-venus-text-secondary mb-3">SKU: {{ product.sku }}</p>

          <div v-if="product && product.review_count !== undefined" class="flex items-center mb-4">
            <div v-if="product.review_count > 0" class="flex items-center">
              <div class="flex items-center">
                <span v-for="i in 5" :key="`star-${i}`" class="h-5 w-5" :class="i <= Math.round(product.average_rating) ? 'text-orange-gold' : 'text-gray-300'">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </span>
              </div>
              <button @click="scrollToReviewsAndOpenTab()" class="ml-2 text-sm text-sky-blue hover:text-peach-pink hover:underline">
                ({{ product.review_count }} {{ product.review_count === 1 ? 'review' : 'reviews' }})
              </button>
            </div>
            <div v-else class="text-sm text-gray-500">
              <button @click="scrollToReviewsAndOpenTab(true)" class="text-sky-blue hover:text-peach-pink hover:underline">
                Be the first to review!
              </button>
            </div>
          </div>

          <p class="text-venus-text-secondary leading-relaxed mb-5 text-sm">{{ product.description?.substring(0, 250) + (product.description?.length > 250 ? '...' : '') }}</p>

          <p class="text-3xl font-semibold text-orange-gold mb-5">
            ${{ displayPrice.toFixed(2) }}
            <span v-if="product.original_price && parseFloat(product.original_price) > displayPrice" class="text-lg text-gray-400 line-through ml-2">
              ${{ parseFloat(product.original_price).toFixed(2) }}
            </span>
          </p>

          <div class="space-y-1 mb-4 text-sm">
            <p v-if="product.category_name" class="text-venus-text-secondary">
              Category: <NuxtLink :to="`/categories/${product.category_slug || product.category_id}`" class="font-medium text-sky-blue hover:text-peach-pink hover:underline">{{ product.category_name }}</NuxtLink>
            </p>
            <div v-if="product.tags && product.tags.length > 0" class="flex flex-wrap gap-2 items-center">
              <span class="text-venus-text-secondary">Tags:</span>
              <NuxtLink v-for="tag in product.tags" :key="tag" :to="`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`" class="inline-block bg-fresh-green/10 text-fresh-green text-xs font-semibold px-2 py-0.5 rounded-full hover:bg-fresh-green/20">
                {{ tag }}
              </NuxtLink>
            </div>
            <p v-if="product.tax_class_name || product.tax_class_id" class="text-venus-text-secondary">
              Tax Class: <span class="font-medium text-venus-text-primary">{{ product.tax_class_name || (product.tax_class_id ? 'ID: ' + product.tax_class_id : 'N/A') }}</span>
            </p>
          </div>

          <div v-if="product.has_variants && product.available_options && product.available_options.length > 0" class="space-y-4 mb-6">
            <div v-for="option_type in product.available_options" :key="option_type.option_id">
              <label :for="`option-${option_type.option_id}`" class="block text-sm font-medium text-venus-text-primary mb-1.5">
                {{ option_type.option_name }}:
                <span v-if="selectedOptions[option_type.option_id]" class="text-sm text-gray-600 ml-1">
                  {{ getSelectedValueName(option_type, selectedOptions[option_type.option_id]) }}
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
                      'p-1 border flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 rounded-md',
                      selectedOptions[option_type.option_id] === valueDetail.value_id
                        ? 'border-peach-pink ring-2 ring-peach-pink'
                        : !valueDetail.isPotentiallyAvailable
                          ? 'border-gray-300 opacity-40 cursor-not-allowed'
                          : valueDetail.anyResultingVariantInStock
                            ? 'border-gray-300 hover:border-sky-blue focus:ring-peach-pink'
                            : 'border-yellow-400 hover:border-yellow-500 focus:ring-peach-pink',
                      valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id ? 'bg-lemon-yellow/20' : ''
                    ]"
                    :aria-pressed="selectedOptions[option_type.option_id] === valueDetail.value_id"
                    :title="valueDetail.isPotentiallyAvailable
                              ? (valueDetail.anyResultingVariantInStock ? valueDetail.value_name : `${valueDetail.value_name} (Out of stock)`)
                              : `${valueDetail.value_name} (Unavailable)`"
                  >
                    <span
                      class="w-6 h-6 rounded border border-gray-400 inline-block relative"
                      :style="{ backgroundColor: valueDetail.value_name.toLowerCase() }"
                      :class="{ 'opacity-40': !valueDetail.isPotentiallyAvailable }"
                    >
                      <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id"
                            class="absolute inset-0 flex items-center justify-center text-orange-gold font-bold text-xs">!</span>
                    </span>
                    <span
                      class="text-sm text-venus-text-secondary pr-1"
                      :class="{
                        'opacity-60 line-through': !valueDetail.isPotentiallyAvailable,
                        'text-orange-gold': valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id
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
                      'px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150',
                      selectedOptions[option_type.option_id] === valueDetail.value_id
                        ? 'bg-sky-blue text-white border-sky-blue focus:ring-peach-pink'
                        : !valueDetail.isPotentiallyAvailable
                          ? 'bg-gray-100 text-gray-400 border-gray-300 opacity-75 cursor-not-allowed line-through'
                          : !valueDetail.anyResultingVariantInStock
                            ? 'bg-lemon-yellow/20 text-orange-gold border-yellow-400 hover:bg-lemon-yellow/40 focus:ring-peach-pink'
                            : 'bg-white text-venus-text-primary border-gray-300 hover:bg-gray-50 hover:border-sky-blue focus:ring-peach-pink'
                    ]"
                    :aria-pressed="selectedOptions[option_type.option_id] === valueDetail.value_id"
                    :title="valueDetail.isPotentiallyAvailable
                              ? (valueDetail.anyResultingVariantInStock ? valueDetail.value_name : `${valueDetail.value_name} (Out of stock)`)
                              : `${valueDetail.value_name} (Unavailable)`"
                  >
                    {{ valueDetail.value_name }}
                    <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id" class="text-xs ml-1">(OOS)</span>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <div v-if="product.has_variants && product.available_options && product.available_options.length > 0 && !currentVariant && Object.keys(selectedOptions).length === product.available_options.length" class="my-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-300 text-sm shadow">
            Selected combination is currently unavailable. Please try different options.
          </div>

          <div class="my-4 p-3 rounded-md text-sm font-medium shadow-sm" :class="{'bg-fresh-green/10 text-fresh-green border border-fresh-green/30': displayStock > 5, 'bg-lemon-yellow/20 text-orange-gold border border-orange-gold/30': displayStock > 0 && displayStock <= 5, 'bg-red-100 text-red-600 border border-red-300': displayStock <= 0}">
            {{ stockStatusMessage }}
          </div>

          <div class="flex items-center gap-3 my-6">
            <input type="number" v-model.number="quantity" min="1" :max="displayStock > 0 ? displayStock : 1" :disabled="addToCartDisabled" class="w-20 p-2.5 border border-gray-300 rounded-md text-center focus:ring-1 focus:ring-peach-pink focus:border-peach-pink disabled:bg-gray-100" />
            <button @click="handleAddToCart" class="flex-grow bg-peach-pink text-white font-semibold py-3 px-6 rounded-md shadow hover:bg-opacity-90 transform transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-300 flex items-center justify-center" :disabled="addToCartDisabled">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{{ (displayStock <= 0 ? 'Out of Stock' : 'Add to Cart') }}</span>
            </button>
          </div>
          <NuxtLink to="/" class="inline-block mt-6 text-sky-blue hover:text-peach-pink hover:underline transition-colors duration-200 ease-in-out">&larr; Back to all products</NuxtLink>
        </div>
      </div>

      <!-- Tabs Section - Moved to be a direct child of the main product content wrapper, after the image/details grid -->
      <div v-if="product && !pending && !fetchError" class="mt-10 lg:mt-16 bg-neutral-bg-soft p-4 sm:p-6 rounded-lg shadow">
        <div class="border-b border-gray-300">
          <nav class="-mb-px flex space-x-6 sm:space-x-8" aria-label="Tabs">
            <button v-for="tab in tabs" :key="tab.key" @click="selectTab(tab.key)"
              :class="[
                activeTab === tab.key
                  ? 'border-peach-pink text-peach-pink'
                  : 'border-transparent text-venus-text-secondary hover:text-peach-pink hover:border-gray-400',
                'whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm focus:outline-none transition-colors duration-200 ease-in-out'
              ]"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>
        <div class="mt-6 py-4" id="product-tabs-content">
          <div v-if="activeTab === 'description'">
            <h3 class="text-xl font-semibold text-venus-text-primary mb-3">Product Description</h3>
            <div class="prose prose-sm sm:prose max-w-none text-venus-text-secondary leading-relaxed" v-html="product.description"></div>
          </div>
          <div v-if="activeTab === 'specifications'">
            <h3 class="text-xl font-semibold text-venus-text-primary mb-3">Specifications</h3>
            <dl class="space-y-3 text-sm">
              <div v-if="product.category_name" class="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 items-baseline py-1 border-b border-neutral-light last:border-b-0">
                <dt class="font-medium text-venus-text-secondary sm:col-span-1">Category</dt>
                <dd class="text-venus-text-primary sm:col-span-2">{{ product.category_name }}</dd>
              </div>
              <div v-if="displaySku" class="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 items-baseline py-1 border-b border-neutral-light last:border-b-0">
                <dt class="font-medium text-venus-text-secondary sm:col-span-1">SKU</dt>
                <dd class="text-venus-text-primary sm:col-span-2">{{ displaySku }}</dd>
              </div>
              <div v-if="product.specifications && typeof product.specifications === 'object'">
                <template v-for="(value, key) in product.specifications" :key="key">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 items-baseline py-1 border-b border-neutral-light last:border-b-0">
                    <dt class="font-medium text-venus-text-secondary sm:col-span-1 capitalize">{{ key.replace(/_/g, ' ') }}</dt>
                    <dd class="text-venus-text-primary sm:col-span-2">{{ value }}</dd>
                  </div>
                </template>
              </div>
              <div v-if="!product.category_name && !displaySku && (!product.specifications || Object.keys(product.specifications).length === 0)"><p class="text-venus-text-secondary">Detailed specifications are not available.</p></div>
            </dl>
          </div>
          <div v-if="activeTab === 'reviews'">
            <h3 class="text-xl font-semibold text-venus-text-primary mb-4">Customer Reviews</h3>

            <div class="mb-8 p-4 border border-neutral-medium rounded-lg bg-white shadow-sm">
              <div v-if="!isLoggedIn" class="text-center py-3">
                <p class="text-venus-text-secondary">Please <NuxtLink to="/login" class="text-peach-pink hover:underline font-medium">login</NuxtLink> to write a review.</p>
              </div>
              <div v-else>
                <div v-if="isLoadingUserReview" class="text-center text-venus-text-secondary py-3"><p>Loading your review status...</p><div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-peach-pink mt-2"></div></div>
                <div v-else-if="userHasReviewed && userReview">
                  <h4 class="text-md font-semibold text-venus-text-primary mb-2">Your Review:</h4>
                  <div class="p-3 bg-neutral-bg-soft border border-neutral-medium rounded-md">
                    <div class="flex items-center mb-1"><span v-for="i in 5" :key="`user-review-star-${i}`" class="h-5 w-5" :class="i <= userReview.rating ? 'text-orange-gold' : 'text-gray-300'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></span></div>
                    <h5 v-if="userReview.title" class="text-md font-medium text-venus-text-primary">{{ userReview.title }}</h5>
                    <p class="text-sm text-venus-text-secondary mt-1 whitespace-pre-wrap">{{ userReview.comment }}</p>
                    <p class="text-xs text-gray-500 mt-2">Status: <span class="font-medium" :class="{'text-orange-gold': userReview.status === 'pending', 'text-fresh-green': userReview.status === 'approved', 'text-red-500': userReview.status === 'rejected'}">{{ userReview.status }}</span></p>
                  </div>
                </div>
                <div v-else-if="!showReviewForm" class="text-center py-3">
                  <button @click="openReviewForm" class="px-6 py-2 bg-fresh-green text-white font-medium rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-fresh-green transition-colors">Write a Review</button>
                </div>
                <div v-if="showReviewForm && !userHasReviewed">
                  <ReviewForm :product-id="product.id" @review-submitted-successfully="handleReviewSubmittedSuccessfully" />
                  <button @click="showReviewForm = false" class="mt-3 w-full text-center px-4 py-2 text-sm text-venus-text-secondary hover:bg-neutral-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-peach-pink">Cancel</button>
                </div>
              </div>
            </div>

            <div class="mt-8 pt-6 border-t border-gray-300" id="public-reviews-section">
              <h4 class="text-lg font-medium text-venus-text-primary mb-4">What Others Are Saying</h4>
              <div v-if="isLoadingPublicReviews" class="text-center py-6"><p class="text-venus-text-secondary">Loading reviews...</p><div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-peach-pink mt-2"></div></div>
              <div v-else-if="publicReviewsError" class="p-4 bg-red-100 text-red-600 border border-red-300 rounded-md text-sm shadow-sm"><p>Could not load reviews: {{ publicReviewsError }}</p></div>
              <div v-else-if="!productPublicReviews || productPublicReviews.length === 0" class="text-center py-6"><p class="text-venus-text-secondary">This product has no approved reviews yet.</p></div>
              <ul v-else class="space-y-6">
                <li v-for="review in productPublicReviews" :key="review.id" class="p-4 bg-white border border-neutral-medium rounded-lg shadow-sm">
                  <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-10 h-10 rounded-full bg-sky-blue/20 flex items-center justify-center text-sky-blue font-semibold text-lg">{{ review.user_name ? review.user_name.charAt(0).toUpperCase() : 'U' }}</div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between"><p class="text-sm font-semibold text-venus-text-primary">{{ review.user_name || 'Anonymous User' }}</p><p class="text-xs text-venus-text-secondary">{{ new Date(review.created_at).toLocaleDateString() }}</p></div>
                      <div class="flex items-center mt-1"><span v-for="i in 5" :key="`pub-star-${review.id}-${i}`" class="h-4 w-4" :class="getPublicReviewStarClass(review.rating, i)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></span></div>
                      <h5 v-if="review.title" class="mt-2 text-sm font-medium text-venus-text-primary">{{ review.title }}</h5>
                      <p class="mt-1 text-sm text-venus-text-secondary whitespace-pre-wrap leading-relaxed">{{ review.comment }}</p>
                    </div>
                  </div>
                </li>
              </ul>
              <div class="mt-8 flex justify-center items-center space-x-3" v-if="reviewPaginationData && reviewPaginationData.totalPages > 1">
                <button @click="currentPublicReviewsPage = reviewPaginationData.currentPage - 1" :disabled="reviewPaginationData.currentPage <= 1" class="px-4 py-2 border border-gray-300 text-sm font-medium text-venus-text-secondary hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-peach-pink">Previous</button>
                <span class="text-sm text-venus-text-secondary">Page {{ reviewPaginationData.currentPage }} of {{ reviewPaginationData.totalPages }}</span>
                <button @click="currentPublicReviewsPage = reviewPaginationData.currentPage + 1" :disabled="reviewPaginationData.currentPage >= reviewPaginationData.totalPages" class="px-4 py-2 border border-gray-300 text-sm font-medium text-venus-text-secondary hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-peach-pink">Next</button>
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
import { ref, onMounted, computed, watch, reactive, nextTick } from 'vue';
import { useRoute, useNuxtApp, useHead } from '#app';
import { useCart } from '~/composables/useCart';
import { useAuth } from '~/composables/useAuth';
import { useToast } from 'vue-toastification';
import ProductDetailSkeleton from '~/components/ProductDetailSkeleton.vue';
import ImageZoomModal from '~/components/ImageZoomModal.vue';
import ReviewForm from '~/components/reviews/ReviewForm.vue';

const { $axios } = useNuxtApp();
const route = useRoute();
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
const selectedImage = ref(null);

const displayPrice = ref(0);
const displaySku = ref('');
const displayStock = ref(0);
const addToCartDisabled = ref(true);

const quantity = ref(1);

const thumbnailContainer = ref(null);
const scrollStep = 200;

const isPrevDisabled = computed(() => thumbnailContainer.value && thumbnailContainer.value.scrollLeft <= 0);
const isNextDisabled = computed(() => {
  if (!thumbnailContainer.value) return true;
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

const productPublicReviews = ref([]);
const reviewPaginationData = ref({ currentPage: 1, totalPages: 1, totalItems: 0, pageSize: 5 });
const isLoadingPublicReviews = ref(false);
const publicReviewsError = ref(null);
const currentPublicReviewsPage = ref(1);

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

const isColorOption = (optionName) => {
  return optionName?.toLowerCase() === 'color';
};

const getSelectedValueName = (optionType, selectedValueId) => {
  if (!optionType || !optionType.values || !selectedValueId) return '';
  const selectedValue = optionType.values.find(v => v.value_id === selectedValueId);
  return selectedValue ? selectedValue.value_name : '';
};

function variantMatchesSelection(variant, selectionsToMatch) {
  if (!variant || !variant.option_value_ids) return false;
  const selectionValueIds = Object.values(selectionsToMatch);
  if (selectionValueIds.length === 0 && Object.keys(selectionsToMatch).length > 0) {
    return Object.keys(selectionsToMatch).length === 0;
  }
  if (selectionValueIds.length === 0) return true;
  return selectionValueIds.every(selectedValueId => variant.option_value_ids.includes(selectedValueId));
}

const getAvailableValuesForOption = (optionToFilter, currentSelectionsForOtherTypes) => {
  const detailedOptionValues = [];
  if (!product.value || !product.value.variants || !optionToFilter || !optionToFilter.values) {
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
          break;
        }
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
        // Check if the currently selected value for optId is still potentially available
        const isStillAvailable = availableValsForThisOpt.find(
            val => val.value_id === selectedOptions[optId] && val.isPotentiallyAvailable
        );
        if (!isStillAvailable && selectedOptions[optId] !== undefined) { // Ensure selectedOptions[optId] actually exists before trying to delete
          // Temporarily commenting out auto-deselection to diagnose "Combination unavailable"
          // delete selectedOptions[optId];
          // console.log(`Auto-deselected ${optType.option_name} because value ${selectedOptions[optId]} is no longer available with current other selections.`);
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
    if (matchedVariant.image_url) {
        const existingGalleryImage = galleryImages.value.find(img => img.url === matchedVariant.image_url);
        if (existingGalleryImage) {
            selectedImage.value = existingGalleryImage;
        } else {
            selectedImage.value = { url: matchedVariant.image_url, alt_text: currentVariant.value.sku || product.value.name, id: 'variant_' + currentVariant.value.id };
        }
    } else if (galleryImages.value.length > 0) {
        selectedImage.value = galleryImages.value[0];
    } else if (product.value.image_url) {
        selectedImage.value = { url: product.value.image_url, alt_text: product.value.name, id: 'product_primary_' + product.value.id };
    } else {
        selectedImage.value = null;
    }
    addToCartDisabled.value = matchedVariant.stock_quantity <= 0;
  } else {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = 0;
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

const productId = route.params.id;
const { data: productData, pending, error: fetchError, refresh } = await useAsyncData(
  `product-${productId}`,
  async () => {
    try {
      const response = await $axios.get(`/products/${productId}`);
      return response.data;
    } catch (err) {
      console.error(`Failed to fetch product ${productId}:`, err);
      const statusCode = err.response?.status || 500;
      const message = err.response?.data?.message || err.message || "Unknown error occurred";
      throw createError({ statusCode, statusMessage: message, fatal: false });
    }
  },
  {
    watch: [() => route.params.id]
  }
);

const product = ref(null);

watch(productData, (newProductData) => {
  if (newProductData) {
    product.value = newProductData;
    galleryImages.value = newProductData.gallery_images || [];
    if (galleryImages.value.length > 0) {
      selectedImage.value = galleryImages.value[0];
    } else if (newProductData.image_url) {
      selectedImage.value = { url: newProductData.image_url, alt_text: newProductData.name, id: 'product_primary_' + newProductData.id };
    } else {
      selectedImage.value = null;
    }
    initializeSelections();
    userHasReviewed.value = false;
    userReview.value = null;
    showReviewForm.value = false;
    productPublicReviews.value = [];
    currentPublicReviewsPage.value = 1;
    if (process.client) {
        checkUserReviewStatus();
        if (activeTab.value === 'reviews') {
            fetchPublicProductReviews(1);
        }
    }
  } else if (fetchError.value) {
    product.value = null;
    if (fetchError.value.statusMessage && process.client) {
        toast.error(fetchError.value.statusMessage || "Failed to load product.");
    }
  }
}, { immediate: true });

const handleAddToCart = () => {
  if (!product.value) {
    toast.error("Product data is not available. Please try again.");
    return;
  }
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
      tax_class_id: product.value.tax_class_id || null,
      tax_class_name: product.value.tax_class_name || null,
    };
  } else {
    cartItemData = {
      id: product.value.id, product_id: product.value.id, variant_id: null,
      name: product.value.name, price: parseFloat(product.value.price), sku: product.value.sku,
      image_url: selectedImage.value?.url || product.value.image_url, type: 'product',
      tax_class_id: product.value.tax_class_id || null,
      tax_class_name: product.value.tax_class_name || null,
    };
  }
  addToCart(cartItemData, quantity.value);
};

watch(product, (newProductValue) => {
  if (newProductValue && newProductValue.id) {
    if (process.client) {
        checkUserReviewStatus();
        productPublicReviews.value = [];
        currentPublicReviewsPage.value = 1;
        if (activeTab.value === 'reviews') {
            fetchPublicProductReviews(1);
        }
    }
  }
}, { deep: true });

watchEffect(() => {
  if (process.client) {
    if (product.value?.id) {
      checkUserReviewStatus();
    }
  }
});

watch(activeTab, (newTab) => {
  if (newTab === 'reviews' && product.value?.id &&
      (!productPublicReviews.value || productPublicReviews.value.length === 0) &&
      !isLoadingPublicReviews.value && !publicReviewsError.value) {
    if (process.client) {
        fetchPublicProductReviews(currentPublicReviewsPage.value);
    }
  }
});

watch(currentPublicReviewsPage, (newPage, oldPage) => {
    if (newPage !== oldPage && activeTab.value === 'reviews' && product.value?.id) {
        if (process.client) {
            fetchPublicProductReviews(newPage);
        }
    }
});

async function checkUserReviewStatus() {
  const loggedIn = (typeof isLoggedIn?.value === 'boolean') ? isLoggedIn.value : false;
  const currentProductId = product.value?.id;
  if (!loggedIn || !currentProductId) {
    userHasReviewed.value = false;
    userReview.value = null;
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

async function fetchPublicProductReviews(page = 1) {
  if (!product.value || !product.value.id) {
    productPublicReviews.value = [];
    return;
  }
  isLoadingPublicReviews.value = true;
  publicReviewsError.value = null;
  try {
    const response = await $axios.get(`/products/${product.value.id}/reviews`, {
      params: {
        page: page,
        limit: reviewPaginationData.value.pageSize || 5,
      },
    });
    productPublicReviews.value = response.data.reviews || [];
    if (response.data.pagination) {
      reviewPaginationData.value = {
        currentPage: response.data.pagination.currentPage,
        totalPages: response.data.pagination.totalPages,
        totalItems: response.data.pagination.totalItems,
        pageSize: response.data.pagination.pageSize,
      };
    }
  } catch (error) {
    console.error('Error fetching public reviews:', error);
    publicReviewsError.value = error.response?.data?.message || error.message || 'Could not load reviews.';
    productPublicReviews.value = [];
  } finally {
    isLoadingPublicReviews.value = false;
  }
}

useHead({
  title: computed(() => product.value ? product.value.name : 'Product Details'),
});
</script>

[end of frontend/pages/products/[id].vue]

[end of frontend/pages/products/[id].vue]

[end of frontend/pages/products/[id].vue]

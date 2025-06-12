<template>
  <div>
    <ProductDetailSkeleton v-if="pending" />
    <div v-else-if="fetchError" class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <h2 class="text-2xl font-semibold text-red-600 mb-4">Error Loading Product</h2>
      <p class="text-gray-600 mb-2">{{ fetchError.message || fetchError }}</p>
      <p v-if="fetchError.response && fetchError.response.status === 404" class="text-gray-600 mb-6">
        The product you are looking for does not exist.
      </p>
      <NuxtLink to="/">Go back to Home</NuxtLink>
    </div>

    <div v-if="product && !pending && !fetchError" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="md:grid md:grid-cols-5 lg:grid-cols-2 gap-8 lg:gap-12">
        <!-- Image Column -->
        <div class="md:col-span-3 lg:col-span-1">
          <img
            @click="openZoomModal(selectedImageUrl)"
          v-if="selectedImageUrl"
          :src="selectedImageUrl"
          :alt="`Image of ${product.name}`"
          class="w-full h-auto object-contain rounded-lg shadow-lg max-h-[550px] aspect-[4/5] cursor-zoom-in"
          key="selected-image"
        />
        <div v-if="!selectedImageUrl" class="w-full h-[400px] md:h-[550px] flex items-center justify-center bg-neutral-medium rounded-lg text-text-secondary">No Image Available</div>

        <!-- Thumbnail Gallery -->
        <div v-if="galleryImages.length > 1" class="mt-4 flex space-x-2 sm:space-x-3 overflow-x-auto py-2 px-1 justify-center">
          <img
            v-for="imageItem in galleryImages"
            :key="imageItem.id"
            :src="imageItem.url"
            @click="selectedImageUrl = imageItem.url"
            :alt="`${product.name} thumbnail ${imageItem.id}`"
            class="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-md border-2 cursor-pointer transition-all duration-200 ease-in-out hover:border-gray-400"
            :class="selectedImageUrl === imageItem.url ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-1' : 'border-transparent'"
          />
        </div>
      </div>

      <!-- Details Column -->
      <div class="md:col-span-2 lg:col-span-1 py-4 md:py-0">
        <h1 class="text-3xl font-bold text-text-primary mb-2">{{ product.name }}</h1>
        <p v-if="currentVariant && currentVariant.sku" class="text-sm text-text-secondary mb-4">SKU: {{ currentVariant.sku }}</p>
        <p v-else-if="!currentVariant && product.sku" class="text-sm text-text-secondary mb-4">SKU: {{ product.sku }}</p>

        <p class="text-text-secondary leading-relaxed mb-6">{{ product.description }}</p>

        <p class="text-3xl font-bold text-brand-primary mb-6">${{ displayPrice.toFixed(2) }}</p>

        <p v-if="product.category_name" class="text-sm text-text-secondary mb-2">
          Category: <span class="font-medium text-text-primary">{{ product.category_name }}</span>
        </p>
        <div v-if="product.tags && product.tags.length > 0" class="mb-6">
          <span v-for="tag in product.tags" :key="tag" class="inline-block bg-neutral-medium text-text-secondary text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">
            {{ tag }}
          </span>
        </div>

        <!-- Product Options Selection (New Structure) -->
        <div v-if="product.has_variants && product.available_options && product.available_options.length > 0" class="space-y-4 mb-6">
          <div v-for="option_type in product.available_options" :key="option_type.option_id">
            <label :for="`option-${option_type.option_id}`" class="block text-sm font-medium text-gray-700 mb-1">
              {{ option_type.option_name }}:
              <span v-if="selectedOptions[option_type.option_id]" class="text-sm text-gray-500 ml-1">
                ({{ getSelectedValueName(option_type, selectedOptions[option_type.option_id]) }})
              </span>
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="value_obj in option_type.values"
                :key="value_obj.value_id"
                @click="selectOption(option_type.option_id, value_obj.value_id)"
                type="button"
                :class="[
                  'px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150',
                  selectedOptions[option_type.option_id] === value_obj.value_id
                    ? 'bg-indigo-600 text-white border-indigo-600 ring-indigo-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                ]"
              >
                <span v-if="option_type.option_name.toLowerCase() === 'color'" class="flex items-center">
                  <span
                    class="w-4 h-4 rounded-full inline-block mr-2 border border-gray-400"
                    :style="{ backgroundColor: value_obj.value_name.toLowerCase() }"
                    :title="value_obj.value_name"
                  ></span>
                  {{ value_obj.value_name }}
                </span>
                <span v-else>
                  {{ value_obj.value_name }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Message for variant availability based on selection -->
        <div v-if="product.has_variants && product.available_options && product.available_options.length > 0 && !currentVariant && Object.keys(selectedOptions).length === product.available_options.length"
             class="my-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">
          Selected combination is unavailable. Please try different options.
        </div>

        <div
          class="my-4 p-3 rounded-md text-sm font-medium"
          :class="{
            'bg-green-100 text-green-700 border border-green-200': displayStock > 5,
            'bg-yellow-100 text-yellow-700 border border-yellow-200': displayStock > 0 && displayStock <= 5,
            'bg-red-100 text-red-700 border border-red-200': displayStock <= 0
          }"
        >
          {{ stockStatusMessage }}
        </div>

        <div class="flex items-center gap-4 my-6">
          <input
            type="number"
            v-model.number="quantity"
            min="1"
            :max="displayStock > 0 ? displayStock : 1"
            :disabled="addToCartDisabled"
            class="w-20 p-2 border border-neutral-medium rounded-md text-center focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
          />
          <button
            @click="handleAddToCart"
            class="flex-grow bg-brand-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-80 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="addToCartDisabled"
          >
            {{ (displayStock <= 0 ? 'Out of Stock' : 'Add to Cart') }}
          </button>
        </div>
        <!-- Removed addToCartError display div -->

        <NuxtLink to="/" class="inline-block mt-6 text-brand-primary hover:underline">
          &larr; Back to all products
        </NuxtLink>
      </div>
    </div>

    <!-- Tabs Section -->
    <div v-if="product && !pending && !fetchError" class="mt-12">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="selectTab(tab.key)"
            :class="[
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none'
            ]"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>
      <div class="mt-8">
        <div v-if="activeTab === 'description'">
          <h3 class="text-xl font-semibold text-gray-800 mb-4">Product Description</h3>
          <div class="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none text-gray-700 leading-relaxed" v-html="product.description"></div>
        </div>
        <div v-if="activeTab === 'specifications'">
          <h3 class="text-xl font-semibold text-gray-800 mb-4">Specifications</h3>
          <!-- Example: Displaying category and SKU as specs -->
          <dl class="space-y-4">
            <div v-if="product.category_name">
              <dt class="text-sm font-medium text-gray-500">Category</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ product.category_name }}</dd>
            </div>
            <div v-if="displaySku">
              <dt class="text-sm font-medium text-gray-500">SKU</dt>
              <dd class="mt-1 text-sm text-gray-900">{{ displaySku }}</dd>
            </div>
            <!-- Add more structured specs here if available from product data -->
            <div v-if="!product.category_name && !displaySku">
                 <p class="text-gray-600">Detailed specifications are not available for this product. Please refer to the product description.</p>
            </div>
          </dl>
        </div>
        <div v-if="activeTab === 'reviews'">
          <h3 class="text-xl font-semibold text-gray-800 mb-4">Customer Reviews</h3>

          <!-- Review Submission Section -->
          <div class="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div v-if="!isLoggedIn" class="text-center">
              <p class="text-gray-700">Please <NuxtLink to="/login" class="text-indigo-600 hover:underline font-medium">login</NuxtLink> to write a review.</p>
            </div>
            <div v-else>
              <div v-if="isLoadingUserReview" class="text-center text-gray-600">
                <p>Loading your review status...</p>
                <div class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mt-2"></div>
              </div>
              <div v-else-if="userHasReviewed && userReview">
                <h4 class="text-md font-semibold text-gray-800 mb-2">Your Review:</h4>
                <div class="p-3 bg-white border border-gray-200 rounded-md">
                  <div class="flex items-center mb-1">
                    <span v-for="i in 5" :key="`user-review-star-${i}`" class="h-5 w-5" :class="i <= userReview.rating ? 'text-yellow-400' : 'text-gray-300'">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </span>
                  </div>
                  <h5 v-if="userReview.title" class="text-md font-medium text-gray-700">{{ userReview.title }}</h5>
                  <p class="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{{ userReview.comment }}</p>
                  <p class="text-xs text-gray-400 mt-2">Status: <span class="font-medium" :class="{'text-yellow-500': userReview.status === 'pending', 'text-green-500': userReview.status === 'approved', 'text-red-500': userReview.status === 'rejected'}">{{ userReview.status }}</span></p>
                  <!-- TODO: Add "Edit your review" button if status is pending or if editing is allowed -->
                </div>
              </div>
              <div v-else-if="!showReviewForm" class="text-center">
                <button
                  @click="showReviewForm = true"
                  class="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
                >
                  Write a Review
                </button>
              </div>
              <div v-if="showReviewForm && !userHasReviewed">
                <ReviewForm :product-id="product.id" @review-submitted-successfully="handleReviewSubmittedSuccessfully" />
                <button
                  @click="showReviewForm = false"
                  class="mt-2 w-full text-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <!-- Existing Public Reviews List (Placeholder) -->
          <p class="text-gray-600 mt-6">No public customer reviews yet for this product. Be the first to review if you've purchased it!</p>
          <!-- Placeholder for review list (to be implemented in Step 4) -->

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useNuxtApp } from '#app';
import { useCart } from '~/composables/useCart';
import { useAuth } from '~/composables/useAuth'; // Import useAuth
import { useToast } from 'vue-toastification';
import ProductDetailSkeleton from '~/components/ProductDetailSkeleton.vue';
import ImageZoomModal from '~/components/ImageZoomModal.vue';
import ReviewForm from '~/components/reviews/ReviewForm.vue'; // Import ReviewForm

const { $axios } = useNuxtApp();
const route = useRoute();
const product = ref(null);
const pending = ref(true);
const fetchError = ref(null);
const toast = useToast();

const { addToCart } = useCart();
const { isLoggedIn, user } = useAuth(); // Auth state

// Review specific state
const showReviewForm = ref(false);
const userHasReviewed = ref(false);
const userReview = ref(null); // To store the user's existing review
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
const selectedImageUrl = ref('');

const displayPrice = ref(0);
const displaySku = ref('');
const displayStock = ref(0);
const addToCartDisabled = ref(true);

const quantity = ref(1);
// itemAdded ref removed
// addToCartError ref removed

// --- Computed properties for dynamic display based on selection ---
const stockStatusMessage = computed(() => {
  if (!product.value && !currentVariant.value) return 'Loading...';
  const stock = displayStock.value;
  if (stock <= 0) return 'Out of Stock';
  if (stock > 0 && stock <= 5) return `Only ${stock} left!`;
  return 'In Stock';
});

// stockStatusClass computed property remains the same

// --- Functions ---

// Helper to get selected value name for display next to option label
const getSelectedValueName = (optionType, selectedValueId) => {
  if (!optionType || !optionType.values || !selectedValueId) return '';
  const selectedValue = optionType.values.find(v => v.value_id === selectedValueId);
  return selectedValue ? selectedValue.value_name : '';
};

function initializeSelections() {
  if (!product.value || !product.value.has_variants || !product.value.available_options || product.value.available_options.length === 0) {
    // Clear any selections if product has no variants or no options to select from
    for (const key in selectedOptions) {
        delete selectedOptions[key];
    }
    updateCurrentVariant();
    return;
  }

  const tempSelectedOptions = {};
  let allOptionsHaveDefault = true;
  for (const optionType of product.value.available_options) {
    if (optionType.values && optionType.values.length > 0) {
      tempSelectedOptions[optionType.option_id] = optionType.values[0].value_id;
    } else {
      allOptionsHaveDefault = false; // This option type has no values to pick a default from
      break;
    }
  }

  if (allOptionsHaveDefault && Object.keys(tempSelectedOptions).length === product.value.available_options.length) {
    const selectedValuesArray = Object.values(tempSelectedOptions).sort((a, b) => a - b);
    const defaultMatchedVariant = product.value.variants.find(variant => {
      if (!variant.option_value_ids || variant.option_value_ids.length !== selectedValuesArray.length) {
        return false;
      }
      const sortedVariantValues = [...variant.option_value_ids].sort((a, b) => a - b);
      return JSON.stringify(sortedVariantValues) === JSON.stringify(selectedValuesArray);
    });

    if (defaultMatchedVariant && defaultMatchedVariant.stock_quantity > 0) {
      // A valid, in-stock default variant is found. Apply these selections.
      for (const key in tempSelectedOptions) {
        selectedOptions[key] = tempSelectedOptions[key];
      }
    } else {
      // No valid, in-stock default variant found with the "all first" strategy.
      // Clear any selections to force user interaction.
      for (const key in selectedOptions) {
          delete selectedOptions[key];
      }
    }
  } else {
    // Not all options could be defaulted (e.g., an option type had no values)
    // Clear any selections to force user interaction.
     for (const key in selectedOptions) {
        delete selectedOptions[key];
    }
  }
  updateCurrentVariant();
}

function selectOption(optionId, valueId) {
  selectedOptions[optionId] = valueId;
  updateCurrentVariant();
}

function updateCurrentVariant() {
  if (!product.value) return;

  // If product has no variants, display base product info
  if (!product.value.has_variants || !product.value.variants || product.value.variants.length === 0) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = product.value.stock_quantity;
    selectedImageUrl.value = product.value.image_url || galleryImages.value[0]?.url || '';
    addToCartDisabled.value = product.value.stock_quantity <= 0;
    quantity.value = 1;
    return;
  }

  // If not all options are selected, variant cannot be determined.
  // Reset to base product price/image, indicate out of stock or prompt selection.
  const numAvailableOptionTypes = product.value.available_options?.length || 0;
  const numSelectedOptions = Object.keys(selectedOptions).length;

  if (numSelectedOptions < numAvailableOptionTypes) {
    currentVariant.value = null; // No specific variant is fully selected
    displayPrice.value = parseFloat(product.value.price); // Show base price or a range, or nothing
    displaySku.value = product.value.sku || ''; // Show base SKU or nothing
    // Keep selectedImageUrl as is, or reset to base product image.
    // For now, let it be what the user last clicked or the default.
    // selectedImageUrl.value = product.value.image_url || galleryImages.value[0]?.url || '';
    displayStock.value = 0; // Indicate that a specific variant's stock is not determined
    addToCartDisabled.value = true; // Cannot add to cart until a full variant is selected
    return;
  }

  // All option types have a selection, try to find a matching variant
  const selectedValuesArray = Object.values(selectedOptions).sort((a, b) => a - b);

  const matchedVariant = product.value.variants.find(variant => {
    if (!variant.option_value_ids || variant.option_value_ids.length !== selectedValuesArray.length) {
      return false;
    }
    // Ensure variant.option_value_ids is also sorted for consistent comparison
    const sortedVariantValues = [...variant.option_value_ids].sort((a, b) => a - b);
    return JSON.stringify(sortedVariantValues) === JSON.stringify(selectedValuesArray);
  });

  if (matchedVariant) {
    currentVariant.value = matchedVariant;
    // final_price is already calculated and attached to variant object from backend/service
    displayPrice.value = parseFloat(matchedVariant.final_price);
    displaySku.value = matchedVariant.sku || product.value.sku || ''; // Prefer variant SKU
    displayStock.value = matchedVariant.stock_quantity;
    // Update main image to variant image if available, else fallback to base product image or first gallery
    selectedImageUrl.value = matchedVariant.image_url || product.value.image_url || galleryImages.value[0]?.url || '';
    addToCartDisabled.value = matchedVariant.stock_quantity <= 0;
  } else {
    // A full combination is selected, but no variant matches
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price); // Or indicate "Unavailable"
    displaySku.value = product.value.sku || '';
    displayStock.value = 0; // Indicate this combination is not available/out of stock
    // selectedImageUrl.value = product.value.image_url || galleryImages.value[0]?.url || ''; // Revert to base image
    addToCartDisabled.value = true;
  }
  quantity.value = 1;
}


async function fetchProduct() {
  const productId = route.params.id;
  pending.value = true;
  fetchError.value = null;
  try {
    const response = await $axios.get(`/products/${productId}`);
    product.value = response.data;
    if (product.value) {
      initializeSelections();

      const imageUrls = new Set();
      if (product.value.image_url) {
        imageUrls.add(product.value.image_url);
      }
      if (product.value.variants && Array.isArray(product.value.variants)) {
        product.value.variants.forEach(variant => {
          if (variant.image_url) {
            imageUrls.add(variant.image_url);
          }
        });
      }
      galleryImages.value = Array.from(imageUrls).map((url, index) => ({ id: `gallery_img_${index}`, url }));

      if (currentVariant.value && currentVariant.value.image_url) {
          selectedImageUrl.value = currentVariant.value.image_url;
      } else if (product.value.image_url) {
          selectedImageUrl.value = product.value.image_url;
      } else if (galleryImages.value.length > 0) {
          selectedImageUrl.value = galleryImages.value[0].url;
      } else {
          selectedImageUrl.value = '';
      }

    } else {
      fetchError.value = { message: "Product data is invalid." };
    }
  } catch (err) {
    console.error(`Failed to fetch product ${productId}:`, err);
    fetchError.value = err.response?.data || err;
  } finally {
    pending.value = false;
  }
}

const handleAddToCart = () => {
  const stockAvailable = displayStock.value;

  if (product.value.has_variants && !currentVariant.value) {
    toast.error("Please select all product options to choose a variant.");
    return;
  }
  if (addToCartDisabled.value || stockAvailable <= 0) { // Check against addToCartDisabled or explicit stock
    toast.error("This item is out of stock or unavailable.");
    return;
  }
  if (quantity.value <= 0) {
    toast.error("Please enter a valid quantity.");
    return;
  }
  if (quantity.value > stockAvailable) {
    toast.error(`Cannot add ${quantity.value} items. Only ${stockAvailable} left in stock.`);
    return;
  }

  let cartItemData;

  if (currentVariant.value) {
    // Construct name from selected options for the variant
    // currentVariant.value.selected_options should be available from the backend response for variants
    // If not, we reconstruct it from selectedOptions and available_options
    let variantOptionString = "";
    if (currentVariant.value.selected_options && currentVariant.value.selected_options.length > 0) {
         variantOptionString = currentVariant.value.selected_options
            .map(opt => `${opt.option_name}: ${opt.value_name}`) // Assuming this structure from backend
            .join(', ');
    } else { // Fallback if selected_options not directly on variant, reconstruct
        const parts = [];
        if (product.value.available_options) {
            for (const optionType of product.value.available_options) {
                const selectedValueId = selectedOptions[optionType.option_id];
                if (selectedValueId) {
                    const valueObj = optionType.values.find(v => v.value_id === selectedValueId);
                    if (valueObj) {
                        parts.push(valueObj.value_name); // Simpler: "Red, Large"
                    }
                }
            }
        }
        variantOptionString = parts.join(', ');
    }

    cartItemData = {
      id: currentVariant.value.id, // Use variant_id as the unique ID for this cart line item
      product_id: product.value.id, // Base product ID
      variant_id: currentVariant.value.id, // Explicit variant ID
      name: `${product.value.name}${variantOptionString ? ` - ${variantOptionString}` : ''}`,
      price: parseFloat(currentVariant.value.final_price),
      sku: currentVariant.value.sku || product.value.sku, // Prefer variant SKU
      image_url: selectedImageUrl.value, // This should reflect the variant image
      type: 'variant',
    };
  } else {
    // Base product without variants, or product where variants exist but none are selected (should be prevented by addToCartDisabled)
    cartItemData = {
      id: product.value.id, // Use product_id as the unique ID
      product_id: product.value.id,
      variant_id: null,
      name: product.value.name,
      price: parseFloat(product.value.price),
      sku: product.value.sku,
      image_url: selectedImageUrl.value, // Base product image
      type: 'product',
    };
  }

  addToCart(cartItemData, quantity.value);
  // Toast for successful add is handled by useCart.js
};

onMounted(fetchProduct);

watch(product, (newProductData) => {
    if(newProductData) {
        initializeSelections();
    }
}, { deep: true });

useHead({
  title: computed(() => product.value ? product.value.name : 'Product Details'),
});

async function checkUserReviewStatus() {
  if (!isLoggedIn.value || !product.value?.id) {
    userHasReviewed.value = false;
    userReview.value = null;
    // Decide initial state of showReviewForm based on if user can write one
    showReviewForm.value = isLoggedIn.value && !userHasReviewed.value;
    return;
  }
  isLoadingUserReview.value = true;
  try {
    // This API endpoint GET /api/products/:productId/reviews/my-review needs to be created in Step 3
    // For now, we simulate its behavior or handle expected errors.
    const response = await $axios.get(`/api/products/${product.value.id}/reviews/my-review`);
    if (response.data && response.data.id) { // Assuming review object has an id
      userReview.value = response.data;
      userHasReviewed.value = true;
      showReviewForm.value = false; // User has reviewed, so don't show form initially
    } else { // No review found for this user and product (e.g. API returns 200 with empty or specific structure)
      userReview.value = null;
      userHasReviewed.value = false;
      showReviewForm.value = false; // Keep form hidden, user can click "Write a review"
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // 404 means user hasn't reviewed this product yet
      userReview.value = null;
      userHasReviewed.value = false;
      showReviewForm.value = false; // Keep form hidden
    } else {
      console.error('Error checking user review status:', error);
      // Don't show form if there was an error checking status, could be misleading
      showReviewForm.value = false;
      // Optionally, inform user about the error checking review status
      // toast.error("Could not check your review status for this product.");
    }
  } finally {
    isLoadingUserReview.value = false;
  }
}

function handleReviewSubmittedSuccessfully() {
  toast.info("Your review has been submitted and is pending approval."); // General info, form itself gives detailed success
  userHasReviewed.value = true; // Assume it will be approved, or API for my-review should return pending one
  showReviewForm.value = false;
  checkUserReviewStatus(); // Re-fetch the user's review to display it (if it's returned immediately even if pending)
  // Potentially, also refresh the main list of reviews if displayed in another tab:
  // For example, if a composable manages public reviews: fetchPublicReviews(product.value.id);
}

watch(product, (newProduct) => {
  if (newProduct && newProduct.id) {
    initializeSelections(); // Existing function
    checkUserReviewStatus(); // Check review status when product loads/changes
  }
}, { deep: true, immediate: true }); // immediate might be too soon if product not fetched. fetchProduct calls initialize.

watch(isLoggedIn, (newValue) => {
  checkUserReviewStatus(); // Re-check when login status changes
});

</script>

<!-- <style scoped> block removed as Tailwind is used -->

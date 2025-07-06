<template>
  <Modal :is-open="isOpen" :title="modalTitle" @close="closeModal" :close-on-overlay-click="true">
    <div v-if="isLoading" class="p-6 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-peach-pink my-4"></div>
      <p class="text-venus-text-secondary">Loading product details...</p>
    </div>
    <div v-else-if="error" class="p-6 text-center">
      <p class="text-red-500">Error loading product: {{ error.message || 'Please try again.' }}</p>
      <button @click="closeModal" class="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Close</button>
    </div>
    <div v-else-if="detailedProduct" class="quick-view-content">
      <div class="md:grid md:grid-cols-2 md:gap-6">
        <!-- Image Column -->
        <div class="mb-4 md:mb-0">
          <img
            v-if="selectedImage && selectedImage.url"
            :src="selectedImage.url"
            :alt="selectedImage.alt_text || detailedProduct.name"
            class="w-full h-auto object-contain rounded-lg shadow-sm max-h-[300px] md:max-h-[350px] border border-neutral-bg-soft"
          />
          <div v-else class="w-full h-[300px] md:h-[350px] flex items-center justify-center bg-neutral-bg-soft rounded-lg text-venus-text-secondary">
            No Image Available
          </div>
          <!-- Thumbnails (simplified for quick view, optional) -->
           <div v-if="galleryImages.length > 1" class="mt-2 flex space-x-2 overflow-x-auto py-1 no-scrollbar justify-center">
              <img
                v-for="imageItem in galleryImages.slice(0, 4)"
                :key="imageItem.id"
                :src="imageItem.url"
                @click="selectedImage = { ...imageItem }"
                :alt="imageItem.alt_text || detailedProduct.name + ' thumbnail'"
                class="h-12 w-12 sm:h-14 sm:w-14 object-cover rounded-md border cursor-pointer transition-all duration-150 ease-in-out hover:shadow-sm"
                :class="selectedImage?.url === imageItem.url ? 'border-orange-gold ring-1 ring-orange-gold/50' : 'border-neutral-bg-soft hover:border-sky-blue/70'"
              />
            </div>
        </div>

        <!-- Details Column -->
        <div class="flex flex-col">
          <h2 class="text-2xl font-semibold text-venus-text-primary mb-2">{{ detailedProduct.name }}</h2>
          <p v-if="displaySku || detailedProduct.sku" class="text-xs text-venus-text-secondary mb-2">SKU: {{ displaySku || (detailedProduct.sku || 'N/A') }}</p>

          <p class="text-2xl font-semibold text-orange-gold mb-3">
            ${{ displayPrice.toFixed(2) }}
            <span v-if="isCurrentProductOnSaleQuickView && currentRrpDisplayQuickView" class="text-md text-gray-400 line-through ml-1">
              ${{ currentRrpDisplayQuickView.toFixed(2) }}
            </span>
          </p>
          <div v-if="isCurrentProductOnSaleQuickView" class="mb-2">
            <span class="bg-orange-gold text-white text-xs font-bold px-2 py-0.5 rounded-sm">SALE</span>
          </div>

          <!-- Variant Options -->
          <div v-if="detailedProduct.has_variants && detailedProduct.available_options && detailedProduct.available_options.length > 0" class="space-y-3 mb-4">
            <div v-for="option_type in detailedProduct.available_options" :key="option_type.option_id">
              <label :for="`qv-option-${option_type.option_id}`" class="block text-sm font-medium text-venus-text-primary mb-1">
                {{ option_type.option_name }}:
                <span v-if="selectedOptions[option_type.option_id]" class="text-sm text-gray-500 ml-1">
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
                      'p-1 border flex items-center space-x-1.5 focus:outline-none focus:ring-1 focus:ring-offset-1 transition-all duration-150 rounded',
                      selectedOptions[option_type.option_id] === valueDetail.value_id
                        ? 'border-peach-pink ring-1 ring-peach-pink'
                        : !valueDetail.isPotentiallyAvailable
                          ? 'border-gray-300 opacity-40 cursor-not-allowed'
                          : valueDetail.anyResultingVariantInStock
                            ? 'border-gray-300 hover:border-sky-blue focus:ring-peach-pink'
                            : 'border-yellow-400 hover:border-yellow-500 focus:ring-peach-pink',
                       valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id ? 'bg-lemon-yellow/20' : ''
                    ]"
                    :title="valueDetail.isPotentiallyAvailable ? (valueDetail.anyResultingVariantInStock ? valueDetail.value_name : `${valueDetail.value_name} (Out of stock)`) : `${valueDetail.value_name} (Unavailable)`"
                  >
                    <span
                      class="w-5 h-5 rounded-sm border border-gray-400 inline-block relative"
                      :style="{ backgroundColor: valueDetail.value_name.toLowerCase() }"
                       :class="{ 'opacity-40': !valueDetail.isPotentiallyAvailable }"
                    >
                       <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id"
                            class="absolute inset-0 flex items-center justify-center text-orange-gold font-bold text-xs">!</span>
                    </span>
                    <span class="text-xs text-venus-text-secondary pr-0.5" :class="{ 'opacity-60 line-through': !valueDetail.isPotentiallyAvailable, 'text-orange-gold': valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id }">
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
                      'px-2.5 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-offset-1 transition-colors duration-150',
                      selectedOptions[option_type.option_id] === valueDetail.value_id
                        ? 'bg-sky-blue text-white border-sky-blue focus:ring-peach-pink'
                        : !valueDetail.isPotentiallyAvailable
                          ? 'bg-gray-100 text-gray-400 border-gray-300 opacity-75 cursor-not-allowed line-through'
                          : !valueDetail.anyResultingVariantInStock
                            ? 'bg-lemon-yellow/20 text-orange-gold border-yellow-400 hover:bg-lemon-yellow/40 focus:ring-peach-pink'
                            : 'bg-white text-venus-text-primary border-gray-300 hover:bg-gray-50 hover:border-sky-blue focus:ring-peach-pink'
                    ]"
                     :title="valueDetail.isPotentiallyAvailable ? (valueDetail.anyResultingVariantInStock ? valueDetail.value_name : `${valueDetail.value_name} (Out of stock)`) : `${valueDetail.value_name} (Unavailable)`"
                  >
                    {{ valueDetail.value_name }}
                     <span v-if="valueDetail.isPotentiallyAvailable && !valueDetail.anyResultingVariantInStock && selectedOptions[option_type.option_id] !== valueDetail.value_id" class="text-xs ml-1">(OOS)</span>
                  </button>
                </template>
              </div>
            </div>
          </div>
          <div v-if="detailedProduct.has_variants && detailedProduct.available_options && detailedProduct.available_options.length > 0 && !currentVariant && Object.keys(selectedOptions).length === detailedProduct.available_options.length" class="my-2 p-2 rounded text-red-700 bg-red-100 border border-red-200 text-xs">
            Selected combination is unavailable.
          </div>

          <div class="my-2 p-2 rounded text-xs font-medium" :class="{'bg-fresh-green/10 text-fresh-green border border-fresh-green/30': displayStock > 5, 'bg-lemon-yellow/20 text-orange-gold border border-orange-gold/30': displayStock > 0 && displayStock <= 5, 'bg-red-100 text-red-600 border border-red-300': displayStock <= 0}">
            {{ stockStatusMessage }}
          </div>

          <!-- Add to Cart and Quantity -->
          <div class="flex items-center gap-2 my-4">
            <input type="number" v-model.number="quantity" min="1" :max="displayStock > 0 ? displayStock : 1" :disabled="addToCartDisabled" class="w-16 p-2 border border-gray-300 rounded-md text-center text-sm focus:ring-1 focus:ring-peach-pink focus:border-peach-pink disabled:bg-gray-100" />
            <button @click="handleAddToCart" class="flex-grow bg-peach-pink text-white font-semibold py-2.5 px-4 rounded-md shadow hover:bg-opacity-90 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-peach-pink disabled:opacity-60 disabled:cursor-not-allowed" :disabled="addToCartDisabled">
              {{ (displayStock <= 0 ? 'Out of Stock' : 'Add to Cart') }}
            </button>
          </div>

          <NuxtLink :to="`/products/${detailedProduct.id}`" class="block text-center text-sm text-sky-blue hover:text-peach-pink hover:underline mt-auto pt-2">
            View Full Product Details &rarr;
          </NuxtLink>
        </div>
      </div>
    </div>
    <template #footer v-if="!isLoading && !error && detailedProduct">
      <div class="flex justify-end">
        <button @click="closeModal" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">Close</button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { useNuxtApp } from '#app';
import { useCart } from '~/composables/useCart';
import { useToast } from 'vue-toastification';
import Modal from '~/components/common/Modal.vue';

const props = defineProps({
  isOpen: Boolean,
  productSummary: { // Expecting a product summary object from the listing
    type: Object,
    default: null,
  },
  productId: { // Fallback if productSummary is not enough or not provided
    type: [String, Number],
    default: null,
  }
});

const emit = defineEmits(['close']);

const { $axios } = useNuxtApp();
const { addToCart } = useCart();
const toast = useToast();

const detailedProduct = ref(null);
const isLoading = ref(false);
const error = ref(null);

const quantity = ref(1);
const selectedOptions = reactive({});
const currentVariant = ref(null);
const galleryImages = ref([]);
const selectedImage = ref(null);

const displayPrice = ref(0);
const displaySku = ref('');
const displayStock = ref(0);
const addToCartDisabled = ref(true);

const modalTitle = computed(() => detailedProduct.value?.name || 'Quick View');

const stockStatusMessage = computed(() => {
  if (isLoading.value) return 'Loading...';
  if (!detailedProduct.value) return 'Product not available.';

  const stock = displayStock.value;
   if (detailedProduct.value.has_variants && Object.keys(selectedOptions).length < (detailedProduct.value.available_options?.length || 0) ) {
    return "Select options";
  }
  if (detailedProduct.value.has_variants && !currentVariant.value && Object.keys(selectedOptions).length === (detailedProduct.value.available_options?.length || 0) ) {
    return "Unavailable";
  }
  if (stock <= 0) return 'Out of Stock';
  if (stock > 0 && stock <= 5) return `Only ${stock} left!`;
  return `${stock} in stock`;
});

const isColorOption = (optionName) => optionName?.toLowerCase() === 'color';

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
  if (!detailedProduct.value || !detailedProduct.value.variants || !optionToFilter || !optionToFilter.values) {
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
    for (const variant of detailedProduct.value.variants) {
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
  if (detailedProduct.value && detailedProduct.value.has_variants && detailedProduct.value.available_options) {
    detailedProduct.value.available_options.forEach(optionType => {
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
  if (!detailedProduct.value || !detailedProduct.value.has_variants || !detailedProduct.value.available_options || detailedProduct.value.available_options.length === 0) {
    for (const key in selectedOptions) { delete selectedOptions[key]; }
    updateCurrentVariantUIData();
    return;
  }

  const tempSelectedOptions = {};
  let allOptionsHaveDefault = true;

  for (const optionType of detailedProduct.value.available_options) {
    if (optionType.values && optionType.values.length > 0) {
      // Try to pick the first *available* and *in-stock* value as default
      let foundDefault = false;
      const potentiallyAvailableValues = getAvailableValuesForOption(optionType, {}); // Check against no other selections initially
      for (const val of potentiallyAvailableValues) {
        if (val.isPotentiallyAvailable && val.anyResultingVariantInStock) {
          tempSelectedOptions[optionType.option_id] = val.value_id;
          foundDefault = true;
          break;
        }
      }
      if (!foundDefault && potentiallyAvailableValues.length > 0 && potentiallyAvailableValues[0].isPotentiallyAvailable) {
        // Fallback: pick the first potentially available if none are in stock
         tempSelectedOptions[optionType.option_id] = potentiallyAvailableValues[0].value_id;
      } else if (!foundDefault) {
        // Fallback: if no values are even potentially available initially, or no values at all
        // This case might mean the product structure is problematic or options lead to no variants
        // For now, we won't select anything for this option type.
        // tempSelectedOptions[optionType.option_id] = optionType.values[0].value_id; // Original less safe fallback
        allOptionsHaveDefault = false; // This option type couldn't get a good default
      }
    } else {
      allOptionsHaveDefault = false; break;
    }
  }

  if (allOptionsHaveDefault && Object.keys(tempSelectedOptions).length === detailedProduct.value.available_options.length) {
     const selectedValuesArray = Object.values(tempSelectedOptions).sort((a, b) => a - b);
     const defaultMatchedVariant = detailedProduct.value.variants.find(variant => {
        if (!variant.option_value_ids || variant.option_value_ids.length !== selectedValuesArray.length) return false;
        const sortedVariantValues = [...variant.option_value_ids].sort((a, b) => a - b);
        return JSON.stringify(sortedVariantValues) === JSON.stringify(selectedValuesArray);
    });

    if (defaultMatchedVariant && defaultMatchedVariant.stock_quantity > 0) {
      for (const key in tempSelectedOptions) { selectedOptions[key] = tempSelectedOptions[key]; }
    } else {
      // If the "best guess" default variant is out of stock or doesn't match, clear selections
      // to force user choice.
      for (const key in selectedOptions) { delete selectedOptions[key]; }
    }
  } else {
     // If not all options could get a default, clear all selections.
     for (const key in selectedOptions) { delete selectedOptions[key]; }
  }
  updateCurrentVariantUIData();
}

function selectOption(optionId, valueId) {
  if (selectedOptions[optionId] === valueId) {
    delete selectedOptions[optionId];
  } else {
    selectedOptions[optionId] = valueId;
  }

  // Auto-deselect conflicting/now-unavailable options
  if (detailedProduct.value && detailedProduct.value.has_variants && detailedProduct.value.available_options) {
    for (const optType of detailedProduct.value.available_options) {
      const optId = optType.option_id;
      if (optId === optionId) continue; // Skip the one just changed

      if (selectedOptions[optId]) {
        const otherSelsForThisCheck = { ...selectedOptions };
        delete otherSelsForThisCheck[optId]; // Create context as if this option (optId) is not yet selected

        const availableValsForThisOpt = getAvailableValuesForOption(optType, otherSelsForThisCheck);
        const isStillPotentiallyAvailable = availableValsForThisOpt.find(
            val => val.value_id === selectedOptions[optId] && val.isPotentiallyAvailable
        );

        if (!isStillPotentiallyAvailable) {
          delete selectedOptions[optId];
        }
      }
    }
  }
  updateCurrentVariantUIData();
}

function updateCurrentVariantUIData() {
  if (!detailedProduct.value) return;

  if (!detailedProduct.value.has_variants || !detailedProduct.value.variants || detailedProduct.value.variants.length === 0) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(detailedProduct.value.price);
    displaySku.value = detailedProduct.value.sku || '';
    displayStock.value = detailedProduct.value.stock_quantity;
    if (galleryImages.value.length > 0) {
        selectedImage.value = galleryImages.value.find(img => img.is_primary) || galleryImages.value[0];
         if(selectedImage.value) selectedImage.value = {...selectedImage.value};
    } else if (detailedProduct.value.image_url) {
        selectedImage.value = { url: detailedProduct.value.image_url, alt_text: detailedProduct.value.name, id: 'prod_primary_qv_' + detailedProduct.value.id, is_primary: true };
    } else {
        selectedImage.value = null;
    }
    addToCartDisabled.value = detailedProduct.value.stock_quantity <= 0;
    quantity.value = 1;
    return;
  }

  const numAvailableOptionTypes = detailedProduct.value.available_options?.length || 0;
  const numSelectedOptions = Object.keys(selectedOptions).length;

  if (numSelectedOptions < numAvailableOptionTypes) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(detailedProduct.value.price); // Base product price
    displaySku.value = detailedProduct.value.sku || ''; // Base product SKU
    displayStock.value = 0; // Undetermined stock
    addToCartDisabled.value = true;
    let productPrimaryImage = galleryImages.value.find(img => img.is_primary) || galleryImages.value[0];
    if (!productPrimaryImage && detailedProduct.value.image_url) {
        productPrimaryImage = { url: detailedProduct.value.image_url, alt_text: detailedProduct.value.name, id: 'prod_primary_qv_incomplete_' + detailedProduct.value.id, is_primary: true };
    }
    selectedImage.value = productPrimaryImage ? { ...productPrimaryImage } : null;
    return;
  }

  const selectedValuesArray = Object.values(selectedOptions).sort((a, b) => a - b);
  const matchedVariant = detailedProduct.value.variants.find(variant => {
    if (!variant.option_value_ids || variant.option_value_ids.length !== selectedValuesArray.length) return false;
    const sortedVariantValues = [...variant.option_value_ids].sort((a, b) => a - b);
    return JSON.stringify(sortedVariantValues) === JSON.stringify(selectedValuesArray);
  });

  let imageToSet = null;

  if (matchedVariant) {
    currentVariant.value = matchedVariant;
    displayPrice.value = parseFloat(matchedVariant.final_price);
    displaySku.value = matchedVariant.sku || detailedProduct.value.sku || '';
    displayStock.value = matchedVariant.stock_quantity;
    addToCartDisabled.value = matchedVariant.stock_quantity <= 0;
    if (matchedVariant.image_url) {
        const galleryMatch = galleryImages.value.find(gi => gi.url === matchedVariant.image_url);
        imageToSet = galleryMatch ? { ...galleryMatch } : { url: matchedVariant.image_url, alt_text: matchedVariant.sku || detailedProduct.value.name, id: 'var_img_qv_' + matchedVariant.id };
    } else {
      const primaryFromGallery = galleryImages.value.find(img => img.is_primary) || galleryImages.value[0];
      if (primaryFromGallery) imageToSet = { ...primaryFromGallery };
      else if (detailedProduct.value.image_url) imageToSet = { url: detailedProduct.value.image_url, alt_text: detailedProduct.value.name, id: 'prod_primary_qv_var_fb_' + detailedProduct.value.id, is_primary: true };
    }
  } else {
    currentVariant.value = null;
    displayPrice.value = parseFloat(detailedProduct.value.price);
    displaySku.value = detailedProduct.value.sku || '';
    displayStock.value = 0; // No matching variant means 0 stock for this selection
    addToCartDisabled.value = true;
    const primaryFromGallery = galleryImages.value.find(img => img.is_primary) || galleryImages.value[0];
    if (primaryFromGallery) imageToSet = { ...primaryFromGallery };
    else if (detailedProduct.value.image_url) imageToSet = { url: detailedProduct.value.image_url, alt_text: detailedProduct.value.name, id: 'prod_primary_qv_no_var_fb_' + detailedProduct.value.id, is_primary: true };
  }
  selectedImage.value = imageToSet;
  quantity.value = 1;
}


async function fetchProductDetails(id) {
  if (!id) {
    error.value = { message: 'Product ID is missing.' };
    return;
  }
  isLoading.value = true;
  error.value = null;
  try {
    // Using the same endpoint as the full product page
    const response = await $axios.get(`/products/${id}`);
    if (response.data && response.data.id) {
      detailedProduct.value = { ...response.data };

      const currentGalleryData = response.data.gallery_images || [];
      galleryImages.value = currentGalleryData.map(img => ({ ...img }));

      let initialDisplayImage = null;
      if (galleryImages.value.length > 0) {
        initialDisplayImage = galleryImages.value.find(img => img.is_primary && img.url) || galleryImages.value[0];
      }
      if (!initialDisplayImage && response.data.image_url) {
        initialDisplayImage = { url: response.data.image_url, alt_text: response.data.name, id: 'main_fb_qv_' + response.data.id, is_primary: true };
        if (galleryImages.value.length === 0 && initialDisplayImage.url) {
           galleryImages.value.push({ ...initialDisplayImage });
        }
      }
      selectedImage.value = initialDisplayImage ? { ...initialDisplayImage } : null;

      initializeSelections(); // This will call updateCurrentVariantUIData internally
    } else {
      detailedProduct.value = null; // Explicitly nullify if data is not as expected
      error.value = { message: 'Product not found or data incomplete.' };
    }
  } catch (err) {
    detailedProduct.value = null;
    error.value = { message: err.response?.data?.message || err.message || 'Could not load product details.' };
  } finally {
    isLoading.value = false;
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    // Reset state when modal opens
    detailedProduct.value = null;
    for (const key in selectedOptions) { delete selectedOptions[key]; }
    currentVariant.value = null;
    galleryImages.value = [];
    selectedImage.value = null;
    quantity.value = 1;
    error.value = null;
    isLoading.value = true; // Set loading true before fetch

    const idToFetch = props.productSummary?.id || props.productId;
    if (idToFetch) {
      // Check if productSummary has enough data (e.g., variants and options)
      // This is a simplified check; a more robust check would verify specific fields.
      if (props.productSummary && props.productSummary.variants && props.productSummary.available_options) {
        detailedProduct.value = { ...props.productSummary }; // Use summary if it seems complete

        const currentGalleryData = props.productSummary.gallery_images || [];
        galleryImages.value = currentGalleryData.map(img => ({ ...img }));
        let initialDisplayImage = null;
        if (galleryImages.value.length > 0) {
            initialDisplayImage = galleryImages.value.find(img => img.is_primary && img.url) || galleryImages.value[0];
        }
        if (!initialDisplayImage && props.productSummary.image_url) {
            initialDisplayImage = { url: props.productSummary.image_url, alt_text: props.productSummary.name, id: 'main_fb_qv_sum_' + props.productSummary.id, is_primary: true };
            if (galleryImages.value.length === 0 && initialDisplayImage.url) {
                galleryImages.value.push({ ...initialDisplayImage });
            }
        }
        selectedImage.value = initialDisplayImage ? { ...initialDisplayImage } : null;

        initializeSelections();
        isLoading.value = false;
      } else {
        fetchProductDetails(idToFetch);
      }
    } else {
      error.value = { message: 'No product ID provided for quick view.' };
      isLoading.value = false;
    }
  }
});

const handleAddToCart = () => {
  if (!detailedProduct.value) return;
  const stockAvailable = displayStock.value;

  if (detailedProduct.value.has_variants && !currentVariant.value && Object.keys(selectedOptions).length === (detailedProduct.value.available_options?.length || 0) ) {
    toast.error("This combination of options is unavailable."); return;
  }
  if (detailedProduct.value.has_variants && !currentVariant.value) {
    toast.error("Please select all product options."); return;
  }
  if (addToCartDisabled.value || stockAvailable <= 0) {
    toast.error("This item is out of stock."); return;
  }
  if (quantity.value <= 0) { toast.error("Please enter a valid quantity."); return; }
  if (quantity.value > stockAvailable) { toast.error(`Only ${stockAvailable} left in stock.`); return; }

  let cartItemData;
  if (currentVariant.value) {
     let variantOptionString = "";
    if (currentVariant.value.selected_options && currentVariant.value.selected_options.length > 0) {
         variantOptionString = currentVariant.value.selected_options.map(opt => opt.value_name).join(', ');
    } else {
        const parts = [];
        if (detailedProduct.value.available_options) {
            for (const optionType of detailedProduct.value.available_options) {
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
      id: currentVariant.value.id, product_id: detailedProduct.value.id, variant_id: currentVariant.value.id,
      name: `${detailedProduct.value.name}${variantOptionString ? ` - ${variantOptionString}` : ''}`,
      price: parseFloat(currentVariant.value.final_price), sku: currentVariant.value.sku || detailedProduct.value.sku,
      image_url: selectedImage.value?.url || detailedProduct.value.image_url, type: 'variant',
      tax_class_id: detailedProduct.value.tax_class_id || null,
    };
  } else {
    cartItemData = {
      id: detailedProduct.value.id, product_id: detailedProduct.value.id, variant_id: null,
      name: detailedProduct.value.name, price: parseFloat(detailedProduct.value.price), sku: detailedProduct.value.sku,
      image_url: selectedImage.value?.url || detailedProduct.value.image_url, type: 'product',
      tax_class_id: detailedProduct.value.tax_class_id || null,
    };
  }
  addToCart(cartItemData, quantity.value);
  emit('close'); // Optionally close modal after adding to cart
};

const closeModal = () => {
  emit('close');
};

const isCurrentProductOnSaleQuickView = computed(() => {
  const currentActualPrice = displayPrice.value;
  let originalPriceForComparison = null;

  if (currentVariant.value && currentVariant.value.original_final_price !== null && currentVariant.value.original_final_price !== undefined) {
    originalPriceForComparison = parseFloat(currentVariant.value.original_final_price);
  } else if (!currentVariant.value && detailedProduct.value && detailedProduct.value.original_price !== null && detailedProduct.value.original_price !== undefined) {
    originalPriceForComparison = parseFloat(detailedProduct.value.original_price);
  }

  if (originalPriceForComparison !== null && !isNaN(currentActualPrice) && !isNaN(originalPriceForComparison)) {
    return originalPriceForComparison > currentActualPrice;
  }
  return false;
});

const currentRrpDisplayQuickView = computed(() => {
  let rrp = null;
  if (currentVariant.value && currentVariant.value.original_final_price !== null && currentVariant.value.original_final_price !== undefined) {
    rrp = parseFloat(currentVariant.value.original_final_price);
  } else if (!currentVariant.value && detailedProduct.value && detailedProduct.value.original_price !== null && detailedProduct.value.original_price !== undefined) {
    rrp = parseFloat(detailedProduct.value.original_price);
  }
  return !isNaN(rrp) ? rrp : null;
});


// Initial setup if productSummary is provided and modal is already open (e.g. SSR scenario, though less likely for modals)
onMounted(() => {
  if (props.isOpen) {
    const idToFetch = props.productSummary?.id || props.productId;
    if (idToFetch) {
        if (props.productSummary && props.productSummary.variants && props.productSummary.available_options) {
            detailedProduct.value = { ...props.productSummary };
             const currentGalleryData = props.productSummary.gallery_images || [];
            galleryImages.value = currentGalleryData.map(img => ({ ...img }));
            let initialDisplayImage = null;
            if (galleryImages.value.length > 0) {
                initialDisplayImage = galleryImages.value.find(img => img.is_primary && img.url) || galleryImages.value[0];
            }
            if (!initialDisplayImage && props.productSummary.image_url) {
                initialDisplayImage = { url: props.productSummary.image_url, alt_text: props.productSummary.name, id: 'main_fb_qv_sum_mount_' + props.productSummary.id, is_primary: true };
                 if (galleryImages.value.length === 0 && initialDisplayImage.url) {
                    galleryImages.value.push({ ...initialDisplayImage });
                }
            }
            selectedImage.value = initialDisplayImage ? { ...initialDisplayImage } : null;
            initializeSelections();
            isLoading.value = false;
        } else if (idToFetch) {
            fetchProductDetails(idToFetch);
        } else {
            error.value = { message: 'No product ID available to fetch details.' };
            isLoading.value = false;
        }
    } else {
        error.value = { message: 'No product ID provided.' };
        isLoading.value = false;
    }
  }
});

</script>

<style scoped>
.quick-view-content {
  max-height: 80vh; /* Max height for the content area */
  overflow-y: auto; /* Allow content scrolling if it overflows */
}
/* Custom scrollbar for webkit browsers */
.quick-view-content::-webkit-scrollbar {
  width: 6px;
}
.quick-view-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
.quick-view-content::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}
.quick-view-content::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
.no-scrollbar::-webkit-scrollbar {
    display: none; /* Safari and Chrome */
}
.no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
</style>

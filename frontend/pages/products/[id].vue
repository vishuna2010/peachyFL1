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

    <div v-if="product && !pending && !fetchError" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:grid md:grid-cols-5 lg:grid-cols-2 gap-8 lg:gap-12">
      <!-- Image Column -->
      <div class="md:col-span-3 lg:col-span-1">
        <img
          v-if="selectedImageUrl"
          :src="selectedImageUrl"
          :alt="`Image of ${product.name}`"
          class="w-full h-auto object-contain rounded-lg shadow-lg max-h-[550px] aspect-[4/5]"
          key="selected-image"
        />
        <div v-if="!selectedImageUrl" class="w-full h-[400px] md:h-[550px] flex items-center justify-center bg-neutral-medium rounded-lg text-text-secondary">No Image Available</div>

        <!-- Thumbnail Gallery -->
        <div v-if="galleryImages.length > 1" class="mt-4 flex items-center justify-center space-x-2 sm:space-x-3 overflow-x-auto py-2 px-1">
          <img
            v-for="imageItem in galleryImages"
            :key="imageItem.id"
            :src="imageItem.url"
            @click="selectedImageUrl = imageItem.url"
            :alt="`${product.name} thumbnail ${imageItem.id}`"
            class="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-md border-2 cursor-pointer transition-all duration-200 ease-in-out hover:opacity-75"
            :class="selectedImageUrl === imageItem.url ? 'border-brand-primary ring-2 ring-brand-primary ring-offset-1 shadow-md' : 'border-transparent'"
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

        <!-- Product Options Selection -->
        <div v-if="product.options && product.options.length > 0" class="space-y-4 mb-6">
          <div v-for="option in product.options" :key="option.id">
            <label :for="`option-${option.id}`" class="block text-sm font-medium text-text-primary mb-1">{{ option.name }}:</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="value in option.values"
                :key="value.id"
                @click="selectOption(option.id, value.id)"
                :class="[
                  'px-4 py-2 border rounded-md text-sm transition-colors duration-150',
                  selectedOptions[option.id] === value.id
                    ? 'bg-brand-primary text-white border-brand-primary ring-2 ring-brand-accent'
                    : 'bg-white hover:bg-neutral-light border-neutral-medium text-text-primary'
                ]"
              >
                {{ value.value }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="product.options && product.options.length > 0 && !currentVariant && Object.keys(selectedOptions).length > 0"
             class="my-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">
          Selected combination is unavailable.
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive, nextTick, useHead } from 'vue'; // Added useHead
import { useRoute, useNuxtApp } from '#app';
import { useCart } from '~/composables/useCart';
import { useToast } from 'vue-toastification';
import ProductDetailSkeleton from '~/components/ProductDetailSkeleton.vue'; // Import skeleton

const { $axios } = useNuxtApp();
const route = useRoute();
const product = ref(null);
const pending = ref(true);
const fetchError = ref(null);
const toast = useToast();

const { addToCart } = useCart();

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
function initializeSelections() {
  if (product.value && product.value.options) {
    for (const option of product.value.options) {
      if (option.values && option.values.length > 0) {
        selectedOptions[option.id] = option.values[0].id;
      }
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

  if (!product.value.variants || product.value.variants.length === 0) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = product.value.stock_quantity;
    selectedImageUrl.value = product.value.image_url || '';
    addToCartDisabled.value = product.value.stock_quantity <= 0;
    quantity.value = 1;
    return;
  }

  const numSelectedOptions = Object.keys(selectedOptions).length;
  if (product.value.options && numSelectedOptions < product.value.options.length) {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = 0;
    selectedImageUrl.value = product.value.image_url || '';
    addToCartDisabled.value = true;
    return;
  }

  const matchedVariant = product.value.variants.find(variant => {
    if (variant.selected_options.length !== numSelectedOptions) return false;
    return variant.selected_options.every(optVal =>
      selectedOptions[optVal.option_id] === optVal.value_id
    );
  });

  if (matchedVariant) {
    currentVariant.value = matchedVariant;
    displayPrice.value = parseFloat(matchedVariant.final_price);
    displaySku.value = matchedVariant.sku || product.value.sku || '';
    displayStock.value = matchedVariant.stock_quantity;
    selectedImageUrl.value = matchedVariant.image_url || product.value.image_url || '';
    addToCartDisabled.value = matchedVariant.stock_quantity <= 0;
  } else {
    currentVariant.value = null;
    displayPrice.value = parseFloat(product.value.price);
    displaySku.value = product.value.sku || '';
    displayStock.value = 0;
    selectedImageUrl.value = product.value.image_url || '';
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
  const productToAdd = currentVariant.value || product.value;
  const stockAvailable = displayStock.value;

  if (!productToAdd) {
    toast.error("Product or variant not selected/available.");
    return;
  }
  if (stockAvailable <= 0) {
    toast.error("This item is out of stock.");
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

  const itemForCart = {
    id: product.value.id,
    productVariantId: currentVariant.value ? currentVariant.value.id : null,
    name: currentVariant.value ? `${product.value.name} (${currentVariant.value.selected_options.map(opt => opt.value_name).join(', ')})` : product.value.name,
    price: displayPrice.value,
    image_url: selectedImageUrl.value,
    sku: displaySku.value,
  };

  addToCart(itemForCart, quantity.value);
  // Toast notification for successful add is now handled by useCart.js
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

</script>

<!-- <style scoped> block removed as Tailwind is used -->

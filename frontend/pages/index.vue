<template>
  <div class="pb-8">
    <HeroBanner v-bind="heroData" />

    <div class="py-6 bg-venus-background">
      <div class="container mx-auto space-y-4 px-4">
        <PromotionalBanner
          mainText="IT'S ALL ON SALE! Extra 35% off sale & outlet w/"
          linkText="HURRYANDSHOP"
          linkUrl="#"
          type="primary"
        />
        <PromotionalBanner
          title="FREE SHIPPING OVER $75+"
          mainText="No Code, Just Shop!"
          type="secondary"
        />
      </div>
    </div>

    <section class="py-12 bg-venus-background">
      <div class="container mx-auto px-4">
        <h2 class="text-3xl font-serif text-venus-text-primary text-center mb-8">Shop By Category</h2>
        
        <!-- Loading State -->
        <div v-if="isLoadingCategories" class="flex gap-6 overflow-hidden">
          <div v-for="n in 4" :key="`category-skeleton-${n}`" class="flex-shrink-0 w-80 bg-gray-200 rounded-lg h-64 animate-pulse"></div>
        </div>
        
        <!-- Error State -->
        <div v-else-if="categoriesError" class="text-center py-8">
          <p class="text-red-600 mb-4">{{ categoriesError }}</p>
          <button @click="fetchCategories" class="bg-peach-pink text-white px-4 py-2 rounded-md hover:bg-opacity-90">
            Try Again
          </button>
        </div>
        
        <!-- Categories Slider -->
        <CategorySlider v-else-if="categories.length > 0" :categories="categories" />
        
        <!-- No Categories State -->
        <div v-else class="text-center py-8">
          <p class="text-venus-text-secondary">No categories available at the moment.</p>
        </div>
      </div>
    </section>

    <section class="py-12 bg-venus-neutral-light">
      <div class="container mx-auto px-4">
        <h2 class="text-3xl font-serif text-venus-text-primary text-center mb-8">Best Sellers</h2>

        <div v-if="isLoadingBestSellers" class="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          <ProductCardSkeleton v-for="n in 4" :key="`bs-skeleton-${n}`" />
        </div>
        <div v-else-if="bestSellersError" class="text-center py-6">
          <p class="text-lg text-red-500">Could not load best sellers: {{ bestSellersError }}</p>
        </div>
        <div v-else-if="!bestSellerProducts || bestSellerProducts.length === 0" class="text-center py-6">
          <p class="text-lg text-venus-text-secondary">No best sellers to display at the moment.</p>
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          <ProductCard
            v-for="product in bestSellerProducts"
            :key="`bs-${product.id}`"
            :product="product"
            @open-quick-view="openQuickViewModal"
          />
        </div>
      </div>
    </section>

    <div class="p-4 md:p-8">
      <h1 class="text-3xl font-serif text-peach-pink mb-6 text-center" id="products">Featured Products</h1> <!-- Themed title -->

      <!-- Main Search Bar -->
      <div class="mb-8 max-w-2xl mx-auto">
        <form @submit.prevent="applyFiltersAndNavigate" class="relative">
          <input
            type="search"
            v-model="searchTerm"
            placeholder="Search products..."
            class="w-full px-4 py-3 text-lg border-gray-300 rounded-lg shadow-sm focus:ring-peach-pink focus:border-peach-pink"
          />
          <button type="submit" class="absolute right-0 top-0 bottom-0 px-6 bg-peach-pink text-white rounded-r-lg hover:bg-opacity-90 flex items-center justify-center">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path></svg>
          </button>
        </form>
      </div>

      <div class="lg:grid lg:grid-cols-4 lg:gap-x-6 xl:gap-x-8">
        <div class="lg:col-span-4">
          <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6">
            <ProductCardSkeleton v-for="n in limit" :key="`skeleton-${n}`" />
          </div>
          <div v-else-if="fetchError" class="text-center py-10">
            <p class="text-lg text-red-600">Error fetching products: {{ fetchError.message || 'Unknown error' }}</p>
            <button @click="() => fetchProducts(currentPage)" class="mt-4 px-4 py-2 bg-brand-primary text-white rounded hover:bg-opacity-90 font-semibold transition-all duration-200 ease-in-out hover:scale-105 transform">Try Again</button>
          </div>
          <div v-else-if="!products.length" class="text-center py-10">
            <p class="text-lg text-venus-text-secondary">No products found matching your criteria.</p>
          </div>
          <div v-else class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 md:gap-6">
            <ProductCard v-for="product in products" :key="product.id" :product="product" @open-quick-view="openQuickViewModal" />
          </div>

          <!-- Standardized QuickView Modal -->
          <ProductQuickView
            :is-open="isQuickViewModalVisible"
            :product-summary="productForQuickView"
            @close="closeQuickViewModal"
          />

          <div class="mt-8 flex justify-center items-center space-x-3" v-if="!isLoading && !fetchError && products.length > 0 && paginationData.totalPages > 1">
            <button
              @click="changePage(currentPage - 1)"
              :disabled="!paginationData.hasPrevPage"
              class="px-4 py-2 border border-venus-neutral-medium text-venus-text-secondary hover:bg-venus-neutral-light hover:text-venus-text-primary rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out"
            >
              Previous
            </button>
            <span class="text-sm text-venus-text-secondary">
              Page {{ paginationData.page }} of {{ paginationData.totalPages }}
            </span>
            <button
              @click="changePage(currentPage + 1)"
              :disabled="!paginationData.hasNextPage"
              class="px-4 py-2 border border-venus-neutral-medium text-venus-text-secondary hover:bg-venus-neutral-light hover:text-venus-text-primary rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useCart } from '~/composables/useCart';
import { useNuxtApp, useRoute, useRouter, useRuntimeConfig, useHead } from '#app';
import ProductCard from '~/components/ProductCard.vue';
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue';
// import ProductFilters from '~/components/ProductFilters.vue'; // No longer directly used here
import ProductQuickView from '~/components/products/ProductQuickView.vue'; // Added import
import HeroBanner from '~/components/HeroBanner.vue';
import PromotionalBanner from '~/components/PromotionalBanner.vue';
import CategoryHighlightCard from '~/components/CategoryHighlightCard.vue';
import CategorySlider from '~/components/CategorySlider.vue';
// import FilterIcon from '~/components/icons/FilterIcon.vue'; // No longer used here
// import CloseIcon from '~/components/icons/CloseIcon.vue'; // No longer needed as ProductQuickView handles its own close

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const { addToCart } = useCart();

const heroData = ref({
  title: 'Golden Hour Glow', // Example from venus.com text
  subtitle: 'Sunset pinks, vibrant oranges, brand-new styles. Summer nights just met their match.',
  buttonText: 'SHOP NEW ARRIVALS',
  buttonLink: '#', // Assuming a "/new" route exists
  imageUrl: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80' // A fashion/summer vibe image
});

const products = ref([]);

// Filter state
const searchTerm = ref(route.query.search_term || '');
const selectedCategoryId = ref(route.query.category_id ? parseInt(route.query.category_id) : null);
const selectedColorValueId = ref(route.query.optionValueId ? parseInt(route.query.optionValueId) : null);
const minPrice = ref(route.query.min_price ? parseFloat(route.query.min_price) : null);
const maxPrice = ref(route.query.max_price ? parseFloat(route.query.max_price) : null);
const sortBy = ref(route.query.sort_by || 'created_at_desc');
const currentPage = ref(route.query.page ? parseInt(route.query.page) : 1);
const limit = ref(12);

const categories = ref([]); // For ProductFilters prop
const paginationData = ref({
  total: 0,
  page: currentPage.value,
  limit: limit.value,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
});
const isLoading = ref(true); // For main product list
const fetchError = ref(null); // For main product list

const bestSellerProducts = ref([]);
const isLoadingBestSellers = ref(true);
const bestSellersError = ref(null);

// const isMobileFiltersOpen = ref(false); // Removed
// const toggleMobileFilters = () => { // Removed
//   isMobileFiltersOpen.value = !isMobileFiltersOpen.value;
// };

// QuickView Modal State
const productForQuickView = ref(null);
const isQuickViewModalVisible = ref(false);

const openQuickViewModal = (product) => {
  productForQuickView.value = product;
  isQuickViewModalVisible.value = true;
  // Optional: Disable body scroll here
};

const closeQuickViewModal = () => {
  isQuickViewModalVisible.value = false;
  productForQuickView.value = null;
  // Optional: Enable body scroll here
};

// const handleDirectAddToCart = (product) => { // Removed this function
//   if (!product) return;
//   addToCart({
//     id: product.id, // Ensure this is the product ID, not variant if applicable
//     product_id: product.id,
//     variant_id: null, // Assuming no variants for direct add from this simple view
//     name: product.name,
//     price: parseFloat(product.price),
//     sku: product.sku,
//     image_url: product.image_url,
//     type: 'product', // Explicitly 'product'
//     tax_class_id: product.tax_class_id || null,
//   }, 1); // Add 1 quantity
//   // toast.success(`${product.name} added to cart!`); // Optional: Show toast
// };

const isLoadingCategories = ref(true);
const categoriesError = ref(null);

// Function to get appropriate image for each category
const getCategoryImage = (categoryName) => {
  const categoryImages = {
    // Database categories with nice placeholders
    'Accessories': 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80',
    'Apparel': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Beauty': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1187&q=80',
    'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Footwear': 'https://images.unsplash.com/photo-1549298916-b41d501d3772?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1112&q=80',
    'Home Goods': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Mens Wear Shoes': 'https://images.unsplash.com/photo-1549298916-b41d501d3772?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1112&q=80',
    'Books': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1128&q=80',
    'Digital Music': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Sports & Outdoors': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Toys & Games': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Headphones': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    
    // Fashion categories with beautiful placeholders
    'Dresses': 'https://images.unsplash.com/photo-1595991209266-5ff5a3a2f020?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80',
    'Swimwear': 'https://images.unsplash.com/photo-1500304400269-bac1eda94035?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80',
    'Tops': 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=705&q=80',
    'Bottoms': 'https://images.unsplash.com/photo-1542272604-787c3835535d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1026&q=80',
    'Shoes': 'https://images.unsplash.com/photo-1549298916-b41d501d3772?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1112&q=80',
    'Jewelry': 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Bags': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Outerwear': 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Lingerie': 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    
    // Additional lifestyle categories
    'Home & Garden': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Kitchen': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Furniture': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Decor': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Garden': 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    
    // Tech categories
    'Computers': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Mobile': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1160&q=80',
    'Gaming': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Audio': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    
    // Health & Wellness
    'Fitness': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Wellness': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1187&q=80',
    'Nutrition': 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    
    // Kids & Family
    'Kids': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Baby': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Pets': 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    
    // Seasonal & Special
    'Holiday': 'https://images.unsplash.com/photo-1543589923-d58f523daec0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Gifts': 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'Sale': 'https://images.unsplash.com/photo-1607082349566-187342175e2f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
    'New Arrivals': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80'
  };
  
  // Return specific image if available, otherwise return a default fashion image
  return categoryImages[categoryName] || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80';
};

async function fetchCategories() {
  isLoadingCategories.value = true;
  categoriesError.value = null;
  try {
    const response = await $axios.get('/categories');
    categories.value = response.data || [];
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    categoriesError.value = err.response?.data?.message || 'Could not load categories.';
  } finally {
    isLoadingCategories.value = false;
  }
}

async function fetchProducts(pageToFetch = currentPage.value) {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const params = {
      page: pageToFetch,
      limit: limit.value,
      search_term: searchTerm.value || undefined,
      category_id: selectedCategoryId.value || undefined,
      optionValueId: selectedColorValueId.value || undefined, // Include in API call
      min_price: minPrice.value || undefined,
      max_price: maxPrice.value || undefined,
      sort_by: sortBy.value || undefined
    };
    const response = await $axios.get('/products', { params });
    products.value = response.data.products;
    const backendPagination = response.data.pagination;
    paginationData.value = {
      total: backendPagination.total_products,
      page: backendPagination.current_page,
      limit: backendPagination.limit,
      totalPages: backendPagination.total_pages,
      hasNextPage: backendPagination.current_page < backendPagination.total_pages,
      hasPrevPage: backendPagination.current_page > 1,
    };
    currentPage.value = backendPagination.current_page;

    // No need to push to router here, this function is called WHEN router query changes (or on initial load)
  } catch (err) {
    console.error('Failed to fetch products:', err);
    fetchError.value = err.response?.data || err;
    products.value = [];
    paginationData.value = { total: 0, page: 1, limit: limit.value, totalPages: 1, hasNextPage: false, hasPrevPage: false };
  } finally {
    isLoading.value = false;
  }
}

const handleFiltersUpdate = (filtersFromChild) => {
  searchTerm.value = filtersFromChild.searchTerm;
  selectedCategoryId.value = filtersFromChild.selectedCategoryId;
  selectedColorValueId.value = filtersFromChild.selectedColorValueId;
  minPrice.value = filtersFromChild.minPrice;
  maxPrice.value = filtersFromChild.maxPrice;
  sortBy.value = filtersFromChild.sortBy;

  applyFiltersAndNavigate();
};

function applyFiltersAndNavigate() {
  currentPage.value = 1;
  const query = {};
  if (searchTerm.value) query.search_term = searchTerm.value;
  if (selectedCategoryId.value) query.category_id = selectedCategoryId.value;
  if (selectedColorValueId.value) query.optionValueId = selectedColorValueId.value; // Add to query
  if (minPrice.value !== null && minPrice.value !== '') query.min_price = minPrice.value;
  if (maxPrice.value !== null && maxPrice.value !== '') query.max_price = maxPrice.value;
  if (sortBy.value && sortBy.value !== 'created_at_desc') query.sort_by = sortBy.value;
  // Page will be 1, so don't include it unless it's > 1 (which it isn't here)

  router.push({ path: '/', query });
  // Mobile filters were previously closed by ProductFilters component itself by emitting 'closeMobileFilters'
  // This is no longer relevant here as those components are removed from this page.
}

function resetFiltersAndNavigate() {
    searchTerm.value = '';
    selectedCategoryId.value = null;
    selectedColorValueId.value = null; // Reset color
    minPrice.value = null;
    maxPrice.value = null;
    sortBy.value = 'created_at_desc';
    currentPage.value = 1;
    router.push({ path: '/', query: {} });
    // Mobile filters were previously closed by ProductFilters component itself.
    // This is no longer relevant here.
}

function changePage(newPage) {
  if (newPage > 0 && newPage <= paginationData.value.totalPages && newPage !== currentPage.value) {
    // currentPage.value will be updated by the watcher reacting to route.query.page change
    const query = { ...route.query };
    if (newPage > 1) {
      query.page = newPage;
    } else {
      delete query.page;
    }
    router.push({ query });
  }
}

onMounted(async () => {
  // Initialize filter states from URL query on mount
  // This is now largely handled by the watcher's immediate:true and its logic
  await fetchCategories();
  // Initial product fetch is handled by the watcher on route.query
  fetchBestSellers();
});

async function fetchBestSellers() {
  isLoadingBestSellers.value = true;
  bestSellersError.value = null;
  try {
    const response = await $axios.get('/products/best-sellers', { params: { limit: 4 } }); // Fetch top 4
    bestSellerProducts.value = response.data.products || [];
  } catch (err) {
    console.error('Failed to fetch best sellers:', err);
    bestSellersError.value = err.response?.data?.message || 'Could not load best sellers.';
    bestSellerProducts.value = [];
  } finally {
    isLoadingBestSellers.value = false;
  }
}

watch(
  () => route.query,
  (newQuery, oldQuery = {}) => {
    searchTerm.value = newQuery.search_term || '';
    selectedCategoryId.value = newQuery.category_id ? parseInt(newQuery.category_id) : null;
    selectedColorValueId.value = newQuery.optionValueId ? parseInt(newQuery.optionValueId) : null; // Update from route
    minPrice.value = newQuery.min_price ? parseFloat(newQuery.min_price) : null;
    maxPrice.value = newQuery.max_price ? parseFloat(newQuery.max_price) : null;
    sortBy.value = newQuery.sort_by || 'created_at_desc';
    const newPage = newQuery.page ? parseInt(newQuery.page) : 1;

    // Only update currentPage if it's different, to avoid potential loop with fetchProducts updating route
    if (currentPage.value !== newPage) {
        currentPage.value = newPage;
    }
    fetchProducts(currentPage.value); // Fetch products based on (potentially updated) filters from URL
  },
  { deep: true, immediate: true } // immediate:true to fetch on initial load based on URL
);

useHead({
  title: 'E-Commerce Home - Featured Products',
});
</script>

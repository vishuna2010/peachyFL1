<template>
  <div class="min-h-screen bg-venus-background">
    <!-- Hero Section -->
    <div class="bg-gradient-to-r from-peach-pink to-pink-400 text-white py-16">
      <div class="container mx-auto px-4 text-center">
        <h1 class="text-4xl md:text-5xl font-bold mb-4">New Arrivals</h1>
        <p class="text-xl opacity-90 max-w-2xl mx-auto">
          Discover our latest products fresh from the warehouse. Be the first to explore new styles and trends.
        </p>
      </div>
    </div>

    <!-- Filters and Sort Section -->
    <div class="bg-white border-b border-gray-200 sticky top-16 z-40">
      <div class="container mx-auto px-4 py-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <!-- Results Count -->
          <div class="text-sm text-gray-600">
            {{ totalProducts }} {{ totalProducts === 1 ? 'product' : 'products' }} found
          </div>

          <!-- Sort Options -->
          <div class="flex items-center gap-4">
            <label for="sort" class="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              id="sort"
              v-model="sortBy"
              @change="handleSortChange"
              class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-peach-pink focus:border-peach-pink"
            >
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="price_asc">Price Low to High</option>
              <option value="price_desc">Price High to Low</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Products Grid -->
    <div class="container mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <ProductCardSkeleton v-for="n in 8" :key="n" />
      </div>

      <!-- Products -->
      <div v-else-if="products.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          @click="viewProduct(product)"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16">
        <div class="max-w-md mx-auto">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No new products</h3>
          <p class="mt-1 text-sm text-gray-500">
            Check back soon for fresh arrivals!
          </p>
          <div class="mt-6">
            <NuxtLink
              to="/products"
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink"
            >
              Browse All Products
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMoreProducts && !loading" class="text-center mt-12">
        <button
          @click="loadMoreProducts"
          :disabled="loadingMore"
          class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-peach-pink hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            v-if="loadingMore"
            class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ loadingMore ? 'Loading...' : 'Load More Products' }}
        </button>
      </div>
    </div>

    <!-- Quick View Modal -->
    <ProductQuickView
      v-if="selectedProduct"
      :product="selectedProduct"
      @close="selectedProduct = null"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import ProductCard from '~/components/ProductCard.vue'
import ProductCardSkeleton from '~/components/ProductCardSkeleton.vue'
import ProductQuickView from '~/components/products/ProductQuickView.vue'

definePageMeta({
  title: 'New Arrivals',
  description: 'Discover our latest products fresh from the warehouse'
})

const router = useRouter()
const { apiFetch } = useApi()

// Data
const products = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const selectedProduct = ref(null)
const currentPage = ref(1)
const totalProducts = ref(0)
const hasMoreProducts = ref(true)
const sortBy = ref('created_at_desc')

// Constants
const PRODUCTS_PER_PAGE = 12

// Computed
const sortParams = computed(() => {
  const [field, order] = sortBy.value.split('_')
  return { sort_by: field, sort_order: order }
})

// Methods
const fetchNewArrivals = async (page = 1, append = false) => {
  if (page === 1) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const params = {
      page,
      limit: PRODUCTS_PER_PAGE,
      new_arrivals: true,
      ...sortParams.value
    }

    const response = await apiFetch('/api/products', { params })
    
    if (append) {
      products.value.push(...(response.products || []))
    } else {
      products.value = response.products || []
    }

    totalProducts.value = response.total || 0
    hasMoreProducts.value = (response.products || []).length === PRODUCTS_PER_PAGE
    currentPage.value = page
  } catch (error) {
    console.error('Error fetching new arrivals:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const handleSortChange = () => {
  currentPage.value = 1
  fetchNewArrivals(1, false)
}

const loadMoreProducts = () => {
  if (!loadingMore.value && hasMoreProducts.value) {
    fetchNewArrivals(currentPage.value + 1, true)
  }
}

const viewProduct = (product) => {
  selectedProduct.value = product
}

// Lifecycle
onMounted(() => {
  fetchNewArrivals()
})
</script> 
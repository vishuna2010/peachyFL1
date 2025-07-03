<template>
  <header class="bg-venus-background shadow-md sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
      <!-- Logo -->
      <NuxtLink to="/" aria-label="Homepage">
        <img src="/Logo.svg" alt="Site Logo" class="h-10 w-auto"> <!-- Corrected to Logo.svg -->
      </NuxtLink>

      <!-- Navigation Links -->
      <nav class="hidden md:flex space-x-1 items-center"> {/* Reduced space-x slightly for wrapper divs */}
        <div
          v-for="category in headerCategories"
          :key="category.id"
          class="relative group"
          @mouseenter="handleCategoryMouseEnter(category, $event)"
          @mouseleave="handleCategoryMouseLeave()"
        >
          <NuxtLink
            :to="`/categories/${category.slug}`"
            class="text-venus-text-primary px-3 py-2 border-b-2 border-transparent hover:border-peach-pink hover:text-peach-pink font-medium transition-colors duration-200 ease-in-out"
          >
            {{ category.name }}
          </NuxtLink>
        </div>
        <NuxtLink :to="{ path: '/products', query: { on_sale: 'true' } }" class="text-venus-text-primary px-3 py-2 border-b-2 border-transparent hover:border-peach-pink hover:text-peach-pink font-bold transition-colors duration-200 ease-in-out">Sale</NuxtLink>
      </nav>

      <!-- Conditionally rendered Dropdown -->
      <CategoryProductPreviewDropdown
        v-if="hoveredCategoryId && currentHoveredCategory"
        :products="hoveredCategoryProducts"
        :category-name="currentHoveredCategory.name"
        :category-slug="currentHoveredCategory.slug"
        :is-loading="isDropdownLoading"
        :style="dropdownPositionStyle"
        @mouseenter="clearDropdownTimeout"
        @mouseleave="handleCategoryMouseLeave()"
        class="absolute" <!-- Positioning will be dynamic via style prop -->
      />

      <!-- Search and Action Icons -->
      <div class="flex items-center space-x-4">
        <!-- Header Search -->
        <div class="flex items-center space-x-2">
          <form @submit.prevent="submitHeaderSearch" class="relative group">
            <input
              type="text"
              v-model="headerSearchTerm"
              placeholder="Search products..."
              class="px-4 py-2 w-40 md:w-56 border border-gray-300 rounded-md text-sm text-venus-text-secondary shadow-sm focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-all duration-300 ease-in-out md:group-hover:w-60 focus:w-60"
              aria-label="Search products"
            />
            <button
              type="submit"
              class="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-peach-pink transition-colors"
              aria-label="Submit search"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </button>
          </form>
          <button
            @click="openFilterModal"
            aria-label="Advanced Filters"
            class="p-2 text-gray-500 hover:text-peach-pink transition-colors"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.293.707l-2 2A1 1 0 019 17v-6.586L4.293 6.707A1 1 0 014 6V3zm2 2v1h10V5H5zm0 3h10l-2 2H7L5 8z" clip-rule="evenodd"></path></svg>
          </button>
        </div>

        <!-- Conditional Auth Links: Wrap in ClientOnly to prevent hydration mismatch -->
        <ClientOnly>
          <div class="flex items-center space-x-4">
            <template v-if="!isAuthenticated">
              <NuxtLink to="/login" class="text-sm font-medium text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out">Login</NuxtLink>
              <NuxtLink to="/register" class="text-sm font-medium text-white bg-peach-pink hover:bg-opacity-90 px-4 py-2 rounded-md transition-colors duration-200 ease-in-out">Sign Up</NuxtLink>
            </template>
            <template v-else-if="isAuthenticated"> <!-- Added explicit isAuthenticated check for clarity with ClientOnly -->
              <NuxtLink to="/profile" aria-label="My Account" class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </NuxtLink>
              <!-- Consider adding a Logout button/icon here or ensure it's easily accessible via /profile -->
            </template>
          </div>
          <template #fallback>
            <!-- Optional: Placeholder for auth links while loading, same dimensions to avoid layout shift -->
            <div class="h-8 w-24"></div> <!-- Adjust w-24 based on typical width of login/signup or profile icon -->
          </template>
        </ClientOnly>

        <NuxtLink to="/cart" aria-label="Cart" class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        </NuxtLink>
      </div>
    </div>
    <HeaderFilterModal
      :is-open="isFilterModalOpen"
      @close="closeFilterModal"
      @apply-header-filters="handleApplyHeaderFilters"
      @reset-header-filters="handleResetHeaderFilters"
    />
  </header>
</template>
<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import { useRouter, useNuxtApp } from '#app';
import { useAuth } from '~/composables/useAuth';
import HeaderFilterModal from '~/components/modals/HeaderFilterModal.vue';
import CategoryProductPreviewDropdown from '~/components/categories/CategoryProductPreviewDropdown.vue';

// Added isAuthInitialized to prevent flicker
const { isAuthenticated, authUser, isAuthInitialized } = useAuth();
const router = useRouter();
const { $axios } = useNuxtApp();

const headerSearchTerm = ref('');
const headerCategories = ref([]);
const isFilterModalOpen = ref(false);

// State for category hover dropdown
const hoveredCategoryId = ref(null);
const hoveredCategoryProducts = ref([]);
const isDropdownLoading = ref(false);
const dropdownPositionStyle = reactive({ top: '0px', left: '0px' });
const activeDropdownTimeoutId = ref(null);
const productPreviewCache = reactive({}); // Cache for product previews

const PRODUCTS_PREVIEW_LIMIT = 4;

const currentHoveredCategory = computed(() => {
  return headerCategories.value.find(cat => cat.id === hoveredCategoryId.value);
});

const fetchHeaderCategories = async () => {
  try {
    const response = await $axios.get('/categories');
    headerCategories.value = response.data || [];
  } catch (error) {
    console.error('Error fetching categories for header:', error);
    headerCategories.value = [];
  }
};

onMounted(() => {
  fetchHeaderCategories();
});

const submitHeaderSearch = () => {
  // When submitting search from header, apply only the search term and navigate.
  // Advanced filters are applied separately via the modal.
  if (headerSearchTerm.value.trim()) {
    router.push({ path: '/products', query: { searchTerm: headerSearchTerm.value.trim() } });
    // Do not clear headerSearchTerm here, user might want to refine with advanced filters.
  } else {
    // If search term is empty, just go to products page (might show all or default sort)
    router.push({ path: '/products' });
  }
};

const openFilterModal = () => { // Renamed from goToAdvancedFilters
  isFilterModalOpen.value = true;
};

const closeFilterModal = () => {
  isFilterModalOpen.value = false;
};

const handleApplyHeaderFilters = (appliedFilters) => {
  const query = { ...appliedFilters }; // Filters from ProductFilters

  // Ensure headerSearchTerm is included if present, potentially overriding what was in ProductFilters' own search
  if (headerSearchTerm.value.trim()) {
    query.searchTerm = headerSearchTerm.value.trim();
  } else if (query.searchTerm) {
     // If header search is empty, but ProductFilters had one (e.g. from URL), keep it.
     // Or, decide if header search always wins. For now, let headerSearchTerm take precedence.
     // If headerSearchTerm is empty, and appliedFilters.searchTerm is also empty/null, it's fine.
  }


  // Remove null/undefined values from query to keep URL clean
  Object.keys(query).forEach(key => {
    if (query[key] === null || query[key] === undefined || query[key] === '') {
      delete query[key];
    }
  });

  router.push({ path: '/products', query });
  closeFilterModal();
};

const handleResetHeaderFilters = () => {
  // Navigate to /products with only the current header search term, if any.
  const query = {};
  if (headerSearchTerm.value.trim()) {
    query.searchTerm = headerSearchTerm.value.trim();
  }
  router.push({ path: '/products', query });
  closeFilterModal();
};

// Category Hover Dropdown Logic
const handleCategoryMouseEnter = async (category, event) => {
  clearDropdownTimeout();
  hoveredCategoryId.value = category.id;
  isDropdownLoading.value = true;

  const rect = event.currentTarget.getBoundingClientRect();
  const smallGap = 4; // 4px gap
  dropdownPositionStyle.top = `${rect.bottom + window.scrollY + smallGap}px`;
  dropdownPositionStyle.left = `${rect.left + window.scrollX}px`;

  if (productPreviewCache[category.id]) {
    hoveredCategoryProducts.value = productPreviewCache[category.id];
    isDropdownLoading.value = false;
  } else {
    try {
      const response = await $axios.get('/products', {
        params: {
          category_id: category.id,
          limit: PRODUCTS_PREVIEW_LIMIT,
          sort_by: 'created_at', // Or 'popularity', 'is_featured' if available
          sort_order: 'desc',
        }
      });
      hoveredCategoryProducts.value = response.data.products || [];
      productPreviewCache[category.id] = hoveredCategoryProducts.value; // Cache the result
    } catch (error) {
      console.error(`Error fetching products for category ${category.name}:`, error);
      hoveredCategoryProducts.value = []; // Clear products on error
    } finally {
      isDropdownLoading.value = false;
    }
  }
};

const handleCategoryMouseLeave = () => {
  activeDropdownTimeoutId.value = setTimeout(() => {
    hoveredCategoryId.value = null;
    hoveredCategoryProducts.value = [];
    isDropdownLoading.value = false;
  }, 200); // 200ms delay to allow moving mouse to dropdown
};

const clearDropdownTimeout = () => {
  if (activeDropdownTimeoutId.value) {
    clearTimeout(activeDropdownTimeoutId.value);
    activeDropdownTimeoutId.value = null;
  }
};

// Ensure dropdown also clears timeout on mouse enter and hides on mouse leave
// These events are on the CategoryProductPreviewDropdown component itself in the template
</script>

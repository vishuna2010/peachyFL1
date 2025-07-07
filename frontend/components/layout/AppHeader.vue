<template>
  <header class="bg-venus-background shadow-md sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
      <!-- Logo -->
      <NuxtLink to="/" aria-label="Homepage">
        <img
          v-if="siteSettings.site_logo?.value"
          :src="siteSettings.site_logo.value"
          :alt="siteSettings.site_name?.value || 'Site Logo'"
          class="h-16 w-auto object-contain"
          @error="(e) => (e.target.src = '/Logo.svg')"
        />
        <img
          v-else
          src="/Logo.svg"
          alt="Site Logo"
          class="h-16 w-auto"
          @error="(e) => (e.target.src = '/fallback-logo.svg')"
        />
      </NuxtLink>

      <!-- Navigation Links -->
      <nav class="hidden md:flex space-x-1 items-center">
        <div
          v-for="category in headerCategories"
          :key="category.id"
          class="relative group"
          @mouseenter="handleCategoryMouseEnter(category, $event)"
          @mouseleave="handleCategoryMouseLeave"
        >
          <NuxtLink
            :to="`/categories/${category.slug}`"
            class="text-venus-text-primary px-3 py-2 border-b-2 border-transparent hover:border-peach-pink hover:text-peach-pink font-medium transition-colors duration-200 ease-in-out"
          >
            {{ category.name }}
          </NuxtLink>
        </div>
        <NuxtLink
          to="/sale"
          class="text-venus-text-primary px-3 py-2 border-b-2 border-transparent hover:border-peach-pink hover:text-peach-pink font-bold transition-colors duration-200 ease-in-out"
        >
          Sale
        </NuxtLink>
        <NuxtLink
          to="/new-arrivals"
          class="text-venus-text-primary px-3 py-2 border-b-2 border-transparent hover:border-peach-pink hover:text-peach-pink font-bold transition-colors duration-200 ease-in-out"
        >
          New Arrivals
        </NuxtLink>
      </nav>

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
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
          <button
            @click="openFilterModal"
            aria-label="Advanced Filters"
            class="p-2 text-gray-500 hover:text-peach-pink transition-colors"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.293.707l-2 2A1 1 0 019 17v-6.586L4.293 6.707A1 1 0 014 6V3zm2 2v1h10V5H5zm0 3h10l-2 2H7L5 8z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <!-- Conditional Auth Links -->
        <ClientOnly>
          <template v-if="isAuthInitialized">
            <template v-if="!isAuthenticated">
              <NuxtLink
                to="/login"
                class="text-sm font-medium text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out"
                >Login</NuxtLink
              >
              <NuxtLink
                to="/register"
                class="text-sm font-medium text-white bg-peach-pink hover:bg-opacity-90 px-4 py-2 rounded-md transition-colors duration-200 ease-in-out"
                >Sign Up</NuxtLink
              >
            </template>
            <template v-else>
              <NuxtLink
                to="/profile"
                aria-label="My Account"
                class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </NuxtLink>
            </template>
          </template>
          <template #fallback>
            <div class="h-8 w-24"></div>
          </template>
        </ClientOnly>

        <NuxtLink
          to="/cart"
          aria-label="Cart"
          class="text-venus-text-primary hover:text-peach-pink transition-colors duration-200 ease-in-out"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </NuxtLink>
      </div>
    </div>

    <!-- Filters Modal -->
    <HeaderFilterModal
      :is-open="isFilterModalOpen"
      :initial-search-term-from-header="headerSearchTerm"
      @close="closeFilterModal"
      @apply-header-filters="handleApplyHeaderFilters"
      @reset-header-filters="handleResetHeaderFilters"
    />

    <!-- Category Product Preview Dropdown (wrapped for proper positioning & events) -->
    <div
      v-if="hoveredCategoryId && currentHoveredCategory"
      :style="dropdownPositionStyle"
      class="absolute"
      @mouseenter="clearDropdownTimeout"
      @mouseleave="handleCategoryMouseLeave"
    >
      <CategoryProductPreviewDropdown
        :key="hoveredCategoryId"
        :products="hoveredCategoryProducts"
        :category-name="currentHoveredCategory.name"
        :category-slug="currentHoveredCategory.slug"
        :is-loading="isDropdownLoading"
      />
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import { useRouter, useNuxtApp } from '#app';
import { useAuth } from '~/composables/useAuth';
import { useSiteSettings } from '~/composables/useSiteSettings';
import HeaderFilterModal from '~/components/modals/HeaderFilterModal.vue';
import CategoryProductPreviewDropdown from '~/components/categories/CategoryProductPreviewDropdown.vue';

// ---- Auth composable ----
const { isAuthenticated, isAuthInitialized } = useAuth();

// ---- Site Settings composable ----
const { settings: siteSettings } = useSiteSettings();

// ---- Nuxt & Router ----
const router = useRouter();
const { $axios } = useNuxtApp();

// ---- UI State ----
const headerSearchTerm = ref('');
const headerCategories = ref([]);
const isFilterModalOpen = ref(false);

// ---- Dropdown State ----
const hoveredCategoryId = ref(null);
const hoveredCategoryProducts = ref([]);
const isDropdownLoading = ref(false);
const dropdownPositionStyle = reactive({ top: '0px', left: '0px' });
const activeDropdownTimeoutId = ref(null);
const productPreviewCache = reactive({});
const PRODUCTS_PREVIEW_LIMIT = 4;

const currentHoveredCategory = computed(() => {
  return headerCategories.value.find((cat) => cat.id === hoveredCategoryId.value);
});

// ---- Fetch categories ----
const fetchHeaderCategories = async () => {
  try {
    // Use the dedicated menu endpoint to get only categories that should be shown in the menu
    const { data } = await $axios.get('/categories/menu');
    headerCategories.value = data || [];
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    headerCategories.value = [];
  }
};

onMounted(() => {
  fetchHeaderCategories();
});

// ---- Search ----
const submitHeaderSearch = () => {
  const term = headerSearchTerm.value.trim();
  router.push({ path: '/products', query: term ? { searchTerm: term } : {} });
};

// ---- Filters ----
const openFilterModal = () => {
  isFilterModalOpen.value = true;
};

const closeFilterModal = () => {
  isFilterModalOpen.value = false;
};

const handleApplyHeaderFilters = (appliedFilters) => {
  const { path, query: currentQuery } = router.currentRoute.value;
  const newQuery = { ...appliedFilters };

  // Ensure headerSearchTerm is included if not already part of appliedFilters from ProductFilters component
  if (headerSearchTerm.value.trim() && !newQuery.searchTerm) {
    newQuery.searchTerm = headerSearchTerm.value.trim();
  }
  // If ProductFilters already provided a searchTerm, it will be used.
  // If headerSearchTerm exists and ProductFilters had an empty search, headerSearchTerm takes precedence.

  Object.keys(newQuery).forEach((k) => {
    if (newQuery[k] === null || newQuery[k] === undefined || newQuery[k] === '') delete newQuery[k];
  });

  const filterablePaths = ['/', '/products'];
  // Check if current path is a category page
  const isCategoryPage = /^\/categories\/[^/]+$/.test(path);

  if (filterablePaths.includes(path) || isCategoryPage) {
    router.push({ path, query: newQuery });
  } else {
    router.push({ path: '/products', query: newQuery });
  }
  closeFilterModal();
};

const handleResetHeaderFilters = () => {
  const { path, query: currentQuery } = router.currentRoute.value;
  let resetQuery = {};
  // Preserve header search term if user specifically wants to reset other filters but keep search
  if (headerSearchTerm.value.trim()) {
    resetQuery.searchTerm = headerSearchTerm.value.trim();
  }

  const filterablePaths = ['/', '/products'];
  const isCategoryPage = /^\/categories\/[^/]+$/.test(path);

  if (filterablePaths.includes(path) || isCategoryPage) {
    router.push({ path, query: resetQuery });
  } else {
    // If on a non-filterable page and resetting, just go to products page with minimal (search term only) query
    router.push({ path: '/products', query: resetQuery });
  }
  closeFilterModal();
};

// ---- Dropdown hover logic ----
const handleCategoryMouseEnter = async (category, event) => {
  clearDropdownTimeout();
  hoveredCategoryId.value = category.id;
  isDropdownLoading.value = true;

  const rect = event.currentTarget.getBoundingClientRect();
  dropdownPositionStyle.top = `${rect.bottom + window.scrollY + 4}px`;
  dropdownPositionStyle.left = `${rect.left + window.scrollX}px`;

  if (productPreviewCache[category.id]) {
    hoveredCategoryProducts.value = productPreviewCache[category.id];
    isDropdownLoading.value = false;
    return;
  }

  try {
    const { data } = await $axios.get('/products', {
      params: {
        category_id: category.id,
        limit: PRODUCTS_PREVIEW_LIMIT,
        sort_by: 'created_at',
        sort_order: 'desc',
      },
    });
    hoveredCategoryProducts.value = data.products || [];
    productPreviewCache[category.id] = hoveredCategoryProducts.value;
  } catch (error) {
    hoveredCategoryProducts.value = [];
  } finally {
    isDropdownLoading.value = false;
  }
};

const handleCategoryMouseLeave = () => {
  activeDropdownTimeoutId.value = setTimeout(() => {
    hoveredCategoryId.value = null;
    hoveredCategoryProducts.value = [];
    isDropdownLoading.value = false;
  }, 200);
};

const clearDropdownTimeout = () => {
  if (activeDropdownTimeoutId.value) {
    clearTimeout(activeDropdownTimeoutId.value);
    activeDropdownTimeoutId.value = null;
  }
};
</script>

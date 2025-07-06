<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Edit Hero Banner #{{ bannerId }}</h1>
    <div v-if="isLoading" class="text-center py-10">
      <p>Loading banner data...</p>
    </div>
    <div v-else-if="fetchError" class="my-3 p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg">
      Error loading banner: {{ fetchError }}
    </div>
    <HeroBannerForm
      v-if="bannerData"
      :initial-data="bannerData"
      :is-edit-mode="true"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleUpdateBanner"
    />
    <div v-else-if="!isLoading && !fetchError" class="my-3 p-3 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-lg">
       Banner not found or could not be loaded.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNuxtApp } from '#app';

import HeroBannerForm from '~/components/admin/HeroBannerForm.vue';

definePageMeta({
  layout: 'admin',
  permission: 'marketing:manage_hero_banners'
});

const route = useRoute();
const bannerId = computed(() => route.params.id);

useHead({ title: `Edit Hero Banner ${bannerId.value}` });



const { $axios, $toast } = useNuxtApp();
const router = useRouter();

const bannerData = ref(null);
const isLoading = ref(true);
const isSubmitting = ref(false);
const apiError = ref('');
const fetchError = ref('');

async function fetchBannerData() {
  isLoading.value = true;
  fetchError.value = '';
  apiError.value = '';
  try {
    const response = await $axios.get(`/admin/hero-banners/${bannerId.value}`);
    bannerData.value = response.data.data; // API returns { data: banner }
    // The HeroBannerForm expects camelCase props, but cmsService maps to camelCase on fetch.
    // If API returns snake_case, HeroBannerForm's watch on initialData should handle it,
    // or we map here if needed. cmsService already maps to camelCase.
  } catch (err) {
    console.error('Error fetching hero banner for edit:', err.response?.data || err.message);
    fetchError.value = err.response?.data?.message || err.message || 'Failed to load banner data.';
    if (typeof $toast !== 'undefined' && $toast.error) {
      $toast.error(fetchError.value);
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleUpdateBanner(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  
  // Debug: Log what's being sent
  if (process.dev) {
    console.log('Sending update request for banner:', bannerId.value);
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }
  }
  
  try {
    await $axios.put(`/admin/hero-banners/${bannerId.value}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Important for file uploads
      },
    });
    if (typeof $toast !== 'undefined' && $toast.success) {
      $toast.success('Hero banner updated successfully!');
    }
    router.push('/admin/marketing/hero-banners');
  } catch (err) {
    console.error('Error updating hero banner:', err.response?.data || err.message);
    
    // Log detailed validation errors
    if (err.response?.data?.errors) {
      console.log('Validation errors:', err.response.data.errors);
      console.log('Full error response:', err.response.data);
      const validationErrors = err.response.data.errors.map(e => `${e.path || e.field || e.param}: ${e.msg}`).join('; ');
      apiError.value = `Validation failed: ${validationErrors}`;
    } else {
      apiError.value = err.response?.data?.message || err.message || 'Failed to update hero banner.';
    }
    
    if (typeof $toast !== 'undefined' && $toast.error) {
      $toast.error(apiError.value);
    }
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  if (bannerId.value) {
    fetchBannerData();
  } else {
    fetchError.value = "Banner ID is missing.";
    isLoading.value = false;
  }
});
</script>

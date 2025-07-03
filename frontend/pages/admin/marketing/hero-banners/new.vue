<template>
  <div>
    <Breadcrumbs :items="breadcrumbs" />
    <h1 class="text-2xl font-bold mb-4">Create New Hero Banner</h1>
    <HeroBannerForm
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleCreateBanner"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNuxtApp } from '#app';
import { useToast } from 'vue-toastification';
import Breadcrumbs from '~/components/admin/Breadcrumbs.vue';
import HeroBannerForm from '~/components/admin/HeroBannerForm.vue';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'rbac'],
  permission: 'marketing:manage_hero_banners'
});

useHead({ title: 'Create Hero Banner' });

const breadcrumbs = [
  { text: 'Admin', href: '/admin' },
  { text: 'Marketing', href: '/admin/marketing' },
  { text: 'Hero Banners', href: '/admin/marketing/hero-banners' },
  { text: 'Create New' }
];

const { $axios } = useNuxtApp();
const router = useRouter();
const toast = useToast();

const isSubmitting = ref(false);
const apiError = ref('');

async function handleCreateBanner(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // Assuming the backend expects 'bannerImage' for the file if provided
    await $axios.post('/admin/hero-banners', formData, {
      headers: {
        'Content-Type': 'multipart/form-data' // Important for file uploads
      }
    });
    toast.success('Hero banner created successfully!');
    router.push('/admin/marketing/hero-banners');
  } catch (err) {
    console.error('Error creating hero banner:', err.response?.data || err.message);
    apiError.value = err.response?.data?.message || err.message || 'Failed to create hero banner.';
    if (err.response?.data?.errors) {
      // Handle more specific validation errors if backend provides them
      // For example, joining them into the apiError string
      const validationErrors = err.response.data.errors.map(e => `${e.field || e.param}: ${e.msg}`).join('; ');
      apiError.value = `Validation failed: ${validationErrors}`;
    }
    toast.error(apiError.value);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

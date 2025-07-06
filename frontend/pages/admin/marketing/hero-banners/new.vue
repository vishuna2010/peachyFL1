<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Create New Hero Banner</h1>
    <HeroBannerForm
      :initial-data="{}"
      :is-edit-mode="false"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleCreateBanner"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useNuxtApp } from '#app';
import HeroBannerForm from '~/components/admin/HeroBannerForm.vue';

definePageMeta({
  layout: 'admin',
  permission: 'marketing:manage_hero_banners'
});

useHead({ title: 'Create New Hero Banner' });



const { $axios, $toast } = useNuxtApp();
const router = useRouter();

const isSubmitting = ref(false);
const apiError = ref('');

async function handleCreateBanner(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    await $axios.post('/admin/hero-banners', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (typeof $toast !== 'undefined' && $toast.success) {
      $toast.success('Hero banner created successfully!');
    }
    router.push('/admin/marketing/hero-banners');
  } catch (err) {
    console.error('Error creating hero banner:', err.response?.data || err.message);
    apiError.value = err.response?.data?.message || err.message || 'Failed to create hero banner.';
    if (err.response?.data?.errors) {
      const validationErrors = err.response.data.errors.map(e => `${e.field || e.param}: ${e.msg}`).join('; ');
      apiError.value = `Validation failed: ${validationErrors}`;
    }
    if (typeof $toast !== 'undefined' && $toast.error) {
      $toast.error(apiError.value);
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

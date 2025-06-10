<template>
  <div class="admin-new-discount-page">
    <h2>Create New Discount Code</h2>
    <DiscountForm
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleCreateDiscount"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useNuxtApp, useRouter } from '#app';
import DiscountForm from '~/components/admin/DiscountForm.vue';

definePageMeta({
  layout: 'admin',
  title: 'New Discount'
});

const { $axios } = useNuxtApp();
const router = useRouter();

const isSubmitting = ref(false);
const apiError = ref('');

async function handleCreateDiscount(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // The DiscountForm component already prepares the payload,
    // including converting empty strings for nullable numbers to null.
    await $axios.post('/admin/discounts', formData);
    // Consider showing a success toast/notification here
    router.push('/admin/discounts?created=success'); // Redirect to list page with a success query
  } catch (error) {
    console.error('Error creating discount code:', error);
    apiError.value = error.response?.data?.message || 'Failed to create discount code.';
  } finally {
    isSubmitting.value = false;
  }
}

useHead({
  title: 'Admin - Create Discount',
});
</script>

<style scoped>
.admin-new-discount-page {
  max-width: 800px;
  margin: 1.5rem auto;
  padding: 1rem;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}
</style>

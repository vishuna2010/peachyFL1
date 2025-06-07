<template>
  <div class="admin-new-supplier-page">
    <h2>Create New Supplier</h2>
    <SupplierForm
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleCreateSupplier"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useNuxtApp, useRouter } from '#app';
import SupplierForm from '~/components/admin/SupplierForm.vue';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const router = useRouter();

const isSubmitting = ref(false);
const apiError = ref('');

async function handleCreateSupplier(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    await $axios.post('/admin/suppliers', formData);
    router.push('/admin/suppliers?created=success');
  } catch (error) {
    console.error('Error creating supplier:', error);
    apiError.value = error.response?.data?.message || 'Failed to create supplier.';
  } finally {
    isSubmitting.value = false;
  }
}

useHead({
  title: 'Admin - Create Supplier',
});
</script>

<style scoped>
.admin-new-supplier-page {
  max-width: 800px;
  margin: 1.5rem auto;
  padding: 1rem;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}
</style>

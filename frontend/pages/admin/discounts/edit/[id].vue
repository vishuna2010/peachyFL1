<template>
  <div class="admin-edit-discount-page">
    <h2>Edit Discount Code</h2>
    <div v-if="isLoading" class="loading-state">Loading discount details...</div>
    <div v-else-if="fetchError" class="error-message">
      {{ fetchError }}
      <p><NuxtLink to="/admin/discounts">Back to list</NuxtLink></p>
    </div>
    <DiscountForm
      v-else-if="discountData"
      :initial-data="discountData"
      :is-edit-mode="true"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleUpdateDiscount"
    />
    <div v-else class="error-message">
        Discount not found.
        <NuxtLink to="/admin/discounts">Back to list</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';
import DiscountForm from '~/components/admin/DiscountForm.vue';

definePageMeta({
  layout: 'admin',
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const discountData = ref(null);
const isLoading = ref(true);
const fetchError = ref('');
const isSubmitting = ref(false);
const apiError = ref('');

const discountId = route.params.id;

async function fetchDiscount() {
  isLoading.value = true;
  fetchError.value = '';
  try {
    const response = await $axios.get(`/admin/discounts/${discountId}`);
    discountData.value = response.data;
  } catch (error) {
    console.error('Error fetching discount details:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load discount details.';
    if (error.response?.status === 404) {
        discountData.value = null; // Ensure form is not shown if 404
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleUpdateDiscount(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // The DiscountForm component prepares the payload.
    // We don't send 'code' or 'times_used' as they are not updatable via this form.
    // Backend should ignore them if sent, or we can strip them here.
    const { code, times_used, ...updatePayload } = formData;

    await $axios.put(`/admin/discounts/${discountId}`, updatePayload);
    // Consider showing a success toast/notification here
    router.push('/admin/discounts?updated=success'); // Redirect to list page
  } catch (error) {
    console.error('Error updating discount code:', error);
    apiError.value = error.response?.data?.message || 'Failed to update discount code.';
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(fetchDiscount);

useHead({
  title: 'Admin - Edit Discount',
});
</script>

<style scoped>
.admin-edit-discount-page {
  max-width: 800px;
  margin: 1.5rem auto;
  padding: 1rem;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}
.loading-state {
  text-align: center;
  padding: 2rem;
}
.error-message {
  color: red;
  background-color: #ffe0e0;
  padding: 1rem;
  border-radius: 4px;
  text-align: center;
}
</style>

<template>
  <div class="admin-edit-supplier-page">
    <h2>Edit Supplier</h2>
    <div v-if="isLoading" class="loading-state">Loading supplier details...</div>
    <div v-else-if="fetchError" class="error-message">
      {{ fetchError }}
      <p><NuxtLink to="/admin/suppliers">Back to list</NuxtLink></p>
    </div>
    <SupplierForm
      v-else-if="supplierData"
      :initial-data="supplierData"
      :is-edit-mode="true"
      :is-submitting="isSubmitting"
      :api-error="apiError"
      @submit="handleUpdateSupplier"
    />
    <div v-else class="error-message">
        Supplier not found.
        <NuxtLink to="/admin/suppliers">Back to list</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp, useRoute, useRouter } from '#app';
import SupplierForm from '~/components/admin/SupplierForm.vue';

definePageMeta({
  layout: 'admin',
  title: 'Edit Supplier'
});

const { $axios } = useNuxtApp();
const route = useRoute();
const router = useRouter();

const supplierData = ref(null);
const isLoading = ref(true);
const fetchError = ref('');
const isSubmitting = ref(false);
const apiError = ref('');

const supplierId = route.params.id;

async function fetchSupplier() {
  isLoading.value = true;
  fetchError.value = '';
  try {
    const response = await $axios.get(`/admin/suppliers/${supplierId}`);
    supplierData.value = response.data;
  } catch (error) {
    console.error('Error fetching supplier details:', error);
    fetchError.value = error.response?.data?.message || 'Failed to load supplier details.';
    if (error.response?.status === 404) {
        supplierData.value = null;
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleUpdateSupplier(formData) {
  isSubmitting.value = true;
  apiError.value = '';
  try {
    // The SupplierForm component prepares the payload.
    // The backend PUT route for suppliers handles partial updates based on provided fields.
    await $axios.put(`/admin/suppliers/${supplierId}`, formData);
    router.push('/admin/suppliers?updated=success');
  } catch (error) {
    console.error('Error updating supplier:', error);
    apiError.value = error.response?.data?.message || 'Failed to update supplier.';
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(fetchSupplier);

useHead({
  title: 'Admin - Edit Supplier',
});
</script>

<style scoped>
.admin-edit-supplier-page {
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

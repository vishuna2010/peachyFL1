<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-2xl font-semibold text-gray-900 mb-8">Stock Adjustments</h1>

    <div class="md:grid md:grid-cols-2 md:gap-8">
      <!-- Write-Off / Other Adjustments Form Section -->
      <div class="bg-white shadow-md rounded-lg p-6 border border-gray-200 mb-8 md:mb-0">
        <h2 class="text-xl font-semibold text-gray-800 mb-6">Record Write-Off / Negative Adjustment</h2>
        <form @submit.prevent="handleWriteOffSubmit" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
            <div class="flex items-center space-x-4">
              <label class="inline-flex items-center">
                <input type="radio" class="form-radio h-4 w-4 text-brand-primary focus:ring-brand-primary-light" v-model="writeOffItemType" value="product">
                <span class="ml-2 text-sm text-gray-700">Product</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" class="form-radio h-4 w-4 text-brand-primary focus:ring-brand-primary-light" v-model="writeOffItemType" value="variant">
                <span class="ml-2 text-sm text-gray-700">Variant</span>
              </label>
            </div>
          </div>

          <div>
            <label for="writeOffItemId" class="block text-sm font-medium text-gray-700">
              {{ writeOffItemType === 'product' ? 'Product ID' : 'Variant ID' }} <span class="text-red-500">*</span>
            </label>
            <input type="number" id="writeOffItemId" v-model.number="writeOffItemId" min="1" required
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm"
                   :placeholder="writeOffItemType === 'product' ? 'Enter Product ID' : 'Enter Variant ID'">
          </div>

          <div>
            <label for="writeOffQuantity" class="block text-sm font-medium text-gray-700">
              Quantity to Decrease <span class="text-red-500">*</span>
            </label>
            <input type="number" id="writeOffQuantity" v-model.number="writeOffQuantity" min="1" required
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm"
                   placeholder="e.g., 5">
            <p class="mt-1 text-xs text-gray-500">This quantity will be subtracted from the current stock.</p>
          </div>

          <div>
            <label for="writeOffMovementType" class="block text-sm font-medium text-gray-700">Adjustment Type <span class="text-red-500">*</span></label>
            <select id="writeOffMovementType" v-model="writeOffMovementType" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm">
              <option value="write_off">Write-Off</option>
              <option value="damage">Damage</option>
              <option value="inventory_loss">Inventory Loss</option>
              <option value="correction_decrease">Correction (Decrease)</option>
            </select>
          </div>

          <div>
            <label for="writeOffReason" class="block text-sm font-medium text-gray-700">
              Reason <span class="text-red-500">*</span>
            </label>
            <textarea id="writeOffReason" v-model.trim="writeOffReason" rows="3" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm"
                      placeholder="Reason for this stock adjustment"></textarea>
          </div>

          <div>
            <button type="submit" :disabled="isWriteOffLoading"
                    class="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light disabled:opacity-50">
              {{ isWriteOffLoading ? 'Processing...' : 'Record Negative Adjustment' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Physical Count Form Section -->
      <div class="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800 mb-6">Record Physical Count</h2>
        <form @submit.prevent="handlePhysicalCountSubmit" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
            <div class="flex items-center space-x-4">
              <label class="inline-flex items-center">
                <input type="radio" class="form-radio h-4 w-4 text-brand-primary focus:ring-brand-primary-light" v-model="physicalCountItemType" value="product">
                <span class="ml-2 text-sm text-gray-700">Product</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" class="form-radio h-4 w-4 text-brand-primary focus:ring-brand-primary-light" v-model="physicalCountItemType" value="variant">
                <span class="ml-2 text-sm text-gray-700">Variant</span>
              </label>
            </div>
          </div>

          <div>
            <label for="physicalCountItemId" class="block text-sm font-medium text-gray-700">
              {{ physicalCountItemType === 'product' ? 'Product ID' : 'Variant ID' }} <span class="text-red-500">*</span>
            </label>
            <input type="number" id="physicalCountItemId" v-model.number="physicalCountItemId" min="1" required
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm"
                   :placeholder="physicalCountItemType === 'product' ? 'Enter Product ID' : 'Enter Variant ID'">
          </div>

          <div>
            <label for="physicalCountCountedQuantity" class="block text-sm font-medium text-gray-700">
              Actual Counted Quantity <span class="text-red-500">*</span>
            </label>
            <input type="number" id="physicalCountCountedQuantity" v-model.number="physicalCountCountedQuantity" min="0" required
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm"
                   placeholder="e.g., 150">
             <p class="mt-1 text-xs text-gray-500">The stock level will be updated to this value.</p>
          </div>

          <div>
            <label for="physicalCountReason" class="block text-sm font-medium text-gray-700">
              Reason for Count / Discrepancy <span class="text-red-500">*</span>
            </label>
            <textarea id="physicalCountReason" v-model.trim="physicalCountReason" rows="3" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary-light focus:border-brand-primary-light sm:text-sm"
                      placeholder="e.g., Annual physical count, discrepancy investigation"></textarea>
          </div>

          <div>
            <button type="submit" :disabled="isPhysicalCountLoading"
                    class="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-light disabled:opacity-50">
              {{ isPhysicalCountLoading ? 'Processing...' : 'Update to Counted Quantity' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useNuxtApp, definePageMeta, useHead } from '#imports';
import { useToast } from 'vue-toastification';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Stock Adjustments',
});

const { $axios } = useNuxtApp();
const toast = useToast();

// Write-Off Form State
const writeOffItemType = ref('product'); // 'product' or 'variant'
const writeOffItemId = ref(null);
const writeOffQuantity = ref(null);
const writeOffReason = ref('');
const writeOffMovementType = ref('write_off'); // Default type
const isWriteOffLoading = ref(false);

// Physical Count Form State
const physicalCountItemType = ref('product'); // 'product' or 'variant'
const physicalCountItemId = ref(null);
const physicalCountCountedQuantity = ref(null);
const physicalCountReason = ref('');
const isPhysicalCountLoading = ref(false);

const resetWriteOffForm = () => {
  writeOffItemType.value = 'product';
  writeOffItemId.value = null;
  writeOffQuantity.value = null;
  writeOffReason.value = '';
  writeOffMovementType.value = 'write_off';
};

const resetPhysicalCountForm = () => {
  physicalCountItemType.value = 'product';
  physicalCountItemId.value = null;
  physicalCountCountedQuantity.value = null;
  physicalCountReason.value = '';
};

const handleWriteOffSubmit = async () => {
  isWriteOffLoading.value = true;
  if (!writeOffItemId.value || writeOffQuantity.value === null || writeOffQuantity.value <= 0 || !writeOffReason.value || !writeOffMovementType.value) {
    toast.error('Please fill in all required fields for write-off and ensure quantity is positive.');
    isWriteOffLoading.value = false;
    return;
  }

  const payload = {
    item_type: writeOffItemType.value,
    item_id: parseInt(writeOffItemId.value),
    quantity: parseInt(writeOffQuantity.value), // This is the amount to DECREASE by
    reason: writeOffReason.value,
    movement_type: writeOffMovementType.value,
  };

  try {
    await $axios.post('/admin/stock-adjustments/write-off', payload);
    toast.success('Stock adjustment recorded successfully.');
    resetWriteOffForm();
  } catch (error) {
    console.error('Error recording write-off:', error);
    toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Failed to record stock adjustment.');
  } finally {
    isWriteOffLoading.value = false;
  }
};

const handlePhysicalCountSubmit = async () => {
  isPhysicalCountLoading.value = true;
  if (!physicalCountItemId.value || physicalCountCountedQuantity.value === null || physicalCountCountedQuantity.value < 0 || !physicalCountReason.value) {
    toast.error('Please fill in all required fields for physical count and ensure counted quantity is not negative.');
    isPhysicalCountLoading.value = false;
    return;
  }

  const payload = {
    item_type: physicalCountItemType.value,
    item_id: parseInt(physicalCountItemId.value),
    counted_quantity: parseInt(physicalCountCountedQuantity.value), // This is the NEW actual quantity
    reason: physicalCountReason.value,
  };

  try {
    await $axios.post('/admin/stock-adjustments/physical-count', payload);
    toast.success('Physical count recorded and stock updated successfully.');
    resetPhysicalCountForm();
  } catch (error) {
    console.error('Error recording physical count:', error);
    toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Failed to record physical count.');
  } finally {
    isPhysicalCountLoading.value = false;
  }
};
</script>

<style scoped>
/* Add any component-specific styles here if needed */
.form-radio {
  color: #4f46e5; /* brand-primary, ensure this matches your theme */
}
.form-radio:focus {
  ring-color: #a5b4fc; /* brand-primary-light */
}
</style>

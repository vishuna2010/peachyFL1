<template>
  <div class="admin-new-po-page">
    <h2>Create New Purchase Order</h2>
    <div v-if="isLoadingInitialData" class="loading-state">Loading necessary data...</div>
    <div v-else-if="fetchError" class="error-message">{{ fetchError }}</div>

    <form v-else @submit.prevent="submitPurchaseOrder" class="po-form">
      <h3>Header Details</h3>
      <div class="form-row">
        <div class="form-group">
          <label for="supplier_id">Supplier:</label>
          <select id="supplier_id" v-model="poData.supplier_id" required>
            <option :value="null" disabled>-- Select Supplier --</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="order_date">Order Date:</label>
          <input type="date" id="order_date" v-model="poData.order_date" />
        </div>
        <div class="form-group">
          <label for="expected_delivery_date">Expected Delivery Date (Optional):</label>
          <input type="date" id="expected_delivery_date" v-model="poData.expected_delivery_date" />
        </div>
      </div>
      <div class="form-group">
        <label for="notes">Notes (Optional):</label>
        <textarea id="notes" v-model="poData.notes"></textarea>
      </div>

      <h3>Line Items</h3>
      <div v-if="productsLoading" class="loading-state">Loading products for selected supplier...</div>
      <div v-else-if="!poData.supplier_id" class="info-message">Please select a supplier to see available products.</div>
      <div v-else-if="availableProducts.length === 0 && poData.supplier_id && !productsLoading" class="info-message">No products found for the selected supplier, or products are still loading.</div>

      <div v-if="!productsLoading && poData.supplier_id && availableProducts.length > 0">
        <div v-for="(item, index) in poItems" :key="index" class="line-item-row">
          <div class="form-group product-select">
            <label :for="`product-${index}`">Product:</label>
            <select :id="`product-${index}`" v-model="item.product_id" @change="updateItemDetails(index)" required :disabled="!poData.supplier_id || availableProducts.length === 0">
              <option :value="null" disabled>-- Select Product --</option>
              <option v-for="product in availableProducts" :key="product.id" :value="product.id">
                {{ product.name }} (SKU: {{ product.sku || 'N/A' }})
              </option>
            </select>
          </div>
          
          <!-- Variant Selection -->
          <div v-if="item.product_id && getSelectedProduct(index)?.has_variants" class="form-group variant-select">
            <label :for="`variant-${index}`">Variant:</label>
            <select :id="`variant-${index}`" v-model="item.product_variant_id" @change="updateVariantDetails(index)" required>
              <option :value="null" disabled>-- Select Variant --</option>
              <option v-for="variant in item.variants" :key="variant.id" :value="variant.id">
                {{ formatVariantDisplay(variant) }}
              </option>
            </select>
          </div>
          
          <div class="form-group qty-input">
            <label :for="`quantity-${index}`">Quantity Ordered:</label>
            <input type="number" :id="`quantity-${index}`" v-model.number="item.quantity_ordered" min="1" required />
          </div>
          <div class="form-group cost-input">
            <label :for="`cost-${index}`">Unit Cost Price ($):</label>
            <input type="number" :id="`cost-${index}`" v-model.number="item.unit_cost_price" min="0" step="0.01" required />
          </div>
          <button type="button" @click="removeItem(index)" class="remove-item-button" :disabled="poItems.length <= 1">&times;</button>
        </div>
        <button type="button" @click="addItem" class="add-item-button">Add Another Item</button>
      </div>

      <div v-if="apiError" class="error-message api-error">{{ apiError }}</div>
      <button type="submit" :disabled="isSubmitting || !poData.supplier_id || productsLoading" class="submit-button">
        {{ isSubmitting ? 'Creating PO...' : 'Create Purchase Order' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue';
import { useNuxtApp, useRouter } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'New Purchase Order'
});

const { $axios } = useNuxtApp();
const router = useRouter();

const poData = reactive({
  supplier_id: null,
  order_date: new Date().toISOString().split('T')[0], // Default to today
  expected_delivery_date: null,
  notes: '',
});

const poItems = reactive([{ 
  product_id: null, 
  product_variant_id: null,
  quantity_ordered: 1, 
  unit_cost_price: 0.00, 
  productName: '',
  variants: []
}]);

const suppliers = ref([]);
const availableProducts = ref([]);
const isLoadingInitialData = ref(true); // For initial supplier load
const productsLoading = ref(false); // For loading products of a supplier
const fetchError = ref(''); // For initial supplier load error
const isSubmitting = ref(false);
const apiError = ref(''); // For submission errors or product load errors related to API

async function fetchInitialSuppliers() {
  isLoadingInitialData.value = true;
  fetchError.value = '';
  try {
    const supResponse = await $axios.get('/admin/suppliers');
    suppliers.value = supResponse.data.data || supResponse.data;
  } catch (error) {
    console.error('Error fetching suppliers for PO form:', error);
    fetchError.value = 'Failed to load suppliers. Please try again.';
  } finally {
    isLoadingInitialData.value = false;
  }
}

async function fetchProductsForSupplier(supplierId) {
  if (!supplierId) {
    availableProducts.value = [];
    poItems.splice(0, poItems.length, { product_id: null, quantity_ordered: 1, unit_cost_price: 0.00, productName: '', product_variant_id: null, variants: [] });
    return;
  }
  productsLoading.value = true;
  apiError.value = ''; // Clear previous errors

  try {
    const prodResponse = await $axios.get(`/admin/products?supplier_id=${supplierId}&limit=100&status=active`);
    availableProducts.value = prodResponse.data.data || prodResponse.data;

    poItems.forEach(item => {
      item.product_id = null;
      item.productName = '';
      item.product_variant_id = null;
      item.variants = [];
    });
    if (poItems.length === 0) {
      addItem();
    } else if (poItems.length > 0 && availableProducts.value.length === 0) {
      // If items exist but no products for new supplier, ensure at least one item remains, reset.
      // This might be slightly aggressive, consider user experience.
      // For now, if no products, the first item's product_id will be null.
    }
     // Ensure at least one item row is present if availableProducts exist
    if (poItems.length === 0 && availableProducts.value.length > 0) {
        addItem();
    }


  } catch (error) {
    availableProducts.value = [];
    apiError.value = `Failed to load products for supplier. ${error.response?.data?.message || error.message || ''}`;
  } finally {
    productsLoading.value = false;
  }
}

watch(() => poData.supplier_id, (newSupplierId, oldSupplierId) => {
  if (newSupplierId !== oldSupplierId) {
    // Clear products and items immediately for better UX before new products load
    availableProducts.value = [];
    poItems.splice(0, poItems.length, { product_id: null, quantity_ordered: 1, unit_cost_price: 0.00, productName: '', product_variant_id: null, variants: [] });
    if (newSupplierId) {
      fetchProductsForSupplier(newSupplierId);
    }
  }
});

onMounted(fetchInitialSuppliers);

function addItem() {
  poItems.push({ 
    product_id: null, 
    product_variant_id: null,
    quantity_ordered: 1, 
    unit_cost_price: 0.00, 
    productName: '',
    variants: []
  });
}

function removeItem(index) {
  if (poItems.length > 1) {
    poItems.splice(index, 1);
  } else {
    // Optionally, clear the single item instead of an alert, or prevent deletion if it's the only one
    // For now, keeping original logic.
    // Handle error silently or show toast notification
  }
}

function getSelectedProduct(index) {
  return availableProducts.value.find(p => p.id === poItems[index].product_id);
}

function formatVariantDisplay(variant) {
  if (variant.option_values && variant.option_values.length > 0) {
    const optionText = variant.option_values.map(opt => `${opt.option_name}: ${opt.option_value}`).join(', ');
    return `${variant.sku} (${optionText})`;
  }
  return variant.sku || `Variant ${variant.id}`;
}

async function updateItemDetails(index) {
  const selectedProduct = availableProducts.value.find(p => p.id === poItems[index].product_id);
  if (selectedProduct) {
    poItems[index].productName = selectedProduct.name;
    poItems[index].product_variant_id = null; // Reset variant selection
    
    // If product has variants, fetch them
    if (selectedProduct.has_variants) {
      try {
        const variantResponse = await $axios.get(`/admin/purchase-orders/product/${selectedProduct.id}/variants`);
        poItems[index].variants = variantResponse.data.variants || [];
      } catch (error) {
        console.error('Error fetching variants:', error);
        poItems[index].variants = [];
      }
    } else {
      poItems[index].variants = [];
    }
  }
}

function updateVariantDetails(index) {
  const selectedVariant = poItems[index].variants.find(v => v.id === poItems[index].product_variant_id);
  if (selectedVariant) {
    // Optionally pre-fill cost price based on variant data
    // poItems[index].unit_cost_price = selectedVariant.cost_price || 0.00;
  }
}

async function submitPurchaseOrder() {
  apiError.value = '';
  if (!poData.supplier_id) {
    apiError.value = 'Please select a supplier.';
    return;
  }
  
  // Enhanced validation to check for variants when required
  const validationErrors = [];
  poItems.forEach((item, index) => {
    if (!item.product_id) {
      validationErrors.push(`Item ${index + 1}: Please select a product.`);
    } else {
      const product = getSelectedProduct(index);
      if (product?.has_variants && !item.product_variant_id) {
        validationErrors.push(`Item ${index + 1}: Please select a variant for ${product.name}.`);
      }
    }
    if (item.quantity_ordered <= 0) {
      validationErrors.push(`Item ${index + 1}: Quantity must be greater than 0.`);
    }
    if (item.unit_cost_price < 0) {
      validationErrors.push(`Item ${index + 1}: Unit cost must be non-negative.`);
    }
  });
  
  if (validationErrors.length > 0) {
    apiError.value = validationErrors.join(' ');
    return;
  }
  
  if (availableProducts.value.length === 0 && poData.supplier_id) {
    apiError.value = 'Cannot create PO as no products are available or loaded for the selected supplier.';
    return;
  }

  isSubmitting.value = true;
  const payload = {
    ...poData,
    items: poItems.map(item => ({
      product_id: item.product_id,
      product_variant_id: item.product_variant_id || null,
      quantity_ordered: item.quantity_ordered,
      unit_cost_price: item.unit_cost_price,
    })),
  };

  try {
    await $axios.post('/admin/purchase-orders', payload);
    router.push('/admin/purchase-orders?created=success');
  } catch (error) {
    apiError.value = error.response?.data?.message || 'Failed to create purchase order.';
  } finally {
    isSubmitting.value = false;
  }
}

useHead({
  title: 'Admin - Create Purchase Order',
});
</script>

<style scoped>
.admin-new-po-page { max-width: 900px; margin: 1.5rem auto; padding: 1rem; }
h2, h3 { text-align: center; margin-bottom: 1.5rem; }
h3 { font-size: 1.3em; margin-top: 2rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;}

.loading-state, .error-message, .info-message { text-align: center; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
.loading-state { background-color: #eef; }
.error-message { background-color: #fdd; color: #900; }
.info-message { background-color: #f0f8ff; color: #31708f; }
.api-error { margin-top: 1rem; }


.po-form { background-color: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
.form-group input[type="date"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.form-group textarea { min-height: 80px; }
.form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.form-row .form-group { flex: 1; min-width: 200px; }

.line-item-row { display: flex; gap: 1rem; align-items: end; margin-bottom: 1rem; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9; }
.form-group { flex: 1; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
.form-group textarea { min-height: 80px; resize: vertical; }
.product-select { flex: 2; }
.variant-select { flex: 2; }
.qty-input { flex: 1; }
.cost-input { flex: 1; }
.remove-item-button { background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 1.2rem; line-height: 1; }
.remove-item-button:hover { background: #c82333; }
.remove-item-button:disabled { background: #6c757d; cursor: not-allowed; }
.add-item-button { background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-bottom: 1rem; }
.add-item-button:hover { background: #218838; }
.submit-button { background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-size: 1rem; width: 100%; margin-top: 1rem; }
.submit-button:hover { background: #0056b3; }
.submit-button:disabled { background: #6c757d; cursor: not-allowed; }
</style>

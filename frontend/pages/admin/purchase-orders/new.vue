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

const poItems = reactive([{ product_id: null, quantity_ordered: 1, unit_cost_price: 0.00, productName: '' }]);

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
    poItems.splice(0, poItems.length, { product_id: null, quantity_ordered: 1, unit_cost_price: 0.00, productName: '' });
    return;
  }
  productsLoading.value = true;
  apiError.value = ''; // Clear previous errors

  try {
    const prodResponse = await $axios.get(`/admin/products?supplier_id=${supplierId}&limit=500&status=active`);
    availableProducts.value = prodResponse.data.data || prodResponse.data;

    poItems.forEach(item => {
      item.product_id = null;
      item.productName = '';
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
    console.error(`Error fetching products for supplier ${supplierId}:`, error);
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
    poItems.splice(0, poItems.length, { product_id: null, quantity_ordered: 1, unit_cost_price: 0.00, productName: '' });
    if (newSupplierId) {
      fetchProductsForSupplier(newSupplierId);
    }
  }
});

onMounted(fetchInitialSuppliers);

function addItem() {
  poItems.push({ product_id: null, quantity_ordered: 1, unit_cost_price: 0.00, productName: '' });
}

function removeItem(index) {
  if (poItems.length > 1) {
    poItems.splice(index, 1);
  } else {
    // Optionally, clear the single item instead of an alert, or prevent deletion if it's the only one
    // For now, keeping original logic.
    alert("A purchase order must have at least one item.");
  }
}

function updateItemDetails(index) {
  const selectedProduct = availableProducts.value.find(p => p.id === poItems[index].product_id);
  if (selectedProduct) {
    poItems[index].productName = selectedProduct.name;
    // Optionally pre-fill cost price if available on product or supplier-product association
    // poItems[index].unit_cost_price = selectedProduct.default_cost_price || 0.00;
  }
}

async function submitPurchaseOrder() {
  apiError.value = '';
  if (!poData.supplier_id) {
    apiError.value = 'Please select a supplier.';
    return;
  }
  if (poItems.some(item => !item.product_id || item.quantity_ordered <= 0 || item.unit_cost_price < 0)) {
    apiError.value = 'Please ensure all line items have a selected product, a valid quantity (>0), and a non-negative unit cost price.';
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
      quantity_ordered: item.quantity_ordered,
      unit_cost_price: item.unit_cost_price,
    })),
  };

  try {
    await $axios.post('/admin/purchase-orders', payload);
    router.push('/admin/purchase-orders?created=success');
  } catch (error) {
    console.error('Error creating purchase order:', error);
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

.line-item-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end; /* Align items to bottom for better layout with remove button */
  padding: 1rem 0;
  border-bottom: 1px dotted #eee;
}
.line-item-row .form-group { flex-grow: 1; }
.line-item-row .product-select { min-width: 250px; }
.line-item-row .qty-input { max-width: 120px; }
.line-item-row .cost-input { max-width: 150px; }

.remove-item-button {
  padding: 0.6rem 0.8rem; /* Adjust padding to match input height better */
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  height: fit-content; /* Fit to content height */
  line-height: 1; /* Ensure text is centered if font size makes it too tall */
}
.remove-item-button:disabled { background-color: #aaa; cursor: not-allowed; }
.remove-item-button:hover:not(:disabled) { background-color: #c82333; }

.add-item-button {
  margin-top: 0.5rem;
  padding: 0.6rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.add-item-button:hover { background-color: #0056b3; }

.submit-button {
  margin-top: 2rem;
  padding: 0.75rem 1.5rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: block; /* Center button */
  margin-left: auto;
  margin-right: auto;
}
.submit-button:disabled { background-color: #aaa; }
.submit-button:hover:not(:disabled) { background-color: #218838; }
</style>

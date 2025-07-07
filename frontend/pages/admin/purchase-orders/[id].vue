<template>
  <div class="admin-po-detail-page">
    <div v-if="isLoading" class="loading-state">Loading purchase order details...</div>
    <div v-if="fetchError" class="error-message">
      Error fetching PO details: {{ fetchError.message || fetchError }}
      <p v-if="fetchError.response && fetchError.response.status === 404">
        The requested purchase order was not found.
      </p>
      <NuxtLink to="/admin/purchase-orders" class="back-link">Back to Purchase Orders List</NuxtLink>
    </div>

    <div v-if="purchaseOrder && !isLoading" class="po-details-container">
      <div class="page-header">
        <h2>Purchase Order #{{ purchaseOrder.id }}</h2>
        <NuxtLink to="/admin/purchase-orders" class="back-link header-back-link">Back to List</NuxtLink>
      </div>

      <div v-if="actionMessage" class="action-message" :class="actionError ? 'error' : 'success'">
        {{ actionMessage }}
      </div>

      <div class="po-section po-info">
        <h3>Order Information</h3>
        <div class="info-grid">
            <p><strong>PO ID:</strong> {{ purchaseOrder.id }}</p>
            <p><strong>Status:</strong> <span :class="`status status-${purchaseOrder.status.toLowerCase()}`">{{ purchaseOrder.status }}</span></p>
            <p><strong>Order Date:</strong> {{ new Date(purchaseOrder.order_date).toLocaleDateString() }}</p>
            <p><strong>Expected Delivery:</strong> {{ purchaseOrder.expected_delivery_date ? new Date(purchaseOrder.expected_delivery_date).toLocaleDateString() : 'N/A' }}</p>
            <p><strong>Created At:</strong> {{ new Date(purchaseOrder.created_at).toLocaleString() }}</p>
            <p><strong>Last Updated:</strong> {{ new Date(purchaseOrder.updated_at).toLocaleString() }}</p>
        </div>
        <div v-if="purchaseOrder.notes" class="notes-section">
            <p><strong>Notes:</strong></p>
            <pre>{{ purchaseOrder.notes }}</pre>
        </div>
      </div>

      <div class="po-section supplier-info">
        <h3>Supplier Information</h3>
         <div class="info-grid">
            <p><strong>Name:</strong> {{ purchaseOrder.supplier_name }} (ID: {{ purchaseOrder.supplier_id }})</p>
            <!-- Add more supplier details here if returned by API and needed -->
        </div>
      </div>

      <div class="po-section creator-info" v-if="purchaseOrder.created_by_user_email">
        <h3>Created By</h3>
        <p><strong>Email:</strong> {{ purchaseOrder.created_by_user_email }} (User ID: {{ purchaseOrder.created_by_user_id }})</p>
      </div>

      <div class="po-section status-update-section">
        <h3>Update Status</h3>
        <div class="status-update-form">
          <select v-model="selectedStatus" :disabled="isUpdatingStatus || isFinalStatus(purchaseOrder.status)" class="status-select">
            <option v-for="s in ALLOWED_PO_STATUSES_FOR_STATUS_UPDATE" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
          </select>
          <button
            @click="handleUpdateStatus"
            :disabled="isUpdatingStatus || selectedStatus === purchaseOrder.status || isFinalStatus(purchaseOrder.status)"
            class="update-status-button"
          >
            {{ isUpdatingStatus ? 'Updating...' : 'Update Status' }}
          </button>
        </div>
      </div>

      <div class="po-section line-items">
        <h3>Line Items ({{ purchaseOrder.items?.length || 0 }})</h3>
        <table v-if="purchaseOrder.items && purchaseOrder.items.length > 0" class="items-table">
          <thead>
            <tr>
              <th>Product SKU</th>
              <th>Product Name</th>
              <th>Variant</th>
              <th>Qty Ordered</th>
              <th>Unit Cost</th>
              <th>Line Total</th>
              <th>Qty Received</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in purchaseOrder.items" :key="item.id">
              <td>{{ item.display_sku || 'N/A' }}</td>
              <td>{{ item.product_name }} (ID: {{ item.product_id }})</td>
              <td>
                <span v-if="item.variant_sku" class="variant-info">
                  {{ item.variant_sku }}
                  <span v-if="item.variant_price_modifier" class="price-modifier">
                    ({{ item.variant_price_modifier > 0 ? '+' : '' }}${{ parseFloat(item.variant_price_modifier).toFixed(2) }})
                  </span>
                </span>
                <span v-else class="no-variant">Base Product</span>
              </td>
              <td>{{ item.quantity_ordered }}</td>
              <td>${{ parseFloat(item.unit_cost_price).toFixed(2) }}</td>
              <td>${{ (parseFloat(item.unit_cost_price) * item.quantity_ordered).toFixed(2) }}</td>
              <td>
                {{ item.quantity_received }}
                <span v-if="item.quantity_ordered - item.quantity_received > 0" class="remaining-qty">
                  (Remaining: {{ item.quantity_ordered - item.quantity_received }})
                </span>
              </td>
              <!-- Stock Receiving UI -->
              <td class="receive-stock-cell" v-if="canReceiveStock(item)">
                <input
                  type="number"
                  v-model.number="itemReceivingState[item.id].qtyToReceive"
                  min="1"
                  :max="item.quantity_ordered - item.quantity_received"
                  class="receive-qty-input"
                  :disabled="itemReceivingState[item.id]?.isLoading"
                />
                <button
                  @click="handleReceiveStock(item)"
                  class="receive-button"
                  :disabled="!itemReceivingState[item.id]?.qtyToReceive ||
                              itemReceivingState[item.id]?.qtyToReceive <= 0 ||
                              itemReceivingState[item.id]?.qtyToReceive > (item.quantity_ordered - item.quantity_received) ||
                              itemReceivingState[item.id]?.isLoading"
                >
                  {{ itemReceivingState[item.id]?.isLoading ? 'Receiving...' : 'Receive' }}
                </button>
                 <p v-if="itemReceivingState[item.id]?.error" class="error-message item-error">
                    {{ itemReceivingState[item.id]?.error }}
                </p>
              </td>
              <td v-else-if="item.quantity_ordered === item.quantity_received" class="fully-received-text">
                Fully Received
              </td>
              <td v-else class="cannot-receive-text">
                 Unavailable
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else>No items found for this purchase order.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue'; // Added reactive
import { useRoute, useNuxtApp, useRouter } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Purchase Order Details'
});

const ALLOWED_PO_STATUSES_FOR_RECEIVING = ['ordered', 'partially_received'];
const ALLOWED_PO_STATUSES_FOR_STATUS_UPDATE = ['pending', 'ordered', 'partially_received', 'received', 'cancelled'];


const route = useRoute();
const { $axios } = useNuxtApp();
const router = useRouter();

const purchaseOrder = ref(null);
const isLoading = ref(true);
const fetchError = ref(null);

const selectedStatus = ref(''); // For general PO status update
const isUpdatingStatus = ref(false); // For general PO status update
const actionMessage = ref(''); // General feedback messages
const actionError = ref(false);

const poId = route.params.id;

// For stock receiving per item
const itemReceivingState = reactive({}); // Stores { qtyToReceive: number, isLoading: boolean, error: string }

function initializeItemReceivingState() {
  if (purchaseOrder.value && purchaseOrder.value.items) {
    purchaseOrder.value.items.forEach(item => {
      if (!itemReceivingState[item.id]) { // Initialize only if not already set
        itemReceivingState[item.id] = {
          qtyToReceive: null, // Default to empty or 1
          isLoading: false,
          error: ''
        };
      }
    });
  }
}

async function fetchPurchaseOrderDetails() {
  isLoading.value = true;
  fetchError.value = null;
  actionMessage.value = ''; actionError.value = false;
  try {
    const response = await $axios.get(`/admin/purchase-orders/${poId}`);
    purchaseOrder.value = response.data;
    if (purchaseOrder.value) {
      selectedStatus.value = purchaseOrder.value.status;
      initializeItemReceivingState(); // Initialize state for new items
    }
  } catch (err) {
    console.error(`Failed to fetch PO details for ID ${poId}:`, err);
    fetchError.value = err.response?.data || err;
  } finally {
    isLoading.value = false;
  }
}

const canReceiveStockOverall = computed(() => {
    return purchaseOrder.value && ALLOWED_PO_STATUSES_FOR_RECEIVING.includes(purchaseOrder.value.status.toLowerCase());
});

const canReceiveStock = (item) => {
    return canReceiveStockOverall.value && (item.quantity_ordered - item.quantity_received > 0);
};

const isFinalStatus = (status) => {
    return ['received', 'cancelled'].includes(status?.toLowerCase());
}

async function handleUpdateStatus() { // General PO Status Update
  if (!purchaseOrder.value || selectedStatus.value === purchaseOrder.value.status || isFinalStatus(purchaseOrder.value.status)) {
    actionMessage.value = 'No change in status or status is final and cannot be updated via this control.';
    actionError.value = true;
    setTimeout(() => { actionMessage.value = ''; }, 3000);
    return;
  }
  if (!confirm(`Are you sure you want to update the overall PO status to "${selectedStatus.value}"?`)) {
    return;
  }

  isUpdatingStatus.value = true;
  actionMessage.value = ''; actionError.value = false;

  try {
    const response = await $axios.put(`/admin/purchase-orders/${poId}`, {
      status: selectedStatus.value,
    });
    purchaseOrder.value = response.data; // Update local PO data with response
    selectedStatus.value = purchaseOrder.value.status; // Sync dropdown
    actionMessage.value = `PO status successfully updated to "${purchaseOrder.value.status}".`;
    actionError.value = false;
  } catch (err) {
    console.error(`Failed to update status for PO ID ${poId}:`, err);
    actionMessage.value = err.response?.data?.message || 'Failed to update status.';
    actionError.value = true;
    if(purchaseOrder.value) selectedStatus.value = purchaseOrder.value.status;
  } finally {
    isUpdatingStatus.value = false;
    setTimeout(() => { actionMessage.value = ''; }, 5000);
  }
}

async function handleReceiveStock(item) {
  const poItemId = item.id;
  const state = itemReceivingState[poItemId];

  if (!state || state.qtyToReceive === null || state.qtyToReceive <= 0 || state.qtyToReceive > (item.quantity_ordered - item.quantity_received) ) {
    state.error = "Invalid quantity to receive.";
    setTimeout(() => { if(state) state.error = ''; }, 3000);
    return;
  }

  state.isLoading = true;
  state.error = '';
  actionMessage.value = ''; actionError.value = false; // Clear general messages

  try {
    const response = await $axios.post(`/admin/purchase-orders/${poId}/items/${poItemId}/receive`, {
      quantity_received_now: state.qtyToReceive
    });

    // Update the entire purchaseOrder object with the response from backend
    // This ensures all item quantities, PO status, etc., are refreshed.
    purchaseOrder.value = response.data.purchaseOrder;
    initializeItemReceivingState(); // Re-initialize/clear inputs for items

    actionMessage.value = response.data.message || `Stock received for item ${item.product_name}.`;
    actionError.value = false;
    state.qtyToReceive = null; // Clear input for this item

  } catch (err) {
    console.error(`Error receiving stock for item ID ${poItemId}:`, err);
    state.error = err.response?.data?.message || 'Failed to receive stock for this item.';
    actionMessage.value = `Failed to receive stock for ${item.product_name}.`; // General message
    actionError.value = true;
  } finally {
    state.isLoading = false;
    setTimeout(() => {
        if(state) state.error = '';
        actionMessage.value = ''; // Clear general action message after a while
    }, 5000);
  }
}


watch(purchaseOrder, (newPO) => {
    if (newPO) {
        if (newPO.status) selectedStatus.value = newPO.status;
        initializeItemReceivingState(); // Ensure item states are ready
    }
}, { deep: true }); // deep might be needed if items array is modified in place by other means

onMounted(fetchPurchaseOrderDetails);

useHead({
  title: computed(() => `Admin - PO #${route.params.id}`),
});
</script>

<style scoped>
.admin-po-detail-page { padding: 1rem; max-width: 1000px; margin: 1.5rem auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
h2 { margin-bottom: 0; }

.loading-state, .error-message, .action-message { text-align: center; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
.loading-state { background-color: #eef; }
.error-message { background-color: #fdd; color: #900; }
.action-message.success { background-color: #dfd; color: #070; }
.action-message.error { background-color: #fdd; color: #900; }
.item-error { font-size: 0.8em; margin-top: 0.3rem; }


.po-details-container { background-color: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.po-section { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #eee; }
.po-section:last-child { border-bottom: none; margin-bottom: 0; }
.po-section h3 { font-size: 1.3em; color: #0056b3; margin-bottom: 1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 0.5rem;}
.po-section p { margin: 0.4rem 0; line-height: 1.6; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.5rem 1rem; }
.notes-section p { margin-top: 0.5rem; }
.notes-section pre { background-color: #f8f9fa; padding: 0.75rem; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }

.status { padding: 0.3em 0.6em; border-radius: 4px; color: white; font-size: 0.9em; text-transform: capitalize; }
.status-pending { background-color: #ffc107; color: #333; }
.status-ordered { background-color: #17a2b8; }
.status-partially_received { background-color: #fd7e14; }
.status-received { background-color: #28a745; }
.status-cancelled { background-color: #dc3545; }

.status-update-section h3 { margin-bottom: 0.75rem;}
.status-update-form { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 4px; max-width: fit-content; }
.status-select { padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px; background-color: white; }
.status-select:disabled { background-color: #e9ecef; opacity: 0.7; }
.update-status-button { padding: 0.6rem 1rem; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
.update-status-button:disabled { background-color: #aaa; cursor: not-allowed; }
.update-status-button:hover:not(:disabled) { background-color: #0056b3; }

.items-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9em;}
.items-table th, .items-table td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; vertical-align: middle; }
.items-table th { background-color: #f2f2f2; }

.variant-info { 
  font-weight: 500; 
  color: #007bff; 
  background-color: #f8f9fa; 
  padding: 0.2rem 0.5rem; 
  border-radius: 3px; 
  font-size: 0.85em; 
}
.price-modifier { 
  color: #28a745; 
  font-size: 0.8em; 
  margin-left: 0.3rem; 
}
.no-variant { 
  color: #6c757d; 
  font-style: italic; 
  font-size: 0.85em; 
}

.back-link { display: inline-block; margin-top: 1.5rem; padding: 0.6rem 1.2rem; background-color: #6c757d; color: white; text-decoration: none; border-radius: 4px; }
.header-back-link { margin-top: 0; font-size: 0.9em; }
.back-link:hover { background-color: #5a6268; }
</style>

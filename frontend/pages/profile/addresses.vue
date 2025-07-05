<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))] bg-venus-background">
    <h1 class="text-3xl sm:text-4xl font-serif font-bold text-venus-text-primary mb-10 text-center">My Addresses</h1>

    <!-- Loading state -->
    <div v-if="isAuthLoading" class="text-center py-10 text-lg text-venus-text-secondary font-medium">Loading addresses...</div>

    <!-- Display content if authenticated -->
    <div v-else-if="isAuthenticated && user" class="addresses-content space-y-8">
      
      <!-- Add New Address Section -->
      <div class="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-neutral-medium">
        <h2 class="text-2xl font-serif font-semibold text-venus-text-primary mb-6">Add New Address</h2>
        <form @submit.prevent="handleAddAddress" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="firstName" class="block text-sm font-medium text-venus-text-primary mb-1">First Name *</label>
              <input type="text" id="firstName" v-model="newAddress.first_name" required
                     class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
            </div>
            <div>
              <label for="lastName" class="block text-sm font-medium text-venus-text-primary mb-1">Last Name *</label>
              <input type="text" id="lastName" v-model="newAddress.last_name" required
                     class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
            </div>
          </div>

          <div>
            <label for="company" class="block text-sm font-medium text-venus-text-primary mb-1">Company (Optional)</label>
            <input type="text" id="company" v-model="newAddress.company"
                   class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
          </div>

          <div>
            <label for="addressLine1" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 1 *</label>
            <input type="text" id="addressLine1" v-model="newAddress.address_line1" required
                   class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
          </div>

          <div>
            <label for="addressLine2" class="block text-sm font-medium text-venus-text-primary mb-1">Address Line 2 (Optional)</label>
            <input type="text" id="addressLine2" v-model="newAddress.address_line2"
                   class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label for="city" class="block text-sm font-medium text-venus-text-primary mb-1">City *</label>
              <input type="text" id="city" v-model="newAddress.city" required
                     class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
            </div>
            <div>
              <label for="stateProvince" class="block text-sm font-medium text-venus-text-primary mb-1">State/Province *</label>
              <input type="text" id="stateProvince" v-model="newAddress.state_province" required
                     class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
            </div>
            <div>
              <label for="postalCode" class="block text-sm font-medium text-venus-text-primary mb-1">Postal Code *</label>
              <input type="text" id="postalCode" v-model="newAddress.postal_code" required
                     class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="country" class="block text-sm font-medium text-venus-text-primary mb-1">Country *</label>
              <select id="country" v-model="newAddress.country" required
                      class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors">
                <option value="">Select Country</option>
                <option value="BS">Bahamas</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
            <div>
              <label for="phone" class="block text-sm font-medium text-venus-text-primary mb-1">Phone (Optional)</label>
              <input type="tel" id="phone" v-model="newAddress.phone"
                     class="w-full px-3 py-2 border border-neutral-medium rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-peach-pink focus:border-peach-pink transition-colors" />
            </div>
          </div>

          <div class="flex items-center space-x-4">
            <div class="flex items-center">
              <input type="radio" id="shipping" v-model="newAddress.address_type" value="shipping" class="mr-2" />
              <label for="shipping" class="text-sm font-medium text-venus-text-primary">Shipping Address</label>
            </div>
            <div class="flex items-center">
              <input type="radio" id="billing" v-model="newAddress.address_type" value="billing" class="mr-2" />
              <label for="billing" class="text-sm font-medium text-venus-text-primary">Billing Address</label>
            </div>
          </div>

          <div class="flex items-center">
            <input type="checkbox" id="isDefault" v-model="newAddress.is_default" class="mr-2" />
            <label for="isDefault" class="text-sm font-medium text-venus-text-primary">Set as default {{ newAddress.address_type }} address</label>
          </div>

          <button
            type="submit"
            :disabled="isAddingAddress"
            class="w-full sm:w-auto px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-peach-pink hover:bg-peach-pink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peach-pink disabled:opacity-60 transition-colors"
          >
            {{ isAddingAddress ? 'Adding...' : 'Add Address' }}
          </button>
        </form>
      </div>

      <!-- Existing Addresses Section -->
      <div class="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-neutral-medium">
        <h2 class="text-2xl font-serif font-semibold text-venus-text-primary mb-6">My Addresses</h2>
        
        <div v-if="isLoadingAddresses" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-peach-pink mx-auto"></div>
          <p class="mt-2 text-venus-text-secondary">Loading addresses...</p>
        </div>

        <div v-else-if="addresses.length === 0" class="text-center py-8">
          <p class="text-venus-text-secondary">No addresses found. Add your first address above.</p>
        </div>

        <div v-else class="space-y-4">
          <div v-for="address in addresses" :key="address.id" 
               class="border border-neutral-medium rounded-lg p-4 hover:shadow-md hover:border-peach-pink transition-all">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                  <span class="text-sm font-medium text-venus-text-primary">{{ address.first_name }} {{ address.last_name }}</span>
                  <span v-if="address.is_default" class="px-2 py-1 text-xs bg-peach-pink text-white rounded-full">Default</span>
                  <span class="px-2 py-1 text-xs bg-neutral-light text-venus-text-secondary rounded-full">{{ address.address_type }}</span>
                </div>
                
                <div class="text-sm text-venus-text-secondary space-y-1">
                  <p v-if="address.company">{{ address.company }}</p>
                  <p>{{ address.address_line1 }}</p>
                  <p v-if="address.address_line2">{{ address.address_line2 }}</p>
                  <p>{{ address.city }}, {{ address.state_province }} {{ address.postal_code }}</p>
                  <p>{{ getCountryName(address.country) }}</p>
                  <p v-if="address.phone">{{ address.phone }}</p>
                </div>
              </div>

              <div class="flex space-x-2">
                <button
                  @click="editAddress(address)"
                  class="px-3 py-1 text-sm text-peach-pink hover:text-peach-pink/80 transition-colors"
                >
                  Edit
                </button>
                <button
                  @click="deleteAddress(address.id)"
                  class="px-3 py-1 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Back to Profile Link -->
      <div class="text-center">
        <NuxtLink
          to="/profile"
          class="inline-block px-6 py-3 border border-neutral-medium text-venus-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors"
        >
          Back to Profile
        </NuxtLink>
      </div>
    </div>

    <!-- Not authenticated -->
    <div v-else-if="!isAuthenticated && !isAuthLoading" class="my-6 p-8 bg-white text-venus-text-secondary rounded-lg shadow-md text-center border border-neutral-medium">
      <p class="text-lg mb-4">You are not logged in. Please log in to manage your addresses.</p>
      <NuxtLink to="/login" class="mt-4 inline-block px-6 py-3 bg-peach-pink text-white font-medium rounded-md hover:bg-peach-pink/90 transition-colors">Login</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useToast } from 'vue-toastification';
import { useNuxtApp } from '#app';

const { authUser, isAuthInitialized, isAuthenticated } = useAuth();
const toast = useToast();
const { $axios } = useNuxtApp();

const user = computed(() => authUser.value);
const isAuthLoading = computed(() => !isAuthInitialized.value);

// Address management
const addresses = ref([]);
const isLoadingAddresses = ref(false);
const isAddingAddress = ref(false);

// New address form
const newAddress = ref({
  first_name: '',
  last_name: '',
  company: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_province: '',
  postal_code: '',
  country: '',
  phone: '',
  address_type: 'shipping',
  is_default: false
});

// Country name mapping
const getCountryName = (code) => {
  const countries = {
    'BS': 'Bahamas',
    'US': 'United States',
    'CA': 'Canada',
    'GB': 'United Kingdom',
    'AU': 'Australia'
  };
  return countries[code] || code;
};

// Load addresses
const loadAddresses = async () => {
  if (!isAuthenticated.value) return;
  
  isLoadingAddresses.value = true;
  try {
    const response = await $axios.get('/users/me/addresses');
    addresses.value = response.data.addresses || [];
  } catch (error) {
    console.error('Error loading addresses:', error);
    toast.error('Failed to load addresses.');
  } finally {
    isLoadingAddresses.value = false;
  }
};

// Add new address
const handleAddAddress = async () => {
  if (!newAddress.value.first_name || !newAddress.value.last_name || 
      !newAddress.value.address_line1 || !newAddress.value.city || 
      !newAddress.value.state_province || !newAddress.value.postal_code || 
      !newAddress.value.country) {
    toast.error('Please fill in all required fields.');
    return;
  }

  isAddingAddress.value = true;
  try {
    const response = await $axios.post('/users/me/addresses', newAddress.value);
    toast.success('Address added successfully!');
    
    // Reset form
    newAddress.value = {
      first_name: '',
      last_name: '',
      company: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: '',
      phone: '',
      address_type: 'shipping',
      is_default: false
    };
    
    // Reload addresses
    await loadAddresses();
  } catch (error) {
    console.error('Error adding address:', error);
    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    } else {
      toast.error('Failed to add address.');
    }
  } finally {
    isAddingAddress.value = false;
  }
};

// Edit address (placeholder for future implementation)
const editAddress = (address) => {
  // TODO: Implement edit functionality
  toast.info('Edit functionality coming soon!');
};

// Delete address
const deleteAddress = async (addressId) => {
  if (!confirm('Are you sure you want to delete this address?')) return;
  
  try {
    await $axios.delete(`/users/me/addresses/${addressId}`);
    toast.success('Address deleted successfully!');
    await loadAddresses();
  } catch (error) {
    console.error('Error deleting address:', error);
    toast.error('Failed to delete address.');
  }
};

// Load addresses when component mounts
onMounted(() => {
  if (isAuthenticated.value) {
    loadAddresses();
  }
});

// Watch for authentication changes
watch(isAuthenticated, (newValue) => {
  if (newValue) {
    loadAddresses();
  }
});
</script> 
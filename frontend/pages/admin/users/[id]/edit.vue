<template>
  <div class="container mx-auto p-6">
    <div class="bg-white shadow-xl rounded-lg p-8">
      <NuxtLink to="/admin/users" class="text-indigo-600 hover:text-indigo-800 mb-6 inline-block text-sm">
        &larr; Back to User List
      </NuxtLink>

      <!-- Corrected v-if conditions to use destructured refs from useAsyncData directly -->
      <h1 v-if="user" class="text-3xl font-bold text-gray-800 mb-2">
        Edit User: {{ user.name }} (ID: {{ userId }})
      </h1>
      <h1 v-else-if="userPending" class="text-3xl font-bold text-gray-800 mb-2">
        Loading User Data...
      </h1>
      <h1 v-else class="text-3xl font-bold text-red-600 mb-2">
        Error Loading User Data
      </h1>

      <div v-if="userPending" class="text-center py-10">
        <p>Loading...</p>
      </div>
      <div v-else-if="userError || !user" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
        <strong class="font-bold">Error!</strong>
        <span class="block sm:inline">{{ userError?.message || userError?.data?.message || 'Could not load user data.' }}</span>
      </div>

      <form v-if="user" @submit.prevent="handleSubmit">
        <!-- User Details Section -->
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">User Details</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" v-model="form.name" id="name" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            </div>
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" v-model="form.email" id="email" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            </div>
            <div>
              <label for="role" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select v-model="form.role_id" id="role" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                <option v-if="roles.pending" value="">Loading roles...</option>
                <option v-for="role in availableRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Password Change Section -->
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Change Password (Optional)</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" v-model="form.password" id="password" autocomplete="new-password" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Leave blank to keep current">
            </div>
            <div>
              <label for="confirm_password" class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" v-model="form.confirm_password" id="confirm_password" autocomplete="new-password" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            </div>
          </div>
           <p v-if="form.password && form.password !== form.confirm_password" class="text-xs text-red-600 mt-1">Passwords do not match.</p>
        </section>

        <!-- Tax Exemption Section -->
        <section class="mb-8">
          <h2 class="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Tax Information</h2>
          <div class="space-y-4">
            <div class="flex items-start">
              <div class="flex items-center h-5">
                <input v-model="form.is_tax_exempt" id="is_tax_exempt" type="checkbox" class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded">
              </div>
              <div class="ml-3 text-sm">
                <label for="is_tax_exempt" class="font-medium text-gray-700">Tax Exempt</label>
                <p class="text-gray-500">Check if this user is exempt from taxes.</p>
              </div>
            </div>
            <div v-if="form.is_tax_exempt">
              <label for="tax_exemption_certificate_id" class="block text-sm font-medium text-gray-700 mb-1">Tax Exemption Certificate ID</label>
              <input type="text" v-model="form.tax_exemption_certificate_id" id="tax_exemption_certificate_id" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            </div>
            <div v-if="form.is_tax_exempt">
              <label for="tax_exemption_notes" class="block text-sm font-medium text-gray-700 mb-1">Tax Exemption Notes</label>
              <textarea v-model="form.tax_exemption_notes" id="tax_exemption_notes" rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
            </div>
          </div>
        </section>

        <!-- Submission Feedback -->
        <div v-if="submissionStatus.message" :class="['mt-6 p-4 rounded-md border', submissionStatus.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700']">
          <h3 class="text-lg font-semibold mb-1">{{ submissionStatus.isError ? 'Error' : 'Success' }}</h3>
          <p class="text-sm">{{ submissionStatus.message }}</p>
          <ul v-if="submissionStatus.errors && submissionStatus.errors.length > 0" class="list-disc list-inside mt-1 text-sm">
            <li v-for="(err, index) in submissionStatus.errors" :key="index">{{ err.msg || err }}</li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="mt-8 flex justify-end space-x-3">
          <NuxtLink to="/admin/users" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">
            Cancel
          </NuxtLink>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
          >
            <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, useAsyncData, useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
});

const route = useRoute();
const router = useRouter();
const { $axios } = useNuxtApp();
const {$toast} = useNuxtApp();


const userId = computed(() => route.params.id);

useHead({
  title: `Edit User ${userId.value} - Admin`,
});

// Form state
const form = ref({
  name: '',
  email: '',
  role_id: null,
  password: '',
  confirm_password: '',
  is_tax_exempt: false,
  tax_exemption_certificate_id: '',
  tax_exemption_notes: '',
});

const availableRoles = ref([]);
const isSubmitting = ref(false);
const submissionStatus = ref({ message: '', isError: false, errors: [] });

// Fetch user data
const { data: user, pending: userPending, error: userError, refresh: refreshUser } = await useAsyncData(
  `admin-user-${userId.value}`,
  () => $axios.get(`/admin/users/${userId.value}`),
  {
    watch: [userId],
    transform: (response) => response.data // Assuming API returns user data directly in response.data
  }
);
console.log('[EditUserPage] After user useAsyncData - user.value:', user.value, 'userError.value:', userError.value, 'userPending.value:', userPending.value);

// Fetch available roles
const { data: roles, pending: rolesPending, error: rolesError } = await useAsyncData(
  'admin-roles-edit-user',
  () => $axios.get('/admin/roles'),
  {
    transform: (response) => response.data // Assuming API returns array of roles in response.data
  }
);

watch(roles, (newRoles) => {
  if (newRoles && Array.isArray(newRoles)) {
    availableRoles.value = newRoles;
  } else if (rolesError.value) {
     availableRoles.value = [{id: 1, name: 'Admin (Fallback)'}, {id: 2, name: 'User (Fallback)'}];
     console.warn('[EditUser] Failed to load roles, using fallback. Error:', rolesError.value);
  }
}, { immediate: true });


// Populate form when user data is loaded
watch(user, (currentUserData) => {
  console.log('[EditUserPage] Watcher for user data triggered. currentUserData:', currentUserData, 'userError at this point:', userError.value);
  if (currentUserData && Object.keys(currentUserData).length > 0) { // Check if currentUserData is not null/empty
    console.log('[EditUserPage] Populating form with currentUserData:', JSON.parse(JSON.stringify(currentUserData)));
    form.value.name = currentUserData.name || '';
    form.value.email = currentUserData.email || '';
    form.value.role_id = currentUserData.role_id || null;
    form.value.is_tax_exempt = currentUserData.is_tax_exempt || false;
    form.value.tax_exemption_certificate_id = currentUserData.tax_exemption_certificate_id || '';
    form.value.tax_exemption_notes = currentUserData.tax_exemption_notes || '';
  } else {
    console.log('[EditUserPage] currentUserData is null, undefined, or empty. Checking userError.value:', userError.value);
    if (userError.value) {
      console.error('[EditUserPage] Error details from userError.value (in else block):', JSON.parse(JSON.stringify(userError.value)));
      submissionStatus.value = {
        message: `Failed to load user data: ${userError.value?.data?.message || userError.value?.message || 'Unknown error'}`,
        isError: true,
        errors: userError.value?.data?.errors || []
      };
    } else if (!userPending.value && !currentUserData) {
      // This case might happen if API returns success but no data (e.g. 200 with empty object after transform)
      console.warn('[EditUserPage] User data is empty after fetch, and no error reported by useAsyncData. This might indicate a transform issue or API returning empty success.');
       submissionStatus.value = { message: 'User data not found or is empty.', isError: true };
    }
  }
}, { immediate: true, deep: true });


const handleSubmit = async () => {
  isSubmitting.value = true;
  submissionStatus.value = { message: '', isError: false, errors: [] };

  if (form.value.password && form.value.password !== form.value.confirm_password) {
    submissionStatus.value = { message: 'Passwords do not match.', isError: true };
    isSubmitting.value = false;
    $toast.error('Passwords do not match.');
    return;
  }

  const payload = {
    name: form.value.name,
    email: form.value.email,
    role_id: form.value.role_id,
    is_tax_exempt: form.value.is_tax_exempt,
    tax_exemption_certificate_id: form.value.is_tax_exempt ? form.value.tax_exemption_certificate_id : null,
    tax_exemption_notes: form.value.is_tax_exempt ? form.value.tax_exemption_notes : null,
  };

  if (form.value.password) {
    payload.password = form.value.password; // Only include password if provided
  }

  try {
    const response = await $axios.put(`/admin/users/${userId.value}`, payload);
    submissionStatus.value = { message: 'User updated successfully!', isError: false };
    $toast.success('User updated successfully!');
    // Optionally, navigate away or refresh data
    // await refreshUser(); // Re-fetch to show updated data if staying on page
    router.push('/admin/users');
  } catch (err) {
    console.error('Error updating user:', err.response?.data || err.message);
    const errorData = err.response?.data;
    submissionStatus.value = {
      message: errorData?.message || 'Failed to update user. Please check the details.',
      isError: true,
      errors: errorData?.errors || []
    };
    $toast.error(submissionStatus.value.message);
    if (submissionStatus.value.errors.length > 0) {
        submissionStatus.value.errors.forEach(e => $toast.error(e.msg || e));
    }
  } finally {
    isSubmitting.value = false;
  }
};

</script>

<style scoped>
/* Add any page-specific styles if needed */
</style>

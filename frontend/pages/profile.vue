<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 min-h-[calc(100vh-theme(spacing.16))]">
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-10 text-center">My Profile</h1>

    <div v-if="isLoading" class="text-center py-10 text-lg text-text-secondary font-medium">Loading profile...</div>

    <div v-else-if="user" class="user-profile-content space-y-8"> <!-- Added space-y-8 to parent -->
      <div class="user-info bg-white p-6 sm:p-8 rounded-lg shadow-md border border-neutral-medium">
        <h2 class="text-2xl font-semibold text-text-primary mb-6">User Profile</h2>
        <p class="mb-3 text-text-secondary"><strong class="font-medium text-text-primary">Email:</strong> {{ user.email }}</p>
        <p v-if="user.id" class="mb-3 text-text-secondary"><strong class="font-medium text-text-primary">User ID (from token):</strong> {{ user.id }}</p>
        <p class="mb-6 text-text-secondary italic">This is a protected page. Only authenticated users can see this.</p>

        <div v-if="authToken" class="token-info mt-6 pt-6 border-t border-neutral-medium">
          <h3 class="text-lg font-semibold text-text-primary mb-2">Your Access Token (for demo purposes):</h3>
          <p class="token-display p-3 bg-neutral-light text-xs text-text-secondary rounded-md overflow-x-auto whitespace-pre-wrap break-all font-mono">
            {{ authToken }}
          </p>
        </div>
      </div>

      <!-- Update Profile Details Section -->
      <div class="bg-white shadow-md rounded-lg p-6 sm:p-8 border border-neutral-medium">
        <h2 class="text-xl font-semibold text-text-primary mb-6">Update Profile Details</h2>
        <form @submit.prevent="handleUpdateProfile" class="space-y-4">
          <div>
            <label for="profileName" class="block text-sm font-medium text-text-primary mb-1">Name</label>
            <input type="text" id="profileName" v-model="profileName" required
                   class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
            <!-- Basic client-side validation message example (optional, toasts are primary) -->
            <p v-if="profileName.length > 0 && profileName.length < 2" class="text-xs text-red-500 mt-1">Name is too short.</p>
          </div>
          <button
            type="submit"
            :disabled="isUpdatingProfile"
            class="w-full sm:w-auto mt-2 px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-60 transition-colors"
          >
            {{ isUpdatingProfile ? 'Updating...' : 'Update Profile' }}
          </button>
        </form>
      </div>

      <!-- Change Password Section -->
      <div class="bg-white shadow-md rounded-lg p-6 sm:p-8 border border-neutral-medium">
        <h2 class="text-xl font-semibold text-text-primary mb-6">Change Password</h2>
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label for="currentPassword" class="block text-sm font-medium text-text-primary mb-1">Current Password</label>
            <input type="password" id="currentPassword" v-model="currentPassword" required
                   class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
          <div>
            <label for="newPassword" class="block text-sm font-medium text-text-primary mb-1">New Password</label>
            <input type="password" id="newPassword" v-model="newPassword" required
                   class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>
          <div>
            <label for="confirmNewPassword" class="block text-sm font-medium text-text-primary mb-1">Confirm New Password</label>
            <input type="password" id="confirmNewPassword" v-model="confirmNewPassword" required
                   class="w-full px-3 py-2 border border-neutral-dark rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary placeholder:text-neutral-dark" />
          </div>

          <!-- Error/Success messages removed, will use toasts -->

          <button
            type="submit"
            :disabled="isChangingPassword"
            class="w-full sm:w-auto mt-2 px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-60 transition-colors"
          >
            {{ isChangingPassword ? 'Changing...' : 'Change Password' }}
          </button>
        </form>
      </div>

      <!-- Action Links/Buttons -->
      <div class="pt-6 border-t border-neutral-medium space-y-3 sm:space-y-0 sm:flex sm:space-x-4">
        <NuxtLink
          to="/profile/2fa-setup"
          class="block w-full sm:w-auto text-center px-5 py-2.5 border border-neutral-dark text-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors duration-150"
        >
          Manage 2FA
        </NuxtLink>
        <NuxtLink
          to="/profile/orders"
          class="block w-full sm:w-auto text-center px-5 py-2.5 border border-neutral-dark text-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors duration-150"
        >
          View Order History
        </NuxtLink>
        <!--
          Future button/link for changing password:
          <button
            type="button"
            class="block w-full sm:w-auto text-center px-5 py-2.5 border border-neutral-dark text-text-primary bg-white hover:bg-neutral-light rounded-md shadow-sm text-sm font-medium transition-colors duration-150"
          >
            Change Password
          </button>
        -->
      </div>
    </div>

    <div v-else class="my-6 p-8 bg-white text-text-secondary rounded-lg shadow-md text-center border border-neutral-medium">
      <p class="text-lg mb-4">You are not logged in. Please log in to view your profile.</p>
      <NuxtLink to="/login" class="mt-4 inline-block px-6 py-3 bg-brand-primary text-white font-medium rounded-md hover:bg-opacity-80 transition-colors">Login</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'; // Added computed
import { useAuth } from '~/composables/useAuth';
import { useRouter } from 'vue-router'; // useRouter might not be needed if not navigating
import { useToast } from 'vue-toastification';
import { useNuxtApp } from '#app'; // To get $axios

const { authUser, authToken, fetchUser, setUser } = useAuth(); // Added setUser
// const router = useRouter(); // Not strictly needed if only staying on page
const toast = useToast();
const { $axios } = useNuxtApp(); // Get $axios instance

const user = computed(() => authUser.value); // Use computed for reactivity from composable
const isLoading = ref(false);

// For Profile Update
const profileName = ref('');
const isUpdatingProfile = ref(false);

// For Change Password
const currentPassword = ref('');
const newPassword = ref('');
const confirmNewPassword = ref('');
const isChangingPassword = ref(false);
// changePasswordError and changePasswordSuccess refs removed

const handleChangePassword = async () => {
  isChangingPassword.value = true;
  // Clear previous messages if they were local state; toasts clear themselves.

  if (newPassword.value !== confirmNewPassword.value) {
    toast.error("New passwords do not match.");
    isChangingPassword.value = false;
    return;
  }
  if (newPassword.value.length < 8) {
    toast.error("New password must be at least 8 characters.");
    isChangingPassword.value = false;
    return;
  }

  console.log('Attempting to change password with current password (hidden) and new password (hidden)');

  try {
    const response = await $axios.post('/api/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });

    // Axios typically considers 2xx as success, others will throw error
    if (response.status === 200 && response.data.message) {
      toast.success(response.data.message);
      currentPassword.value = '';
      newPassword.value = '';
      confirmNewPassword.value = '';
    } else {
      // Fallback, though usually errors are caught in catch block
      toast.error(response.data.message || 'Failed to change password. Please try again.');
    }
  } catch (error) {
    console.error('Change password error:', error);
    if (error.response && error.response.data && error.response.data.message) {
      toast.error(error.response.data.message);
    } else if (error.message) {
      toast.error(error.message);
    } else {
      toast.error('An unexpected error occurred while changing password.');
    }
  } finally {
    isChangingPassword.value = false;
  }
};

const handleUpdateProfile = async () => {
  if (!profileName.value.trim()) {
    toast.error('Name cannot be empty.');
    return;
  }
  if (profileName.value.length < 2 || profileName.value.length > 255) {
    toast.error('Name must be between 2 and 255 characters.');
    return;
  }

  isUpdatingProfile.value = true;
  try {
    const response = await $axios.put('/api/users/me/profile', {
      name: profileName.value,
    });

    if (response.status === 200 && response.data.user) {
      setUser(response.data.user); // Update the user state in useAuth
      toast.success(response.data.message || 'Profile updated successfully!');
      // profileName.value will be updated via the watchEffect or if user re-navigates
      // or directly: profileName.value = response.data.user.name; (already done by setUser)
    } else {
      toast.error(response.data.message || 'Failed to update profile.');
    }
  } catch (error) {
    console.error('Profile update error:', error);
    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    } else if (error.response?.data?.errors) { // Handle express-validator errors
      toast.error(error.response.data.errors.map(e => e.msg).join(', '));
    } else {
      toast.error('An unexpected error occurred while updating profile.');
    }
  } finally {
    isUpdatingProfile.value = false;
  }
};

onMounted(async () => {
  isLoading.value = true;
  if (authToken.value && !authUser.value) {
    await fetchUser(); // This might not fetch 'name' currently
  }
  // Initialize profileName after user data is potentially available
  // authUser.value might be populated directly from localStorage or by fetchUser
  if (authUser.value) {
    profileName.value = authUser.value.name || '';
  }
  isLoading.value = false;

  if (!authToken.value) {
    console.log("Profile page: No auth token found on mount. User will be shown 'not logged in' message.");
  }
});

watch(authUser, (newUser) => {
  if (newUser) {
    profileName.value = newUser.name || '';
  } else {
    profileName.value = '';
  }
}, { immediate: true }); // immediate: true to run on component mount as well

useHead({
});

useHead({
  title: 'My Profile',
});
</script>
<!-- No style changes, structure is similar to Change Password -->

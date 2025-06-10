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
import { ref, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';

const { authUser, authToken, fetchUser } = useAuth();
const router = useRouter();
const toast = useToast();

const user = ref(authUser.value);
const isLoading = ref(false);

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

  console.log('Attempting to change password with:', currentPassword.value, newPassword.value, confirmNewPassword.value);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Example outcomes (replace with actual API call logic later):
  const mockApiSuccess = true; // Simulate API response
  if (mockApiSuccess) {
    toast.success('Password changed successfully! (Mocked)');
    currentPassword.value = '';
    newPassword.value = '';
    confirmNewPassword.value = '';
  } else {
    toast.error('Failed to change password. Incorrect current password. (Mocked)');
  }

  isChangingPassword.value = false;
};


onMounted(async () => {
  if (!user.value && authToken.value) {
    isLoading.value = true;
    await fetchUser();
    user.value = authUser.value;
    isLoading.value = false;
  }

  if (!user.value && !authToken.value) {
  }
});

useHead({
  title: 'My Profile',
});
</script>
<!-- <style scoped> block removed -->

<template>
  <div class="profile-page">
    <div v-if="isLoading" class="loading">Loading profile...</div>
    <div v-else-if="user" class="user-info">
      <h2>User Profile</h2>
      <p><strong>Email:</strong> {{ user.email }}</p>
      <p v-if="user.id"><strong>User ID (from token):</strong> {{ user.id }}</p>
      <p>This is a protected page. Only authenticated users can see this.</p>

      <div v-if="authToken" class="token-info">
        <h3>Your Access Token (for demo purposes):</h3>
        <p class="token-display">{{ authToken }}</p>
      </div>
    </div>
    <!-- Message when redirecting or if user somehow lands here without being caught by middleware/guard -->
    <div v-else>
      <p>You are not logged in. Redirecting to login...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useRouter } from 'vue-router'; // useRouter for navigation

const { authUser, authToken, fetchUser } = useAuth(); // fetchUser might be needed if user info isn't fully populated
const router = useRouter();

const user = ref(authUser.value);
const isLoading = ref(false);

onMounted(async () => {
  // If authUser is not populated from localStorage/initial load, but token exists, try fetching.
  if (!user.value && authToken.value) {
    isLoading.value = true;
    await fetchUser(); // Attempt to get user info
    user.value = authUser.value; // Update local ref after fetchUser updates global state
    isLoading.value = false;
  }

  // If still no user (even after fetch attempt if token was present), redirect.
  if (!user.value && !authToken.value) { // Check both user and token
    router.push('/login');
  }
});

useHead({
  title: 'My Profile',
});
</script>

<style scoped>
.profile-page {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}
.loading {
  text-align: center;
  padding: 1rem;
}
.user-info h2 {
  color: #333;
  margin-bottom: 1rem;
}
.user-info p {
  margin-bottom: 0.5rem;
  color: #555;
}
.token-info {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}
.token-info h3 {
  font-size: 0.9em;
  color: #777;
}
.token-display {
  word-break: break-all;
  font-family: monospace;
  background-color: #e0e0e0;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.8em;
}
</style>

<template>
  <div class="auth-page">
    <h2>Login</h2>
    <form @submit.prevent="handleLogin" class="auth-form">
      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" id="email" v-model="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Logging in...' : 'Login' }}
      </button>
    </form>
    <p>
      Don't have an account? <NuxtLink to="/register">Register here</NuxtLink>
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '~/composables/useAuth'; // Adjust path if necessary

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

const { login } = useAuth();
const router = useRouter();

const handleLogin = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  const result = await login(email.value, password.value);
  isLoading.value = false;

  if (result.success) {
    // Redirect to a protected page or home
    // await nextTick(); // Ensure auth state is updated before navigation
    router.push('/profile'); // Or '/'
  } else {
    errorMessage.value = result.message || 'Failed to login. Please check your credentials.';
  }
};

// Meta for the page
useHead({
  title: 'Login',
});
</script>

<style scoped>
.auth-page {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}
h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}
.auth-form .form-group {
  margin-bottom: 1rem;
}
.auth-form label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
}
.auth-form input[type="email"],
.auth-form input[type="password"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}
.error-message {
  color: red;
  margin-bottom: 1rem;
  text-align: center;
  background-color: #ffe0e0;
  padding: 0.5rem;
  border-radius: 4px;
}
button[type="submit"] {
  width: 100%;
  padding: 0.75rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}
button[type="submit"]:disabled {
  background-color: #aaa;
}
button[type="submit"]:hover:not(:disabled) {
  background-color: #0056b3;
}
p {
  margin-top: 1.5rem;
  text-align: center;
}
</style>

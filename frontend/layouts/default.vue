<template>
  <div>
    <header>
      <nav>
        <ul>
          <li><NuxtLink to="/">Home</NuxtLink></li>
          <template v-if="!isAuthenticated">
            <li><NuxtLink to="/login">Login</NuxtLink></li>
            <li><NuxtLink to="/register">Register</NuxtLink></li>
          </template>
          <template v-else>
            <li><NuxtLink to="/profile">Profile</NuxtLink></li>
            <li v-if="isAdminUser"><NuxtLink to="/admin/users">Manage Users</NuxtLink></li>
            <li>
              <button @click="handleLogout" class="logout-button">Logout</button>
            </li>
            <li v-if="user" class="user-greeting">Hello, {{ user.email }} ({{ user.role }})</li>
          </template>
        </ul>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <p>&copy; {{ new Date().getFullYear() }} My E-commerce Site</p>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
// useRouter is not strictly needed here if logout() in useAuth handles redirection fully.
// However, if we wanted to explicitly redirect from here, we would use it.
// import { useRouter } from 'vue-router';

const { authToken, authUser, logout } = useAuth();
// const router = useRouter();

const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);
const isAdminUser = computed(() => authUser.value?.role === 'admin');

const handleLogout = () => {
  logout();
};
</script>

<style scoped>
/* Basic styling for layout */
header {
  background-color: #f0f0f0;
  padding: 1rem;
  border-bottom: 1px solid #ccc;
  /* display: flex; Removed for simplicity, nav ul can handle flex items */
  /* justify-content: space-between; */
  /* align-items: center; */
}

nav ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 1rem; /* Space between items */
  align-items: center; /* Align items like button and text vertically */
}

/* Style for the user greeting to be pushed to the right */
nav ul .user-greeting {
  margin-left: auto;
  color: #555;
  font-size: 0.9em;
}

nav a, .logout-button {
  text-decoration: none;
  color: #333;
  padding: 0.5rem; /* Add some padding to links/buttons for better clickability */
  border-radius: 4px; /* Slightly rounded corners for links/buttons */
  display: inline-block; /* Ensures padding is applied correctly */
}

nav a:hover, .logout-button:hover {
  color: #007bff;
  background-color: #e9ecef; /* Light background on hover */
}

.logout-button {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit; /* Inherit font from parent */
  font-size: inherit; /* Inherit font size */
}

main {
  padding: 1rem;
}

footer {
  text-align: center;
  padding: 1rem;
  margin-top: 2rem;
  background-color: #f0f0f0;
  border-top: 1px solid #ccc;
}
</style>

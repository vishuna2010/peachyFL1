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
          <!-- Cart Link - visible to all, but count updates based on cart state -->
          <li>
            <NuxtLink to="/cart" class="cart-link">
              🛒 Cart <span v-if="cartTotalItems > 0" class="cart-count">({{ cartTotalItems }})</span>
            </NuxtLink>
          </li>
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
import { useCart } from '~/composables/useCart'; // Import useCart

// Auth composable
const { authToken, authUser, logout } = useAuth();
const isAuthenticated = computed(() => !!authToken.value);
const user = computed(() => authUser.value);
const isAdminUser = computed(() => authUser.value?.role === 'admin');

const handleLogout = () => {
  logout();
};

// Cart composable
const { cartTotalItems } = useCart();

</script>

<style scoped>
/* Basic styling for layout */
header {
  background-color: #f0f0f0;
  padding: 1rem;
  border-bottom: 1px solid #ccc;
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
  /* This will make the cart link appear after the user greeting if it's the last item.
     If you want cart before user greeting, you might need to adjust flex order or structure.
     For simplicity, cart link is added as the last item in the ul. */
  color: #555;
  font-size: 0.9em;
}
/* If user-greeting is not the item pushing others, and you want cart on far right: */
nav ul .cart-link {
   margin-left: auto; /* This would push cart to the far right if user-greeting wasn't already doing so */
}
/* To have user greeting then cart at the very end, you might need another wrapper or adjust margin logic */
/* For now, cart-link is simply the last item in the flow. */


nav a, .logout-button, .cart-link { /* Added .cart-link */
  text-decoration: none;
  color: #333;
  padding: 0.5rem;
  border-radius: 4px;
  display: inline-block;
}

nav a:hover, .logout-button:hover, .cart-link:hover { /* Added .cart-link */
  color: #007bff;
  background-color: #e9ecef;
}

.cart-link .cart-count {
  font-size: 0.8em;
  font-weight: bold;
  color: #28a745; /* Green count */
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

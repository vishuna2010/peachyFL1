<template>
  <div>
    <header>
      <nav>
        <ul>
          <li>
            <NuxtLink to="/">Home</NuxtLink>
          </li>
          <!-- Add other navigation links here if needed -->
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
  gap: 1rem;
}

nav a {
  text-decoration: none;
  color: #333;
}

nav a:hover {
  color: #007bff;
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

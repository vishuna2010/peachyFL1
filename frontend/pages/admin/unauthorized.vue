<template>
  <div class="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
    <div class="mx-auto max-w-screen-sm text-center">
      <h1 class="mb-4 text-7xl tracking-tight font-extrabold lg:text-9xl text-primary-600 dark:text-primary-500">
        403
      </h1>
      <p class="mb-4 text-3xl tracking-tight font-bold text-gray-900 md:text-4xl dark:text-white">
        Access Denied.
      </p>
      <p class="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
        Sorry, you don't have the required permissions to access this page.
      </p>
      <NuxtLink
        to="/admin"
        class="inline-flex text-white bg-primary-600 hover:bg-primary-800 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:focus:ring-primary-900 my-4"
      >
        Back to Admin Dashboard
      </NuxtLink>
      <NuxtLink
        to="/"
        class="ml-4 inline-flex text-gray-900 bg-gray-200 hover:bg-gray-300 focus:ring-4 focus:outline-none focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:text-white dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-600 my-4"
      >
        Back to Homepage
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth'], // Ensures user is admin, but RBAC would have already run for the original target page
});

useHead({
  title: 'Access Denied',
});
</script>

<style scoped>
/* Add any specific styles if needed */
</style>

<template>
  <div>
    <HeaderTopBar />
    <AppHeader />
    <main class="bg-venus-background min-h-screen">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
<script setup>
import HeaderTopBar from '~/components/layout/HeaderTopBar.vue';
import AppHeader from '~/components/layout/AppHeader.vue';
import AppFooter from '~/components/layout/AppFooter.vue';
</script>
<style>
/* Ensure Lato and Playfair Display are loaded, e.g., via Nuxt config or CSS import */
/* Basic body styling for new theme if needed */
body {
  @apply font-sans text-venus-text-primary bg-venus-background;
}
</style>

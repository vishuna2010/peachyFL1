<template>
  <div>
    <label v-if="label" :for="id" class="block text-sm font-medium text-gray-700 mb-1">{{ label }}</label>
    <slot></slot>
    <p v-if="helpText" class="mt-1 text-xs text-gray-500">{{ helpText }}</p>
    <p v-if="errorText" class="mt-1 text-xs text-red-500">{{ errorText }}</p>
  </div>
</template>

<script setup>
defineProps({
  id: String,
  label: String,
  helpText: String,
  errorText: String,
});
</script>

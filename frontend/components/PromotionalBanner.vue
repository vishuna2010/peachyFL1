<template>
  <div :class="bannerClasses" class="py-3 px-4 text-center">
    <p class="font-semibold" v-if="title">{{ title }}</p>
    <p :class="subtitle ? 'mt-1' : ''">{{ mainText }}
      <NuxtLink v-if="linkText && linkUrl" :to="linkUrl" class="underline font-bold hover:opacity-80 transition-opacity duration-200">
        {{ linkText }}
      </NuxtLink>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  mainText: { type: String, required: true },
  linkText: { type: String, default: '' },
  linkUrl: { type: String, default: '#' },
  type: { type: String, default: 'primary' } // 'primary', 'secondary'
});

const bannerClasses = computed(() => {
  let classes = 'text-sm ';
  if (props.type === 'primary') {
    // Example: Gold background with dark text
    classes += 'bg-venus-accent-gold text-venus-text-primary';
  } else { // secondary
    // Example: Dark background with white text (like the existing top bar)
    classes += 'bg-venus-neutral-dark text-white';
  }
  return classes;
});
</script>

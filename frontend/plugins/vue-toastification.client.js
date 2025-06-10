import { defineNuxtPlugin } from '#app';
import Toast, { POSITION } from 'vue-toastification';
import 'vue-toastification/dist/index.css'; // Import default CSS

export default defineNuxtPlugin((nuxtApp) => {
  const options = {
    position: POSITION.TOP_RIGHT,
    timeout: 3500, // Slightly longer for readability
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
    draggablePercent: 0.6,
    showCloseButtonOnHover: false, // Show close button always or never based on closeButton presence
    hideProgressBar: false, // Show progress bar
    closeButton: "button", // "button", "jsx" (provide JSX), false (no close)
    icon: true, // Show default icons, or provide custom components
    rtl: false,
    transition: "Vue-Toastification__bounce", // Default transition
    maxToasts: 7, // Max number of toasts on screen
    newestOnTop: true, // New toasts appear on top
    // You can add global options for specific toast types here if needed
    // filterBeforeCreate: (toast, toasts) => { ... },
    // filterToasts: toasts => { ... },
    // containerClassName: 'my-custom-container',
    // toastClassName: ['my-custom-toast'],
    // bodyClassName: ['my-custom-body'],
    // ...and other options
  };

  nuxtApp.vueApp.use(Toast, options);

  // Optionally, provide the toast interface to the Nuxt app instance
  // This makes it available via useNuxtApp().$toast or directly in setup as toast
  // However, vue-toastification's primary API is via `import { useToast } from 'vue-toastification';`
  // which should work out of the box after the plugin installs it.
  // For direct injection if desired:
  // nuxtApp.provide('toast', nuxtApp.vueApp.config.globalProperties.$toast);
});

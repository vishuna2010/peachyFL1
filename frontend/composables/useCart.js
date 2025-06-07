import { ref, computed, watch } from 'vue';

// Cart item structure: { productId: string, quantity: number, name: string, price: number, image_url: string | null }
const cartItems = ref([]);
const isCartInitialized = ref(false); // To prevent multiple initializations

const CART_STORAGE_KEY = 'myNuxtEcommerceCart';

// --- Persistence ---
const saveCartToLocalStorage = () => {
  if (process.client) { // Ensure localStorage is only accessed on the client
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems.value));
  }
};

const loadCartFromLocalStorage = () => {
  if (process.client) {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      cartItems.value = JSON.parse(storedCart);
    }
  }
};

// Watch for changes in cartItems and save to localStorage
// This needs to be outside the useCart function if cartItems is truly global singleton shared across useCart calls
// However, Nuxt composables usually return their own state unless explicitly shared via useState
// For this example, we'll make cartItems a global singleton for simplicity of this file.
// A more robust approach for multiple instances might involve Nuxt's useState for global reactive state.
// Let's assume this composable itself acts as a singleton due to Nuxt's module caching.
watch(cartItems, (newCart) => {
  if (isCartInitialized.value) { // Only save after initial load to prevent overwriting during init
    saveCartToLocalStorage();
  }
}, { deep: true });


export const useCart = () => {

  const initCart = () => {
    if (process.client && !isCartInitialized.value) {
      loadCartFromLocalStorage();
      isCartInitialized.value = true;
      console.log('Cart initialized from localStorage.');
    }
  };

  const addToCart = (product, quantity = 1) => {
    if (!product || !product.id) {
      console.error('Invalid product passed to addToCart');
      return;
    }
    if (!isCartInitialized.value && process.client) {
        initCart(); // Ensure cart is loaded before operations
    }

    const existingItem = cartItems.value.find(item => item.productId === product.id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cartItems.value.push({
        productId: product.id,
        name: product.name,
        price: parseFloat(product.price), // Ensure price is a number
        image_url: product.image_url || null,
        quantity: quantity,
      });
    }
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Added to cart:', product.name, 'Quantity:', quantity);
  };

  const removeFromCart = (productId) => {
     if (!isCartInitialized.value && process.client) {
        initCart();
    }
    cartItems.value = cartItems.value.filter(item => item.productId !== productId);
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Removed from cart, productId:', productId);
  };

  const updateQuantity = (productId, quantity) => {
    if (!isCartInitialized.value && process.client) {
        initCart();
    }
    const item = cartItems.value.find(item => item.productId === productId);
    if (item) {
      if (quantity <= 0) {
        removeFromCart(productId);
      } else {
        item.quantity = quantity;
      }
    }
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Updated quantity for productId:', productId, 'New Quantity:', quantity);
  };

  const clearCart = () => {
    cartItems.value = [];
    // saveCartToLocalStorage(); // Watcher handles this
    console.log('Cart cleared.');
  };

  // --- Computed Properties ---
  const cartTotalItems = computed(() => {
    if (!isCartInitialized.value && process.client) {
        // This might run on server before init, so guard or ensure init happens first
        // For client-side components, this should be fine after mount.
    }
    return cartItems.value.reduce((total, item) => total + item.quantity, 0);
  });

  const cartTotalPrice = computed(() => {
    if (!isCartInitialized.value && process.client) {
        // Guard for server-side rendering if needed
    }
    const total = cartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0);
    return parseFloat(total.toFixed(2)); // Ensure two decimal places
  });

  return {
    cartItems: computed(() => cartItems.value), // Expose as computed to encourage read-only access from outside
    isCartInitialized: computed(() => isCartInitialized.value),
    initCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotalItems,
    cartTotalPrice,
  };
};

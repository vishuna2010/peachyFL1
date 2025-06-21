import { ref, computed, watch } from 'vue';
import { useToast } from 'vue-toastification'; // Added import

// Cart item structure:
// {
//   cartItemId: 'prod123-variant456', // or 'prod123-base'
//   productId: '123', // Base Product ID
//   productVariantId: '456', // or null
//   name: 'Awesome T-Shirt', // Base Product Name
//   quantity: 1,
//   price: 29.99, // Final price of this item (variant or base)
//   image_url: 'path/to/variant_or_base_image.jpg',
//   sku: 'SKU-RED-L', // Variant or base SKU
//   selectedVariantDescription: 'Color: Red, Size: Large' // or empty string/null
// }
const cartItems = ref([]);
const isCartInitialized = ref(false);

const CART_STORAGE_KEY = 'myNuxtEcommerceCart';

// --- Persistence ---
const saveCartToLocalStorage = () => {
  if (process.client) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems.value));
  }
};

const loadCartFromLocalStorage = () => {
  if (process.client) {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      try {
        const parsedCart = JSON.parse(storedCart);
        // Basic validation: check if it's an array (or an object if your cart structure is different)
        if (Array.isArray(parsedCart)) {
          cartItems.value = parsedCart;
        } else {
          console.warn('Stored cart data is not an array, resetting cart:', parsedCart);
          cartItems.value = []; // Reset to empty if structure is unexpected
          localStorage.removeItem(CART_STORAGE_KEY); // Remove invalid cart data
        }
      } catch (error) {
        console.error('Error parsing cart from localStorage:', error);
        cartItems.value = []; // Reset to empty cart on parsing error
        localStorage.removeItem(CART_STORAGE_KEY); // Remove corrupted cart data
      }
    }
  }
};

const appliedDiscount = ref(null);
const discountValidationError = ref('');

watch(cartItems, (newCart) => {
  if (isCartInitialized.value) {
    saveCartToLocalStorage();
    if (newCart.length === 0) {
        clearAppliedDiscountGlobal(); // Use a global-scoped clear if needed
    }
  }
}, { deep: true });

// Helper function to clear discount if cartItems is watched directly
// This needs to be outside useCart if cartItems is a true global singleton.
// For now, assuming cartItems is managed within the scope of useCart instances,
// so clearAppliedDiscount from useCart context is fine.
// If cartItems were a global useState, this would be:
function clearAppliedDiscountGlobal() {
    appliedDiscount.value = null;
    discountValidationError.value = '';
}


export const useCart = () => {
  const { $axios } = useNuxtApp();
  const toast = useToast(); // Initialize toast

  const initCart = () => {
    if (process.client && !isCartInitialized.value) {
      loadCartFromLocalStorage();
      isCartInitialized.value = true;
      console.log('Cart initialized from localStorage.');
    }
  };

  const addToCart = (itemDetails, quantityToAdd = 1) => {
    if (!itemDetails || !itemDetails.id) { // itemDetails.id is now variant_id or product_id
      console.error('Invalid itemDetails passed to addToCart', itemDetails);
      toast.error("Could not add item to cart due to invalid product data.");
      return;
    }
    if (!isCartInitialized.value && process.client) {
        initCart();
    }

    // Generate a unique cartItemId: 'variant-VID' or 'product-PID'
    const cartItemId = itemDetails.type === 'variant'
      ? `variant-${itemDetails.variant_id}`
      : `product-${itemDetails.product_id}`;

    const existingItem = cartItems.value.find(item => item.cartItemId === cartItemId);

    if (existingItem) {
      existingItem.quantity += quantityToAdd;
      toast.info(`Quantity of "${existingItem.name}" updated to ${existingItem.quantity} in cart.`);
    } else {
      const newItem = {
        cartItemId: cartItemId, // Unique ID for the cart line item
        id: itemDetails.id, // Original product or variant ID
        productId: itemDetails.product_id, // Base product ID
        variantId: itemDetails.variant_id || null, // Actual variant ID, if applicable
        name: itemDetails.name, // Descriptive name (e.g., "Product - Red, Large")
        price: parseFloat(itemDetails.price),
        image_url: itemDetails.image_url || null,
        sku: itemDetails.sku || null,
        type: itemDetails.type, // 'product' or 'variant'
        // selectedVariantDescription could be derived from name or passed if needed explicitly
        quantity: quantityToAdd,
      };
      cartItems.value.push(newItem);
      toast.success(`"${newItem.name}" (Qty: ${quantityToAdd}) added to cart!`);
    }
    // console.log('Cart operation:', itemDetails.name, 'Type:', itemDetails.type, 'ID:', itemDetails.id, 'Quantity after op:', existingItem ? existingItem.quantity : quantityToAdd);
  };

  const removeFromCart = (cartItemIdToRemove) => {
     if (!isCartInitialized.value && process.client) {
        initCart();
    }
    const itemIndex = cartItems.value.findIndex(item => item.cartItemId === cartItemIdToRemove);
    if (itemIndex > -1) {
        const removedItemName = cartItems.value[itemIndex].name;
        cartItems.value.splice(itemIndex, 1);
        toast.info(`"${removedItemName}" removed from cart.`);
        console.log('Removed from cart, cartItemId:', cartItemIdToRemove);
    }
  };

  const updateQuantity = (cartItemIdToUpdate, newQuantity) => {
    if (!isCartInitialized.value && process.client) {
        initCart();
    }
    const item = cartItems.value.find(item => item.cartItemId === cartItemIdToUpdate);
    if (item) {
      if (newQuantity <= 0) {
        removeFromCart(cartItemIdToUpdate);
      } else {
        item.quantity = newQuantity;
        toast.info(`Quantity of "${item.name}" updated to ${newQuantity}.`);
      }
    }
    console.log('Updated quantity for cartItemId:', cartItemIdToUpdate, 'New Quantity:', newQuantity);
  };

  const clearCart = () => {
    cartItems.value = [];
    clearAppliedDiscount();
    toast.info("Cart cleared.");
    console.log('Cart cleared.');
  };

  async function applyDiscountCode(codeToApply) {
    if (!codeToApply || codeToApply.trim() === '') {
      discountValidationError.value = 'Please enter a discount code.';
      appliedDiscount.value = null;
      toast.error('Please enter a discount code.');
      return;
    }
    discountValidationError.value = '';
    appliedDiscount.value = null;

    const subtotal = cartSubtotal.value;

    try {
      const response = await $axios.post('/cart/validate-discount', {
        discount_code: codeToApply.trim().toUpperCase(),
        cart_subtotal: subtotal
      });
      appliedDiscount.value = response.data;
      toast.success(`Discount "${response.data.code}" applied!`);
      console.log('Discount applied:', response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Invalid or expired discount code.';
      console.error('Error applying discount code:', errorMessage);
      discountValidationError.value = errorMessage;
      appliedDiscount.value = null;
      toast.error(errorMessage);
    }
  }

  function clearAppliedDiscount() {
    if(appliedDiscount.value) { // Only show toast if a discount was actually cleared
        toast.info(`Discount "${appliedDiscount.value.code}" removed.`);
    }
    appliedDiscount.value = null;
    discountValidationError.value = '';
    console.log('Applied discount cleared.');
  }

  const cartSubtotal = computed(() => {
    if (!isCartInitialized.value && process.client && cartItems.value.length > 0) {
    }
    const total = cartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0);
    return parseFloat(total.toFixed(2));
  });

  const cartFinalTotalPrice = computed(() => {
    if (appliedDiscount.value && appliedDiscount.value.calculated_discount_amount_for_cart) {
      const finalTotal = cartSubtotal.value - parseFloat(appliedDiscount.value.calculated_discount_amount_for_cart);
      return parseFloat(Math.max(0, finalTotal).toFixed(2));
    }
    return cartSubtotal.value;
  });

  const cartTotalItems = computed(() => {
    return cartItems.value.reduce((total, item) => total + item.quantity, 0);
  });


  return {
    cartItems: computed(() => cartItems.value),
    isCartInitialized: computed(() => isCartInitialized.value),
    appliedDiscount: computed(() => appliedDiscount.value),
    discountValidationError: computed(() => discountValidationError.value),
    initCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyDiscountCode,
    clearAppliedDiscount,
    cartTotalItems,
    cartSubtotal,
    cartFinalTotalPrice,
  };
};

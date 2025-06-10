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
      cartItems.value = JSON.parse(storedCart);
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

  const addToCart = (productDetails, quantity = 1) => {
    if (!productDetails || !productDetails.id) {
      console.error('Invalid productDetails passed to addToCart');
      toast.error("Could not add item to cart due to invalid product data.");
      return;
    }
    if (!isCartInitialized.value && process.client) {
        initCart();
    }

    const cartItemId = productDetails.id + '-' + (productDetails.productVariantId || 'base');
    const existingItem = cartItems.value.find(item => item.cartItemId === cartItemId);

    let itemName = productDetails.name; // Default to base product name
    if (existingItem) {
      existingItem.quantity += quantity;
      itemName = existingItem.name; // Use name already in cart for consistency in toast
      toast.info(`Quantity of "${itemName}" updated to ${existingItem.quantity} in cart.`);
    } else {
      const selectedVariantDesc = productDetails.selectedOptionsDescriptionArray
                                  ? productDetails.selectedOptionsDescriptionArray.join(', ')
                                  : '';
      const newItem = {
        cartItemId: cartItemId,
        productId: productDetails.id,
        productVariantId: productDetails.productVariantId || null,
        name: productDetails.name,
        price: parseFloat(productDetails.price),
        image_url: productDetails.image_url || null,
        sku: productDetails.sku || null,
        selectedVariantDescription: selectedVariantDesc,
        quantity: quantity,
      };
      cartItems.value.push(newItem);
      itemName = newItem.name; // Use name from newly created item
      toast.success(`"${itemName}" (Qty: ${quantity}) added to cart!`);
    }
    console.log('Cart operation:', productDetails.name, 'Variant:', productDetails.productVariantId, 'Quantity after op:', existingItem ? existingItem.quantity : quantity);
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
      const response = await $axios.post('/api/cart/validate-discount', {
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

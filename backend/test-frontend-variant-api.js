const axios = require('axios');

async function testFrontendVariantAPI() {
  try {
    console.log('Testing frontend API call for product with variants...');
    
    // Test the product API endpoint that the frontend uses
    const response = await axios.get('http://localhost:3000/api/products/1');
    
    console.log('Product API response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check the specific variant that should be showing
    const variants = response.data.variants || [];
    const targetVariant = variants.find(v => v.sku === 'HDPHN-WL-BT-001-USE-RED-XS');
    
    if (targetVariant) {
      console.log('\nTarget variant details:');
      console.log(`ID: ${targetVariant.id}`);
      console.log(`SKU: ${targetVariant.sku}`);
      console.log(`Price Modifier: ${targetVariant.price_modifier}`);
      console.log(`Final Price: ${targetVariant.final_price}`);
      console.log(`Original Final Price: ${targetVariant.original_final_price}`);
      console.log(`Is On Sale: ${targetVariant.is_on_sale}`);
      console.log(`Sale Price: ${targetVariant.sale_price}`);
    } else {
      console.log('\nTarget variant not found in API response');
    }
    
    // Check if there's a variant with $160 final_price
    const expensiveVariant = variants.find(v => parseFloat(v.final_price) >= 159 && parseFloat(v.final_price) <= 161);
    
    if (expensiveVariant) {
      console.log('\nVariant with ~$160 price:');
      console.log(`ID: ${expensiveVariant.id}`);
      console.log(`SKU: ${expensiveVariant.sku}`);
      console.log(`Price Modifier: ${expensiveVariant.price_modifier}`);
      console.log(`Final Price: ${expensiveVariant.final_price}`);
      console.log(`Original Final Price: ${expensiveVariant.original_final_price}`);
    }
    
  } catch (error) {
    console.error('Error testing frontend API:', error.response?.data || error.message);
  }
}

testFrontendVariantAPI(); 
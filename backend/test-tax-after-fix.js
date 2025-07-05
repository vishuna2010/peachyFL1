const axios = require('axios');

async function testTaxAfterFix() {
  try {
    console.log('Testing tax calculation for the fixed variant...');
    
    // Test cart API with the fixed variant
    const cartPayload = {
      cartItems: [
        {
          productId: 1,
          variantId: 68, // HDPHN-WL-BT-001-USE-RED-XS
          quantity: 1,
          price: 149.99
        }
      ],
      shippingAddress: {
        country: 'BS',
        state_province: 'NP'
      }
    };
    
    console.log('Cart payload:', JSON.stringify(cartPayload, null, 2));
    
    const response = await axios.post('http://localhost:3000/api/cart/calculate-taxes', cartPayload);
    
    console.log('Tax calculation response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check if the tax amount is correct (10% of $149.99 = $15.00)
    const expectedTax = 15.00;
    const actualTax = response.data.total_tax_amount;
    
    console.log(`\nExpected tax: $${expectedTax}`);
    console.log(`Actual tax: $${actualTax}`);
    console.log(`Tax calculation ${actualTax === expectedTax ? 'CORRECT' : 'INCORRECT'}`);
    
  } catch (error) {
    console.error('Error testing tax calculation:', error.response?.data || error.message);
  }
}

testTaxAfterFix(); 
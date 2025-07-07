const geoLocationService = require('./services/geoLocationService');

async function testGeoLocationService() {
  console.log('Testing Geo-Location Service...\n');

  try {
    // Test 1: Get available providers
    console.log('1. Available Providers:');
    const providers = geoLocationService.getAvailableProviders();
    providers.forEach(provider => {
      console.log(`   - ${provider.name} (${provider.key}): ${provider.description}`);
    });

    // Test 2: Get current provider
    console.log('\n2. Current Provider:');
    const currentProvider = await geoLocationService.getCurrentProvider();
    console.log(`   Current: ${currentProvider.name}`);

    // Test 3: Get allowed countries
    console.log('\n3. Allowed Countries:');
    const allowedCountries = await geoLocationService.getAllowedCountries();
    console.log(`   Countries: ${allowedCountries.join(', ')}`);

    // Test 4: Check if geo-restriction is enabled
    console.log('\n4. Geo-Restriction Status:');
    const isEnabled = await geoLocationService.isGeoRestrictionEnabled();
    console.log(`   Enabled: ${isEnabled}`);

    // Test 5: Test service with Google DNS IP
    console.log('\n5. Testing Service with IP 8.8.8.8:');
    const testResult = await geoLocationService.testService('8.8.8.8');
    console.log(`   Success: ${testResult.success}`);
    console.log(`   Provider: ${testResult.provider}`);
    console.log(`   Detected Country: ${testResult.detectedCountry || 'Unknown'}`);
    if (testResult.error) {
      console.log(`   Error: ${testResult.error}`);
    }

    // Test 6: Check if specific IP is allowed
    console.log('\n6. Checking IP 8.8.8.8 access:');
    const isAllowed = await geoLocationService.isCountryAllowed('8.8.8.8');
    console.log(`   Allowed: ${isAllowed}`);

    // Test 7: Get country from IP
    console.log('\n7. Getting country from IP 8.8.8.8:');
    const country = await geoLocationService.getCountryFromIP('8.8.8.8');
    console.log(`   Country: ${country || 'Unknown'}`);

  } catch (error) {
    console.error('Error testing geo-location service:', error);
  } finally {
    process.exit();
  }
}

testGeoLocationService(); 
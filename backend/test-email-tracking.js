const { sendMarketingPromoEmailWithTracking } = require('./services/emailService');
const emailTrackingService = require('./services/emailTrackingService');

async function testEmailTracking() {
  console.log('Testing email tracking system...\n');

  try {
    // Test 1: Send marketing email with tracking
    console.log('1. Testing marketing email with tracking...');
    const promoDetails = {
      subject: 'Test Marketing Campaign',
      promoTitle: 'Special Offer!',
      promoMessageBody: '<p>This is a test marketing email with tracking enabled.</p><p>Click <a href="https://example.com">here</a> to learn more!</p>',
      ctaLink: 'https://example.com/offer',
      ctaText: 'Get Offer'
    };

    const emailTrackingData = {
      campaignId: 1,
      userId: 1,
      messageId: `test_${Date.now()}`
    };

    const emailResult = await sendMarketingPromoEmailWithTracking(
      'test@example.com',
      'Test User',
      promoDetails,
      emailTrackingData
    );

    if (emailResult.success) {
      console.log('✅ Marketing email with tracking sent successfully!');
      console.log(`   Message ID: ${emailResult.messageId || 'N/A'}`);
      console.log(`   Preview URL: ${emailResult.previewUrl || 'N/A'}`);
    } else {
      console.log('❌ Marketing email failed:');
      console.log(`   Error: ${emailResult.error}`);
    }

    // Test 2: Check unsubscribe functionality
    console.log('\n2. Testing unsubscribe functionality...');
    const isUnsubscribed = await emailTrackingService.isUnsubscribed('test@example.com', 'marketing');
    console.log(`   Is unsubscribed: ${isUnsubscribed}`);

    // Test 3: Unsubscribe user
    console.log('\n3. Testing unsubscribe user...');
    const unsubscribeResult = await emailTrackingService.unsubscribe(
      'test@example.com',
      'marketing',
      1,
      'Test unsubscribe',
      1
    );

    if (unsubscribeResult) {
      console.log('✅ User unsubscribed successfully!');
      console.log(`   Unsubscribe token: ${unsubscribeResult.unsubscribe_token}`);
    } else {
      console.log('❌ Unsubscribe failed');
    }

    // Test 4: Check unsubscribe status again
    console.log('\n4. Testing unsubscribe status after unsubscribe...');
    const isUnsubscribedAfter = await emailTrackingService.isUnsubscribed('test@example.com', 'marketing');
    console.log(`   Is unsubscribed: ${isUnsubscribedAfter}`);

    // Test 5: Resubscribe user
    console.log('\n5. Testing resubscribe user...');
    const resubscribeResult = await emailTrackingService.resubscribe('test@example.com', 'marketing');
    console.log(`   Resubscribe result: ${resubscribeResult}`);

    // Test 6: Check unsubscribe status after resubscribe
    console.log('\n6. Testing unsubscribe status after resubscribe...');
    const isUnsubscribedAfterResubscribe = await emailTrackingService.isUnsubscribed('test@example.com', 'marketing');
    console.log(`   Is unsubscribed: ${isUnsubscribedAfterResubscribe}`);

    // Test 7: Test email preferences
    console.log('\n7. Testing email preferences...');
    const preferences = {
      marketing_emails: true,
      order_emails: true,
      promotional_emails: false,
      newsletter_emails: true
    };

    const updateResult = await emailTrackingService.updateEmailPreferences(1, 'test@example.com', preferences);
    if (updateResult) {
      console.log('✅ Email preferences updated successfully!');
      console.log(`   Marketing emails: ${updateResult.marketing_emails}`);
      console.log(`   Order emails: ${updateResult.order_emails}`);
      console.log(`   Promotional emails: ${updateResult.promotional_emails}`);
      console.log(`   Newsletter emails: ${updateResult.newsletter_emails}`);
    } else {
      console.log('❌ Email preferences update failed');
    }

    // Test 8: Get email preferences
    console.log('\n8. Testing get email preferences...');
    const getPreferencesResult = await emailTrackingService.getEmailPreferences(1, 'test@example.com');
    if (getPreferencesResult) {
      console.log('✅ Email preferences retrieved successfully!');
      console.log(`   Marketing emails: ${getPreferencesResult.marketing_emails}`);
      console.log(`   Order emails: ${getPreferencesResult.order_emails}`);
      console.log(`   Promotional emails: ${getPreferencesResult.promotional_emails}`);
      console.log(`   Newsletter emails: ${getPreferencesResult.newsletter_emails}`);
    } else {
      console.log('❌ Email preferences retrieval failed');
    }

    // Test 9: Test campaign stats (if campaign exists)
    console.log('\n9. Testing campaign stats...');
    const campaignStats = await emailTrackingService.getCampaignStats(1);
    if (campaignStats) {
      console.log('✅ Campaign stats retrieved successfully!');
      console.log(`   Campaign: ${campaignStats.name}`);
      console.log(`   Total sent: ${campaignStats.total_sent}`);
      console.log(`   Total opens: ${campaignStats.total_opens}`);
      console.log(`   Total clicks: ${campaignStats.total_clicks}`);
      console.log(`   Open rate: ${campaignStats.open_rate}%`);
      console.log(`   Click rate: ${campaignStats.click_rate}%`);
    } else {
      console.log('⚠️  Campaign stats not available (campaign may not exist)');
    }

    // Test 10: Test tracking data retrieval
    console.log('\n10. Testing tracking data retrieval...');
    const campaignTrackingData = await emailTrackingService.getCampaignTrackingData(1, 10, 0);
    console.log(`   Retrieved ${campaignTrackingData.length} tracking records`);

    console.log('\n📋 Summary:');
    console.log(`   Marketing email with tracking: ${emailResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Unsubscribe functionality: ${unsubscribeResult ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Resubscribe functionality: ${resubscribeResult ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Email preferences: ${updateResult ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (emailResult.success && unsubscribeResult && resubscribeResult && updateResult) {
      console.log('\n🎉 All email tracking tests passed! The system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the error messages above.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testEmailTracking(); 
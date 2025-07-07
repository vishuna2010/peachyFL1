<template>
  <div class="container mx-auto p-6">
    <div class="bg-white shadow-xl rounded-lg">
      <!-- Header -->
      <div class="px-8 py-6 border-b border-gray-200">
        <h1 class="text-3xl font-bold text-gray-800">Site Settings</h1>
        <p class="text-gray-600 mt-2">Configure your website's global settings, locale, currency, and feature toggles.</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-peach-pink"></div>
        <span class="ml-3 text-gray-600">Loading settings...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="px-8 py-6">
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Error loading settings</h3>
              <div class="mt-2 text-sm text-red-700">{{ error }}</div>
              <button @click="fetchSettings" class="mt-3 text-sm text-red-800 hover:text-red-900 underline">
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Content -->
      <div v-else class="flex">
        <!-- Tab Navigation -->
        <div class="w-64 border-r border-gray-200">
          <nav class="p-4 space-y-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150"
              :class="activeTab === tab.id 
                ? 'bg-peach-pink text-white' 
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'"
            >
              <div class="flex items-center">
                <span v-html="tab.icon" class="mr-3 h-5 w-5"></span>
                {{ tab.name }}
              </div>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 p-8">
          <!-- General Settings -->
          <div v-if="activeTab === 'general'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">General Settings</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                <input
                  v-model="settings.site_name"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="Enter site name"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Site Description</label>
                <input
                  v-model="settings.site_description"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="Enter site description"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                <input
                  v-model="settings.contact_email"
                  type="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="contact@example.com"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                <input
                  v-model="settings.contact_phone"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Business Address</label>
              <textarea
                v-model="settings.address"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                placeholder="Enter business address"
              ></textarea>
            </div>

            <!-- Logo Upload Section -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Site Logo</h3>
              
              <div class="flex items-center space-x-6">
                <!-- Current Logo Display -->
                <div class="flex-shrink-0">
                  <div v-if="settings.site_logo" class="relative">
                    <img 
                      :src="settings.site_logo" 
                      alt="Site Logo" 
                      class="h-16 w-auto object-contain border border-gray-200 rounded"
                    />
                    <button
                      @click="removeLogo"
                      class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      title="Remove logo"
                    >
                      ×
                    </button>
                  </div>
                  <div v-else class="h-16 w-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                    <span class="text-gray-400 text-sm">No logo</span>
                  </div>
                </div>

                <!-- Upload Controls -->
                <div class="flex-1">
                  <div class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Upload New Logo</label>
                      <div class="flex items-center space-x-3">
                        <input
                          ref="logoInput"
                          type="file"
                          accept="image/*"
                          @change="handleLogoUpload"
                          class="hidden"
                        />
                        <button
                          @click="$refs.logoInput.click()"
                          type="button"
                          class="px-4 py-2 text-sm font-medium text-peach-pink bg-white border border-peach-pink rounded-md hover:bg-peach-pink hover:text-white focus:outline-none focus:ring-2 focus:ring-peach-pink focus:ring-offset-2 transition-colors"
                        >
                          Choose File
                        </button>
                        <span v-if="logoUploading" class="text-sm text-gray-500">
                          <div class="flex items-center">
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-peach-pink mr-2"></div>
                            Uploading...
                          </div>
                        </span>
                      </div>
                    </div>
                    
                    <div class="text-xs text-gray-500">
                      Recommended: PNG or JPG, max 5MB. Logo will be displayed in the header.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Locale & Currency -->
          <div v-if="activeTab === 'locale'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">Locale & Currency</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Default Locale</label>
                <select
                  v-model="settings.default_locale"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                >
                  <!-- North America -->
                  <optgroup label="North America">
                    <option value="en-US">English (US)</option>
                    <option value="en-CA">English (Canada)</option>
                    <option value="fr-CA">French (Canada)</option>
                    <option value="es-MX">Spanish (Mexico)</option>
                  </optgroup>
                  
                  <!-- Europe -->
                  <optgroup label="Europe">
                    <option value="en-GB">English (UK)</option>
                    <option value="en-IE">English (Ireland)</option>
                    <option value="fr-FR">French (France)</option>
                    <option value="fr-BE">French (Belgium)</option>
                    <option value="fr-CH">French (Switzerland)</option>
                    <option value="de-DE">German (Germany)</option>
                    <option value="de-AT">German (Austria)</option>
                    <option value="de-CH">German (Switzerland)</option>
                    <option value="it-IT">Italian (Italy)</option>
                    <option value="it-CH">Italian (Switzerland)</option>
                    <option value="es-ES">Spanish (Spain)</option>
                    <option value="es-CAT">Catalan (Spain)</option>
                    <option value="pt-PT">Portuguese (Portugal)</option>
                    <option value="pt-BR">Portuguese (Brazil)</option>
                    <option value="nl-NL">Dutch (Netherlands)</option>
                    <option value="nl-BE">Dutch (Belgium)</option>
                    <option value="sv-SE">Swedish (Sweden)</option>
                    <option value="no-NO">Norwegian (Norway)</option>
                    <option value="da-DK">Danish (Denmark)</option>
                    <option value="fi-FI">Finnish (Finland)</option>
                    <option value="pl-PL">Polish (Poland)</option>
                    <option value="cs-CZ">Czech (Czech Republic)</option>
                    <option value="sk-SK">Slovak (Slovakia)</option>
                    <option value="hu-HU">Hungarian (Hungary)</option>
                    <option value="ro-RO">Romanian (Romania)</option>
                    <option value="bg-BG">Bulgarian (Bulgaria)</option>
                    <option value="hr-HR">Croatian (Croatia)</option>
                    <option value="sl-SI">Slovenian (Slovenia)</option>
                    <option value="et-EE">Estonian (Estonia)</option>
                    <option value="lv-LV">Latvian (Latvia)</option>
                    <option value="lt-LT">Lithuanian (Lithuania)</option>
                    <option value="el-GR">Greek (Greece)</option>
                    <option value="mt-MT">Maltese (Malta)</option>
                    <option value="ru-RU">Russian (Russia)</option>
                    <option value="uk-UA">Ukrainian (Ukraine)</option>
                    <option value="be-BY">Belarusian (Belarus)</option>
                    <option value="tr-TR">Turkish (Turkey)</option>
                  </optgroup>
                  
                  <!-- Asia Pacific -->
                  <optgroup label="Asia Pacific">
                    <option value="ja-JP">Japanese (Japan)</option>
                    <option value="ko-KR">Korean (South Korea)</option>
                    <option value="zh-CN">Chinese (Simplified, China)</option>
                    <option value="zh-TW">Chinese (Traditional, Taiwan)</option>
                    <option value="zh-HK">Chinese (Traditional, Hong Kong)</option>
                    <option value="zh-SG">Chinese (Simplified, Singapore)</option>
                    <option value="th-TH">Thai (Thailand)</option>
                    <option value="vi-VN">Vietnamese (Vietnam)</option>
                    <option value="id-ID">Indonesian (Indonesia)</option>
                    <option value="ms-MY">Malay (Malaysia)</option>
                    <option value="tl-PH">Filipino (Philippines)</option>
                    <option value="hi-IN">Hindi (India)</option>
                    <option value="bn-IN">Bengali (India)</option>
                    <option value="ta-IN">Tamil (India)</option>
                    <option value="te-IN">Telugu (India)</option>
                    <option value="mr-IN">Marathi (India)</option>
                    <option value="gu-IN">Gujarati (India)</option>
                    <option value="kn-IN">Kannada (India)</option>
                    <option value="ml-IN">Malayalam (India)</option>
                    <option value="pa-IN">Punjabi (India)</option>
                    <option value="ur-IN">Urdu (India)</option>
                    <option value="si-LK">Sinhala (Sri Lanka)</option>
                    <option value="my-MM">Burmese (Myanmar)</option>
                    <option value="km-KH">Khmer (Cambodia)</option>
                    <option value="lo-LA">Lao (Laos)</option>
                    <option value="mn-MN">Mongolian (Mongolia)</option>
                    <option value="ka-GE">Georgian (Georgia)</option>
                    <option value="hy-AM">Armenian (Armenia)</option>
                    <option value="az-AZ">Azerbaijani (Azerbaijan)</option>
                    <option value="kk-KZ">Kazakh (Kazakhstan)</option>
                    <option value="ky-KG">Kyrgyz (Kyrgyzstan)</option>
                    <option value="uz-UZ">Uzbek (Uzbekistan)</option>
                    <option value="tg-TJ">Tajik (Tajikistan)</option>
                    <option value="fa-IR">Persian (Iran)</option>
                    <option value="ps-AF">Pashto (Afghanistan)</option>
                    <option value="sd-PK">Sindhi (Pakistan)</option>
                    <option value="ne-NP">Nepali (Nepal)</option>
                    <option value="dz-BT">Dzongkha (Bhutan)</option>
                    <option value="bo-CN">Tibetan (China)</option>
                    <option value="ug-CN">Uyghur (China)</option>
                  </optgroup>
                  
                  <!-- Middle East & Africa -->
                  <optgroup label="Middle East & Africa">
                    <option value="ar-SA">Arabic (Saudi Arabia)</option>
                    <option value="ar-EG">Arabic (Egypt)</option>
                    <option value="ar-AE">Arabic (UAE)</option>
                    <option value="ar-IL">Arabic (Israel)</option>
                    <option value="ar-JO">Arabic (Jordan)</option>
                    <option value="ar-LB">Arabic (Lebanon)</option>
                    <option value="ar-IQ">Arabic (Iraq)</option>
                    <option value="ar-SY">Arabic (Syria)</option>
                    <option value="ar-PS">Arabic (Palestine)</option>
                    <option value="ar-KW">Arabic (Kuwait)</option>
                    <option value="ar-BH">Arabic (Bahrain)</option>
                    <option value="ar-QA">Arabic (Qatar)</option>
                    <option value="ar-OM">Arabic (Oman)</option>
                    <option value="ar-YE">Arabic (Yemen)</option>
                    <option value="he-IL">Hebrew (Israel)</option>
                    <option value="am-ET">Amharic (Ethiopia)</option>
                    <option value="sw-KE">Swahili (Kenya)</option>
                    <option value="sw-TZ">Swahili (Tanzania)</option>
                    <option value="yo-NG">Yoruba (Nigeria)</option>
                    <option value="ig-NG">Igbo (Nigeria)</option>
                    <option value="ha-NG">Hausa (Nigeria)</option>
                    <option value="zu-ZA">Zulu (South Africa)</option>
                    <option value="xh-ZA">Xhosa (South Africa)</option>
                    <option value="af-ZA">Afrikaans (South Africa)</option>
                    <option value="rw-RW">Kinyarwanda (Rwanda)</option>
                    <option value="lg-UG">Ganda (Uganda)</option>
                    <option value="so-SO">Somali (Somalia)</option>
                    <option value="om-ET">Oromo (Ethiopia)</option>
                    <option value="ti-ET">Tigrinya (Ethiopia)</option>
                    <option value="sn-ZW">Shona (Zimbabwe)</option>
                    <option value="st-ZA">Southern Sotho (South Africa)</option>
                    <option value="tn-ZA">Tswana (South Africa)</option>
                    <option value="ss-ZA">Swati (South Africa)</option>
                    <option value="ve-ZA">Venda (South Africa)</option>
                    <option value="ts-ZA">Tsonga (South Africa)</option>
                    <option value="nr-ZA">Southern Ndebele (South Africa)</option>
                    <option value="nd-ZW">Northern Ndebele (Zimbabwe)</option>
                  </optgroup>
                  
                  <!-- Oceania -->
                  <optgroup label="Oceania">
                    <option value="en-AU">English (Australia)</option>
                    <option value="en-NZ">English (New Zealand)</option>
                    <option value="en-FJ">English (Fiji)</option>
                    <option value="en-PG">English (Papua New Guinea)</option>
                    <option value="en-SB">English (Solomon Islands)</option>
                    <option value="en-VU">English (Vanuatu)</option>
                    <option value="en-NC">English (New Caledonia)</option>
                    <option value="en-PF">English (French Polynesia)</option>
                    <option value="mi-NZ">Maori (New Zealand)</option>
                    <option value="fj-FJ">Fijian (Fiji)</option>
                    <option value="to-TO">Tongan (Tonga)</option>
                    <option value="sm-WS">Samoan (Samoa)</option>
                    <option value="ty-PF">Tahitian (French Polynesia)</option>
                  </optgroup>
                  
                                     <!-- Caribbean -->
                   <optgroup label="Caribbean">
                     <option value="en-JM">English (Jamaica)</option>
                     <option value="en-BB">English (Barbados)</option>
                     <option value="en-TT">English (Trinidad and Tobago)</option>
                     <option value="en-BS">English (Bahamas)</option>
                     <option value="en-BZ">English (Belize)</option>
                     <option value="en-GY">English (Guyana)</option>
                     <option value="en-SR">English (Suriname)</option>
                     <option value="en-BM">English (Bermuda)</option>
                     <option value="en-KY">English (Cayman Islands)</option>
                     <option value="en-AI">English (Anguilla)</option>
                     <option value="en-VG">English (British Virgin Islands)</option>
                     <option value="en-VI">English (US Virgin Islands)</option>
                     <option value="en-TC">English (Turks and Caicos)</option>
                     <option value="en-MS">English (Montserrat)</option>
                     <option value="en-KN">English (Saint Kitts and Nevis)</option>
                     <option value="en-AG">English (Antigua and Barbuda)</option>
                     <option value="en-DM">English (Dominica)</option>
                     <option value="en-LC">English (Saint Lucia)</option>
                     <option value="en-VC">English (Saint Vincent and the Grenadines)</option>
                     <option value="en-GD">English (Grenada)</option>
                     <option value="fr-HT">French (Haiti)</option>
                     <option value="fr-MQ">French (Martinique)</option>
                     <option value="fr-GP">French (Guadeloupe)</option>
                     <option value="es-CU">Spanish (Cuba)</option>
                     <option value="es-DO">Spanish (Dominican Republic)</option>
                     <option value="es-PR">Spanish (Puerto Rico)</option>
                     <option value="nl-SR">Dutch (Suriname)</option>
                     <option value="nl-CW">Dutch (Curaçao)</option>
                     <option value="nl-SX">Dutch (Sint Maarten)</option>
                     <option value="pap-AW">Papiamento (Aruba)</option>
                     <option value="ht-HT">Haitian Creole (Haiti)</option>
                   </optgroup>
                   
                   <!-- South America -->
                   <optgroup label="South America">
                     <option value="es-AR">Spanish (Argentina)</option>
                     <option value="es-CL">Spanish (Chile)</option>
                     <option value="es-CO">Spanish (Colombia)</option>
                     <option value="es-PE">Spanish (Peru)</option>
                     <option value="es-VE">Spanish (Venezuela)</option>
                     <option value="es-EC">Spanish (Ecuador)</option>
                     <option value="es-BO">Spanish (Bolivia)</option>
                     <option value="es-PY">Spanish (Paraguay)</option>
                     <option value="es-UY">Spanish (Uruguay)</option>
                     <option value="es-GT">Spanish (Guatemala)</option>
                     <option value="es-HN">Spanish (Honduras)</option>
                     <option value="es-SV">Spanish (El Salvador)</option>
                     <option value="es-NI">Spanish (Nicaragua)</option>
                     <option value="es-CR">Spanish (Costa Rica)</option>
                     <option value="es-PA">Spanish (Panama)</option>
                     <option value="qu-PE">Quechua (Peru)</option>
                     <option value="qu-BO">Quechua (Bolivia)</option>
                     <option value="qu-EC">Quechua (Ecuador)</option>
                     <option value="ay-BO">Aymara (Bolivia)</option>
                     <option value="gn-PY">Guarani (Paraguay)</option>
                   </optgroup>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Default Currency</label>
                <select
                  v-model="settings.default_currency"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                >
                  <!-- Major World Currencies -->
                  <optgroup label="Major World Currencies">
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CHF">CHF - Swiss Franc</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="CNY">CNY - Chinese Yuan</option>
                    <option value="HKD">HKD - Hong Kong Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </optgroup>
                  
                  <!-- European Currencies -->
                  <optgroup label="European Currencies">
                    <option value="SEK">SEK - Swedish Krona</option>
                    <option value="NOK">NOK - Norwegian Krone</option>
                    <option value="DKK">DKK - Danish Krone</option>
                    <option value="PLN">PLN - Polish Złoty</option>
                    <option value="CZK">CZK - Czech Koruna</option>
                    <option value="HUF">HUF - Hungarian Forint</option>
                    <option value="RON">RON - Romanian Leu</option>
                    <option value="BGN">BGN - Bulgarian Lev</option>
                    <option value="HRK">HRK - Croatian Kuna</option>
                    <option value="RSD">RSD - Serbian Dinar</option>
                    <option value="ALL">ALL - Albanian Lek</option>
                    <option value="MKD">MKD - Macedonian Denar</option>
                    <option value="BAM">BAM - Bosnia-Herzegovina Convertible Mark</option>
                    <option value="MDL">MDL - Moldovan Leu</option>
                    <option value="UAH">UAH - Ukrainian Hryvnia</option>
                    <option value="BYN">BYN - Belarusian Ruble</option>
                    <option value="RUB">RUB - Russian Ruble</option>
                    <option value="TRY">TRY - Turkish Lira</option>
                    <option value="GEL">GEL - Georgian Lari</option>
                    <option value="AMD">AMD - Armenian Dram</option>
                    <option value="AZN">AZN - Azerbaijani Manat</option>
                    <option value="KZT">KZT - Kazakhstani Tenge</option>
                    <option value="KGS">KGS - Kyrgyzstani Som</option>
                    <option value="UZS">UZS - Uzbekistani Som</option>
                    <option value="TJS">TJS - Tajikistani Somoni</option>
                    <option value="TMT">TMT - Turkmenistani Manat</option>
                    <option value="ISK">ISK - Icelandic Króna</option>
                    <option value="FIM">FIM - Finnish Markka (discontinued)</option>
                    <option value="ITL">ITL - Italian Lira (discontinued)</option>
                    <option value="ESP">ESP - Spanish Peseta (discontinued)</option>
                    <option value="PTE">PTE - Portuguese Escudo (discontinued)</option>
                    <option value="ATS">ATS - Austrian Schilling (discontinued)</option>
                    <option value="BEF">BEF - Belgian Franc (discontinued)</option>
                    <option value="DEM">DEM - German Mark (discontinued)</option>
                    <option value="FRF">FRF - French Franc (discontinued)</option>
                    <option value="IEP">IEP - Irish Pound (discontinued)</option>
                    <option value="LUF">LUF - Luxembourg Franc (discontinued)</option>
                    <option value="NLG">NLG - Dutch Guilder (discontinued)</option>
                    <option value="GRD">GRD - Greek Drachma (discontinued)</option>
                    <option value="SIT">SIT - Slovenian Tolar (discontinued)</option>
                    <option value="SKK">SKK - Slovak Koruna (discontinued)</option>
                    <option value="CYP">CYP - Cypriot Pound (discontinued)</option>
                    <option value="MTL">MTL - Maltese Lira (discontinued)</option>
                    <option value="EEK">EEK - Estonian Kroon (discontinued)</option>
                    <option value="LVL">LVL - Latvian Lats (discontinued)</option>
                    <option value="LTL">LTL - Lithuanian Litas (discontinued)</option>
                  </optgroup>
                  
                  <!-- Asian Currencies -->
                  <optgroup label="Asian Currencies">
                    <option value="KRW">KRW - South Korean Won</option>
                    <option value="TWD">TWD - Taiwan Dollar</option>
                    <option value="THB">THB - Thai Baht</option>
                    <option value="VND">VND - Vietnamese Dong</option>
                    <option value="IDR">IDR - Indonesian Rupiah</option>
                    <option value="MYR">MYR - Malaysian Ringgit</option>
                    <option value="PHP">PHP - Philippine Peso</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="PKR">PKR - Pakistani Rupee</option>
                    <option value="BDT">BDT - Bangladeshi Taka</option>
                    <option value="LKR">LKR - Sri Lankan Rupee</option>
                    <option value="NPR">NPR - Nepalese Rupee</option>
                    <option value="BTN">BTN - Bhutanese Ngultrum</option>
                    <option value="MMK">MMK - Myanmar Kyat</option>
                    <option value="KHR">KHR - Cambodian Riel</option>
                    <option value="LAK">LAK - Lao Kip</option>
                    <option value="MNT">MNT - Mongolian Tögrög</option>
                    <option value="IRR">IRR - Iranian Rial</option>
                    <option value="AFN">AFN - Afghan Afghani</option>
                    <option value="NIO">NIO - Nicaraguan Córdoba</option>
                    <option value="GTQ">GTQ - Guatemalan Quetzal</option>
                    <option value="HNL">HNL - Honduran Lempira</option>
                    <option value="SVC">SVC - Salvadoran Colón</option>
                    <option value="CRC">CRC - Costa Rican Colón</option>
                    <option value="PAB">PAB - Panamanian Balboa</option>
                    <option value="CUP">CUP - Cuban Peso</option>
                    <option value="DOP">DOP - Dominican Peso</option>
                    <option value="JMD">JMD - Jamaican Dollar</option>
                    <option value="TTD">TTD - Trinidad and Tobago Dollar</option>
                    <option value="BBD">BBD - Barbadian Dollar</option>
                    <option value="BZD">BZD - Belize Dollar</option>
                    <option value="GYD">GYD - Guyanese Dollar</option>
                    <option value="SRD">SRD - Surinamese Dollar</option>
                    <option value="XCD">XCD - East Caribbean Dollar</option>
                    <option value="ANG">ANG - Netherlands Antillean Guilder</option>
                    <option value="AWG">AWG - Aruban Florin</option>
                    <option value="KYD">KYD - Cayman Islands Dollar</option>
                    <option value="BMD">BMD - Bermudian Dollar</option>
                    <option value="FJD">FJD - Fijian Dollar</option>
                    <option value="NZD">NZD - New Zealand Dollar</option>
                    <option value="PGK">PGK - Papua New Guinean Kina</option>
                    <option value="SBD">SBD - Solomon Islands Dollar</option>
                    <option value="VUV">VUV - Vanuatu Vatu</option>
                    <option value="TOP">TOP - Tongan Paʻanga</option>
                    <option value="WST">WST - Samoan Tālā</option>
                    <option value="XPF">XPF - CFP Franc</option>
                    <option value="CLP">CLP - Chilean Peso</option>
                    <option value="COP">COP - Colombian Peso</option>
                    <option value="PEN">PEN - Peruvian Sol</option>
                    <option value="VES">VES - Venezuelan Bolívar</option>
                    <option value="ECU">ECU - Ecuadorian Sucre (discontinued)</option>
                    <option value="BOB">BOB - Bolivian Boliviano</option>
                    <option value="PYG">PYG - Paraguayan Guaraní</option>
                    <option value="UYU">UYU - Uruguayan Peso</option>
                    <option value="ARS">ARS - Argentine Peso</option>
                    <option value="BRL">BRL - Brazilian Real</option>
                    <option value="GYD">GYD - Guyanese Dollar</option>
                    <option value="SRD">SRD - Surinamese Dollar</option>
                    <option value="FKP">FKP - Falkland Islands Pound</option>
                    <option value="GIP">GIP - Gibraltar Pound</option>
                    <option value="SHP">SHP - Saint Helena Pound</option>
                    <option value="ZAR">ZAR - South African Rand</option>
                    <option value="NAD">NAD - Namibian Dollar</option>
                    <option value="BWP">BWP - Botswana Pula</option>
                    <option value="LSL">LSL - Lesotho Loti</option>
                    <option value="SZL">SZL - Eswatini Lilangeni</option>
                    <option value="MUR">MUR - Mauritian Rupee</option>
                    <option value="SCR">SCR - Seychellois Rupee</option>
                    <option value="KMF">KMF - Comorian Franc</option>
                    <option value="DJF">DJF - Djiboutian Franc</option>
                    <option value="ETB">ETB - Ethiopian Birr</option>
                    <option value="SOS">SOS - Somali Shilling</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="TZS">TZS - Tanzanian Shilling</option>
                    <option value="UGX">UGX - Ugandan Shilling</option>
                    <option value="RWF">RWF - Rwandan Franc</option>
                    <option value="BIF">BIF - Burundian Franc</option>
                    <option value="CDF">CDF - Congolese Franc</option>
                    <option value="GMD">GMD - Gambian Dalasi</option>
                    <option value="GHS">GHS - Ghanaian Cedi</option>
                    <option value="NGN">NGN - Nigerian Naira</option>
                    <option value="XOF">XOF - West African CFA Franc</option>
                    <option value="XAF">XAF - Central African CFA Franc</option>
                    <option value="XPF">XPF - CFP Franc</option>
                    <option value="MAD">MAD - Moroccan Dirham</option>
                    <option value="DZD">DZD - Algerian Dinar</option>
                    <option value="TND">TND - Tunisian Dinar</option>
                    <option value="LYD">LYD - Libyan Dinar</option>
                    <option value="EGP">EGP - Egyptian Pound</option>
                    <option value="SDG">SDG - Sudanese Pound</option>
                    <option value="SSP">SSP - South Sudanese Pound</option>
                    <option value="ERN">ERN - Eritrean Nakfa</option>
                    <option value="STN">STN - São Tomé and Príncipe Dobra</option>
                    <option value="CVE">CVE - Cape Verdean Escudo</option>
                    <option value="GNF">GNF - Guinean Franc</option>
                    <option value="SLL">SLL - Sierra Leonean Leone</option>
                    <option value="LRD">LRD - Liberian Dollar</option>
                    <option value="MRO">MRO - Mauritanian Ouguiya (discontinued)</option>
                    <option value="MRU">MRU - Mauritanian Ouguiya</option>
                    <option value="MZN">MZN - Mozambican Metical</option>
                    <option value="MWK">MWK - Malawian Kwacha</option>
                    <option value="ZMW">ZMW - Zambian Kwacha</option>
                    <option value="ZMK">ZMK - Zambian Kwacha (discontinued)</option>
                    <option value="MGA">MGA - Malagasy Ariary</option>
                    <option value="MGF">MGF - Malagasy Franc (discontinued)</option>
                    <option value="AOA">AOA - Angolan Kwanza</option>
                    <option value="AON">AON - Angolan New Kwanza (discontinued)</option>
                    <option value="AOR">AOR - Angolan Readjusted Kwanza (discontinued)</option>
                    <option value="ZWD">ZWD - Zimbabwean Dollar (discontinued)</option>
                    <option value="ZWL">ZWL - Zimbabwean Dollar (2009)</option>
                    <option value="ZWR">ZWR - Zimbabwean Dollar (2008)</option>
                    <option value="ZWN">ZWN - Zimbabwean Dollar (2006)</option>
                    <option value="ZWD">ZWD - Zimbabwean Dollar (1980-2008)</option>
                  </optgroup>
                  
                                     <!-- Caribbean Currencies -->
                   <optgroup label="Caribbean Currencies">
                     <option value="XCD">XCD - East Caribbean Dollar</option>
                     <option value="ANG">ANG - Netherlands Antillean Guilder</option>
                     <option value="AWG">AWG - Aruban Florin</option>
                     <option value="KYD">KYD - Cayman Islands Dollar</option>
                     <option value="BMD">BMD - Bermudian Dollar</option>
                     <option value="BBD">BBD - Barbadian Dollar</option>
                     <option value="TTD">TTD - Trinidad and Tobago Dollar</option>
                     <option value="JMD">JMD - Jamaican Dollar</option>
                     <option value="BZD">BZD - Belize Dollar</option>
                     <option value="GYD">GYD - Guyanese Dollar</option>
                     <option value="SRD">SRD - Surinamese Dollar</option>
                     <option value="HTG">HTG - Haitian Gourde</option>
                     <option value="DOP">DOP - Dominican Peso</option>
                     <option value="CUP">CUP - Cuban Peso</option>
                     <option value="BSD">BSD - Bahamian Dollar</option>
                   </optgroup>
                   
                   <!-- Middle Eastern Currencies -->
                   <optgroup label="Middle Eastern Currencies">
                     <option value="SAR">SAR - Saudi Riyal</option>
                     <option value="AED">AED - UAE Dirham</option>
                     <option value="QAR">QAR - Qatari Riyal</option>
                     <option value="KWD">KWD - Kuwaiti Dinar</option>
                     <option value="BHD">BHD - Bahraini Dinar</option>
                     <option value="OMR">OMR - Omani Rial</option>
                     <option value="YER">YER - Yemeni Rial</option>
                     <option value="JOD">JOD - Jordanian Dinar</option>
                     <option value="LBP">LBP - Lebanese Pound</option>
                     <option value="SYP">SYP - Syrian Pound</option>
                     <option value="IQD">IQD - Iraqi Dinar</option>
                     <option value="ILS">ILS - Israeli New Shekel</option>
                     <option value="PEN">PEN - Peruvian Sol</option>
                     <option value="VES">VES - Venezuelan Bolívar</option>
                     <option value="ECU">ECU - Ecuadorian Sucre (discontinued)</option>
                     <option value="BOB">BOB - Bolivian Boliviano</option>
                     <option value="PYG">PYG - Paraguayan Guaraní</option>
                     <option value="UYU">UYU - Uruguayan Peso</option>
                     <option value="ARS">ARS - Argentine Peso</option>
                     <option value="BRL">BRL - Brazilian Real</option>
                     <option value="FKP">FKP - Falkland Islands Pound</option>
                     <option value="GIP">GIP - Gibraltar Pound</option>
                     <option value="SHP">SHP - Saint Helena Pound</option>
                     <option value="ZAR">ZAR - South African Rand</option>
                     <option value="NAD">NAD - Namibian Dollar</option>
                     <option value="BWP">BWP - Botswana Pula</option>
                     <option value="LSL">LSL - Lesotho Loti</option>
                     <option value="SZL">SZL - Eswatini Lilangeni</option>
                     <option value="MUR">MUR - Mauritian Rupee</option>
                     <option value="SCR">SCR - Seychellois Rupee</option>
                     <option value="KMF">KMF - Comorian Franc</option>
                     <option value="DJF">DJF - Djiboutian Franc</option>
                     <option value="ETB">ETB - Ethiopian Birr</option>
                     <option value="SOS">SOS - Somali Shilling</option>
                     <option value="KES">KES - Kenyan Shilling</option>
                     <option value="TZS">TZS - Tanzanian Shilling</option>
                     <option value="UGX">UGX - Ugandan Shilling</option>
                     <option value="RWF">RWF - Rwandan Franc</option>
                     <option value="BIF">BIF - Burundian Franc</option>
                     <option value="CDF">CDF - Congolese Franc</option>
                     <option value="GMD">GMD - Gambian Dalasi</option>
                     <option value="GHS">GHS - Ghanaian Cedi</option>
                     <option value="NGN">NGN - Nigerian Naira</option>
                     <option value="XOF">XOF - West African CFA Franc</option>
                     <option value="XAF">XAF - Central African CFA Franc</option>
                     <option value="XPF">XPF - CFP Franc</option>
                     <option value="MAD">MAD - Moroccan Dirham</option>
                     <option value="DZD">DZD - Algerian Dinar</option>
                     <option value="TND">TND - Tunisian Dinar</option>
                     <option value="LYD">LYD - Libyan Dinar</option>
                     <option value="EGP">EGP - Egyptian Pound</option>
                     <option value="SDG">SDG - Sudanese Pound</option>
                     <option value="SSP">SSP - South Sudanese Pound</option>
                     <option value="ERN">ERN - Eritrean Nakfa</option>
                     <option value="STN">STN - São Tomé and Príncipe Dobra</option>
                     <option value="CVE">CVE - Cape Verdean Escudo</option>
                     <option value="GNF">GNF - Guinean Franc</option>
                     <option value="SLL">SLL - Sierra Leonean Leone</option>
                     <option value="LRD">LRD - Liberian Dollar</option>
                     <option value="MRO">MRO - Mauritanian Ouguiya (discontinued)</option>
                     <option value="MRU">MRU - Mauritanian Ouguiya</option>
                     <option value="MZN">MZN - Mozambican Metical</option>
                     <option value="MWK">MWK - Malawian Kwacha</option>
                     <option value="ZMW">ZMW - Zambian Kwacha</option>
                     <option value="ZMK">ZMK - Zambian Kwacha (discontinued)</option>
                     <option value="MGA">MGA - Malagasy Ariary</option>
                     <option value="MGF">MGF - Malagasy Franc (discontinued)</option>
                     <option value="AOA">AOA - Angolan Kwanza</option>
                     <option value="AON">AON - Angolan New Kwanza (discontinued)</option>
                     <option value="AOR">AOR - Angolan Readjusted Kwanza (discontinued)</option>
                     <option value="ZWD">ZWD - Zimbabwean Dollar (discontinued)</option>
                     <option value="ZWL">ZWL - Zimbabwean Dollar (2009)</option>
                     <option value="ZWR">ZWR - Zimbabwean Dollar (2008)</option>
                     <option value="ZWN">ZWN - Zimbabwean Dollar (2006)</option>
                     <option value="ZWD">ZWD - Zimbabwean Dollar (1980-2008)</option>
                   </optgroup>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                <input
                  v-model="settings.currency_symbol"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="$"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select
                v-model="settings.timezone"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Anchorage">Alaska Time (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
              </select>
            </div>

            <!-- Geographic Service Locations -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Geographic Service Locations</h3>
              <p class="text-sm text-gray-600 mb-4">Select the regions where you want to serve your website. This helps with regional content, shipping, and compliance.</p>
              
              <div class="space-y-4">
                <!-- North America -->
                <div class="border border-gray-200 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium text-gray-900">North America</h4>
                    <button
                      @click="toggleRegion('northAmerica')"
                      class="text-sm text-peach-pink hover:text-peach-pink-dark"
                    >
                      {{ expandedRegions.northAmerica ? 'Collapse' : 'Expand' }}
                    </button>
                  </div>
                  <div v-if="expandedRegions.northAmerica" class="space-y-2">
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="US"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">United States</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="CA"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Canada</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="MX"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Mexico</span>
                    </label>
                  </div>
                </div>

                <!-- Europe -->
                <div class="border border-gray-200 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium text-gray-900">Europe</h4>
                    <button
                      @click="toggleRegion('europe')"
                      class="text-sm text-peach-pink hover:text-peach-pink-dark"
                    >
                      {{ expandedRegions.europe ? 'Collapse' : 'Expand' }}
                    </button>
                  </div>
                  <div v-if="expandedRegions.europe" class="grid grid-cols-2 gap-2">
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="GB"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">United Kingdom</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="DE"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Germany</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="FR"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">France</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="IT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Italy</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="ES"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Spain</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="NL"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Netherlands</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="BE"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Belgium</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="CH"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Switzerland</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="AT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Austria</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="SE"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Sweden</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="NO"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Norway</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="DK"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Denmark</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="FI"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Finland</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="PL"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Poland</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="CZ"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Czech Republic</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="HU"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Hungary</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="RO"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Romania</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="BG"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Bulgaria</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="HR"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Croatia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="SI"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Slovenia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="SK"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Slovakia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="EE"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Estonia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="LV"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Latvia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="LT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Lithuania</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="GR"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Greece</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="MT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Malta</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="CY"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Cyprus</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="IE"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Ireland</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="LU"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Luxembourg</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="PT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Portugal</span>
                    </label>
                  </div>
                </div>

                <!-- Asia Pacific -->
                <div class="border border-gray-200 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium text-gray-900">Asia Pacific</h4>
                    <button
                      @click="toggleRegion('asiaPacific')"
                      class="text-sm text-peach-pink hover:text-peach-pink-dark"
                    >
                      {{ expandedRegions.asiaPacific ? 'Collapse' : 'Expand' }}
                    </button>
                  </div>
                  <div v-if="expandedRegions.asiaPacific" class="grid grid-cols-2 gap-2">
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="JP"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Japan</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="KR"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">South Korea</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="CN"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">China</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="TW"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Taiwan</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="HK"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Hong Kong</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="SG"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Singapore</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="TH"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Thailand</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="VN"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Vietnam</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="ID"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Indonesia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="MY"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Malaysia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="PH"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Philippines</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="IN"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">India</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="AU"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Australia</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="NZ"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">New Zealand</span>
                    </label>
                  </div>
                </div>

                <!-- Caribbean -->
                <div class="border border-gray-200 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-medium text-gray-900">Caribbean</h4>
                    <button
                      @click="toggleRegion('caribbean')"
                      class="text-sm text-peach-pink hover:text-peach-pink-dark"
                    >
                      {{ expandedRegions.caribbean ? 'Collapse' : 'Expand' }}
                    </button>
                  </div>
                  <div v-if="expandedRegions.caribbean" class="grid grid-cols-2 gap-2">
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="JM"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Jamaica</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="BB"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Barbados</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="TT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Trinidad & Tobago</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="BS"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Bahamas</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="BZ"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Belize</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="GY"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Guyana</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="SR"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Suriname</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="HT"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Haiti</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="DO"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Dominican Republic</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="CU"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Cuba</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        v-model="selectedLocations"
                        type="checkbox"
                        value="PR"
                        class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                      />
                      <span class="ml-2 text-sm text-gray-700">Puerto Rico</span>
                    </label>
                  </div>
                </div>

                <!-- Quick Actions -->
                <div class="flex flex-wrap gap-2 pt-4">
                  <button
                    @click="selectAllLocations"
                    class="px-3 py-1 text-sm bg-peach-pink text-white rounded-md hover:bg-peach-pink-dark transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    @click="clearAllLocations"
                    class="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    @click="selectMajorMarkets"
                    class="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Major Markets
                  </button>
                </div>

                <!-- Selected Locations Summary -->
                <div v-if="selectedLocations.length > 0" class="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 class="text-sm font-medium text-gray-900 mb-2">Selected Locations ({{ selectedLocations.length }})</h4>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="location in selectedLocations"
                      :key="location"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-peach-pink text-white"
                    >
                      {{ getLocationName(location) }}
                      <button
                        @click="removeLocation(location)"
                        class="ml-1 hover:text-red-200"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Payment -->
          <div v-if="activeTab === 'payment'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">Payment Methods</h2>
            <p class="text-sm text-gray-600 mb-6">Configure payment methods and their settings for your store.</p>
            
            <div class="space-y-6">
              <!-- Stripe -->
              <div class="border border-gray-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                      <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.831 3.47 1.426 3.47 2.338 0 .914-.796 1.431-2.127 1.431-1.72 0-4.516-.924-6.378-2.168l-.9 5.555C8.203 21.29 10.082 22 12.514 22c2.666 0 4.89-.624 6.362-1.813 1.671-1.305 2.586-3.233 2.586-5.732 0-4.128-2.524-5.851-6.594-7.305h-.884z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-medium text-gray-900">Stripe</h3>
                      <p class="text-sm text-gray-500">Accept credit cards and digital wallets</p>
                    </div>
                  </div>
                  <button
                    @click="settings.stripe_enabled = !settings.stripe_enabled"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                    :class="settings.stripe_enabled ? 'bg-blue-600' : 'bg-gray-200'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                      :class="settings.stripe_enabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
                
                <div v-if="settings.stripe_enabled" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Publishable Key</label>
                      <input
                        v-model="settings.stripe_publishable_key"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="pk_test_..."
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
                      <input
                        v-model="settings.stripe_secret_key"
                        type="password"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="sk_test_..."
                      />
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      v-model="settings.stripe_test_mode"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label class="ml-2 text-sm text-gray-700">Test mode</label>
                  </div>
                </div>
              </div>

              <!-- PayPal -->
              <div class="border border-gray-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                      <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.067 8.478c.492.315.844.825.844 1.478 0 .653-.352 1.163-.844 1.478-.492.315-1.163.478-1.844.478H17.5v-2.956h.723c.681 0 1.352.163 1.844.478zM7.5 8.478c.492.315.844.825.844 1.478 0 .653-.352 1.163-.844 1.478-.492.315-1.163.478-1.844.478H5v-2.956h.723c.681 0 1.352.163 1.844.478zM12.5 8.478c.492.315.844.825.844 1.478 0 .653-.352 1.163-.844 1.478-.492.315-1.163.478-1.844.478H10v-2.956h.723c.681 0 1.352.163 1.844.478z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-medium text-gray-900">PayPal</h3>
                      <p class="text-sm text-gray-500">Accept PayPal payments</p>
                    </div>
                  </div>
                  <button
                    @click="settings.paypal_enabled = !settings.paypal_enabled"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                    :class="settings.paypal_enabled ? 'bg-blue-500' : 'bg-gray-200'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                      :class="settings.paypal_enabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
                
                <div v-if="settings.paypal_enabled" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
                      <input
                        v-model="settings.paypal_client_id"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your PayPal Client ID"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Secret</label>
                      <input
                        v-model="settings.paypal_secret"
                        type="password"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your PayPal Secret"
                      />
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      v-model="settings.paypal_sandbox"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label class="ml-2 text-sm text-gray-700">Sandbox mode</label>
                  </div>
                </div>
              </div>

              <!-- Cash on Delivery -->
              <div class="border border-gray-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-medium text-gray-900">Cash on Delivery</h3>
                      <p class="text-sm text-gray-500">Accept cash payments upon delivery</p>
                    </div>
                  </div>
                  <button
                    @click="settings.cash_on_delivery_enabled = !settings.cash_on_delivery_enabled"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                    :class="settings.cash_on_delivery_enabled ? 'bg-green-600' : 'bg-gray-200'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                      :class="settings.cash_on_delivery_enabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
                
                <div v-if="settings.cash_on_delivery_enabled" class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                    <textarea
                      v-model="settings.cod_instructions"
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter instructions for cash on delivery payments"
                    ></textarea>
                  </div>
                  <div class="flex items-center">
                    <input
                      v-model="settings.cod_require_change"
                      type="checkbox"
                      class="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label class="ml-2 text-sm text-gray-700">Require exact change</label>
                  </div>
                </div>
              </div>

              <!-- Bank Transfer -->
              <div class="border border-gray-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <div class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-medium text-gray-900">Bank Transfer</h3>
                      <p class="text-sm text-gray-500">Accept bank transfers</p>
                    </div>
                  </div>
                  <button
                    @click="settings.bank_transfer_enabled = !settings.bank_transfer_enabled"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                    :class="settings.bank_transfer_enabled ? 'bg-purple-600' : 'bg-gray-200'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                      :class="settings.bank_transfer_enabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
                
                <div v-if="settings.bank_transfer_enabled" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                      <input
                        v-model="settings.bank_name"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Bank Name"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                      <input
                        v-model="settings.bank_account_number"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Account Number"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Routing Number</label>
                      <input
                        v-model="settings.bank_routing_number"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Routing Number"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Account Holder</label>
                      <input
                        v-model="settings.bank_account_holder"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Account Holder Name"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Transfer Instructions</label>
                    <textarea
                      v-model="settings.bank_transfer_instructions"
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter instructions for bank transfer payments"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- PlugNPay -->
              <div class="border border-gray-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <div class="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center mr-3">
                      <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-medium text-gray-900">PlugNPay</h3>
                      <p class="text-sm text-gray-500">Accept credit cards and ACH payments</p>
                    </div>
                  </div>
                  <button
                    @click="settings.plugnpay_enabled = !settings.plugnpay_enabled"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                    :class="settings.plugnpay_enabled ? 'bg-orange-600' : 'bg-gray-200'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                      :class="settings.plugnpay_enabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
                
                <div v-if="settings.plugnpay_enabled" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Merchant ID</label>
                      <input
                        v-model="settings.plugnpay_merchant_id"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Your PlugNPay Merchant ID"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">API Username</label>
                      <input
                        v-model="settings.plugnpay_username"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="API Username"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">API Password</label>
                      <input
                        v-model="settings.plugnpay_password"
                        type="password"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="API Password"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Gateway URL</label>
                      <input
                        v-model="settings.plugnpay_gateway_url"
                        type="url"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="https://pay1.plugnpay.com/pay"
                      />
                    </div>
                  </div>
                  <div class="space-y-3">
                    <div class="flex items-center">
                      <input
                        v-model="settings.plugnpay_test_mode"
                        type="checkbox"
                        class="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label class="ml-2 text-sm text-gray-700">Test mode</label>
                    </div>
                    <div class="flex items-center">
                      <input
                        v-model="settings.plugnpay_ach_enabled"
                        type="checkbox"
                        class="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label class="ml-2 text-sm text-gray-700">Enable ACH payments</label>
                    </div>
                    <div class="flex items-center">
                      <input
                        v-model="settings.plugnpay_auto_settle"
                        type="checkbox"
                        class="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label class="ml-2 text-sm text-gray-700">Auto-settle transactions</label>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Custom Fields (Optional)</label>
                    <textarea
                      v-model="settings.plugnpay_custom_fields"
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Additional custom fields for PlugNPay configuration"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- Mock Gateway -->
              <div class="border border-gray-200 rounded-lg p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center">
                    <div class="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mr-3">
                      <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-medium text-gray-900">Mock Gateway</h3>
                      <p class="text-sm text-gray-500">Simulated payment method for testing (no real transactions)</p>
                    </div>
                  </div>
                  <button
                    @click="settings.mock_gateway_enabled = !settings.mock_gateway_enabled"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                    :class="settings.mock_gateway_enabled ? 'bg-gray-500' : 'bg-gray-200'"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                      :class="settings.mock_gateway_enabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
                <div v-if="settings.mock_gateway_enabled" class="space-y-4">
                  <div class="text-sm text-gray-700">No configuration required. Use this for test orders and development only.</div>
                </div>
              </div>

              <!-- Payment Settings -->
              <div class="border border-gray-200 rounded-lg p-6">
                <h3 class="text-lg font-medium text-gray-900 mb-4">General Payment Settings</h3>
                <div class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                      <select
                        v-model="settings.payment_currency"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Payment Timeout (minutes)</label>
                      <input
                        v-model.number="settings.payment_timeout_minutes"
                        type="number"
                        min="5"
                        max="1440"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                        placeholder="30"
                      />
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      v-model="settings.auto_capture_payments"
                      type="checkbox"
                      class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                    />
                    <label class="ml-2 text-sm text-gray-700">Automatically capture payments</label>
                  </div>
                  <div class="flex items-center">
                    <input
                      v-model="settings.require_payment_confirmation"
                      type="checkbox"
                      class="rounded border-gray-300 text-peach-pink focus:ring-peach-pink"
                    />
                    <label class="ml-2 text-sm text-gray-700">Require payment confirmation for orders</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Social Media -->
          <div v-if="activeTab === 'social'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">Social Media</h2>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Facebook URL</label>
                <input
                  v-model="settings.social_facebook"
                  type="url"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Instagram URL</label>
                <input
                  v-model="settings.social_instagram"
                  type="url"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="https://instagram.com/yourprofile"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Twitter URL</label>
                <input
                  v-model="settings.social_twitter"
                  type="url"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="https://twitter.com/yourprofile"
                />
              </div>
            </div>
          </div>

          <!-- Features -->
          <div v-if="activeTab === 'features'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">Feature Toggles</h2>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">Shipping Calculator</h3>
                  <p class="text-sm text-gray-500">Enable shipping cost calculation during checkout</p>
                </div>
                <button
                  @click="settings.shipping_calculator_enabled = !settings.shipping_calculator_enabled"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="settings.shipping_calculator_enabled ? 'bg-peach-pink' : 'bg-gray-200'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                    :class="settings.shipping_calculator_enabled ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">Tax Calculator</h3>
                  <p class="text-sm text-gray-500">Enable tax calculation during checkout</p>
                </div>
                <button
                  @click="settings.tax_calculator_enabled = !settings.tax_calculator_enabled"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="settings.tax_calculator_enabled ? 'bg-peach-pink' : 'bg-gray-200'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                    :class="settings.tax_calculator_enabled ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">Guest Checkout</h3>
                  <p class="text-sm text-gray-500">Allow customers to checkout without creating an account</p>
                </div>
                <button
                  @click="settings.guest_checkout_enabled = !settings.guest_checkout_enabled"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="settings.guest_checkout_enabled ? 'bg-peach-pink' : 'bg-gray-200'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                    :class="settings.guest_checkout_enabled ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">Product Reviews</h3>
                  <p class="text-sm text-gray-500">Enable customer reviews and ratings</p>
                </div>
                <button
                  @click="settings.reviews_enabled = !settings.reviews_enabled"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="settings.reviews_enabled ? 'bg-peach-pink' : 'bg-gray-200'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                    :class="settings.reviews_enabled ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">Wishlist</h3>
                  <p class="text-sm text-gray-500">Enable wishlist functionality for customers</p>
                </div>
                <button
                  @click="settings.wishlist_enabled = !settings.wishlist_enabled"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="settings.wishlist_enabled ? 'bg-peach-pink' : 'bg-gray-200'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                    :class="settings.wishlist_enabled ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>

              <div class="p-4 border border-gray-200 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-medium text-gray-900">New Arrivals Period</h3>
                </div>
                <p class="text-sm text-gray-500 mb-3">Number of days to consider products as "new arrivals"</p>
                <div class="flex items-center space-x-3">
                  <input
                    v-model.number="settings.new_arrivals_days"
                    type="number"
                    min="1"
                    max="365"
                    class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                    placeholder="30"
                  />
                  <span class="text-sm text-gray-600">days</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Maintenance -->
          <div v-if="activeTab === 'maintenance'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">Maintenance Mode</h2>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">Maintenance Mode</h3>
                  <p class="text-sm text-gray-500">Enable maintenance mode to temporarily disable the site</p>
                </div>
                <button
                  @click="settings.maintenance_mode = !settings.maintenance_mode"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
                  :class="settings.maintenance_mode ? 'bg-red-500' : 'bg-gray-200'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200"
                    :class="settings.maintenance_mode ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>

              <div v-if="settings.maintenance_mode">
                <label class="block text-sm font-medium text-gray-700 mb-2">Maintenance Message</label>
                <textarea
                  v-model="settings.maintenance_message"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="Enter maintenance message to display to visitors"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Geo-Location -->
          <div v-if="activeTab === 'geo-location'" class="space-y-6">
            <h2 class="text-xl font-semibold text-gray-800">Geo-Location Services</h2>
            
            <!-- Service Provider Selection -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900">Service Provider</h3>
              <p class="text-sm text-gray-600 mb-4">Choose a geo-location service to restrict access based on user location.</p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  v-for="provider in geoLocationProviders"
                  :key="provider.key"
                  @click="selectGeoProvider(provider.key)"
                  class="border-2 rounded-lg p-4 cursor-pointer transition-colors"
                  :class="currentProvider?.key === provider.key 
                    ? 'border-peach-pink bg-peach-pink/5' 
                    : 'border-gray-200 hover:border-gray-300'"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h4 class="font-medium text-gray-900">{{ provider.name }}</h4>
                      <p class="text-sm text-gray-600 mt-1">{{ provider.description }}</p>
                      <div v-if="provider.requiresApiKey" class="mt-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Requires API Key
                        </span>
                      </div>
                    </div>
                    <div v-if="currentProvider?.key === provider.key" class="text-peach-pink">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <!-- API Key Input -->
              <div v-if="currentProvider?.requiresApiKey" class="mt-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <input
                  v-model="settings.geo_location_api_key"
                  type="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                  placeholder="Enter API key"
                />
                <p class="text-xs text-gray-500 mt-1">Your API key will be securely stored and encrypted.</p>
              </div>
            </div>

            <!-- Service Status -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900">Service Status</h3>
              
              <div v-if="geoLocationStatus" class="bg-gray-50 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-medium text-gray-900">Current Status</h4>
                    <p class="text-sm text-gray-600">
                      Provider: {{ geoLocationStatus.provider }} | 
                      Allowed Countries: {{ geoLocationStatus.allowedCountriesCount }}
                    </p>
                  </div>
                  <div class="flex items-center">
                    <div 
                      class="w-3 h-3 rounded-full mr-2"
                      :class="geoLocationStatus.isEnabled ? 'bg-green-500' : 'bg-gray-400'"
                    ></div>
                    <span class="text-sm font-medium" :class="geoLocationStatus.isEnabled ? 'text-green-700' : 'text-gray-500'">
                      {{ geoLocationStatus.isEnabled ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                </div>
                
                <!-- Test Results -->
                <div v-if="geoLocationStatus.testResult" class="mt-4 p-3 bg-white rounded border">
                  <h5 class="font-medium text-gray-900 mb-2">Last Test Result</h5>
                  <div class="text-sm">
                    <p><strong>Test IP:</strong> {{ geoLocationStatus.testResult.testIP }}</p>
                    <p><strong>Detected Country:</strong> {{ geoLocationStatus.testResult.detectedCountry || 'Unknown' }}</p>
                    <p><strong>Status:</strong> 
                      <span :class="geoLocationStatus.testResult.success ? 'text-green-600' : 'text-red-600'">
                        {{ geoLocationStatus.testResult.success ? 'Success' : 'Failed' }}
                      </span>
                    </p>
                    <p v-if="geoLocationStatus.testResult.error" class="text-red-600">
                      <strong>Error:</strong> {{ geoLocationStatus.testResult.error }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Test Service Button -->
              <div class="flex space-x-3">
                <button
                  @click="testGeoService"
                  :disabled="testingService"
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="testingService" class="flex items-center">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Testing...
                  </span>
                  <span v-else>Test Service</span>
                </button>
                
                <button
                  @click="refreshGeoStatus"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                >
                  Refresh Status
                </button>
              </div>
            </div>

            <!-- IP Testing -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900">Test Specific IP</h3>
              <p class="text-sm text-gray-600">Test how a specific IP address would be handled by the geo-restriction system.</p>
              
              <div class="flex space-x-3">
                <input
                  v-model="testIP"
                  type="text"
                  placeholder="Enter IP address (e.g., 8.8.8.8)"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent"
                />
                <button
                  @click="testSpecificIP"
                  :disabled="!testIP || testingService"
                  class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Test IP
                </button>
              </div>

              <!-- Test Result -->
              <div v-if="testResult" class="bg-gray-50 rounded-lg p-4">
                <h4 class="font-medium text-gray-900 mb-2">Test Result</h4>
                <div class="text-sm space-y-1">
                  <p><strong>IP:</strong> {{ testResult.ip }}</p>
                  <p><strong>Detected Country:</strong> {{ testResult.detectedCountry || 'Unknown' }}</p>
                  <p><strong>Allowed:</strong> 
                    <span :class="testResult.isAllowed ? 'text-green-600' : 'text-red-600'">
                      {{ testResult.isAllowed ? 'Yes' : 'No' }}
                    </span>
                  </p>
                  <p><strong>Provider:</strong> {{ testResult.provider }}</p>
                  <p class="text-gray-600">{{ testResult.message }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div v-if="!loading && !error" class="px-8 py-6 border-t border-gray-200 bg-gray-50">
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-600">
            {{ hasChanges ? 'You have unsaved changes' : 'All changes saved' }}
          </div>
          <div class="flex space-x-3">
            <button
              @click="resetSettings"
              :disabled="!hasChanges || saving"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-peach-pink focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              @click="saveSettings"
              :disabled="!hasChanges || saving"
              class="px-4 py-2 text-sm font-medium text-white bg-peach-pink border border-transparent rounded-md hover:bg-peach-pink/90 focus:outline-none focus:ring-2 focus:ring-peach-pink focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="saving" class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </span>
              <span v-else>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useNuxtApp } from '#app';
import { useAuth } from '~/composables/useAuth';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Site Settings - Admin',
});

const { $axios } = useNuxtApp();

// State
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const activeTab = ref('general');
const originalSettings = ref({});
const settings = ref({});
const logoUploading = ref(false);

// Geographic location state
const selectedLocations = ref([]);
const expandedRegions = ref({
  northAmerica: false,
  europe: false,
  asiaPacific: false,
  caribbean: false
});

// Geo-location service state
const geoLocationProviders = ref([]);
const currentProvider = ref(null);
const geoLocationStatus = ref(null);
const testingService = ref(false);
const testResult = ref(null);
const testIP = ref('');

// Location mapping
const locationNames = {
  // North America
  US: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
  
  // Europe
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  BG: 'Bulgaria',
  HR: 'Croatia',
  SI: 'Slovenia',
  SK: 'Slovakia',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
  GR: 'Greece',
  MT: 'Malta',
  CY: 'Cyprus',
  IE: 'Ireland',
  LU: 'Luxembourg',
  PT: 'Portugal',
  
  // Asia Pacific
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  SG: 'Singapore',
  TH: 'Thailand',
  VN: 'Vietnam',
  ID: 'Indonesia',
  MY: 'Malaysia',
  PH: 'Philippines',
  IN: 'India',
  AU: 'Australia',
  NZ: 'New Zealand',
  
  // Caribbean
  JM: 'Jamaica',
  BB: 'Barbados',
  TT: 'Trinidad & Tobago',
  BS: 'Bahamas',
  BZ: 'Belize',
  GY: 'Guyana',
  SR: 'Suriname',
  HT: 'Haiti',
  DO: 'Dominican Republic',
  CU: 'Cuba',
  PR: 'Puerto Rico'
};

// Tabs configuration
const tabs = [
  {
    id: 'general',
    name: 'General',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>'
  },
  {
    id: 'locale',
    name: 'Locale & Currency',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>'
  },
  {
    id: 'payment',
    name: 'Payment',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>'
  },
  {
    id: 'social',
    name: 'Social Media',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2"></path></svg>'
  },
  {
    id: 'features',
    name: 'Features',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>'
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"></path></svg>'
  },
  {
    id: 'geo-location',
    name: 'Geo-Location',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
  }
];

// Computed
const hasChanges = computed(() => {
  return JSON.stringify(settings.value) !== JSON.stringify(originalSettings.value);
});

// Methods
const fetchSettings = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await $axios.get('/admin/settings');
    const settingsData = {};
    
    response.data.settings.forEach(setting => {
      settingsData[setting.setting_key] = setting.setting_value;
    });
    
    settings.value = settingsData;
    originalSettings.value = JSON.parse(JSON.stringify(settingsData));
    
    // Initialize geographic locations
    initializeLocations();
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load settings';
    console.error('Error fetching settings:', err);
  } finally {
    loading.value = false;
  }
};

const saveSettings = async () => {
  saving.value = true;
  
  try {
    const settingsArray = Object.entries(settings.value).map(([key, value]) => ({
      key,
      value: String(value)
    }));
    
    await $axios.put('/admin/settings', { settings: settingsArray });
    
    // Update original settings to reflect saved state
    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    
    // Show success message
    console.log('Settings saved successfully');
    
    // Show success notification
    const { $toast } = useNuxtApp();
    if ($toast) {
      $toast.success('Settings saved successfully!');
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save settings';
    console.error('Error saving settings:', err);
    
    // Show error notification
    const { $toast } = useNuxtApp();
    if ($toast) {
      $toast.error('Failed to save settings. Please try again.');
    }
  } finally {
    saving.value = false;
  }
};

const resetSettings = () => {
  settings.value = JSON.parse(JSON.stringify(originalSettings.value));
};

const initializeSettings = async () => {
  try {
    await $axios.post('/admin/settings/initialize');
    await fetchSettings();
  } catch (err) {
    console.error('Error initializing settings:', err);
  }
};

const handleLogoUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  logoUploading.value = true;
  
  try {
    const formData = new FormData();
    formData.append('productImage', file); // Using the same field name as the middleware expects

    const response = await $axios.post('/admin/settings/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    // Update the logo URL in settings
    settings.value.site_logo = response.data.logoUrl;
    
    // Show success message
    console.log('Logo uploaded successfully');
  } catch (err) {
    console.error('Error uploading logo:', err);
    alert(err.response?.data?.message || 'Failed to upload logo');
  } finally {
    logoUploading.value = false;
    // Reset the file input
    event.target.value = '';
  }
};

const removeLogo = async () => {
  if (!settings.value.site_logo) return;

  if (confirm('Are you sure you want to remove the logo?')) {
    try {
      // Clear the logo URL in settings
      settings.value.site_logo = '';
      
      // Update the setting in the database
      const settingsArray = [{
        key: 'site_logo',
        value: ''
      }];
      
      await $axios.put('/admin/settings', { settings: settingsArray });
      
      console.log('Logo removed successfully');
    } catch (err) {
      console.error('Error removing logo:', err);
      alert('Failed to remove logo');
    }
  }
};

// Geographic location methods
const toggleRegion = (region) => {
  expandedRegions.value[region] = !expandedRegions.value[region];
};

const getLocationName = (code) => {
  return locationNames[code] || code;
};

const selectAllLocations = () => {
  selectedLocations.value = Object.keys(locationNames);
};

const clearAllLocations = () => {
  selectedLocations.value = [];
};

const selectMajorMarkets = () => {
  selectedLocations.value = [
    'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'JP', 'KR', 'CN', 'AU', 'SG', 'IN'
  ];
};

const removeLocation = (location) => {
  const index = selectedLocations.value.indexOf(location);
  if (index > -1) {
    selectedLocations.value.splice(index, 1);
  }
};

// Watch for changes in selected locations and update settings
watch(selectedLocations, (newLocations) => {
  settings.value.service_locations = newLocations.join(',');
}, { deep: true });

// Initialize selected locations from settings
const initializeLocations = () => {
  if (settings.value.service_locations) {
    selectedLocations.value = settings.value.service_locations.split(',').filter(loc => loc.trim());
  }
};

// Geo-location methods
const fetchGeoLocationProviders = async () => {
  try {
    const response = await $axios.get('/admin/geo-location/providers');
    geoLocationProviders.value = response.data.providers;
  } catch (err) {
    console.error('Error fetching geo-location providers:', err);
  }
};

const fetchGeoLocationStatus = async () => {
  try {
    const response = await $axios.get('/admin/geo-location/status');
    geoLocationStatus.value = response.data;
  } catch (err) {
    console.error('Error fetching geo-location status:', err);
  }
};

const selectGeoProvider = (providerKey) => {
  currentProvider.value = geoLocationProviders.value.find(p => p.key === providerKey);
  settings.value.geo_location_service = providerKey;
};

const testGeoService = async () => {
  testingService.value = true;
  try {
    const response = await $axios.post('/admin/geo-location/test');
    geoLocationStatus.value = response.data;
    
    const { $toast } = useNuxtApp();
    if ($toast) {
      $toast.success('Service test completed successfully!');
    }
  } catch (err) {
    console.error('Error testing geo-location service:', err);
    const { $toast } = useNuxtApp();
    if ($toast) {
      $toast.error('Failed to test service. Please check your configuration.');
    }
  } finally {
    testingService.value = false;
  }
};

const testSpecificIP = async () => {
  if (!testIP.value) return;
  
  testingService.value = true;
  try {
    const response = await $axios.post('/admin/geo-location/test-ip', {
      ip: testIP.value
    });
    testResult.value = response.data;
  } catch (err) {
    console.error('Error testing IP:', err);
    testResult.value = {
      ip: testIP.value,
      error: err.response?.data?.message || 'Failed to test IP'
    };
  } finally {
    testingService.value = false;
  }
};

const refreshGeoStatus = async () => {
  await fetchGeoLocationStatus();
  const { $toast } = useNuxtApp();
  if ($toast) {
    $toast.success('Status refreshed!');
  }
};

// Initialize geo-location data when tab is selected
watch(activeTab, async (newTab) => {
  if (newTab === 'geo-location') {
    await fetchGeoLocationProviders();
    await fetchGeoLocationStatus();
    
    // Set current provider based on settings
    if (settings.value.geo_location_service) {
      currentProvider.value = geoLocationProviders.value.find(
        p => p.key === settings.value.geo_location_service
      );
    }
  }
});

// Lifecycle
onMounted(async () => {
  // Wait for authentication to be initialized
  const { isAuthInitialized } = useAuth();
  
  // Watch for auth initialization
  watch(isAuthInitialized, async (initialized) => {
    if (initialized) {
      await fetchSettings();
      
      // If no settings exist, initialize them
      if (Object.keys(settings.value).length === 0) {
        await initializeSettings();
      }
    }
  }, { immediate: true });
});
</script>

<style scoped>
/* Add any page-specific styles if needed */
</style>

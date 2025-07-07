<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">Reports Dashboard</h1>
      <div class="flex space-x-2">
        <button
          @click="refreshAllStats"
          :disabled="loading"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="flex items-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Refreshing...
          </span>
          <span v-else>Refresh All</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Total Revenue Card -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                <dd class="text-lg font-medium text-gray-900">{{ formatCurrency(stats.totalRevenue) }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Orders Card -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                <dd class="text-lg font-medium text-gray-900">{{ stats.totalOrders }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Products Card -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                <dd class="text-lg font-medium text-gray-900">{{ stats.totalProducts }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Users Card -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
                <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                <dd class="text-lg font-medium text-gray-900">{{ stats.totalUsers }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Categories -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Sales & Revenue Reports -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Sales & Revenue Reports</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Sales Report</h3>
              <p class="text-sm text-gray-500">Detailed sales analysis with date filtering</p>
            </div>
            <div class="flex space-x-2">
              <NuxtLink
                to="/admin/reports/sales"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </NuxtLink>
              <button
                @click="exportReport('sales')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Profit & Loss Report</h3>
              <p class="text-sm text-gray-500">Comprehensive P&L analysis</p>
            </div>
            <div class="flex space-x-2">
              <NuxtLink
                to="/admin/reports/profit-loss"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </NuxtLink>
              <button
                @click="exportReport('profit-loss')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Best Sellers Report</h3>
              <p class="text-sm text-gray-500">Top performing products by revenue or quantity</p>
            </div>
            <div class="flex space-x-2">
              <NuxtLink
                to="/admin/reports/best-sellers"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </NuxtLink>
              <button
                @click="exportReport('best-sellers')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Inventory & Stock Reports -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Inventory & Stock Reports</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Low Stock Report</h3>
              <p class="text-sm text-gray-500">Products below reorder threshold</p>
            </div>
            <div class="flex space-x-2">
              <NuxtLink
                to="/admin/reports/low-stock"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </NuxtLink>
              <button
                @click="exportReport('low-stock')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Stock Valuation Report</h3>
              <p class="text-sm text-gray-500">Current inventory value by product</p>
            </div>
            <div class="flex space-x-2">
              <NuxtLink
                to="/admin/reports/stock-valuation"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </NuxtLink>
              <button
                @click="exportReport('stock-valuation')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tax & Compliance Reports -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Tax & Compliance Reports</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Tax Report</h3>
              <p class="text-sm text-gray-500">Tax summary by period</p>
            </div>
            <div class="flex space-x-2">
              <button
                @click="showTaxReportModal = true"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </button>
              <button
                @click="exportReport('tax')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Tax Summary by Region</h3>
              <p class="text-sm text-gray-500">Tax breakdown by geographic region</p>
            </div>
            <div class="flex space-x-2">
              <button
                @click="showTaxRegionModal = true"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </button>
              <button
                @click="exportReport('tax-region')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- System Reports -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">System Reports</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Audit Logs</h3>
              <p class="text-sm text-gray-500">System activity and user actions</p>
            </div>
            <div class="flex space-x-2">
              <NuxtLink
                to="/admin/reports/audit-logs"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </NuxtLink>
              <button
                @click="exportReport('audit-logs')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 class="text-sm font-medium text-gray-900">Invoice Export</h3>
              <p class="text-sm text-gray-500">Detailed invoice data for accounting</p>
            </div>
            <div class="flex space-x-2">
              <button
                @click="showInvoiceModal = true"
                class="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                View
              </button>
              <button
                @click="exportReport('invoice')"
                class="px-3 py-1 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tax Report Modal -->
    <div v-if="showTaxReportModal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Tax Report</h3>
          <button @click="showTaxReportModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Year</label>
            <input v-model="taxReport.year" type="number" min="2000" :max="new Date().getFullYear() + 1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Period Type</label>
            <select v-model="taxReport.periodType" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div v-if="taxReport.periodType === 'monthly'">
            <label class="block text-sm font-medium text-gray-700">Month</label>
            <select v-model="taxReport.month" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>
          <div v-if="taxReport.periodType === 'quarterly'">
            <label class="block text-sm font-medium text-gray-700">Quarter</label>
            <select v-model="taxReport.quarter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              <option value="1">Q1 (Jan-Mar)</option>
              <option value="2">Q2 (Apr-Jun)</option>
              <option value="3">Q3 (Jul-Sep)</option>
              <option value="4">Q4 (Oct-Dec)</option>
            </select>
          </div>
          <div class="flex space-x-3">
            <button @click="generateTaxReport" class="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">Generate</button>
            <button @click="showTaxReportModal = false" class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tax Region Modal -->
    <div v-if="showTaxRegionModal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Tax Summary by Region</h3>
          <button @click="showTaxRegionModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Start Date</label>
            <input v-model="taxRegion.startDate" type="date" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">End Date</label>
            <input v-model="taxRegion.endDate" type="date" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div class="flex space-x-3">
            <button @click="generateTaxRegionReport" class="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">Generate</button>
            <button @click="showTaxRegionModal = false" class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoice Modal -->
    <div v-if="showInvoiceModal" class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Invoice Export</h3>
          <button @click="showInvoiceModal = false" class="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Start Date</label>
            <input v-model="invoiceExport.startDate" type="date" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">End Date</label>
            <input v-model="invoiceExport.endDate" type="date" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div class="flex space-x-3">
            <button @click="generateInvoiceExport" class="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">Generate</button>
            <button @click="showInvoiceModal = false" class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
});

useHead({
  title: 'Admin - Reports Overview',
});

const { $axios } = useNuxtApp();

// State
const loading = ref(false);
const stats = ref({
  totalRevenue: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalUsers: 0
});

// Modal states
const showTaxReportModal = ref(false);
const showTaxRegionModal = ref(false);
const showInvoiceModal = ref(false);

// Form data
const taxReport = ref({
  year: new Date().getFullYear(),
  periodType: 'monthly',
  month: new Date().getMonth() + 1,
  quarter: Math.ceil((new Date().getMonth() + 1) / 3)
});

const taxRegion = ref({
  startDate: '',
  endDate: ''
});

const invoiceExport = ref({
  startDate: '',
  endDate: ''
});

// Methods
const fetchStats = async () => {
  try {
    const [revenueRes, ordersRes, productsRes, usersRes] = await Promise.all([
      $axios.get('/admin/stats/total-revenue'),
      $axios.get('/admin/stats/orders-count'),
      $axios.get('/admin/stats/products-count'),
      $axios.get('/admin/stats/users-count')
    ]);

    stats.value = {
      totalRevenue: revenueRes.data.total_revenue || 0,
      totalOrders: ordersRes.data.count || 0,
      totalProducts: productsRes.data.count || 0,
      totalUsers: usersRes.data.count || 0
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
};

const refreshAllStats = async () => {
  loading.value = true;
  await fetchStats();
  loading.value = false;
};

const formatCurrency = (amount) => {
  return parseFloat(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const exportReport = async (reportType) => {
  try {
    let url = '';
    let params = {};
    
    switch (reportType) {
      case 'sales':
        url = '/admin/reports/sales';
        params = {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        };
        break;
      case 'profit-loss':
        url = '/admin/reports/profit-loss';
        params = {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        };
        break;
      case 'best-sellers':
        url = '/admin/reports/best-sellers';
        params = { limit: 50 };
        break;
      case 'low-stock':
        url = '/admin/reports/low-stock-products';
        break;
      case 'stock-valuation':
        url = '/admin/reports/stock-valuation';
        break;
      case 'tax':
        url = '/admin/reports/tax-report';
        params = {
          year: new Date().getFullYear(),
          periodType: 'monthly',
          month: new Date().getMonth() + 1
        };
        break;
      case 'tax-region':
        url = '/admin/reports/tax-summary-by-region';
        params = {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        };
        break;
      case 'invoice':
        url = '/admin/reports/invoice-export';
        params = {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        };
        break;
      case 'audit-logs':
        url = '/admin/audit-logs';
        break;
    }

    const response = await $axios.get(url, { params, responseType: 'blob' });
    
    // Create download link
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url2 = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url2;
    link.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url2);
  } catch (error) {
    console.error('Error exporting report:', error);
    // Fallback to regular JSON export
    try {
      const response = await $axios.get(url, { params });
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url2 = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url2;
      link.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url2);
    } catch (fallbackError) {
      console.error('Error with fallback export:', fallbackError);
    }
  }
};

const generateTaxReport = async () => {
  try {
    const params = {
      year: taxReport.value.year,
      periodType: taxReport.value.periodType
    };
    
    if (taxReport.value.periodType === 'monthly') {
      params.month = taxReport.value.month;
    } else {
      params.quarter = taxReport.value.quarter;
    }
    
    const response = await $axios.get('/admin/reports/tax-report', { params });
    console.log('Tax Report:', response.data);
    showTaxReportModal.value = false;
  } catch (error) {
    console.error('Error generating tax report:', error);
  }
};

const generateTaxRegionReport = async () => {
  try {
    const params = {
      startDate: taxRegion.value.startDate,
      endDate: taxRegion.value.endDate
    };
    
    const response = await $axios.get('/admin/reports/tax-summary-by-region', { params });
    console.log('Tax Region Report:', response.data);
    showTaxRegionModal.value = false;
  } catch (error) {
    console.error('Error generating tax region report:', error);
  }
};

const generateInvoiceExport = async () => {
  try {
    const params = {
      startDate: invoiceExport.value.startDate,
      endDate: invoiceExport.value.endDate
    };
    
    const response = await $axios.get('/admin/reports/invoice-export', { params });
    console.log('Invoice Export:', response.data);
    showInvoiceModal.value = false;
  } catch (error) {
    console.error('Error generating invoice export:', error);
  }
};

// Lifecycle
onMounted(() => {
  fetchStats();
});
</script>

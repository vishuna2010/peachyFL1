<template>
  <div class="admin-profit-loss-report-page">
    <!-- Header Section -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <svg class="title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          Profit & Loss Report
        </h1>
        <p class="page-subtitle">Comprehensive financial analysis and performance metrics</p>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="filter-section">
      <div class="filter-card">
        <div class="filter-header">
          <h3>Report Configuration</h3>
          <p>Select your desired date range and grouping options</p>
        </div>
        
        <div class="filter-form">
          <!-- Basic Filters -->
          <div class="form-row">
            <div class="form-group">
              <label for="startDate">Start Date</label>
              <input 
                type="date" 
                id="startDate" 
                v-model="startDate"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="endDate">End Date</label>
              <input 
                type="date" 
                id="endDate" 
                v-model="endDate"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="groupBy">Group By</label>
              <select id="groupBy" v-model="groupBy" class="form-select">
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </div>

          <!-- Advanced Filters Toggle -->
          <div class="advanced-filters-toggle">
            <button 
              @click="showAdvancedFilters = !showAdvancedFilters" 
              type="button"
              class="btn btn-outline btn-sm"
            >
              <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"></path>
              </svg>
              {{ showAdvancedFilters ? 'Hide' : 'Show' }} Advanced Filters
            </button>
          </div>

          <!-- Advanced Filters -->
          <div v-if="showAdvancedFilters" class="advanced-filters">
            <div class="filters-grid">
              <!-- Product Filters -->
              <div class="filter-section-group">
                <h4>Product Filters</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="productId">Product</label>
                    <select id="productId" v-model="filters.productId" class="form-select">
                      <option value="">All Products</option>
                      <option v-for="product in filterOptions.products" :key="product.id" :value="product.id">
                        {{ product.name }} ({{ product.sku }})
                      </option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="categoryId">Category</label>
                    <select id="categoryId" v-model="filters.categoryId" class="form-select">
                      <option value="">All Categories</option>
                      <option v-for="category in filterOptions.categories" :key="category.id" :value="category.id">
                        {{ category.name }}
                      </option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="variantId">Variant</label>
                    <select id="variantId" v-model="filters.variantId" class="form-select">
                      <option value="">All Variants</option>
                      <option v-for="variant in filterOptions.variants" :key="variant.id" :value="variant.id">
                        {{ variant.product_name }} - {{ variant.name }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Customer & Order Filters -->
              <div class="filter-section-group">
                <h4>Customer & Order Filters</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="customerId">Customer</label>
                    <select id="customerId" v-model="filters.customerId" class="form-select">
                      <option value="">All Customers</option>
                      <option v-for="customer in filterOptions.customers" :key="customer.id" :value="customer.id">
                        {{ customer.first_name }} {{ customer.last_name }} ({{ customer.email }})
                      </option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="orderStatus">Order Status</label>
                    <select id="orderStatus" v-model="filters.orderStatus" class="form-select">
                      <option value="">All Statuses</option>
                      <option v-for="status in filterOptions.orderStatuses" :key="status.value" :value="status.value">
                        {{ status.label }}
                      </option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="paymentStatus">Payment Status</label>
                    <select id="paymentStatus" v-model="filters.paymentStatus" class="form-select">
                      <option value="">All Payment Statuses</option>
                      <option v-for="status in filterOptions.paymentStatuses" :key="status.value" :value="status.value">
                        {{ status.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Supplier & Additional Filters -->
              <div class="filter-section-group">
                <h4>Additional Filters</h4>
                <div class="form-row">
                  <div class="form-group">
                    <label for="supplierId">Supplier</label>
                    <select id="supplierId" v-model="filters.supplierId" class="form-select">
                      <option value="">All Suppliers</option>
                      <option v-for="supplier in filterOptions.suppliers" :key="supplier.id" :value="supplier.id">
                        {{ supplier.name }}
                      </option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        v-model="filters.includeRefunds"
                        class="form-checkbox"
                      />
                      Include Refunds
                    </label>
                  </div>
                  <div class="form-group">
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        v-model="filters.includeCancelled"
                        class="form-checkbox"
                      />
                      Include Cancelled Orders
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="filter-actions">
            <button 
              @click="clearFilters" 
              type="button"
              class="btn btn-secondary"
            >
              <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Clear Filters
            </button>
            <button 
              @click="generateReport" 
              :disabled="isLoading" 
              class="btn btn-primary"
            >
              <svg v-if="isLoading" class="btn-icon animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              {{ isLoading ? 'Generating Report...' : 'Generate Report' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Generating comprehensive profit & loss analysis...</p>
    </div>

    <!-- Error State -->
    <div v-if="errorMessage" class="error-container">
      <div class="error-card">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3>Error Generating Report</h3>
        <p>{{ errorMessage }}</p>
        <button @click="generateReport" class="btn btn-secondary">Try Again</button>
      </div>
    </div>

    <!-- Report Results -->
    <div v-if="reportData && !isLoading" class="report-container">
      <!-- Report Header -->
      <div class="report-header">
        <div class="report-info">
          <h2>Financial Performance Report</h2>
          <div class="report-meta">
            <span class="meta-item">
              <svg class="meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              {{ formatDate(reportData.report_period.start_date) }} - {{ formatDate(reportData.report_period.end_date) }}
            </span>
            <span class="meta-item">
              <svg class="meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
              </svg>
              Grouped by {{ formatGroupBy(reportData.report_period.group_by) }}
            </span>
          </div>
        </div>
        <div class="report-actions">
          <button @click="exportReport" class="btn btn-outline">
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Export Report
          </button>
        </div>
      </div>

      <!-- Key Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card revenue">
          <div class="metric-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Total Revenue</h3>
            <p class="metric-value positive">${{ formatCurrency(reportData.summary.total_revenue) }}</p>
            <p class="metric-label">Gross income before deductions</p>
          </div>
        </div>

        <div class="metric-card costs">
          <div class="metric-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Total Costs</h3>
            <p class="metric-value negative">${{ formatCurrency(reportData.summary.total_costs) }}</p>
            <p class="metric-label">All expenses and deductions</p>
          </div>
        </div>

        <div class="metric-card gross-profit">
          <div class="metric-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Gross Profit</h3>
            <p class="metric-value" :class="reportData.summary.gross_profit >= 0 ? 'positive' : 'negative'">
              ${{ formatCurrency(reportData.summary.gross_profit) }}
            </p>
            <p class="metric-label">Revenue minus direct costs</p>
          </div>
        </div>

        <div class="metric-card net-profit">
          <div class="metric-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Net Profit</h3>
            <p class="metric-value" :class="reportData.summary.net_profit >= 0 ? 'positive' : 'negative'">
              ${{ formatCurrency(reportData.summary.net_profit) }}
            </p>
            <p class="metric-label">Final profit after all expenses</p>
          </div>
        </div>
      </div>

      <!-- Detailed Breakdown -->
      <div class="breakdown-section">
        <div class="breakdown-grid">
          <!-- Revenue Breakdown -->
          <div class="breakdown-card">
            <div class="breakdown-header">
              <h3>Revenue Breakdown</h3>
              <p>Income sources and deductions</p>
            </div>
            <div class="breakdown-list">
              <div class="breakdown-item">
                <span class="item-label">Product Sales</span>
                <span class="item-value positive">${{ formatCurrency(reportData.revenue.product_sales) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Shipping Revenue</span>
                <span class="item-value positive">${{ formatCurrency(reportData.revenue.shipping_revenue) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Tax Collected</span>
                <span class="item-value positive">${{ formatCurrency(reportData.revenue.tax_collected) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Discounts Given</span>
                <span class="item-value negative">-${{ formatCurrency(reportData.revenue.discounts_given) }}</span>
              </div>
            </div>
          </div>

          <!-- Cost Breakdown -->
          <div class="breakdown-card">
            <div class="breakdown-header">
              <h3>Cost Breakdown</h3>
              <p>Expense categories and fees</p>
            </div>
            <div class="breakdown-list">
              <div class="breakdown-item">
                <span class="item-label">Product Costs</span>
                <span class="item-value negative">${{ formatCurrency(reportData.costs.product_costs) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Shipping Costs</span>
                <span class="item-value negative">${{ formatCurrency(reportData.costs.shipping_costs) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Payment Fees</span>
                <span class="item-value negative">${{ formatCurrency(reportData.costs.payment_fees) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Tax Paid</span>
                <span class="item-value negative">${{ formatCurrency(reportData.costs.tax_paid) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="item-label">Operating Expenses</span>
                <span class="item-value negative">${{ formatCurrency(reportData.costs.operating_expenses) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Profitability Metrics -->
        <div class="metrics-section">
          <div class="metrics-header">
            <h3>Profitability Metrics</h3>
            <p>Key performance indicators and ratios</p>
          </div>
          <div class="metrics-cards">
            <div class="metric-mini-card">
              <div class="metric-mini-header">
                <span class="metric-mini-label">Gross Profit Margin</span>
                <span class="metric-mini-value">{{ formatPercentage(reportData.metrics.grossProfitMargin) }}%</span>
              </div>
              <div class="metric-mini-bar">
                <div 
                  class="metric-mini-fill" 
                  :style="{ width: Math.min(reportData.metrics.grossProfitMargin, 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="metric-mini-card">
              <div class="metric-mini-header">
                <span class="metric-mini-label">Net Profit Margin</span>
                <span class="metric-mini-value">{{ formatPercentage(reportData.metrics.netProfitMargin) }}%</span>
              </div>
              <div class="metric-mini-bar">
                <div 
                  class="metric-mini-fill" 
                  :style="{ width: Math.min(reportData.metrics.netProfitMargin, 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="metric-mini-card">
              <div class="metric-mini-header">
                <span class="metric-mini-label">Cost of Goods Sold</span>
                <span class="metric-mini-value">{{ formatPercentage(reportData.metrics.cogsPercentage) }}%</span>
              </div>
              <div class="metric-mini-bar">
                <div 
                  class="metric-mini-fill cost" 
                  :style="{ width: Math.min(reportData.metrics.cogsPercentage, 100) + '%' }"
                ></div>
              </div>
            </div>

            <div class="metric-mini-card">
              <div class="metric-mini-header">
                <span class="metric-mini-label">Operating Expenses</span>
                <span class="metric-mini-value">{{ formatPercentage(reportData.metrics.operatingExpensePercentage) }}%</span>
              </div>
              <div class="metric-mini-bar">
                <div 
                  class="metric-mini-fill cost" 
                  :style="{ width: Math.min(reportData.metrics.operatingExpensePercentage, 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Time Series Data -->
      <div v-if="reportData.timeSeries && reportData.timeSeries.length > 0" class="time-series-section">
        <div class="section-header">
          <h3>Performance Over Time</h3>
          <p>Financial trends and period-by-period analysis</p>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Revenue</th>
                <th>Costs</th>
                <th>Gross Profit</th>
                <th>Net Profit</th>
                <th>Profit Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="period in reportData.timeSeries" :key="period.period">
                <td class="period-cell">{{ formatPeriod(period.period) }}</td>
                <td class="amount-cell">${{ formatCurrency(period.revenue) }}</td>
                <td class="amount-cell">${{ formatCurrency(period.costs) }}</td>
                <td class="amount-cell" :class="period.gross_profit >= 0 ? 'positive' : 'negative'">
                  ${{ formatCurrency(period.gross_profit) }}
                </td>
                <td class="amount-cell" :class="period.net_profit >= 0 ? 'positive' : 'negative'">
                  ${{ formatCurrency(period.net_profit) }}
                </td>
                <td class="percentage-cell">{{ formatPercentage(period.profit_margin) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Products by Profit -->
      <div v-if="reportData.topProducts && reportData.topProducts.length > 0" class="top-products-section">
        <div class="section-header">
          <h3>Top Products by Profit</h3>
          <p>Best performing products and their profitability</p>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in reportData.topProducts" :key="product.product_id">
                <td class="product-cell">{{ product.product_name }}</td>
                <td class="sku-cell">{{ product.sku || 'N/A' }}</td>
                <td class="number-cell">{{ product.units_sold }}</td>
                <td class="amount-cell">${{ formatCurrency(product.revenue) }}</td>
                <td class="amount-cell">${{ formatCurrency(product.cost) }}</td>
                <td class="amount-cell" :class="product.profit >= 0 ? 'positive' : 'negative'">
                  ${{ formatCurrency(product.profit) }}
                </td>
                <td class="percentage-cell">{{ formatPercentage(product.margin) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!reportData && !isLoading && !errorMessage" class="empty-state">
      <div class="empty-card">
        <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        <h3>Ready to Generate Report</h3>
        <p>Select your date range and grouping options above to generate a comprehensive profit & loss analysis.</p>
        <button @click="generateReport" class="btn btn-primary">Generate Report</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNuxtApp } from '#app';

definePageMeta({
  layout: 'admin',
  title: 'Profit & Loss Report'
});

const { $axios } = useNuxtApp();

// Default date range (current month)
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const startDate = ref(firstDayOfMonth.toISOString().split('T')[0]);
const endDate = ref(today.toISOString().split('T')[0]);
const groupBy = ref('month');

// Advanced filters
const showAdvancedFilters = ref(false);
const filters = ref({
  productId: '',
  categoryId: '',
  variantId: '',
  customerId: '',
  orderStatus: '',
  paymentStatus: '',
  supplierId: '',
  includeRefunds: false,
  includeCancelled: false
});

const filterOptions = ref({
  products: [],
  categories: [],
  variants: [],
  customers: [],
  suppliers: [],
  orderStatuses: [],
  paymentStatuses: []
});

const reportData = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

async function generateReport() {
  isLoading.value = true;
  errorMessage.value = '';
  reportData.value = null;

  if (!startDate.value || !endDate.value) {
    errorMessage.value = 'Please select both a start and end date.';
    isLoading.value = false;
    return;
  }
  if (new Date(startDate.value) > new Date(endDate.value)) {
    errorMessage.value = 'Start date cannot be after end date.';
    isLoading.value = false;
    return;
  }

  try {
    // Build params object with only non-empty values
    const params = {
      startDate: startDate.value,
      endDate: endDate.value,
      groupBy: groupBy.value,
    };

    // Add filters only if they have values
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value !== '' && value !== false && value !== null && value !== undefined) {
        params[key] = value;
      }
    });

    const response = await $axios.get('/admin/reports/profit-loss', { params });
    reportData.value = response.data;
  } catch (error) {
    console.error('Failed to generate P&L report:', error);
    errorMessage.value = error.response?.data?.message || 'An unexpected error occurred.';
  } finally {
    isLoading.value = false;
  }
}

const formatCurrency = (amount) => {
  return parseFloat(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatPercentage = (value) => {
  return parseFloat(value || 0).toFixed(2);
};

// Load filter options
const loadFilterOptions = async () => {
  try {
    const response = await $axios.get('/admin/reports/profit-loss/filter-options');
    filterOptions.value = response.data;
  } catch (error) {
    console.error('Failed to load filter options:', error);
  }
};

// Clear all filters
const clearFilters = () => {
  filters.value = {
    productId: '',
    categoryId: '',
    variantId: '',
    customerId: '',
    orderStatus: '',
    paymentStatus: '',
    supplierId: '',
    includeRefunds: false,
    includeCancelled: false
  };
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatGroupBy = (groupBy) => {
  const options = {
    day: 'Daily',
    week: 'Weekly', 
    month: 'Monthly',
    quarter: 'Quarterly',
    year: 'Yearly'
  };
  return options[groupBy] || groupBy;
};

const formatPeriod = (period) => {
  return period.replace('-', '/');
};

const exportReport = () => {
  if (!reportData.value) return;
  
  // Create CSV content
  const csvContent = generateCSV();
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profit-loss-report-${startDate.value}-to-${endDate.value}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

const generateCSV = () => {
  const data = reportData.value;
  let csv = 'Profit & Loss Report\n';
  csv += `Period: ${formatDate(data.report_period.start_date)} to ${formatDate(data.report_period.end_date)}\n`;
  csv += `Grouped by: ${formatGroupBy(data.report_period.group_by)}\n\n`;
  
  // Summary
  csv += 'SUMMARY\n';
  csv += 'Total Revenue,$' + formatCurrency(data.summary.total_revenue) + '\n';
  csv += 'Total Costs,$' + formatCurrency(data.summary.total_costs) + '\n';
  csv += 'Gross Profit,$' + formatCurrency(data.summary.gross_profit) + '\n';
  csv += 'Net Profit,$' + formatCurrency(data.summary.net_profit) + '\n\n';
  
  // Metrics
  csv += 'PROFITABILITY METRICS\n';
  csv += 'Gross Profit Margin,' + formatPercentage(data.metrics.grossProfitMargin) + '%\n';
  csv += 'Net Profit Margin,' + formatPercentage(data.metrics.netProfitMargin) + '%\n';
  csv += 'Cost of Goods Sold,' + formatPercentage(data.metrics.cogsPercentage) + '%\n';
  csv += 'Operating Expenses,' + formatPercentage(data.metrics.operatingExpensePercentage) + '%\n\n';
  
  return csv;
};

// Load filter options and optionally generate a report on mount
onMounted(async () => {
  await loadFilterOptions();
  // generateReport(); // Uncomment to load default report on page load
});

useHead({
  title: 'Admin - Profit & Loss Report',
});
</script>

<style scoped>
/* Base Layout */
.admin-profit-loss-report-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  min-height: 100vh;
}

/* Page Header */
.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.header-content {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.page-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.title-icon {
  width: 2rem;
  height: 2rem;
  color: #3b82f6;
}

.page-subtitle {
  color: #64748b;
  font-size: 1.1rem;
  margin: 0;
}

/* Filter Section */
.filter-section {
  margin-bottom: 2rem;
}

.filter-card {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.filter-header {
  margin-bottom: 1.5rem;
}

.filter-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.filter-header p {
  color: #64748b;
  margin: 0;
}

.filter-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-input, .form-select {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  background: white;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.advanced-filters-toggle {
  text-align: center;
  margin: 1rem 0;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.advanced-filters {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.filters-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.filter-section-group h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.form-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}

.form-checkbox:checked {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.4);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-outline {
  background: transparent;
  color: #3b82f6;
  border: 2px solid #3b82f6;
}

.btn-outline:hover {
  background: #3b82f6;
  color: white;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.loading-text {
  color: #64748b;
  font-size: 1.1rem;
  margin: 0;
}

/* Error State */
.error-container {
  margin-bottom: 2rem;
}

.error-card {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
  border-left: 4px solid #ef4444;
}

.error-icon {
  width: 3rem;
  height: 3rem;
  color: #ef4444;
  margin-bottom: 1rem;
}

.error-card h3 {
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.error-card p {
  color: #64748b;
  margin: 0 0 1.5rem 0;
}

/* Report Container */
.report-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Report Header */
.report-header {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.report-info h2 {
  font-size: 1.875rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
  font-size: 0.875rem;
}

.meta-icon {
  width: 1rem;
  height: 1rem;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.metric-card {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  transition: transform 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
}

.metric-icon {
  width: 3rem;
  height: 3rem;
  padding: 0.75rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-card.revenue .metric-icon {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.metric-card.costs .metric-icon {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.metric-card.gross-profit .metric-icon {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.metric-card.net-profit .metric-icon {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.metric-content h3 {
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
}

.metric-value.positive {
  color: #059669;
}

.metric-value.negative {
  color: #dc2626;
}

.metric-label {
  color: #9ca3af;
  font-size: 0.875rem;
  margin: 0;
}

/* Breakdown Section */
.breakdown-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.breakdown-card {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.breakdown-header {
  margin-bottom: 1.5rem;
}

.breakdown-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.breakdown-header p {
  color: #64748b;
  margin: 0;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #e2e8f0;
}

.item-label {
  font-weight: 500;
  color: #374151;
}

.item-value {
  font-weight: 600;
  font-size: 1.1rem;
}

.item-value.positive {
  color: #059669;
}

.item-value.negative {
  color: #dc2626;
}

/* Metrics Section */
.metrics-section {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.metrics-header {
  margin-bottom: 1.5rem;
}

.metrics-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.metrics-header p {
  color: #64748b;
  margin: 0;
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metric-mini-card {
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.metric-mini-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.metric-mini-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.metric-mini-value {
  font-weight: 600;
  color: #1e293b;
  font-size: 1.1rem;
}

.metric-mini-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.metric-mini-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.metric-mini-fill.cost {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

/* Section Headers */
.section-header {
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.section-header p {
  color: #64748b;
  margin: 0;
}

/* Tables */
.table-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  background: #f8fafc;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
}

.data-table td {
  padding: 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.data-table tr:hover {
  background: #f8fafc;
}

.period-cell {
  font-weight: 500;
}

.amount-cell {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-weight: 500;
}

.percentage-cell {
  font-weight: 600;
  color: #059669;
}

.product-cell {
  font-weight: 500;
}

.sku-cell {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  color: #64748b;
}

.number-cell {
  text-align: center;
  font-weight: 500;
}

.amount-cell.positive {
  color: #059669;
}

.amount-cell.negative {
  color: #dc2626;
}

/* Empty State */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.empty-card {
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: #9ca3af;
  margin-bottom: 1.5rem;
}

.empty-card h3 {
  color: #1e293b;
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}

.empty-card p {
  color: #64748b;
  margin: 0 0 2rem 0;
  line-height: 1.6;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .admin-profit-loss-report-page {
    padding: 1rem;
  }
  
  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
  
  .breakdown-grid {
    grid-template-columns: 1fr;
  }
  
  .metrics-cards {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 2rem;
  }
  
  .report-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .report-actions {
    justify-content: stretch;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .metric-card {
    flex-direction: column;
    text-align: center;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .filter-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .advanced-filters {
    padding: 1rem;
  }
  
  .filters-grid {
    gap: 1.5rem;
  }
  
  .data-table {
    font-size: 0.75rem;
  }
  
  .data-table th,
  .data-table td {
    padding: 0.75rem 0.5rem;
  }
}

@media (max-width: 480px) {
  .admin-profit-loss-report-page {
    padding: 0.5rem;
  }
  
  .page-header,
  .filter-card,
  .report-header,
  .metric-card,
  .breakdown-card,
  .metrics-section,
  .table-container,
  .empty-card {
    padding: 1.5rem;
  }
  
  .page-title {
    font-size: 1.75rem;
  }
  
  .metric-value {
    font-size: 1.5rem;
  }
}
</style> 
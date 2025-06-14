# Project To-Do List & Future Enhancements

This document consolidates future enhancements and pending tasks for the platform.

---

# Backend

## III. Backend Development Roadmap & Core Modules

This section outlines the primary driver for future backend development, based on user-specified core modules.

1.  **Product Catalog Management**
    - [X] Product ID (auto-generated)
    - [X] Product Name
    - [X] SKU
    - [X] Category
    - [X] Description
    - [X] Brand / Manufacturer
    - [X] Supplier Reference
    - [~] Image Gallery
      - [X] Phase 1: Backend CRUD for multiple images, images included in product detail API.
      - [X] Phase 2: Primary image selection and sync with main product image_url.
    - [X] Status (Active / Inactive / Archived)
    - Enhance "Specifications" tab with actual data if/when available from backend. (Moved from I.B)
2.  **Pricing Engine**
    - [X] Buying Price
        - [~] Historical tracking per supplier
          - [X] Phase 1: Schema created (`product_cost_history`) and PO receipts log entries.
          - [X] Phase 2: API endpoint to view product cost history (paginated & filterable).
          - [X] Product/Variant `cost_price` field is updated from latest PO receipt (in base currency).
        - [~] Supports multi-currency
          - [X] Phase 1: PO Items & Cost History store costs in supplier's currency and attempt to store in base currency (1:1 if matches, NULL otherwise).
          - [X] Phase 2: Allow manual input of exchange_rate_to_base during PO receiving to calculate and store base_currency_cost_price.
    - [X] Selling Price
        - [~] Retail and wholesale options
          - [X] Phase 1: Schema and APIs support `wholesale_price` on products and `wholesale_price_modifier` on variants; `getProductById` includes calculated `final_wholesale_price` for variants.
        - Bulk discounts and dynamic pricing
    - [~] Profit Margin Calculator
      - [X] Profit margin details (amount & percentage) included in product/variant API responses.
3.  **Stock Control & Movement**
    - [X] Real-time inventory levels (Admin UI: Stock Levels View - filterable, searchable, committed vs. available)
    - [~] Stock Movement Logs (Inbound/Outbound) (Admin UI: Recent Inventory Activity Log, Manual Stock Adjustments with reason codes, history)
      - [X] Manual stock adjustments logged to database (Phase 1)
      - [X] Logging for Initial Stock setup (products & variants).
      - [X] Logging for Stock Write-offs/Damage (via new admin endpoint).
      - [X] Logging for Customer Returns (restock).
    - [X] Reorder threshold alerts (Admin UI: Product Reorder Thresholds Management, Low Stock Report)
    - [~] Batch and expiry tracking
      - [X] Phase 1: Schema designed for `inventory_batches` table (includes batch_number, expiry_date, quantities, cost at receipt).
      - [X] Phase 2a: PO Receipt API optionally accepts batch details & creates records in `inventory_batches`.
      - [X] Phase 2b: Admin API endpoint to view inventory batches for a product/variant (paginated & sortable).
      - [X] Phase 2c: Admin API endpoint (`PUT /api/admin/inventory-batches/:batchId`) to update batch details (qty, expiry, number) and log qty changes.
      - [X] Phase 3: Sales order fulfillment deducts stock from batches (FEFO/FIFO strategy).
    - [~] Stock Takes / Cycle Counting
      - [X] Phase 1: Backend API endpoint (`/api/admin/stock-adjustments/physical-count`) to update stock to counted quantity and log adjustment.
    - (Consider: Stock Movement Tracking (Advanced - for multi-location) - Admin UI)
    - (Consider: Settings - Default Units of Measure, Reason Codes for Stock Adjustments, Warehouse/Location Management - Admin UI)
4.  **Label Generation & QR Code Printing**
    - [~] Printable product labels (Avery/Thermal formats)
      - [X] Phase 1: Backend API endpoint (/api/admin/products/:productId/label-data) provides structured JSON data for labels.
      - [X] Phase 2: Enhanced PDF label generation (`/api/admin/products/:id/label`) with barcode from label-data and QR code.
    - [~] QR codes linking to product page, order form, or promotion
      - [X] Product page, reorder, and promotion URL data included in /label-data API response for QR code generation.
    - Integration with Zebra/Brother printers
5.  **Supplier & Purchase Management**
    - [X] Supplier profiles with contact and currency info (Admin UI: Manage Suppliers - CRUD for details including currency_code exists, ensure UI is styled)
    - [~] Purchase orders and invoice matching (Admin UI: Manage Purchase Orders, Receiving Stock against POs, PO History & Reporting)
      - [X] PO items store supplier's currency code for unit_cost_price.
    - [~] Delivery tracking and status updates (for POs)
      - [X] Phase 1: Schema fields added to `purchase_orders` table; Admin API (`PUT /api/admin/purchase-orders/:id`) updated to set these fields. GET routes return fields.
6.  **Sales Order & Fulfillment**
    - Integration with e-commerce platforms
    - [~] FIFO or batch-aware stock deduction
        - [X] Phase 1: Implemented batch-aware stock deduction (FEFO/FIFO) during sales order creation.
    - [~] PDF invoice generation
      - [X] Phase 1: Basic PDF invoice generated via admin API endpoint (/api/admin/orders/:orderId/invoice/pdf).
    - [~] Order packing label printing
      - [X] Phase 1: Backend API endpoint (`/api/admin/orders/:orderId/packing-slip-data`) provides structured JSON data for packing slips.
      - [X] Phase 1 PDF: Basic PDF packing slip generated via admin API endpoint (/api/admin/orders/:orderId/packing-slip/pdf).
7.  **Barcode / QR Scanning Support**
    - Mobile or USB scanner support
    - Use QR codes for fast lookups or reorders

### A. Foundational: Product Variants & Options (Existing)
- Full backend logic for product variants (options, values, variants, specific configurations). *(DONE - Phase 1: DB Schema, Global Options API, Product-Specific Options API, Variants API)*
- Ensure variants correctly impact SKU, price, and stock quantity. *(DONE - `price_modifier` used, stock on variant)*
- API endpoints for managing options and variants associated with products. *(DONE)*
- Update public product API (`GET /api/products/:id`) to return variant info. *(DONE)*

### B. Foundational: Core User Features (Existing)
- API endpoint for "Change Password". *(DONE)*
- Define updatable "Profile Details" and create corresponding API endpoint(s). *(DONE - for user name)*

### C. Foundational: Customer Reviews & Ratings (Existing)
- Database schema for reviews. *(DONE)*
- API endpoints for submitting reviews. *(DONE)*
- API endpoints for retrieving (paginated) approved reviews for a product. *(DONE)*
- Admin API endpoints for moderating reviews (list, update status, delete). *(DONE)*
- Logic for calculating and storing average ratings / review counts on products table. *(DONE)*
- API endpoint for user to get their own review for a product. *(DONE)*

### D. Other Backend Enhancements (Existing & Future)
- **Advanced Shipping & Tax Calculation:**
  - Develop or integrate modules for complex shipping cost calculations.
  - Implement tax calculation logic.
- **Payment Gateway Integration (Major Feature):**
  - Integrate Stripe or PayPal for actual payment processing.
- [~] Email Templating:
  - [X] Phase 1: Implement EJS templating for Order Confirmation email (HTML). Created template structure (`order_confirmation.ejs`), refactored `emailService.js` to use it, and updated `orders.js` to call it correctly.
- **Search API Refinements:**
  - [~] Enhance product search (`GET /api/products`) for better partial match performance (e.g., PostgreSQL full-text search, `pg_trgm`).
    - [X] Phase 1: Implemented case-insensitive partial matching (ILIKE) for product name, description, and SKU (base product and variant SKUs).
- **Input Validation Review:**
  - [~] Systematically review and enhance input validation for all API endpoints using a library like `joi` or `express-validator` (already started using `express-validator`).
  - [X] Enhanced input validation for Discount Management routes (`/api/admin/discounts`) using express-validator.

### E. Development Utilities: Data Seeding (Existing)
- [X] Enhance `seed.js` to add sample products with variants and reviews. (Sample products, global options/values, product-specific option configurations, variants, and reviews are now seeded; average ratings also updated).
- [X] Major `seed.js` overhaul: Implemented full schema creation (`CREATE TABLE IF NOT EXISTS` for all tables including all new columns/features) and added comprehensive sample data for new entities (product images, stock logs, cost history) and new fields in existing entities.
- [X] Updated `seed.js` `createSchema` to include PO delivery tracking fields and the new `inventory_batches` table; added sample data for `inventory_batches`.
- [ ] CRITICAL: Review and fix `seed.js` `createSchema` function to ensure it correctly handles adding new columns to existing tables (e.g., using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) before attempting to create indexes or use these columns. Issues were noted with `order_items.tax_class_id_at_purchase` and an attempt to add `products.specifications`.

## IV. Tax Engine & Invoicing Module (New Specification)

### Invoice Structure
- [~] Unique Invoice Number
    - [X] Phase 1: Schema field added to `orders`; API logic to generate/store on status change (e.g., to 'shipped'/'completed').
- [~] Customer Information
    - [X] Phase 1: Schema fields for user tax exemption status added to `users` table.
- [~] Date/Time of Issue
    - [X] Phase 1: Schema field added to `orders`; API logic to store on status change.
- [~] Itemized Line Items
    - [X] Verified and ensured Product Name, SKU (base/variant), and Quantity are available and correctly represented in data sources for invoice generation (PDF route and export API).
    - [~] Unit Price (Excl. Tax)
        - [X] Assumed to be current `order_items.price_at_purchase`.
    - [~] Discount, Tax Rate, Tax Amount
        - [X] Phase 1: Schema fields for `line_item_tax_amount` and `applied_tax_rate_percentage` added to `order_items`.
    - [~] Line Total (Incl. Tax)
        - [X] Phase 1: Schema fields in place to calculate this.
- [~] Subtotal, Total Tax, Shipping Fee
    - [X] Phase 1: Schema field `total_tax_amount` (and `tax_summary_details`) added to `orders` table. (Shipping fee is pre-existing or separate).
- [~] Grand Total (Incl. Tax)
    - [X] Existing `orders.total_amount` will eventually include tax. Schema fields in place.
- [~] Payment Status (Pending, Paid, Refunded)
    - [X] Phase 1: Schema field (`payment_status`) added to `orders` table (in seed.js); Admin API for orders updated to manage this status.

### Tax Engine
1.  **Configurable Tax Rules**
    - [~] Multiple tax types (VAT, Sales Tax, Customs)
        - [X] Phase 1: Implement sequential/compounding tax calculation if different tax types apply (e.g., PST on subtotal+GST).
    - [~] Define name, rate %, jurisdiction, code, and validity dates
        - [X] Phase 1: Schema for `tax_rates` table designed and added to seed.js (includes name, rate, jurisdiction, type, code, active status, validity dates).
        - [X] Phase 2: CRUD API endpoints for managing `tax_rates` implemented.
        - [X] Phase 3: Sample `tax_rates` data seeded.
2.  **Customer-Based Logic**
    - [~] Taxable vs tax-exempt customers
        - [X] Phase 1: Schema fields for user tax exemption (`is_tax_exempt`, `tax_exemption_certificate_id`, `tax_exemption_notes`) added to `users` table and seed.js.
        - [X] Phase 2: Admin APIs for Users (GET list, GET ID, PUT ID) updated to include/manage tax exemption fields.
    - [~] Apply based on billing address
        - [X] Phase 1: Use order billing address (country/state) for jurisdiction matching in tax calculation. (Note: Relies on per-order billing address; centralized user address book is a future enhancement).
3.  **Product-Based Tax Classes**
    - [~] Standard Rate, Reduced Rate, Zero Rate
        - [X] Phase 1: Schema for `tax_classes` table designed and added to seed.js.
        - [X] Phase 2: CRUD API endpoints for managing `tax_classes` implemented.
        - [X] Phase 3: Sample `tax_classes` data seeded.
    - [~] Tag products by tax class
        - [X] Phase 1: `tax_class_id` FK column added to `products` table schema (and in seed.js).
        - [X] Phase 2: Product CRUD APIs updated to support assigning/unsetting `tax_class_id` on products.
        - [X] Phase 3: Seeded products are now assigned a `tax_class_id`.
    - [~] Link Tax Classes to Specific Tax Rates
        - [X] Phase 1: Schema for join table `tax_class_rates` designed and added to seed.js.
        - [X] Phase 2: CRUD API endpoints for managing links between tax classes and tax rates implemented.
        - [X] Phase 3: Sample `tax_class_rates` data seeded.
4.  **Dynamic Calculation**
    - [~] Auto-calculate tax on invoice/checkout
        - [X] Phase 1: Basic tax calculation service (`calculateTaxForCartItems`) created for cart items (handles user exemption, simplified jurisdiction, single rate per item from product's tax class).
        - [X] Phase 2: Integrated tax calculation service into order creation process (`POST /api/orders`); tax amounts stored on orders and order items.
    - [~] Support inclusive and exclusive pricing
        - [X] Phase 1: Implemented logic in taxService and orders route to handle a global setting (simulated via const/env var) for inclusive/exclusive prices. Tax calculations are based on derived exclusive price, and `order_items.price_at_purchase` stores this exclusive price. Subtotals for discounts also use exclusive prices.
5.  **Tax Reporting**
    - [ ] Monthly/quarterly returns
    - [~] Summary by region
        - [X] Phase 1: Created admin API endpoint (`/api/admin/reports/tax-summary-by-region`) to provide total tax collected and order count, grouped by billing country and region/state. Supports optional date filtering.
    - [~] Export invoice-level data
        - [X] Phase 1: Created admin API endpoint (`/api/admin/reports/invoice-export`) providing detailed order and line item data (including product, customer, addresses, pricing, and tax details) suitable for export. Supports date filtering.

### Optional: QR Invoice Label
- [ ] Link to online invoice or validation portal

---

# Frontend

## I. Storefront UI/UX (Customer Facing) - Frontend Aspects

### B. Product Detail Page (PDP - `pages/products/[id].vue`)
- **Customer Review Submission:**
  - UI for users to submit new reviews. *(DONE - ReviewForm.vue and PDP integration)*

### C. User Authentication & Profile
- **Core User Profile Features (`pages/profile/*.vue`):**
  - Connect "My Orders" list page to backend API. *(DONE - Verified existing)*
  - Connect "Order Detail" page to backend API. *(DONE - Verified existing)*
  - Implement "Change Password" functionality. *(DONE)*
  - Implement "Update Profile Details" (e.g., user's name). *(DONE)*

## II. Admin Panel UI/UX - Frontend Aspects

### A. Dashboard (`pages/admin/index.vue`)
- Implement actual data fetching for Stat Cards. *(DONE)*
- Integrate basic charts (e.g., sales over time - requires backend data source).
- Implement "Recent Activity" and "Recent Orders Table" sections with real data.

### B. Core Page Styling & Structure
- Create reusable admin-specific form components if beneficial.

### D. Category Management
- Create `frontend/pages/admin/categories/index.vue`. *(DONE)*
- Create `frontend/pages/admin/categories/new.vue`. *(DONE)*
- Create `frontend/pages/admin/categories/edit/[id].vue`. *(DONE)*

### E. Product Option & Variant Management (New Section)
- **Global Product Options UI:**
  - Page to manage global option types (`/admin/options/index.vue`). *(DONE)*
  - Page to manage global values for an option type (`/admin/options/[optionId]/values.vue`). *(DONE)*
- **Product-Specific Variant UI (likely within product edit page `/admin/products/edit/[id].vue` or a dedicated sub-page):**
  - [X] Assign global options to a specific product (UI implemented in ProductOptionsManager on product edit page).
  - [X] Specify which global option values are applicable for that product's assigned options (UI implemented on `.../manage-values.vue` page).
  - [X] Create/edit/delete variants based on combinations of these values (setting SKU, price modifier, stock, image). (Display, Add Form & Logic, Edit Form & Logic, Delete Logic implemented).

### F. Review Moderation
- Create Admin Page for Review Moderation (`/admin/reviews/index.vue`). *(DONE)*

### H. Reporting (Admin UI)
- Create `frontend/pages/admin/reports/index.vue` (as a dashboard for various reports).

---

# UI/UX

## I. Storefront UI/UX (Customer Facing) - UI/UX Aspects

### A. Product Listing Page (PLP - `pages/index.vue`)
- **Advanced Filters UI (Phase 2+):**
  - Implement collapsible sidebar for filters on desktop. *(DONE - Basic structure implemented)*
  - Implement modal/drawer for filters on mobile. *(DONE - Basic structure implemented)*
  - [X] Add visual filters: Color swatches implemented for "Color" option on PLP.
  - [X] Enhance price range filter with improved number inputs, validation, and styling (deferred more visual slider).
- **General UI/UX:**
  - Further review and refine global typography (Poppins font, scale, line heights, spacing).
  - Design more engaging and helpful empty state components (e.g., "No products match your filters").

### B. Product Detail Page (PDP - `pages/products/[id].vue`)
- **Image Gallery Phase 2:**
  - Implement click-to-zoom on main image. *(DONE)*
  - Improve thumbnail interactions (e.g., better scrolling for many images). *(DONE - basic scroll, active styling)*
- **Variant Selector Refinement:**
  - [X] Display visual swatches for "Color" options on PDP selector.
  - [X] Ensure "Size" or other options are clear and possibly indicate stock per selection dynamically (Implemented visual hints for out-of-stock combinations based on current selections).
- **Product Information Tabs:** *(DONE - Description, Specs (placeholder), Reviews (placeholder))*
- **Customer Reviews Display:**
  - Display list of approved public reviews in the "Reviews" tab. *(DONE)*

### C. User Authentication & Profile
- **Login/Registration Pages (`pages/login.vue`, `pages/register.vue`):**
  - Style with Tailwind CSS. *(DONE)*

### D. General UI Polish & Feedback
- **Interactive Feedback (Phase 2+):**
  - Implement Skeleton Loaders for PLP, PDP, Order History. *(DONE)*
  - Refine Toast Notification usage/styling if needed.
- **Empty States & Error Pages:**
  - Design more engaging and helpful empty state components throughout the application.
  - Ensure the custom 404 page (`error.vue`) is robust and potentially add more specific error pages.

## II. Admin Panel UI/UX - UI/UX Aspects

### B. Core Page Styling & Structure
- **Refactor Key Admin Pages with Tailwind CSS:**
  - [X] `admin/users/index.vue`
  - `admin/products/index.vue` *(DONE)*
  - [X] `admin/products/new.vue / edit/[id].vue`
  - `admin/orders/index.vue` / `[id].vue`
  - (Other admin pages as they are developed).

### C. Layout & Navigation
- Add SVG icons to all `AdminSidebar.vue` navigation items. *(DONE)*
- Implement breadcrumb navigation within the admin section.
- Implement a functional global search bar in the top admin bar (for searching orders, products, users etc.).
- Add notification icon/dropdown placeholder in top admin bar.
- Consider more sophisticated collapse mechanism for the sidebar (e.g., icon-only view).

### H. Reporting (Admin UI)
  - Consider UI for Low Stock Report (linked to "Reorder threshold alerts" in Core Modules).
  - Consider UI for Stock Valuation Report.
  - Consider UI for Inventory History/Audit Trail Report.

---

# Testing

## V. Testing (Original Section V)

### A. Backend
- Develop unit tests for services and utility functions.
- Implement integration tests for API endpoints (especially new variant and review APIs).

### B. Frontend
- Write unit tests for Vue components and composables (e.g., using Vitest).
- Implement End-to-End (E2E) tests for critical user flows (registration, login, add to cart with variants, checkout, review submission).

---

# Deployment & Operations

## VI. Deployment & Operations (Original Section VI)

- Finalize and document the AWS Amplify deployment strategy.
- Implement database backup and restore procedures. (Moved to Backend)
- Setup monitoring and logging for the production environment.

---
*This list will be updated as features are implemented or new requirements arise.*

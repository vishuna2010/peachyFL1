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
    - [~] Enhance "Specifications" tab with actual data if/when available from backend. (Moved from I.B)
      - [X] Phase 1 (Backend): Added \`specifications\` JSONB column to \`products\`. Updated admin CRUD and public product detail API to support it. Seeded sample specs.
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
        - [ ] Bulk discounts and dynamic pricing
    - [~] Profit Margin Calculator
      - [X] Profit margin details (amount & percentage) included in product/variant API responses.
3.  **Stock Control & Movement**
    - [X] Real-time inventory levels (Admin UI: Stock Levels View - filterable, searchable, committed vs. available)
    - [X] Stock Movement Logs (Inbound/Outbound) (Admin UI: Recent Inventory Activity Log, Manual Stock Adjustments with reason codes, history)
      - [X] Manual stock adjustments logged to database (Phase 1)
      - [X] Logging for Initial Stock setup (products & variants).
      - [X] Logging for Stock Write-offs/Damage (via new admin endpoint).
      - [X] Logging for Customer Returns (restock).
      - [X] Admin UI for viewing logs with filtering and pagination implemented.
    - [X] Reorder threshold alerts (Admin UI: Product Reorder Thresholds Management, Low Stock Report)
    - [X] Batch and expiry tracking
      - [X] Phase 1: Schema designed for `inventory_batches` table (includes batch_number, expiry_date, quantities, cost at receipt).
      - [X] Phase 2a: PO Receipt API optionally accepts batch details & creates records in `inventory_batches`.
      - [X] Phase 2b: Admin API endpoint to view inventory batches for a product/variant (paginated & sortable).
      - [X] Phase 2c: Admin API endpoint (`PUT /api/admin/inventory-batches/:batchId`) to update batch details (qty, expiry, number) and log qty changes.
      - [X] Phase 3: Sales order fulfillment deducts stock from batches (FEFO/FIFO strategy).
      - [X] Admin UI for listing, filtering, paginating, and editing batches implemented.
    - [X] Stock Takes / Cycle Counting
      - [X] Phase 1: Backend API endpoint (`/api/admin/stock-adjustments/physical-count`) to update stock to counted quantity and log adjustment.
      - [X] Admin UI for submitting physical counts and write-offs implemented.
    - [ ] (Consider: Stock Movement Tracking (Advanced - for multi-location) - Admin UI)
    - [ ] (Consider: Settings - Default Units of Measure, Reason Codes for Stock Adjustments, Warehouse/Location Management - Admin UI)
4.  **Label Generation & QR Code Printing**
    - [X] Printable product labels (Avery/Thermal formats)
      - [X] Phase 1: Backend API endpoint (/api/admin/products/:productId/label-data) provides structured JSON data for labels.
      - [X] Phase 2: Enhanced PDF label generation (`/api/admin/products/:id/label`) with barcode from label-data and QR code.
    - [X] QR codes linking to product page, order form, or promotion
      - [X] Product page, reorder, and promotion URL data included in /label-data API response for QR code generation.
    - [ ] Integration with Zebra/Brother printers
5.  **Supplier & Purchase Management**
    - [X] Supplier profiles with contact and currency info (Admin UI: Manage Suppliers - CRUD for details including currency_code exists, ensure UI is styled)
    - [~] Purchase orders and invoice matching (Admin UI: Manage Purchase Orders, Receiving Stock against POs, PO History & Reporting)
      - [X] PO items store supplier's currency code for unit_cost_price.
    - [~] Delivery tracking and status updates (for POs)
      - [X] Phase 1: Schema fields added to `purchase_orders` table; Admin API (`PUT /api/admin/purchase-orders/:id`) updated to set these fields. GET routes return fields.
6.  **Sales Order & Fulfillment**
    - [ ] Integration with e-commerce platforms
    - [X] FIFO or batch-aware stock deduction
        - [X] Phase 1: Implemented batch-aware stock deduction (FEFO/FIFO) during sales order creation.
    - [X] PDF invoice generation
      - [X] Phase 1: Basic PDF invoice generated via admin API endpoint (/api/admin/orders/:orderId/invoice/pdf).
    - [X] Order packing label printing
      - [X] Phase 1: Backend API endpoint (`/api/admin/orders/:orderId/packing-slip-data`) provides structured JSON data for packing slips.
      - [X] Phase 1 PDF: Basic PDF packing slip generated via admin API endpoint (/api/admin/orders/:orderId/packing-slip/pdf).
    - [~] **Refund Processing (Admin):** (Backend endpoint exists, UI basic or pending)
        - [X] Phase 1: Implement backend endpoint for full (mock) refunds. Update order/payment status, adjust product/variant stock (simplified), create stock movement & audit logs. Use `orders:manage_refunds` permission. (Backend done, UI might need more work)
        - [ ] Phase 2: UI for partial refunds (item selection, amounts).
        - [ ] Phase 3: Integrate with actual payment gateway for refund transactions.
7.  **Barcode / QR Scanning Support**
    - [ ] Mobile or USB scanner support
    - [ ] Use QR codes for fast lookups or reorders

### A. Foundational: Product Variants & Options (Existing)
- [X] Full backend logic for product variants (options, values, variants, specific configurations). *(DONE - Phase 1: DB Schema, Global Options API, Product-Specific Options API, Variants API)*
- [X] Ensure variants correctly impact SKU, price, and stock quantity. *(DONE - `price_modifier` used, stock on variant)*
- [X] API endpoints for managing options and variants associated with products. *(DONE)*
- [X] Update public product API (`GET /api/products/:id`) to return variant info. *(DONE)*

### B. Foundational: Core User Features (Existing)
- [X] API endpoint for "Change Password". *(DONE)*
- [X] Define updatable "Profile Details" and create corresponding API endpoint(s). *(DONE - for user name)*

### C. Foundational: Customer Reviews & Ratings (Existing)
- [X] Database schema for reviews. *(DONE)*
- [X] API endpoints for submitting reviews. *(DONE)*
- [X] API endpoints for retrieving (paginated) approved reviews for a product. *(DONE)*
- [X] Admin API endpoints for moderating reviews (list, update status, delete). *(DONE)*
- [X] Logic for calculating and storing average ratings / review counts on products table. *(DONE)*
- [X] API endpoint for user to get their own review for a product. *(DONE)*

### D. Other Backend Enhancements (Existing & Future)
- **Advanced Shipping & Tax Calculation:**
  - [ ] Develop or integrate modules for complex shipping cost calculations.
  - [X] Implement tax calculation logic. (Core tax engine implemented)
- **Payment Gateway Integration (Major Feature):**
  - [ ] Integrate Stripe or PayPal for actual payment processing.
  - [~] **Mock Payment Flow (Checkout Page):** (Backend support exists, UI implemented)
    - [X] Phase 1: Implement UI changes on checkout page for a mock payment step. Modify order creation to reflect "paid" status if mock payment is confirmed. (Backend `mock_payment_successful` flag and frontend modal exist)
- [X] Email Templating:
  - [X] Phase 1: Implement EJS templating for Order Confirmation email (HTML). Created template structure (`order_confirmation.ejs`), refactored `emailService.js` to use it, and updated `orders.js` to call it correctly.
- **Search API Refinements:**
  - [~] Enhance product search (`GET /api/products`) for better partial match performance.
    - [X] Phase 1: Implemented case-insensitive partial matching (ILIKE) for product name, description, and SKU (base product and variant SKUs).
    - [ ] Phase 2: Consider PostgreSQL full-text search (`tsvector`, `tsquery`) or `pg_trgm` for more advanced similarity searching and relevance ranking.
- **Input Validation Review:** (Moved to Section V)

## V. Backend Architecture & Process Improvements
- [X] **Enhanced Configuration Management:** (DONE - `backend/config/index.js` created and integrated)
    -   Centralize all environment variable access and configuration settings.
    -   Benefit: Makes configuration easier to manage, reduces magic strings/numbers, simplifies environment-specific setups.

- [~] **Comprehensive Error Handling & Validation:**
    - [X] Ensure a globally consistent error response structure for all API endpoints (Standardized structure with status, message, code, details via `AppError.js` and `errorHandler.js`).
    - [X] Refine the global error handler (`errorHandler.js`) for more detailed logging (structured logging of stack traces for non-operational errors in prod) and to prevent leaking sensitive details.
    - [~] Systematically review and expand input validation (`express-validator`) for all API endpoints.
        - [X] Admin Categories module (`adminCategories.js`)
        - [X] Admin Discounts module (`adminDiscounts.js`)
        - [X] Admin Suppliers module (`adminSuppliers.js`)
        - [X] Admin Products module (`adminProducts.js` - C/U/D Product, Stock Update, Stock Levels, Inventory Batches, Cost History, Label Data, Assigned Options)
        - [X] Admin Product Variants module (`adminProductVariants.js` - C/U/D Variants)
        - [X] Admin Users module (`adminUsers.js` - C/U/D, Role Update)
        - [ ] Admin Orders module (`adminOrders.js`)
        - [ ] Admin Purchase Orders module (`adminPurchaseOrders.js`)
        - [ ] Admin Reviews module (`adminReviews.js`)
        - [ ] Admin Reports module (`adminReports.js` - query parameters)
        - [ ] Admin Stock Adjustments module (`adminStockAdjustments.js`)
        - [ ] Admin Inventory Batches module (`adminInventoryBatches.js` - PUT route)
        - [ ] Admin Tax Classes module (`adminTaxClasses.js`)
        - [ ] Admin Tax Rates module (`adminTaxRates.js`)
        - [ ] Public API routes (auth, products, orders, users, categories, reviews, etc.)
    -   Benefit: Improves API robustness, provides clearer error feedback, enhances security.

- [~] **Strict Database Interactions & Service Layer Enforcement:**
    - [~] Enforce service layer pattern: Ensure all DB logic is within services, minimize direct `db.query` in route handlers.
        - [X] Categories module (`categoryService.js`)
        - [X] Discounts module (`discountService.js`)
        - [X] Suppliers module (`supplierService.js`)
        - [X] Product Management module (`productService.js` - C/U/D Product, C/U/D Variants, Stock Update, Stock Levels, Inventory Batches, Cost History, Label Data, Assigned Options; internal `getAllProducts` refactor)
        - [X] Admin Users module (`adminUsers.js` -> `userService.js`)
        - [ ] Admin Orders module (`adminOrders.js` -> `orderService.js`)
        - [ ] Admin Purchase Orders module (`adminPurchaseOrders.js` -> `purchaseOrderService.js`)
        - [ ] Admin Reviews module (`adminReviews.js` -> `reviewService.js`)
        - [ ] Admin Reports module (`adminReports.js` - for complex queries -> `reportService.js`)
        - [ ] Admin Stock Adjustments module (`adminStockAdjustments.js` -> `inventoryService.js` or `productService.js`)
        - [ ] Admin Inventory Batches module (`adminInventoryBatches.js` - PUT route -> `inventoryService.js` or `productService.js`)
        - [ ] Admin Tax Classes module (`adminTaxClasses.js` -> `taxService.js` or new service)
        - [ ] Admin Tax Rates module (`adminTaxRates.js` -> `taxService.js` or new service)
        - [ ] Public User Profile routes (`users.js` -> `userService.js`)
        - [ ] Public Order creation route (`orders.js` -> `orderService.js`)
        - [ ] Other public routes with DB logic as identified.
    - [~] Review and ensure comprehensive transaction management for all multi-step DB operations.
        - [X] Addressed in C/U/D methods of `categoryService.js`.
        - [X] Addressed in C/U/D methods of `discountService.js`.
        - [X] Addressed in C/U/D methods of `supplierService.js`.
        - [X] Addressed in C/U/D methods of `productService.js` (including product and variant C/U/D operations).
        - [X] Addressed in C/U/D methods of `userService.js`.
        - [ ] Broader review for overall transactional integrity in remaining complex operations (e.g., order processing, PO management, stock adjustments).
    - [ ] (Consider for Future) Evaluate ORM/Query Builder (e.g., Sequelize, Knex.js) for potential adoption if complexity warrants.
    -   Benefit: Better separation of concerns, more testable code, improved data consistency, and potentially more maintainable database logic.

- **[ ] Stock Management Logic Reconciliation & Accuracy:**
    *   **Suggestion:** **Critically review** how stock quantities are determined and presented. Ensure `productService.getAllProducts` (and thus public product listings) stock (e.g. `effective_stock_quantity` CTE) is perfectly aligned with the batch-aware stock deduction logic used in sales order fulfillment (`inventory_batches` table) and accurately reflects sellable quantities.
    *   **Benefit:** Prevents overselling and ensures customers see accurate stock availability.

- **[ ] Asynchronous Operations & Background Jobs Strategy:**
    *   **Suggestion:** For operations that can be slow or are not critical to the immediate API response (e.g., sending emails, complex report generation, S3 cleanup on failure), evaluate using a message queue (e.g., RabbitMQ, Redis streams, AWS SQS) and background workers.
    *   **Benefit:** Improves API responsiveness and resilience.

- **[~] Proactive Security Enhancements:**
    *   **Suggestion:**
        *   [ ] Periodically review RBAC permission granularity.
        *   [~] Ensure no sensitive data is inadvertently exposed in API responses or general `console.log` statements. (PARTIALLY DONE - Moved to structured logging which helps, but code review still needed for all log points)
        *   [ ] Regularly review dependencies for known vulnerabilities (`npm audit`).
    -   **Benefit:** Strengthens the security posture of the application.

- **[ ] API Design Consistency & Documentation Standards:**
    *   **Suggestion:**
        *   [ ] Maintain consistency in API endpoint paths, naming conventions, and response structures.
        *   [ ] Consider implementing API documentation using tools like Swagger/OpenAPI.
    -   **Benefit:** Makes the API easier to understand, consume, and maintain.

- **[~] Expanded Testing Strategy:**
    *   **Suggestion:**
        *   [~] Expand unit test coverage for services (especially complex business logic like in `productService`, `taxService`, `orderService`) and utility functions. (PARTIALLY DONE - Service layer refactor makes this easier, noted areas for testing for refactored services)
        *   [ ] Increase integration test coverage for critical API endpoints, testing the full request-response cycle including database interaction.
    -   **Benefit:** Improves code quality, reduces regressions, and makes refactoring safer.

- **[X] Advanced Logging Enhancements:** (DONE - Basic setup with Pino and pino-http for request/response and error logging)
    *   Implement structured logging (e.g., JSON format) with consistent fields.
    *   [~] Ensure important events, errors, and decision points are logged appropriately. (PARTIALLY DONE - Key areas like error handler and server start are covered, more specific business logic logging can be added)
    *   Benefit: Greatly improves debugging, monitoring, and auditing capabilities.

### E. Development Utilities: Data Seeding (Existing)
- [X] Enhance `seed.js` to add sample products with variants and reviews. (Sample products, global options/values, product-specific option configurations, variants, and reviews are now seeded; average ratings also updated).
- [X] Major `seed.js` overhaul: Implemented full schema creation (`CREATE TABLE IF NOT EXISTS` for all tables including all new columns/features) and added comprehensive sample data for new entities (product images, stock logs, cost history) and new fields in existing entities.
- [X] Updated `seed.js` `createSchema` to include PO delivery tracking fields and the new `inventory_batches` table; added sample data for `inventory_batches`.
- [X] CRITICAL: Review and fix `seed.js` `createSchema` function to ensure it correctly handles adding new columns to existing tables (e.g., using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) before attempting to create indexes or use these columns. Issues were noted with `order_items.tax_class_id_at_purchase` and an attempt to add `products.specifications`.
  - [X] Phase 1: Refactored `createSchema` by ensuring all columns for all tables are explicitly checked/added with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` after initial `CREATE TABLE IF NOT EXISTS ...` statements. This makes schema creation more robust against pre-existing tables with older definitions.
  - [X] Phase 1a: Ensured unique index exists on `product_variants.sku` to resolve `ON CONFLICT` issues during seeding.
  - [X] Phase 1b: Ensured unique constraint/index exists on `product_images(product_id, image_url)` to resolve `ON CONFLICT` issues during seeding.

## IV. Tax Engine & Invoicing Module (New Specification)

### Invoice Structure
- [X] Unique Invoice Number
    - [X] Phase 1: Schema field added to `orders`; API logic to generate/store on status change (e.g., to 'shipped'/'completed').
- [X] Customer Information
    - [X] Phase 1: Schema fields for user tax exemption status added to `users` table.
- [X] Date/Time of Issue
    - [X] Phase 1: Schema field added to `orders`; API logic to store on status change.
- [X] Itemized Line Items
    - [X] Verified and ensured Product Name, SKU (base/variant), and Quantity are available and correctly represented in data sources for invoice generation (PDF route and export API).
    - [X] Unit Price (Excl. Tax)
        - [X] Assumed to be current `order_items.price_at_purchase`.
    - [X] Discount, Tax Rate, Tax Amount
        - [X] Phase 1: Schema fields for `line_item_tax_amount` and `applied_tax_rate_percentage` added to `order_items`.
    - [X] Line Total (Incl. Tax)
        - [X] Phase 1: Schema fields in place to calculate this.
- [X] Subtotal, Total Tax, Shipping Fee
    - [X] Phase 1: Schema field `total_tax_amount` (and `tax_summary_details`) added to `orders` table. (Shipping fee is pre-existing or separate).
- [X] Grand Total (Incl. Tax)
    - [X] Existing `orders.total_amount` will eventually include tax. Schema fields in place.
- [X] Payment Status (Pending, Paid, Refunded)
    - [X] Phase 1: Schema field (`payment_status`) added to `orders` table (in seed.js); Admin API for orders updated to manage this status.

### Tax Engine
1.  **Configurable Tax Rules**
    - [X] Multiple tax types (VAT, Sales Tax, Customs)
        - [X] Phase 1: Implement sequential/compounding tax calculation if different tax types apply (e.g., PST on subtotal+GST).
    - [X] Define name, rate %, jurisdiction, code, and validity dates
        - [X] Phase 1: Schema for `tax_rates` table designed and added to seed.js (includes name, rate, jurisdiction, type, code, active status, validity dates).
        - [X] Phase 2: CRUD API endpoints for managing `tax_rates` implemented.
        - [X] Phase 3: Sample `tax_rates` data seeded.
2.  **Customer-Based Logic**
    - [X] Taxable vs tax-exempt customers
        - [X] Phase 1: Schema fields for user tax exemption (`is_tax_exempt`, `tax_exemption_certificate_id`, `tax_exemption_notes`) added to `users` table and seed.js.
        - [X] Phase 2: Admin APIs for Users (GET list, GET ID, PUT ID) updated to include/manage tax exemption fields.
    - [X] Apply based on billing address
        - [X] Phase 1: Use order billing address (country/state) for jurisdiction matching in tax calculation. (Note: Relies on per-order billing address; centralized user address book is a future enhancement).
3.  **Product-Based Tax Classes**
    - [X] Standard Rate, Reduced Rate, Zero Rate
        - [X] Phase 1: Schema for `tax_classes` table designed and added to seed.js.
        - [X] Phase 2: CRUD API endpoints for managing `tax_classes` implemented.
        - [X] Phase 3: Sample `tax_classes` data seeded.
    - [X] Tag products by tax class
        - [X] Phase 1: `tax_class_id` FK column added to `products` table schema (and in seed.js).
        - [X] Phase 2: Product CRUD APIs updated to support assigning/unsetting `tax_class_id` on products.
        - [X] Phase 3: Seeded products are now assigned a `tax_class_id`.
    - [X] Link Tax Classes to Specific Tax Rates
        - [X] Phase 1: Schema for join table `tax_class_rates` designed and added to seed.js.
        - [X] Phase 2: CRUD API endpoints for managing links between tax classes and tax rates implemented.
        - [X] Phase 3: Sample `tax_class_rates` data seeded.
4.  **Dynamic Calculation**
    - [X] Auto-calculate tax on invoice/checkout
        - [X] Phase 1: Basic tax calculation service (`calculateTaxForCartItems`) created for cart items (handles user exemption, simplified jurisdiction, single rate per item from product's tax class).
        - [X] Phase 2: Integrated tax calculation service into order creation process (`POST /api/orders`); tax amounts stored on orders and order items.
    - [X] Support inclusive and exclusive pricing
        - [X] Phase 1: Implemented logic in taxService and orders route to handle a global setting (simulated via const/env var) for inclusive/exclusive prices. Tax calculations are based on derived exclusive price, and `order_items.price_at_purchase` stores this exclusive price. Subtotals for discounts also use exclusive prices.
5.  **Tax Reporting**
    - [~] Monthly/quarterly returns
      - [X] Phase 1: Created admin API endpoint (`/api/admin/reports/tax-returns`) to provide total tax collected for a specified year and period (month/quarter), based on order creation date.
    - [~] Summary by region
        - [X] Phase 1: Created admin API endpoint (`/api/admin/reports/tax-summary-by-region`) to provide total tax collected and order count, grouped by billing country and region/state. Supports optional date filtering.
    - [~] Export invoice-level data
        - [X] Phase 1: Created admin API endpoint (`/api/admin/reports/invoice-export`) providing detailed order and line item data (including product, customer, addresses, pricing, and tax details) suitable for export. Supports date filtering.

### Optional: QR Invoice Label
- [~] Link to online invoice or validation portal
  - [X] Phase 1 (Backend): Implemented generation of a unique URL (using order ID and a short random token) for online invoice viewing. This URL is added to the data passed to the PDF invoice generation service.

---

# Frontend
(Frontend tasks remain as they were)
...
---

# UI/UX
(UI/UX tasks remain as they were)
...
---

# Testing
(Testing tasks remain as they were)
...
---

# Deployment & Operations
(Deployment & Operations tasks remain as they were)
...
---
*This list will be updated as features are implemented or new requirements arise.*

---

# Theming Implementation (New Palette & UI Suggestions)
(Theming tasks remain as they were)
...
---

# Theme Change Errata & Unresolved Issues
(Theme errata remain as they were)
...
---

## Purchase Order Feature Improvements
(PO improvements remain as they were)
...
---

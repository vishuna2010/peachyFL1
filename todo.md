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
        - Bulk discounts and dynamic pricing
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
    - [X] FIFO or batch-aware stock deduction
        - [X] Phase 1: Implemented batch-aware stock deduction (FEFO/FIFO) during sales order creation.
    - [~] PDF invoice generation
      - [X] Phase 1: Basic PDF invoice generated via admin API endpoint (/api/admin/orders/:orderId/invoice/pdf).
    - [~] Order packing label printing
      - [X] Phase 1: Backend API endpoint (`/api/admin/orders/:orderId/packing-slip-data`) provides structured JSON data for packing slips.
      - [X] Phase 1 PDF: Basic PDF packing slip generated via admin API endpoint (/api/admin/orders/:orderId/packing-slip/pdf).
    - [ ] **Refund Processing (Admin):**
        - [ ] Phase 1: Implement backend endpoint and basic UI for full (mock) refunds. Update order/payment status, adjust product/variant stock (simplified), create stock movement & audit logs. Use `orders:manage_refunds` permission.
        - [ ] Phase 2: UI for partial refunds (item selection, amounts).
        - [ ] Phase 3: Integrate with actual payment gateway for refund transactions.
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
  - [ ] **Mock Payment Flow (Checkout Page):**
    - [ ] Phase 1: Implement UI changes on checkout page for a mock payment step. Modify order creation to reflect "paid" status if mock payment is confirmed.
- [~] Email Templating:
  - [X] Phase 1: Implement EJS templating for Order Confirmation email (HTML). Created template structure (`order_confirmation.ejs`), refactored `emailService.js` to use it, and updated `orders.js` to call it correctly.
- **Search API Refinements:**
  - [~] Enhance product search (`GET /api/products`) for better partial match performance (e.g., PostgreSQL full-text search, `pg_trgm`).
    - [X] Phase 1: Implemented case-insensitive partial matching (ILIKE) for product name, description, and SKU (base product and variant SKUs).
- **Input Validation Review:**
  - [~] Systematically review and enhance input validation for all API endpoints using a library like `joi` or `express-validator` (already started using `express-validator`).
  - [X] Enhanced input validation for Discount Management routes (`/api/admin/discounts`) using express-validator.
  - [X] Enhanced input validation for Category Management routes (`/api/admin/categories`) using express-validator.

## V. Backend Architecture & Process Improvements (New Section for General Backend Enhancements)
- [ ] **Configuration Management:** Centralize environment variable access into a dedicated config module (e.g., `backend/config/index.js`).
- [ ] **Error Handling & Validation:**
    - [ ] Ensure consistent error response structures across all APIs.
    - [X] Ensure consistent error response structures across all APIs. (Standardized structure with status, message, code, details implemented in errorHandler.js and AppError.js)
    - [~] Systematically review and expand input validation (`express-validator` or similar) for all API endpoints. (Examples applied for admin products [C/U/D variants, C/U/D product, stock, stock levels, inventory batches, cost history, label data, assigned options], admin categories, admin discounts, admin suppliers, admin users; further review pending)
    - [X] Refine global error handler for better logging (structured logging of stack traces for non-operational errors in prod) and to prevent leaking sensitive details.
- [~] **Database Interactions & Services:**
    - [~] Enforce service layer pattern: Ensure all DB logic is within services, minimize direct `db.query` in route handlers. (Completed for Categories, Discounts, Suppliers modules; Product Management [C/U/D variants, C/U/D product, stock, stock levels, inventory batches, cost history, label data, assigned options] refactored. `productService.getAllProducts` internally refactored; pending for others)
    - [~] Review and ensure comprehensive transaction management for all multi-step DB operations. (Addressed in C/U/D methods of Category, Discount, Supplier, Product services [including variants and product deletion]; needs broader review)
    - [ ] (Consider for Future) Evaluate ORM/Query Builder (e.g., Sequelize, Knex.js) for potential adoption if complexity warrants.
- [ ] **Stock Management Logic:**
    - [ ] **Critical:** Reconcile `productService.getAllProducts` stock determination (currently `products.stock_quantity`) with batch-aware stock logic used in order processing. Public listings should reflect actual sellable batch inventory.
    - [ ] Enhance refund restocking logic: Allow options for returning items to specific batches or a "returns" status, rather than just incrementing main product/variant stock.
- [ ] **Asynchronous Operations:**
    - [ ] For email sending and other potentially long-running non-critical tasks, evaluate using a message queue and background workers for improved API resilience and responsiveness.
- [ ] **Security:**
    - [ ] Periodically review RBAC permission granularity.
    - [ ] Ensure no sensitive data is inadvertently exposed in general `console.log` statements (audit logs are structured, but general debug logs need care).
- [ ] **API Design & Documentation:**
    - [ ] Maintain/improve consistency in API endpoint paths and naming.
    - [ ] Consider implementing API documentation using Swagger/OpenAPI.
- [~] **Testing:**
    - [~] Expand unit test coverage for services and utility functions. (Service layer refactor makes this easier, noted areas for testing)
    - [ ] Increase integration test coverage for critical API endpoints.

- **[X] Enhanced Configuration Management:**
    -   **Suggestion:** Centralize all environment variable access and configuration settings (e.g., database URLs, API keys, pagination defaults, feature flags) into a dedicated configuration module (e.g., `backend/config/index.js`). (DONE - `backend/config/index.js` created and integrated)
    -   **Benefit:** Makes configuration easier to manage, reduces magic strings/numbers scattered in the code, and simplifies environment-specific setups (dev, staging, prod).

- **[X] Comprehensive Error Handling & Validation:**
    -   **Suggestion:**
        *   Ensure a globally consistent error response structure for all API endpoints (building on `AppError` and `errorHandler.js`). (DONE - Standardized structure with status, message, code, details)
        *   Systematically review and expand input validation (`express-validator`) for *all* API endpoints, ensuring all expected parameters, body fields, and their types/constraints are covered. (PARTIALLY DONE - Examples applied to admin products [C/U/D variants, C/U/D product, stock, stock levels, inventory batches, cost history, label data, assigned options], admin categories, admin discounts, admin suppliers, admin users; further review pending for all other endpoints)
        *   Refine the global error handler (`errorHandler.js`) for more detailed logging (e.g., stack traces for 500 errors, request identifiers) while ensuring no sensitive details are leaked in client-facing error messages. (DONE - Structured logging of stack traces for non-operational errors in prod, client still gets generic message)
    -   **Benefit:** Improves API robustness, provides clearer error feedback to clients, and enhances security.

- **[~] Strict Database Interactions & Service Layer Enforcement:**
    -   **Suggestion:**
        *   Strictly enforce the service layer pattern: All database interaction logic should reside within service functions. Route handlers should only be responsible for request/response handling and calling services. (PARTIALLY DONE - Categories, Discounts, Suppliers modules refactored. Extensive refactoring of Product Management admin routes [C/U/D Product, C/U/D Variants, Stock Update, Stock Levels, Inventory Batches, Cost History, Label Data, Assigned Options] into `productService.js`. `productService.getAllProducts` also internally refactored for maintainability. Admin Users validation enhanced, service layer pending.)
        *   Review and ensure comprehensive transaction management (`BEGIN`, `COMMIT`, `ROLLBACK`) for all operations that involve multiple database writes. (PARTIALLY DONE - Addressed in C/U/D methods in `categoryService.js`, `discountService.js`, `supplierService.js`, and `productService.js` [including product and variant C/U/D]. Broader review for overall transactional integrity still beneficial.)
        *   For complex queries or if direct SQL becomes unwieldy, consider evaluating a Query Builder (like Knex.js) which can work alongside direct `db.query` calls.
    -   **Benefit:** Better separation of concerns, more testable code, improved data consistency, and potentially more maintainable database logic.

- **[ ] Stock Management Logic Reconciliation & Accuracy:**
    *   **Suggestion:** **Critically review** how stock quantities are determined and presented. Ensure `productService.getAllProducts` (and thus public product listings) stock (e.g. `effective_stock_quantity` CTE) is perfectly aligned with the batch-aware stock deduction logic used in sales order fulfillment (`inventory_batches` table) and accurately reflects sellable quantities.
    *   **Benefit:** Prevents overselling and ensures customers see accurate stock availability.

- **[ ] Asynchronous Operations & Background Jobs Strategy:**
    *   **Suggestion:** For operations that can be slow or are not critical to the immediate API response (e.g., sending emails, complex report generation, S3 cleanup on failure), evaluate using a message queue (e.g., RabbitMQ, Redis streams, AWS SQS) and background workers.
    *   **Benefit:** Improves API responsiveness and resilience.

- **[~] Proactive Security Enhancements:**
    *   **Suggestion:**
        *   Periodically review RBAC permission granularity.
        *   Ensure no sensitive data is inadvertently exposed in API responses or general `console.log` statements. (PARTIALLY DONE - Moved to structured logging which helps, but code review still needed)
        *   Regularly review dependencies for known vulnerabilities (`npm audit`).
    -   **Benefit:** Strengthens the security posture of the application.

- **[ ] API Design Consistency & Documentation Standards:**
    *   **Suggestion:**
        *   Maintain consistency in API endpoint paths, naming conventions, and response structures.
        *   Consider implementing API documentation using tools like Swagger/OpenAPI.
    *   **Benefit:** Makes the API easier to understand, consume, and maintain.

- **[~] Expanded Testing Strategy:**
    *   **Suggestion:**
        *   Expand unit test coverage for services (especially complex business logic like in `productService`, `taxService`, `orderService`) and utility functions. (PARTIALLY DONE - Service layer refactor makes this easier, noted areas for testing)
        *   Increase integration test coverage for critical API endpoints, testing the full request-response cycle including database interaction.
    *   **Benefit:** Improves code quality, reduces regressions, and makes refactoring safer.

- **[X] Advanced Logging Enhancements:**
    *   **Suggestion:** Implement structured logging (e.g., JSON format) with consistent fields like request ID, user ID (if available), timestamp, log level, and message. (DONE - Basic setup with Pino and pino-http for request/response and error logging)
    *   Ensure important events, errors, and decision points are logged appropriately. (PARTIALLY DONE - Key areas like error handler and server start are covered, more specific business logic logging can be added)
    *   **Benefit:** Greatly improves debugging, monitoring, and auditing capabilities.

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
- [~] Integrate basic charts (e.g., sales over time - requires backend data source). *(UI placeholder exists, backend needed)*
- [X] Implement "Recent Activity" (stock logs) and "Recent Orders Table" sections with real data.

### B. Core Page Styling & Structure
- [~] Create reusable admin-specific form components if beneficial. *(Created CategoryForm, FormField. DiscountForm and LowStockReport refactored. Further generalization can be reviewed.)*
- **Refactor Key Admin Pages with Tailwind CSS:**
  - [X] `admin/users/index.vue`
  - [X] `admin/products/index.vue`
  - [X] `admin/products/new.vue / edit/[id].vue`
  - [X] `admin/orders/index.vue / [id].vue`
  - [X] `admin/reports/low-stock.vue` *(Refactored to Tailwind)*
  - [X] `admin/discounts` pages via `DiscountForm.vue` *(Refactored to Tailwind)*
  - (Other admin pages as they are developed).

### C. Layout & Navigation
- Add SVG icons to all `AdminSidebar.vue` navigation items. *(DONE)*
- [X] Implement breadcrumb navigation within the admin section.
- [X] Implement a functional global search bar in the top admin bar (UI and navigation to search page implemented; backend search logic pending). *(Verified UI exists and navigates)*
- [X] Add notification icon/dropdown placeholder in top admin bar.
- Consider more sophisticated collapse mechanism for the sidebar (e.g., icon-only view).

### D. Category Management
- Create `frontend/pages/admin/categories/index.vue`. *(DONE)*
- Create `frontend/pages/admin/categories/new.vue`. *(DONE, refactored to use CategoryForm)*
- Create `frontend/pages/admin/categories/edit/[id].vue`. *(DONE, refactored to use CategoryForm)*

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
- [X] Create `frontend/pages/admin/reports/index.vue` (as a dashboard for various reports). *(Exists as navigation page, added Stock Valuation link)*

### II.I Inventory Management UI (New Section)
*   `[X] Admin Sidebar Menu: "Inventory" collapsible menu with links to Stock Levels, Batch Management, Stock Adjustments, Movement Logs.`
*   `[X] Stock Levels Page (`/admin/inventory/index.vue`): Displays products/variants with stock quantities and reorder thresholds. Includes filtering (search, category, supplier, low stock) and pagination. (Backend API: `GET /api/admin/products/stock-levels`).`
*   `[X] Batch Management Page (`/admin/inventory/batches.vue`): Lists inventory batches with filtering, sorting, and pagination. Includes modal for editing batch details (quantity, expiry, number, reason). (Backend API: `GET /api/admin/inventory-batches`, `PUT /api/admin/inventory-batches/:batchId`).`
*   `[X] Stock Adjustments Page (`/admin/inventory/adjustments.vue`): Provides forms for "Write-Off / Other Adjustments" and "Physical Count" submissions. (Backend API: `POST /api/admin/stock-adjustments/...`).`
*   `[X] Stock Movement Logs Page (`/admin/inventory/logs.vue`): Displays stock movement logs with filtering, sorting, and pagination. (Backend API: `GET /api/admin/stock-movement-logs`).`

### II.J Tax Management UI (New Section)
*   `[X] Admin Sidebar Menu: "Tax Management" collapsible menu with links to Tax Overview, Tax Classes, Tax Rates.`
*   `[X] Tax Overview Page (`/admin/taxes/index.vue`): Placeholder created.`
*   `[X] Tax Classes Pages (`/admin/taxes/classes/...`): Full CRUD UI for Tax Classes (list, new, edit). Edit page includes functionality to list, link, and unlink Tax Rates to/from a Tax Class. (Backend API: `GET /api/admin/tax-classes`, `POST /api/admin/tax-classes`, `GET /api/admin/tax-classes/:id`, `PUT /api/admin/tax-classes/:id`, `DELETE /api/admin/tax-classes/:id`, plus rate linking endpoints).`
*   `[X] Tax Rates Pages (`/admin/taxes/rates/...`): Full CRUD UI for Tax Rates (list, new, edit). (Backend API: `GET /api/admin/tax-rates`, `POST /api/admin/tax-rates`, `GET /api/admin/tax-rates/:id`, `PUT /api/admin/tax-rates/:id`, `DELETE /api/admin/tax-rates/:id`).`

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
  - [X] `admin/reports/low-stock.vue` *(Refactored to Tailwind)*
  - [X] Discount form component and its pages. *(Refactored to Tailwind)*
  - (Other admin pages as they are developed).

### C. Layout & Navigation
- Add SVG icons to all `AdminSidebar.vue` navigation items. *(DONE)*
- [X] Implement breadcrumb navigation within the admin section. *(Verified existing)*
- [X] Implement a functional global search bar in the top admin bar (for searching orders, products, users etc.). *(UI/navigation exists)*
- [X] Add notification icon/dropdown placeholder in top admin bar.
- Consider more sophisticated collapse mechanism for the sidebar (e.g., icon-only view).

### H. Reporting (Admin UI)
  - [X] Consider UI for Low Stock Report (linked to "Reorder threshold alerts" in Core Modules). *(Exists, styling refactored)*
  - [~] Consider UI for Stock Valuation Report. *(UI placeholder created, backend needed)*
  - [X] Consider UI for Inventory History/Audit Trail Report. *(Covered by existing Stock Movement Logs page)*

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

---

# Theming Implementation (New Palette & UI Suggestions)

- **[X] Setup and Configuration:**
  - [X] Updated `tailwind.config.js` with the new color palette:
    - Peach Pink: `#FC7099` (primary)
    - Sky Blue: `#26A7E2` (secondary)
    - Fresh Green: `#5BAA41` (secondary)
    - Lemon Yellow: `#F9D849` (accent)
    - Orange Gold: `#F6A03C` (accent)
    - Neutral Soft BG: `#FFF5F8` (neutral-bg-soft)
    - Sky Blue Deep: `#17729D` (for admin sidebar bg)
  - [X] Updated logo references to `/Logo.svg` (assuming `frontend/public/Logo.svg`).
- **[X] Global Styling:**
  - [X] Ensured main page backgrounds default to white (`bg-white`).
  - [X] Standardized default text color to `text-venus-text-primary` (`#1a1a1a`).
- **[X] Public E-commerce Website Styling:**
  - [X] **Header (`AppHeader.vue`):** White background, Peach Pink hover underlines for nav links, themed action icons and auth buttons.
  - [X] **Top Bar (`HeaderTopBar.vue`):** Sky Blue background, white text, Peach Pink link hover.
  - [X] **Buttons (General):** Primary actions (e.g., Sign Up, Add to Cart, Place Order, main form submits) use `bg-peach-pink text-white rounded-md`. Secondary/accent buttons use Sky Blue or neutrals.
  - [X] **Product Cards (`ProductCard.vue`):** White base, Sky Blue category text, Orange Gold price text, Peach Pink border hover, Orange Gold sale tag.
  - [X] **Hero Banner (`HeroBanner.vue`):** Changed to solid Peach Pink background with white text and contrasting button.
  - [X] **Promotional Banners (`PromotionalBanner.vue`):** Primary type uses `bg-peach-pink text-white`; secondary uses `bg-sky-blue text-white`.
  - [X] **Auth Pages (`login.vue`, `register.vue`):** Themed background (`neutral-bg-soft`), logo, input focus rings (Peach Pink), primary buttons (Peach Pink), and links (Peach Pink).
  - [X] **Cart Page (`cart.vue`):** Themed titles, placeholders, buttons, summary section (totals, borders, discount display), and input focus rings.
  - [X] **Checkout Page (`checkout.vue`):** Themed titles, placeholders, order summary (background, text, totals, borders), form section titles, input focus rings, checkbox, and "Place Order" button.
  - [X] **Footer (`AppFooter.vue`):** Background `bg-sky-blue-deep`, `text-neutral-100`, Peach Pink link hovers.
- **[X] Admin Panel Styling:**
  - [X] **Layout (`admin.vue`, `AdminSidebar.vue`):**
    - Sidebar: `bg-sky-blue-deep`, `text-neutral-100`, Peach Pink for active/hover link states and title hover. Logo updated.
    - Top Bar: White background, Peach Pink for interactive element hovers/focus rings.
  - [X] **Forms (Product, Category, Discount, User Management):** Updated primary buttons and input focus rings to Peach Pink.
  - [X] **Stat Cards (`StatCard.vue` & `admin/index.vue`):** Icon backgrounds/text themed with new palette (Peach Pink, Sky Blue, Fresh Green, Orange Gold accents). Value hover to Peach Pink.
  - [X] **User Management Page (`admin/users/index.vue`):** Themed tabs, "Create User" buttons, table headers.
- **[X] Invoice PDF Template (Backend - `pdfService.js`):**
  - [X] Injected CSS styles into `getInvoiceHtml` to use theme colors: Peach Pink for header accents/main title, Sky Blue for address titles/table headers, Orange Gold for grand total.
  - [X] Ensured structure supports company logo (via `company_logo_url` from `adminOrders.js`, which now has updated placeholders if ENV vars are not set).

---

# Theme Change Errata & Unresolved Issues

- **[~] Persistent Frontend Error (Believed Resolved):** `InvalidCharacterError: Failed to execute 'setAttribute' on 'Element': '<!--' is not a valid attribute name.`
  - **Context:** This error appeared after initial theming. It occurred during component updates (Cart page, Admin layout).
  - **Suspected Cause:** Misplaced HTML comments within tag definitions.
  - **Fixes Applied:**
    - Multiple reviews and corrections of HTML comment placements in themed `.vue` files (esp. `cart.vue`, `admin.vue`, `StatCard.vue`).
    - Sanitization of product data for attributes in `ProductCard.vue` and `cart.vue`.
  - **Current Status (as of last interaction):** Believed to be resolved after targeted fixes to comment syntax and product data sanitization, particularly in `cart.vue`. User confirmation pending on all cart functionalities.
- **[~] Cart Navigation & Rendering (Believed Resolved):**
    - **Issue:** Cart page not loading content or failing navigation when items were present.
    - **Fixes:** Addressed potential TypeErrors in `useCart.js` computed properties and `cart.vue` template for `.toFixed()` calls. Systematically debugged `cart.vue` rendering by commenting/uncommenting sections, leading to the fix for the `InvalidCharacterError`.
    - **Current Status:** User reported the simplified cart and then the cart with most details (including summary without action buttons) were loading. The final fix for `InvalidCharacterError` (related to action button comments) should allow full cart functionality. User to verify.
- **Admin Dashboard - Stat Cards Missing (Reported, then addressed):**
    - Issue: StatCards were reported missing.
    - Fix: Wrapped StatCard grid in `v-else` for `v-if="statsError"`. This issue is likely resolved. User to verify.
- **Admin Layout - Duplicate Sidebar / Content Misplacement (Reported, then addressed):**
    - Issue: Content (including a second sidebar) was appearing at the bottom of the main sidebar.
    - Fix: Reverted a speculative `lg:w-[calc(...)]` style from the main content wrapper in `admin.vue`. This issue is likely resolved. User to verify.

---

## Purchase Order Feature Improvements

### UI/UX Enhancements (Purchase Order Creation/Editing)

1.  **Searchable Product Dropdown:**
    *   Instead of a simple `<select>` for products (currently limited to 100 per supplier), implement a searchable dropdown component (e.g., using libraries like `vue-select`, `choices.js`, or a custom-built one).
    *   This would allow users to type product names or SKUs to quickly find items, especially if a supplier has many products.
    *   Could include server-side searching if the product list per supplier is very large (beyond a few hundred).

2.  **Display Product Details on Selection:**
    *   When a product is selected in a line item, automatically populate not just the name/SKU but also other relevant info like current stock (for reference), last cost price (if available and desired as a default), or even a small thumbnail.

3.  **Supplier Details Display:**
    *   Once a supplier is selected, display some key details about them on the form (e.g., supplier contact info, address, default currency if applicable) for quick reference.

4.  **Automatic Calculation of Line Totals & Grand Total:**
    *   As quantity and unit cost are entered for each line item, automatically calculate and display the line total (`quantity * unit_cost`).
    *   Calculate and display a running grand total for the entire PO.

5.  **Prevent Duplicate Products in Line Items:**
    *   Optionally, add logic to warn or prevent the user from adding the exact same product multiple times as separate line items (they should typically just adjust the quantity on the existing line).

6.  **Batch Actions for Line Items:**
    *   E.g., "Remove selected items", "Apply X% discount to selected items" (if discounts on POs are a feature).

7.  **Improved Date Pickers:**
    *   Use a more user-friendly date picker component if the native browser ones are not ideal for your users.

8.  **Clearer Loading/Error States:**
    *   Ensure all async operations (supplier select, product select, submission) have clear visual feedback.

### Backend/Functionality Enhancements

1.  **Supplier-Specific Product Codes/Costs:**
    *   Allow storing supplier-specific product codes (their part number for your product) and default cost prices for each product from that supplier. When creating a PO, these could auto-populate.

2.  **PO Templates/Recurring POs:**
    *   Ability to save a PO as a template for frequently ordered items from a supplier.
    *   Functionality for setting up recurring POs.

3.  **PO Approval Workflow:**
    *   If needed, implement a system where POs above a certain value or for certain items require approval from another user/role before being sent.

4.  **Emailing PO to Supplier:**
    *   Functionality to generate a PDF of the PO and email it directly to the supplier from the system.

5.  **Partial Receipts & Backorders:**
    *   The current receiving logic seems to handle partial receipts at the item level. Ensure the overall PO status (`pending`, `ordered`, `partially_received`, `received`, `cancelled`) accurately reflects this across all items.
    *   Consider how backordered items are managed.

6.  **Landed Costs:**
    *   Ability to add landed costs (shipping, duties, customs fees) to a PO or to received items to get a more accurate inventory valuation.

7.  **Integration with Inventory Adjustments:**
    *   Ensure that receiving PO items correctly and robustly updates inventory levels, including logging stock movements (which seems to be in place with `stock_movement_logs` and `inventory_batches`).

8.  **PO Number Generation:**
    *   Implement a configurable PO number generation system (e.g., prefix + sequential number).

9.  **Reporting on POs:**
    *   More detailed reports: POs by supplier, by status, items pending receipt, cost analysis over time, etc.

10. **Link POs to Sales Orders (for dropshipping/back-to-back orders):**
    *   If you fulfill orders by ordering directly from a supplier for a specific customer sale.

11. **Currency Handling:**
    *   If dealing with suppliers in different currencies, ensure robust handling of currency codes, exchange rates at time of order and receipt, and proper calculation of base currency costs.

---

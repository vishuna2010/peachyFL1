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
    - [~] **Refund Processing (Admin):** (Backend endpoint and service logic exist, UI may need more work for partial refunds)
        - [X] Phase 1: Implement backend endpoint and service logic for full/partial (mock) refunds. Update order/payment status, adjust product/variant stock (simplified), create stock movement & audit logs. Use `orders:manage_refunds` permission.
        - [ ] Phase 2: UI for partial refunds (item selection, amounts) - if not already comprehensive.
        - [ ] Phase 3: Integrate with actual payment gateway for refund transactions.
7.  **Barcode / QR Scanning Support**
    - [ ] Mobile or USB scanner support
    - [ ] Use QR codes for fast lookups or reorders

### A. Foundational: Product Variants & Options (Existing)
- [X] Full backend logic for product variants (options, values, variants, specific configurations).
- [X] Ensure variants correctly impact SKU, price, and stock quantity.
- [X] API endpoints for managing options and variants associated with products.
- [X] Update public product API (`GET /api/products/:id`) to return variant info.

### B. Foundational: Core User Features (Existing)
- [X] API endpoint for "Change Password".
- [X] Define updatable "Profile Details" and create corresponding API endpoint(s).

### C. Foundational: Customer Reviews & Ratings (Existing)
- [X] Database schema for reviews.
- [X] API endpoints for submitting reviews.
- [X] API endpoints for retrieving (paginated) approved reviews for a product.
- [X] Admin API endpoints for moderating reviews (list, update status, delete).
- [X] Logic for calculating and storing average ratings / review counts on products table.
- [X] API endpoint for user to get their own review for a product.

### D. Other Backend Enhancements (Existing & Future)
- **Advanced Shipping & Tax Calculation:**
  - [ ] Develop or integrate modules for complex shipping cost calculations.
  - [X] Implement tax calculation logic. (Core tax engine implemented)
- **Payment Gateway Integration (Major Feature):**
  - [ ] Integrate Stripe or PayPal for actual payment processing.
  - [X] **Mock Payment Flow (Checkout Page):** (Backend support and UI for mock payment exist)
    - [X] Phase 1: Implement UI changes on checkout page for a mock payment step. Modify order creation to reflect "paid" status if mock payment is confirmed.
- [X] Email Templating:
  - [X] Phase 1: Implement EJS templating for Order Confirmation email (HTML).
- **Search API Refinements:**
  - [~] Enhance product search (`GET /api/products`) for better partial match performance.
    - [X] Phase 1: Implemented case-insensitive partial matching (ILIKE).
    - [ ] Phase 2: Consider PostgreSQL full-text search or `pg_trgm`.

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
        - [X] Admin Orders module (`adminOrders.js` - List, GetByID, UpdateStatus, GetPDFData, ProcessRefund)
        - [X] Admin Purchase Orders module (`adminPurchaseOrders.js` - All existing routes)
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
        - [X] Admin Users module (`userService.js`)
        - [X] Admin Orders module (`orderService.js` - List, GetByID, UpdateStatus, GetPDFData, ProcessRefund)
        - [X] Admin Purchase Orders module (`purchaseOrderService.js` - All existing routes refactored)
        - [X] Admin Reviews module (`adminReviews.js` -> `reviewService.js`)
        - [X] Admin Reports module (`adminReports.js` - for complex queries -> `reportService.js`)
        - [X] Admin Stock Adjustments module (`adminStockAdjustments.js` -> `inventoryService.js`)
        - [X] Admin Inventory Batches module (`adminInventoryBatches.js` - PUT route -> `inventoryService.js` or `productService.js`)
        - [X] Admin Tax Classes module (`adminTaxClasses.js` -> `taxService.js` or new service)
        - [X] Admin Tax Rates module (`adminTaxRates.js` -> `taxService.js` or new service)
        - [X] Public User Profile routes (`users.js` -> `userService.js`)
        - [X] Public Order creation route (`orders.js` -> `orderService.js`)
        - [~] Other public routes with DB logic as identified.
            - [X] `POST /api/cart/validate-discount` (moved to `discountService.js`)
            - [X] `POST /api/cart/calculate-taxes` (user fetching part moved to `userService.js`)
            - [X] `GET /api/categories` (moved to `categoryService.js`)
            - [X] `GET /api/options/public-filters` (moved to `productService.js`)
            - [X] `GET /api/orders/my-history` and `GET /api/orders/my-history/:orderId` (moved to `orderService.js`)
            - [X] Public review routes in `reviews.js` (submit, get user's, list approved) moved to `reviewService.js`
    - [~] Review and ensure comprehensive transaction management for all multi-step DB operations.
        - [X] Addressed in C/U/D methods of `categoryService.js`.
        - [X] Addressed in C/U/D methods of `discountService.js`.
        - [X] Addressed in C/U/D methods of `supplierService.js`.
        - [X] Addressed in C/U/D methods of `productService.js` (including product and variant C/U/D operations).
        - [X] Addressed in C/U/D methods of `userService.js`.
        - [X] Addressed in C/U/D methods of `orderService.js` (status update, refund).
        - [X] Addressed in C/U/D methods of `purchaseOrderService.js` (create PO with items, receive stock, item C/U/D).
        - [ ] Broader review for overall transactional integrity in remaining complex operations (e.g., public order processing, stock adjustments).
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
- [X] Enhance `seed.js` to add sample products with variants and reviews.
- [X] Major `seed.js` overhaul: Implemented full schema creation and comprehensive sample data.
- [X] Updated `seed.js` `createSchema` for PO delivery tracking, `inventory_batches`, and sample data.
- [X] CRITICAL: Review and fix `seed.js` `createSchema` for robust column additions.
  - [X] Phase 1: Refactored `createSchema` for robust column additions.
  - [X] Phase 1a: Ensured unique index on `product_variants.sku`.
  - [X] Phase 1b: Ensured unique constraint/index on `product_images(product_id, image_url)`.
- [X] Updated `seed.js` `createSchema` for `users` table to include email verification fields (`email_verification_token`, `email_verification_token_expires_at`, `is_email_verified`).

## IV. Tax Engine & Invoicing Module (New Specification)
(This section remains largely unchanged as it was mostly [X] already)
...

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

## 🔔 Notifications & Email Features (To Implement & Verify)
- [X] **Email Template Theming:** Applied consistent color palette and branding to all EJS email templates.
- **Welcome Email**
  - [~] Sent immediately after user signs up
    - [X] Core functionality implemented (EJS template, emailService function, integration with registration).
    - [X] Theming with site colors applied.
    - [ ] Consider enhancing user name personalization if registration collects a full name.
- **Two-Factor Authentication (2FA)**
  - [X] Email-based code for signup validation
    - [X] User registration updated to generate/store verification token & expiry.
    - [X] Email service sends verification code upon registration.
    - [X] New `/api/auth/verify-email` endpoint created to validate code, mark email as verified, and clear token.
    - [X] Login process updated to block login for unverified emails.
    - [X] Welcome email now sent *after* successful email verification.
- **Order Notifications**
  - Email customer when:
    - [X] Order is placed (covered by existing Order Confirmation email sent after successful order creation)
    - [X] Order is dispatched
      - [X] EJS template `order_dispatched.ejs` created.
      - [X] `emailService.sendOrderDispatchedEmail` function implemented.
      - [X] Integrated into `orderService.updateOrderStatus` when status becomes 'shipped'.
      - [X] `orders` table schema in `seed.js` updated with `shipping_carrier`, `tracking_number`.
      - [X] Admin route `PUT /admin/orders/:id/status` and validators updated for tracking info.
      - [X] Theming with site colors applied.
    - [X] Order is delivered
      - [X] EJS template `order_delivered.ejs` created.
      - [X] `emailService.sendOrderDeliveredEmail` function implemented.
      - [X] Integrated into `orderService.updateOrderStatus` when status becomes 'delivered'.
      - [X] Theming with site colors applied.
- **Invoice Notifications**
  - [~] Automatically generate and email invoices to customers upon order confirmation
    - [X] EJS template `invoice_email.ejs` for email body created.
    - [X] `emailService.sendInvoiceEmail` function implemented to send email with PDF attachment.
    - [X] Integrated into `POST /api/orders` route: after order creation, PDF is generated and invoice email is sent.
    - [X] Theming of email body template applied.
    - [ ] Review if PDF invoice content itself needs theming/updates.
- **Tracking Updates**
  - Email customer when:
    - [X] Order is dispatched (with tracking link or number) (Covered by 'Order Dispatched' email notification)
    - [X] Order is delivered (Covered by 'Order Delivered' email notification)
- **QR Code for Delivery Confirmation**
  - New feature:
    - [X] Attach a QR code to each invoice
      - [X] `orderService.getOrderDetailsForPdf` updated to generate a `delivery_confirmation_qr_url` using a deterministic HMAC token.
      - [X] `pdfService` updated to generate QR code from this URL and embed it in the invoice PDF.
    - [ ] Delivery person scans QR at hand-off (Assumed physical process)
    - [X] Triggers delivery confirmation in system
      - [X] Created `GET /api/public/delivery/confirm` endpoint.
      - [X] Endpoint validates `orderId` and HMAC `token`.
      - [X] Updates order status to 'delivered' and sets `delivery_confirmed_at`.
      - [X] Returns HTML response for success/failure.
      - [X] Added `delivery_confirmed_at` to `orders` table schema.
      - [X] Implemented `generateDeliveryConfirmationToken` and `validateDeliveryConfirmationToken` utilities.
      - [X] Added `DELIVERY_CONFIRMATION_SECRET` to config.

---

## 📦 Fulfillment Features
- **Print Shipping Label**
  - [ ] Generate and print shipping label per order
  - Include:
    - [ ] Recipient name/address
    - [ ] Tracking number
    - [ ] Barcode or QR code (if supported by courier)

---

## 💸 Refund System
- **Refund Notification**
  - Email customer for:
    - [ ] Full refunds
    - [ ] Partial refunds
  - [ ] Include refund details in email

---

## 📢 Marketing Emails
- **Email Marketing Integration**
  - [ ] Design promotional and newsletter templates
  - [ ] Segment user base (e.g., by activity, order history)

---

## 🧾 Invoice Design
- **Invoice Layouts**
  - [ ] Create customizable invoice templates with:
    - [ ] Branding (logo, colors)
    - [ ] Tax & pricing details
    - [ ] Optional QR for delivery scanning
    - [ ] Custom line item notes
---

# Project To-Do List

## Inventory Control Features

### I. Dashboard / Overview
- **A. Inventory Summary:**
  - 1. View key inventory metrics (e.g., total inventory value, number of SKUs, low stock items).
  - 2. Quick links to common inventory operations.
- **B. Recent Activity:**
  - 1. Log of recent inventory adjustments, stock movements, PO updates.

### II. Products / Stock Management
- **A. Stock Levels:**
  - 1. View current stock levels for all products and variants.
  - 2. Filter by product, category, supplier, stock status (in stock, low stock, out of stock).
  - 3. Search by SKU or product name.
  - 4. Quick view of committed stock (from open orders) vs. available stock.
- **B. Manual Stock Adjustments:**
  - 1. Adjust stock quantity for a product/variant with reason codes (e.g., cycle count, damage, promotion, return).
  - 2. View history of adjustments for a specific item.
- **C. Stock Takes / Cycle Counting:**
  - 1. Initiate and manage stock take processes.
  - 2. Enter counted quantities and view discrepancies.
  - 3. Approve adjustments post-count.
- **D. Product Reorder Thresholds:**
  - 1. Set and manage reorder points/thresholds for each product/variant (already partially in `products` table, UI needed).
  - 2. View items at or below their reorder threshold (Low Stock Report also covers this).
- **E. Stock Movement Tracking (Advanced):**
  - 1. Track stock transfers between different locations/warehouses (if multi-location becomes a feature).
  - 2. View history of stock movements for an item.

### III. Purchase Orders (POs)
- **A. Manage Purchase Orders:**
  - 1. Create new POs for suppliers.
  - 2. Add products/variants to POs with quantities and costs.
  - 3. View list of all POs (filterable by status: Draft, Sent, Partially Received, Received, Cancelled).
  - 4. Edit existing POs (if status allows).
  - 5. Send POs to suppliers (e.g., generate PDF, email functionality).
- **B. Receiving Stock (Goods In):**
  - 1. Receive items against a PO.
  - 2. Update stock levels based on received quantities.
  - 3. Handle partial receipts.
  - 4. Record supplier invoice numbers and delivery details.
- **C. Purchase Order History & Reporting:**
  - 1. View detailed history of a specific PO.

### IV. Suppliers
- **A. Manage Suppliers:**
  - 1. Add, edit, view supplier information (name, contact, address, terms). (Existing CRUD seems to be in place).
  - 2. Link products to suppliers (already part of product creation/edit).
- **B. Supplier Performance (Advanced):**
  - 1. Track supplier lead times, order accuracy (future enhancement).

### V. Inventory Reporting
- **A. Low Stock Report:**
  - 1. List all items at or below their reorder threshold. (Existing backend endpoint).
- **B. Stock Valuation Report:**
  - 1. Report showing current stock levels and their value (based on cost price or purchase price).
- **C. Inventory History/Audit Trail Report:**
  - 1. Detailed log of all stock movements, adjustments, and changes for a specific period or item.
- **D. Sales Velocity Report (Advanced):**
  - 1. Report showing how quickly items are selling to help with reordering decisions.
- **E. Dead Stock Report (Advanced):**
  - 1. Report identifying items that haven't sold for a specified period.

### VI. Settings (Inventory Specific)
- **A. Default Units of Measure.**
- **B. Reason Codes for Stock Adjustments.**
- **C. Warehouse/Location Management (if multi-location is added).**

---
*This todo list will be updated as features are implemented or new requirements arise.*

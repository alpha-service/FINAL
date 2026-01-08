# ALPHA&CO POS System - Product Requirements Document

## Project Overview
**Name:** ALPHA&CO POS — BOUWMATERIALEN & DESIGN  
**Type:** Point of Sale Web Application for Building Materials Store  
**Location:** Ninoofsesteenweg 77-79, 1700 Dilbeek, Belgique  
**VAT:** BE 1028.386.674

## Tech Stack
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **PDF Generation:** jsPDF

## User Personas
1. **Cashier** - Primary user, tablet-first workflow, needs fast product search and payment
2. **Manager** - Oversees sales, accesses reports
3. **Admin** - Full system access, configuration

## Core Requirements (Static)
- Tablet-first responsive design
- Bilingual: French (FR) + Dutch (NL)
- Invoice numbering: YYMMDD-XXX format
- VAT rate: 21%
- Payment methods: Cash, Card, Bank Transfer

## What's Been Implemented

### Sprint 1 (MVP - Completed 2026-01-08)
✅ **POS Sales Screen**
- 2-column layout: products grid (left), sticky cart (right)
- Product search by SKU, name_fr, name_nl
- Category filters: Tuyaux/Buizen, Fixations/Bevestigingen, Isolation/Isolatie, Outils/Gereedschap
- Responsive mobile cart drawer

✅ **Cart Functionality**
- Add products with toast notification
- Quantity +/- controls, Remove items
- Line discounts (% or fixed)
- Global discount (KORTING button)

✅ **Customer Selection**
- Search customers by name/phone/VAT
- Display customer type (Individual/Company)
- Credit limit display

✅ **Payment Processing**
- Payment modal with Cash/Card/Bank transfer options
- Quick cash amount buttons (€10, €20, €50, €100, €200, Exact)
- Change calculation for cash payments
- Partial payment support

✅ **PDF Receipt Generation**
- A4 format with ALPHA&CO branding
- Invoice number, date, customer info
- Item table with SKU, description, qty, price, discount, total
- Subtotal, VAT (21%), Total
- Payment method display
- IMPAYÉ watermark for unpaid invoices

### Phase 2 (Operations Backbone - In Progress)

✅ **Data Model Expansion**
- Unified Document model (Quote, Invoice, Receipt, Proforma, Credit Note, Delivery Note)
- Document status tracking (Draft, Sent, Accepted, Unpaid, Partially Paid, Paid, Cancelled, Credited)
- Shift management with cash movements
- Stock movements ledger
- Shopify integration models (Settings, Sync Logs, Unmapped Products)

✅ **Backend API Enhancements**
- `/api/documents`: Unified CRUD for all document types
- `/api/documents/{id}/convert`: Convert quotes to invoices
- `/api/documents/{id}/duplicate`: Duplicate existing documents
- `/api/returns`: Process returns and generate credit notes
- `/api/shifts`: Open/close shifts, cash movements, Z reports
- `/api/stock-movements`: Track all stock changes
- `/api/stock-alerts`: Low stock notifications
- `/api/shopify/*`: Shopify integration endpoints (settings, sync products/stock/orders, unmapped products)
- Peppol placeholder endpoint

✅ **Frontend Pages Scaffolded**
- **Sales History** (`/sales`): View past sales with filters (status, payment, search), return processing
- **Documents Hub** (`/documents`): Central view for all document types with tabs, conversion actions
- **Document Detail** (`/documents/:id`): Individual document view with payment actions
- **Cash Register** (`/cash-register`): Shift management, cash movements, Z report generation
- **Inventory** (`/inventory`): Stock tracking, movements ledger, alerts
- **Settings** (`/settings`): Hardware (Printer, Scanner), Peppol, Shopify configuration

✅ **Shopify Integration (MVP Foundation)**
- Settings configuration (store domain, access token, sync toggles)
- Manual sync triggers (import products, push stock, import orders)
- Sync logs tracking
- Unmapped products queue for manual mapping
- Product origin tracking (local vs Shopify)
- Shopify variant ID mapping

✅ **UI/UX Improvements**
- MainLayout with sidebar navigation
- Shift status indicator
- Stock alerts badge
- Fixed Emergent badge overlap issue

## Prioritized Backlog

### P0 (Critical - Sprint 2)
- [ ] Customers module: Create/Edit customers
- [ ] Credit/Partial payments with debt tracking
- [ ] Invoice status management (Draft/Unpaid/Paid/Partially Paid)
- [ ] Daily Z report with VAT breakdown

### P1 (High Priority - Sprint 3)
- [ ] Admin sales list with filters (date, client, status, amount)
- [ ] Export functionality (CSV, PDF)
- [ ] User authentication (Supabase Auth + PIN for cashiers)
- [ ] Audit logging for critical actions

### P2 (Medium Priority - Future)
- [ ] Multi-warehouse stock management
- [ ] Supplier purchases module
- [ ] Hardware integrations (ESC/POS printers, barcode scanners)
- [ ] Dark mode support

## Next Action Items
1. Implement Customer CRUD (Create/Edit forms)
2. Add invoice status management
3. Build daily sales report (Z report)
4. Connect to real Supabase instance

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

### Sprint 1 (Completed - 2026-01-08)
✅ **POS Sales Screen**
- 2-column layout: products grid (left), sticky cart (right)
- Product search by SKU, name_fr, name_nl
- Category filters: Tuyaux/Buizen, Fixations/Bevestigingen, Isolation/Isolatie, Outils/Gereedschap
- Responsive mobile cart drawer

✅ **Cart Functionality**
- Add products with toast notification
- Quantity +/- controls
- Remove items
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

✅ **Backend API**
- Products CRUD: GET /api/products, search, filter by category
- Categories: GET /api/categories
- Customers: GET /api/customers, search
- Sales: POST /api/sales, GET /api/sales
- Stock auto-decrement on sale

✅ **Seed Data**
- 50 products across 4 categories
- 10 customers (5 individual, 5 company)

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

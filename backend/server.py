from fastapi import FastAPI, APIRouter, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ALPHA&CO POS API")
api_router = APIRouter(prefix="/api")

# ============= ENUMS =============
class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"

class DocumentType(str, Enum):
    QUOTE = "quote"  # Devis
    INVOICE = "invoice"  # Facture
    RECEIPT = "receipt"  # Ticket de caisse
    PROFORMA = "proforma"
    CREDIT_NOTE = "credit_note"  # Note de crédit / Bon d'avoir
    DELIVERY_NOTE = "delivery_note"  # Bon de livraison
    PURCHASE_ORDER = "purchase_order"  # Bon de commande

class DocumentStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"  # For quotes
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    CANCELLED = "cancelled"
    CREDITED = "credited"

class CustomerType(str, Enum):
    INDIVIDUAL = "individual"
    COMPANY = "company"

class Unit(str, Enum):
    PIECE = "piece"
    METER = "meter"
    M2 = "m²"
    BOX = "box"

class StockMovementType(str, Enum):
    SALE = "sale"
    RETURN = "return"
    ADJUSTMENT = "adjustment"
    PURCHASE = "purchase"
    TRANSFER = "transfer"
    DELIVERY = "delivery"  # For delivery notes

class ShiftStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"

class CashMovementType(str, Enum):
    CASH_IN = "cash_in"
    CASH_OUT = "cash_out"
    SALE = "sale"
    REFUND = "refund"

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    CASHIER = "cashier"
    VIEWER = "viewer"

class ProductOrigin(str, Enum):
    LOCAL = "local"
    SHOPIFY = "shopify"

class ShopifySyncStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    MAPPING_REQUIRED = "mapping_required"

# ============= MODELS =============
class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_fr: str
    name_nl: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[str] = None  # For hierarchy
    shopify_collection_id: Optional[str] = None
    active: bool = True
    product_count: int = 0  # Will be calculated dynamically

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    barcode: Optional[str] = None  # EAN-13, UPC, etc.
    gtin: Optional[str] = None  # Global Trade Item Number (EAN/UPC)
    name_fr: str
    name_nl: str
    description_fr: Optional[str] = None
    description_nl: Optional[str] = None
    category_id: str
    unit: Unit
    price_retail: float
    price_wholesale: Optional[float] = None
    price_loyal: Optional[float] = None
    compare_at_price: Optional[float] = None  # Prix barré (ancien prix)
    cost_price: Optional[float] = None  # Prix d'achat
    vat_rate: float = 21.0
    stock_qty: int = 0
    min_stock: int = 0
    # Physical attributes
    weight: Optional[float] = None  # Poids en kg
    weight_unit: str = "kg"  # kg, g, lb
    length: Optional[float] = None  # cm
    width: Optional[float] = None  # cm
    height: Optional[float] = None  # cm
    depth: Optional[float] = None  # cm (profondeur)
    size: Optional[str] = None  # Taille (S, M, L, XL, etc.)
    color: Optional[str] = None  # Couleur
    material: Optional[str] = None  # Matériau
    # Metafields from Shopify (dimensions, custom attributes)
    metafields: Optional[dict] = None  # {"dimension": "50x100cm", "capacity": "500ml", ...}
    variant_title: Optional[str] = None  # "XL / Blue" from Shopify variant
    # Shopify fields
    vendor: Optional[str] = None  # Marque / Fournisseur
    tags: Optional[str] = None  # Tags séparés par virgule
    product_type: Optional[str] = None  # Type de produit Shopify
    collection_ids: Optional[List[str]] = None  # IDs des collections Shopify
    image_url: Optional[str] = None
    origin: ProductOrigin = ProductOrigin.LOCAL
    shopify_variant_id: Optional[str] = None
    shopify_product_id: Optional[str] = None
    shopify_inventory_item_id: Optional[str] = None
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: CustomerType
    name: str
    # Peppol identifiers
    peppol_id: Optional[str] = None  # Format: 0208:BE0123456789
    endpoint_id: Optional[str] = None  # Electronic Address Identifier
    company_id: Optional[str] = None  # Numéro BCE/KBO (différent du TVA)
    vat_number: Optional[str] = None
    # Contact
    contact_name: Optional[str] = None  # Personne de contact
    phone: Optional[str] = None
    email: Optional[str] = None
    # Adresse structurée (Peppol compliant)
    street_name: Optional[str] = None
    building_number: Optional[str] = None
    address: Optional[str] = None  # Adresse complète (legacy)
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country_subdivision: Optional[str] = None  # Région/Province
    country: str = "BE"
    # Paiement
    payment_terms_days: int = 30  # Délai de paiement
    bank_account_iban: Optional[str] = None
    bank_account_bic: Optional[str] = None
    bank_account_name: Optional[str] = None  # Nom du titulaire
    # Limites et soldes
    credit_limit: float = 0.0
    balance: float = 0.0  # Negative = owes money
    # Préférences
    language: str = "fr"  # fr, nl
    receive_invoices_by_peppol: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None

# Document Items
class DocumentItemCreate(BaseModel):
    product_id: str
    sku: str
    name: str
    qty: float
    unit: str = "piece"
    unit_price: float
    discount_type: Optional[str] = None
    discount_value: float = 0.0
    vat_rate: float = 21.0

class DocumentItem(DocumentItemCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    line_subtotal: float = 0.0
    line_vat: float = 0.0
    line_total: float = 0.0

# Payments
class PaymentCreate(BaseModel):
    method: PaymentMethod
    amount: float
    reference: Optional[str] = None

class Payment(PaymentCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: Optional[str] = None
    shift_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Documents (unified model for all document types)
class DocumentCreate(BaseModel):
    doc_type: DocumentType
    customer_id: Optional[str] = None
    items: List[DocumentItemCreate]
    payments: Optional[List[PaymentCreate]] = []
    global_discount_type: Optional[str] = None
    global_discount_value: float = 0.0
    notes: Optional[str] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    # For conversions
    source_document_id: Optional[str] = None
    # Credit Note specific fields (Peppol compliant)
    reference_invoice_id: Optional[str] = None  # Required for credit notes - links to original invoice
    credit_reason: Optional[str] = None  # Reason: return, price_error, quantity_error, cancelled
    # Delivery Note specific
    delivery_address: Optional[str] = None
    delivery_contact: Optional[str] = None
    delivery_notes: Optional[str] = None

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: str
    doc_type: DocumentType
    status: DocumentStatus = DocumentStatus.DRAFT
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_vat: Optional[str] = None
    customer_address: Optional[str] = None
    items: List[DocumentItem] = []
    payments: List[Payment] = []
    subtotal: float = 0.0
    vat_total: float = 0.0
    total: float = 0.0
    paid_total: float = 0.0
    global_discount_type: Optional[str] = None
    global_discount_value: float = 0.0
    notes: Optional[str] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    source_document_id: Optional[str] = None
    related_documents: List[str] = []
    shift_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None
    
    # Credit Note specific fields (Peppol BIS CreditNote compliant)
    reference_invoice_id: Optional[str] = None  # Mandatory for credit notes
    reference_invoice_number: Optional[str] = None  # Display number of original invoice
    credit_reason: Optional[str] = None  # return, price_error, quantity_error, cancelled, other
    
    # Delivery Note specific fields
    delivery_address: Optional[str] = None
    delivery_contact: Optional[str] = None
    delivery_notes: Optional[str] = None
    delivered_at: Optional[str] = None
    signed_by: Optional[str] = None
    
    # Stock movement tracking
    stock_movement_created: bool = False
    stock_movement_ids: List[str] = []
    
    # Peppol fields
    peppol_status: Optional[str] = None  # pending, sent, delivered, failed
    peppol_id: Optional[str] = None
    peppol_recipient_id: Optional[str] = None  # e.g., 0208:0123456789
    peppol_sent: bool = False
    peppol_sent_at: Optional[str] = None
    peppol_message_id: Optional[str] = None  # Peppyrus message ID for tracking
    peppol_delivery_status: Optional[str] = None  # From Peppyrus webhook
    peppol_ubl_xml: Optional[str] = None  # Stored UBL XML (optional)

# Shifts
class ShiftCreate(BaseModel):
    opening_cash: float
    cashier_name: Optional[str] = None
    register_number: int = 1  # Caisse 1 ou Caisse 2

class CashMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: CashMovementType
    amount: float
    reason: Optional[str] = None
    reference: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ShiftClose(BaseModel):
    counted_cash: float
    notes: Optional[str] = None

# User/Cashier model
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.CASHIER
    pin_code: Optional[str] = None  # 4-digit PIN for quick login
    is_active: bool = True

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str  # Hashed password
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.CASHIER
    pin_code: Optional[str] = None
    is_active: bool = True
    # Stats
    total_sales: int = 0
    total_revenue: float = 0.0
    total_shifts: int = 0
    last_login: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None

class UserLogin(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    pin_code: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    total_sales: int = 0
    total_revenue: float = 0.0
    total_shifts: int = 0
    last_login: Optional[str] = None
    created_at: str

class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: ShiftStatus = ShiftStatus.OPEN
    register_number: int = 1  # Caisse 1 ou Caisse 2
    cashier_name: Optional[str] = None
    opening_cash: float = 0.0
    closing_cash: Optional[float] = None
    counted_cash: Optional[float] = None
    discrepancy: Optional[float] = None
    cash_movements: List[CashMovement] = []
    sales_count: int = 0
    sales_total: float = 0.0
    cash_total: float = 0.0
    card_total: float = 0.0
    transfer_total: float = 0.0
    refunds_total: float = 0.0
    vat_collected: float = 0.0
    opened_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    closed_at: Optional[str] = None
    notes: Optional[str] = None

# Stock Movements
class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    sku: str
    type: StockMovementType
    qty: float
    reference_type: Optional[str] = None  # document, adjustment
    reference_id: Optional[str] = None
    reason: Optional[str] = None
    stock_before: int = 0
    stock_after: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Returns/Credit Notes
class ReturnItemCreate(BaseModel):
    original_item_id: str
    product_id: str
    sku: str
    name: str
    qty: float
    unit_price: float
    vat_rate: float = 21.0
    reason: Optional[str] = None

class ReturnCreate(BaseModel):
    original_document_id: str
    items: List[ReturnItemCreate]
    refund_method: Optional[PaymentMethod] = None
    notes: Optional[str] = None

# Shopify Integration Models
class ShopifySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_domain: str
    access_token: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    auto_sync_enabled: bool = False
    sync_interval_minutes: int = 10
    import_products_enabled: bool = True
    export_stock_enabled: bool = True
    import_orders_enabled: bool = True
    last_product_sync: Optional[str] = None
    last_stock_sync: Optional[str] = None
    last_order_sync: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ShopifySettingsUpdate(BaseModel):
    store_domain: Optional[str] = None
    access_token: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    auto_sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None
    import_products_enabled: Optional[bool] = None
    export_stock_enabled: Optional[bool] = None
    import_orders_enabled: Optional[bool] = None

class ShopifySyncLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sync_type: str  # product_import, stock_export, order_import
    status: ShopifySyncStatus
    items_processed: int = 0
    items_succeeded: int = 0
    items_failed: int = 0
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UnmappedProduct(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shopify_product_id: str
    shopify_variant_id: str
    title: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price: float
    inventory_qty: int
    reason: str  # missing_sku, duplicate_sku, duplicate_barcode
    shopify_data: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Company Settings (for Peppol/invoicing)
class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Identification
    company_name: str = "ALPHA&CO"
    legal_name: Optional[str] = None  # Raison sociale officielle
    company_id: Optional[str] = None  # Numéro BCE/KBO (ex: 0123.456.789)
    vat_number: Optional[str] = None  # Numéro TVA (ex: BE0123456789)
    # Peppol
    peppol_id: Optional[str] = None  # Format: 0208:BE0123456789
    peppol_endpoint_id: Optional[str] = None
    peppol_enabled: bool = False
    # Adresse
    street_name: Optional[str] = None
    building_number: Optional[str] = None
    address_line: Optional[str] = None  # Adresse complète
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "BE"
    country_name: str = "Belgium"
    # Contact
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    # Banque
    bank_account_iban: Optional[str] = None
    bank_account_bic: Optional[str] = None
    bank_name: Optional[str] = None
    # Logo et branding
    logo_url: Optional[str] = None
    # Mentions légales
    invoice_footer_text: Optional[str] = None
    quote_footer_text: Optional[str] = None
    receipt_footer_text: Optional[str] = None
    default_payment_terms_days: int = 30
    # Timestamps
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Peppyrus Integration Settings
class PeppyrusSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enabled: bool = False
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    api_url: str = "https://api.peppyrus.be"  # Peppyrus API endpoint
    sender_id: Optional[str] = None  # Peppol Sender ID
    test_mode: bool = True  # Sandbox mode
    auto_send_invoices: bool = False  # Auto-send on invoice creation
    last_sync: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Audit Log (for Peppol compliance and traceability)
class AuditLogAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    CONVERT = "convert"  # Quote -> Invoice, etc.
    SEND = "send"  # Peppol send
    PAYMENT = "payment"
    REFUND = "refund"
    STOCK_MOVE = "stock_move"
    STATUS_CHANGE = "status_change"

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: AuditLogAction
    entity_type: str  # document, product, customer, payment, etc.
    entity_id: str
    entity_number: Optional[str] = None  # Document number for reference
    description: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None  # For updates
    new_values: Optional[Dict[str, Any]] = None  # For updates
    metadata: Optional[Dict[str, Any]] = None  # Additional context
    ip_address: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Credit Note creation request
class CreditNoteCreate(BaseModel):
    reference_invoice_id: str  # Required - original invoice ID
    items: List[DocumentItemCreate]  # Items to credit
    credit_reason: str  # return, price_error, quantity_error, cancelled, other
    notes: Optional[str] = None
    restock_items: bool = True  # Whether to add items back to stock
    refund_method: Optional[PaymentMethod] = None  # If immediate refund

# ============= HELPERS =============
async def log_audit(
    action: AuditLogAction,
    entity_type: str,
    entity_id: str,
    description: str,
    entity_number: Optional[str] = None,
    user_name: Optional[str] = None,
    old_values: Optional[Dict] = None,
    new_values: Optional[Dict] = None,
    metadata: Optional[Dict] = None
):
    """Log an action for audit trail (Peppol compliance)"""
    audit = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_number=entity_number,
        description=description,
        user_name=user_name,
        old_values=old_values,
        new_values=new_values,
        metadata=metadata
    )
    await db.audit_logs.insert_one(audit.model_dump())
    return audit

# ============= HELPERS =============
async def generate_document_number(doc_type: DocumentType) -> str:
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    prefix_map = {
        DocumentType.QUOTE: "DV",
        DocumentType.INVOICE: "FA",
        DocumentType.RECEIPT: "RC",
        DocumentType.PROFORMA: "PF",
        DocumentType.CREDIT_NOTE: "CN",
        DocumentType.DELIVERY_NOTE: "BL",
    }
    prefix = prefix_map.get(doc_type, "XX")
    count = await db.documents.count_documents({
        "number": {"$regex": f"^{prefix}{today}"}
    })
    return f"{prefix}{today}-{str(count + 1).zfill(3)}"

def calculate_document_totals(items: List[DocumentItemCreate], global_discount_type: Optional[str], global_discount_value: float):
    calculated_items = []
    subtotal = 0.0
    vat_total = 0.0
    
    for item in items:
        line_subtotal = item.qty * item.unit_price
        if item.discount_type == "percent":
            line_subtotal -= line_subtotal * (item.discount_value / 100)
        elif item.discount_type == "fixed":
            line_subtotal -= item.discount_value
        
        line_vat = line_subtotal * (item.vat_rate / 100)
        line_total = line_subtotal + line_vat
        
        calc_item = DocumentItem(
            **item.model_dump(),
            id=str(uuid.uuid4()),
            line_subtotal=round(line_subtotal, 2),
            line_vat=round(line_vat, 2),
            line_total=round(line_total, 2)
        )
        calculated_items.append(calc_item)
        subtotal += line_subtotal
        vat_total += line_vat
    
    # Apply global discount
    if global_discount_type == "percent":
        discount = subtotal * (global_discount_value / 100)
        subtotal -= discount
        vat_total = subtotal * 0.21
    elif global_discount_type == "fixed":
        subtotal -= global_discount_value
        vat_total = subtotal * 0.21
    
    return calculated_items, round(subtotal, 2), round(vat_total, 2), round(subtotal + vat_total, 2)

async def record_stock_movement(product_id: str, sku: str, movement_type: StockMovementType, qty: float, ref_type: str = None, ref_id: str = None, reason: str = None):
    product = await db.products.find_one({"id": product_id})
    if not product:
        return
    
    stock_before = product.get("stock_qty", 0)
    stock_change = qty if movement_type in [StockMovementType.RETURN, StockMovementType.PURCHASE, StockMovementType.ADJUSTMENT] else -qty
    stock_after = stock_before + int(stock_change)
    
    movement = StockMovement(
        product_id=product_id,
        sku=sku,
        type=movement_type,
        qty=qty,
        reference_type=ref_type,
        reference_id=ref_id,
        reason=reason,
        stock_before=stock_before,
        stock_after=stock_after
    )
    
    await db.stock_movements.insert_one(movement.model_dump())
    await db.products.update_one({"id": product_id}, {"$set": {"stock_qty": stock_after}})

async def get_current_shift():
    shift = await db.shifts.find_one({"status": ShiftStatus.OPEN}, {"_id": 0})
    return shift

# ============= SEED DATA =============
CATEGORIES = [
    {"id": "cat-pipes", "name_fr": "Tuyaux", "name_nl": "Buizen"},
    {"id": "cat-fasteners", "name_fr": "Fixations", "name_nl": "Bevestigingen"},
    {"id": "cat-insulation", "name_fr": "Isolation", "name_nl": "Isolatie"},
    {"id": "cat-tools", "name_fr": "Outils", "name_nl": "Gereedschap"},
]

PRODUCTS = [
    {"id": "p001", "sku": "GG10WP035020", "barcode": "5412345000011", "name_fr": "Tuyau PVC 35mm", "name_nl": "PVC Buis 35mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 4.50, "price_wholesale": 3.80, "vat_rate": 21.0, "stock_qty": 250, "min_stock": 50, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p002", "sku": "GG10WP050020", "barcode": "5412345000028", "name_fr": "Tuyau PVC 50mm", "name_nl": "PVC Buis 50mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 6.80, "price_wholesale": 5.50, "vat_rate": 21.0, "stock_qty": 180, "min_stock": 30, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p003", "sku": "GG10WP075020", "barcode": "5412345000035", "name_fr": "Tuyau PVC 75mm", "name_nl": "PVC Buis 75mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 9.20, "price_wholesale": 7.80, "vat_rate": 21.0, "stock_qty": 120, "min_stock": 20, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p004", "sku": "GG10WP100020", "barcode": "5412345000042", "name_fr": "Tuyau PVC 100mm", "name_nl": "PVC Buis 100mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 12.50, "price_wholesale": 10.20, "vat_rate": 21.0, "stock_qty": 90, "min_stock": 15, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p005", "sku": "GG20CU015010", "barcode": "5412345000059", "name_fr": "Tube Cuivre 15mm", "name_nl": "Koperen Buis 15mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 8.90, "price_wholesale": 7.50, "vat_rate": 21.0, "stock_qty": 200, "min_stock": 40, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p006", "sku": "GG20CU022010", "barcode": "5412345000066", "name_fr": "Tube Cuivre 22mm", "name_nl": "Koperen Buis 22mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 12.30, "price_wholesale": 10.50, "vat_rate": 21.0, "stock_qty": 150, "min_stock": 30, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p007", "sku": "GG30PE032025", "barcode": "5412345000073", "name_fr": "Tuyau PE 32mm", "name_nl": "PE Buis 32mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 3.20, "price_wholesale": 2.60, "vat_rate": 21.0, "stock_qty": 500, "min_stock": 100, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p008", "sku": "GG30PE050025", "barcode": "5412345000080", "name_fr": "Tuyau PE 50mm", "name_nl": "PE Buis 50mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 5.40, "price_wholesale": 4.30, "vat_rate": 21.0, "stock_qty": 350, "min_stock": 70, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p009", "sku": "GG40MU020015", "barcode": "5412345000097", "name_fr": "Multicouche 20mm", "name_nl": "Meerlagenbuis 20mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 4.80, "price_wholesale": 3.90, "vat_rate": 21.0, "stock_qty": 400, "min_stock": 80, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p010", "sku": "GG40MU026015", "barcode": "5412345000103", "name_fr": "Multicouche 26mm", "name_nl": "Meerlagenbuis 26mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 6.50, "price_wholesale": 5.30, "vat_rate": 21.0, "stock_qty": 300, "min_stock": 60, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p011", "sku": "GG50DR110020", "barcode": "5412345000110", "name_fr": "Drain 110mm", "name_nl": "Afvoerbuis 110mm", "category_id": "cat-pipes", "unit": "piece", "price_retail": 18.90, "price_wholesale": 15.50, "vat_rate": 21.0, "stock_qty": 80, "min_stock": 15, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p012", "sku": "GG50DR160020", "barcode": "5412345000127", "name_fr": "Drain 160mm", "name_nl": "Afvoerbuis 160mm", "category_id": "cat-pipes", "unit": "piece", "price_retail": 28.50, "price_wholesale": 23.00, "vat_rate": 21.0, "stock_qty": 50, "min_stock": 10, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p013", "sku": "FX10VS004025", "barcode": "5412345000134", "name_fr": "Vis 4x25mm (100pc)", "name_nl": "Schroef 4x25mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 6.90, "price_wholesale": 5.50, "vat_rate": 21.0, "stock_qty": 500, "min_stock": 100, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p014", "sku": "FX10VS005040", "barcode": "5412345000141", "name_fr": "Vis 5x40mm (100pc)", "name_nl": "Schroef 5x40mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 8.50, "price_wholesale": 6.80, "vat_rate": 21.0, "stock_qty": 400, "min_stock": 80, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p015", "sku": "FX10VS006060", "barcode": "5412345000158", "name_fr": "Vis 6x60mm (100pc)", "name_nl": "Schroef 6x60mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 12.30, "price_wholesale": 9.90, "vat_rate": 21.0, "stock_qty": 350, "min_stock": 70, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p016", "sku": "FX20BL006050", "barcode": "5412345000165", "name_fr": "Boulon M6x50 (50pc)", "name_nl": "Bout M6x50 (50st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 14.80, "price_wholesale": 11.90, "vat_rate": 21.0, "stock_qty": 200, "min_stock": 40, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p017", "sku": "FX20BL008070", "barcode": "5412345000172", "name_fr": "Boulon M8x70 (50pc)", "name_nl": "Bout M8x70 (50st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 18.50, "price_wholesale": 14.90, "vat_rate": 21.0, "stock_qty": 180, "min_stock": 35, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p018", "sku": "FX30CH006010", "barcode": "5412345000189", "name_fr": "Cheville 6mm (100pc)", "name_nl": "Plug 6mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 5.90, "price_wholesale": 4.70, "vat_rate": 21.0, "stock_qty": 600, "min_stock": 120, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p019", "sku": "FX30CH008010", "barcode": "5412345000196", "name_fr": "Cheville 8mm (100pc)", "name_nl": "Plug 8mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 7.20, "price_wholesale": 5.80, "vat_rate": 21.0, "stock_qty": 550, "min_stock": 110, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p020", "sku": "FX30CH010010", "barcode": "5412345000202", "name_fr": "Cheville 10mm (50pc)", "name_nl": "Plug 10mm (50st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 400, "min_stock": 80, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p021", "sku": "FX40CL025001", "barcode": "5412345000219", "name_fr": "Clou 25mm (1kg)", "name_nl": "Spijker 25mm (1kg)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 9.80, "price_wholesale": 7.80, "vat_rate": 21.0, "stock_qty": 300, "min_stock": 60, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p022", "sku": "FX40CL040001", "barcode": "5412345000226", "name_fr": "Clou 40mm (1kg)", "name_nl": "Spijker 40mm (1kg)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 10.50, "price_wholesale": 8.40, "vat_rate": 21.0, "stock_qty": 280, "min_stock": 55, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p023", "sku": "FX50TQ010002", "barcode": "5412345000233", "name_fr": "Tire-fond 10x80 (25pc)", "name_nl": "Houtdraadbout 10x80 (25st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 16.90, "price_wholesale": 13.50, "vat_rate": 21.0, "stock_qty": 150, "min_stock": 30, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p024", "sku": "FX60EC006001", "barcode": "5412345000240", "name_fr": "Écrou M6 (100pc)", "name_nl": "Moer M6 (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 4.50, "price_wholesale": 3.60, "vat_rate": 21.0, "stock_qty": 700, "min_stock": 140, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p025", "sku": "FX70RD006001", "barcode": "5412345000257", "name_fr": "Rondelle M6 (100pc)", "name_nl": "Ring M6 (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 3.20, "price_wholesale": 2.50, "vat_rate": 21.0, "stock_qty": 800, "min_stock": 160, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p026", "sku": "IS10LV050060", "barcode": "5412345000264", "name_fr": "Laine Verre 50mm", "name_nl": "Glaswol 50mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 450, "min_stock": 90, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p027", "sku": "IS10LV080060", "barcode": "5412345000271", "name_fr": "Laine Verre 80mm", "name_nl": "Glaswol 80mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 12.50, "price_wholesale": 10.00, "vat_rate": 21.0, "stock_qty": 380, "min_stock": 75, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p028", "sku": "IS10LV100060", "barcode": "5412345000288", "name_fr": "Laine Verre 100mm", "name_nl": "Glaswol 100mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 15.80, "price_wholesale": 12.60, "vat_rate": 21.0, "stock_qty": 320, "min_stock": 65, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p029", "sku": "IS20LR050040", "barcode": "5412345000295", "name_fr": "Laine Roche 50mm", "name_nl": "Rotswol 50mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 11.20, "price_wholesale": 9.00, "vat_rate": 21.0, "stock_qty": 400, "min_stock": 80, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p030", "sku": "IS20LR080040", "barcode": "5412345000301", "name_fr": "Laine Roche 80mm", "name_nl": "Rotswol 80mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 16.50, "price_wholesale": 13.20, "vat_rate": 21.0, "stock_qty": 350, "min_stock": 70, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p031", "sku": "IS30PS020120", "barcode": "5412345000318", "name_fr": "Polystyrène 20mm", "name_nl": "Polystyreen 20mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 3.80, "price_wholesale": 3.00, "vat_rate": 21.0, "stock_qty": 600, "min_stock": 120, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p032", "sku": "IS30PS040120", "barcode": "5412345000325", "name_fr": "Polystyrène 40mm", "name_nl": "Polystyreen 40mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 6.20, "price_wholesale": 4.90, "vat_rate": 21.0, "stock_qty": 500, "min_stock": 100, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p033", "sku": "IS30PS060120", "barcode": "5412345000332", "name_fr": "Polystyrène 60mm", "name_nl": "Polystyreen 60mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 420, "min_stock": 85, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p034", "sku": "IS40PU030060", "barcode": "5412345000349", "name_fr": "Polyuréthane 30mm", "name_nl": "Polyurethaan 30mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 18.50, "price_wholesale": 14.80, "vat_rate": 21.0, "stock_qty": 280, "min_stock": 55, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p035", "sku": "IS40PU050060", "barcode": "5412345000356", "name_fr": "Polyuréthane 50mm", "name_nl": "Polyurethaan 50mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 24.80, "price_wholesale": 19.80, "vat_rate": 21.0, "stock_qty": 220, "min_stock": 45, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p036", "sku": "IS50FB009010", "barcode": "5412345000363", "name_fr": "Film Pare-vapeur", "name_nl": "Dampscherm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 1.80, "price_wholesale": 1.40, "vat_rate": 21.0, "stock_qty": 1000, "min_stock": 200, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p037", "sku": "IS60SC050050", "barcode": "5412345000370", "name_fr": "Scotch Alu 50m", "name_nl": "Alu Tape 50m", "category_id": "cat-insulation", "unit": "piece", "price_retail": 12.90, "price_wholesale": 10.30, "vat_rate": 21.0, "stock_qty": 300, "min_stock": 60, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p038", "sku": "IS70MO010025", "barcode": "5412345000387", "name_fr": "Mousse Expansive 750ml", "name_nl": "PU Schuim 750ml", "category_id": "cat-insulation", "unit": "piece", "price_retail": 8.50, "price_wholesale": 6.80, "vat_rate": 21.0, "stock_qty": 400, "min_stock": 80, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p039", "sku": "TL10MT005001", "barcode": "5412345000394", "name_fr": "Mètre 5m", "name_nl": "Meetlint 5m", "category_id": "cat-tools", "unit": "piece", "price_retail": 9.90, "price_wholesale": 7.90, "vat_rate": 21.0, "stock_qty": 200, "min_stock": 40, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p040", "sku": "TL10MT008001", "barcode": "5412345000400", "name_fr": "Mètre 8m", "name_nl": "Meetlint 8m", "category_id": "cat-tools", "unit": "piece", "price_retail": 14.50, "price_wholesale": 11.60, "vat_rate": 21.0, "stock_qty": 150, "min_stock": 30, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p041", "sku": "TL20NV045001", "barcode": "5412345000417", "name_fr": "Niveau 45cm", "name_nl": "Waterpas 45cm", "category_id": "cat-tools", "unit": "piece", "price_retail": 18.90, "price_wholesale": 15.10, "vat_rate": 21.0, "stock_qty": 100, "min_stock": 20, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p042", "sku": "TL20NV080001", "barcode": "5412345000424", "name_fr": "Niveau 80cm", "name_nl": "Waterpas 80cm", "category_id": "cat-tools", "unit": "piece", "price_retail": 28.50, "price_wholesale": 22.80, "vat_rate": 21.0, "stock_qty": 80, "min_stock": 15, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p043", "sku": "TL30MR500001", "barcode": "5412345000431", "name_fr": "Marteau 500g", "name_nl": "Hamer 500g", "category_id": "cat-tools", "unit": "piece", "price_retail": 22.90, "price_wholesale": 18.30, "vat_rate": 21.0, "stock_qty": 120, "min_stock": 25, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p044", "sku": "TL40SC180001", "barcode": "5412345000448", "name_fr": "Scie Égoïne 18\"", "name_nl": "Handzaag 18\"", "category_id": "cat-tools", "unit": "piece", "price_retail": 24.90, "price_wholesale": 19.90, "vat_rate": 21.0, "stock_qty": 90, "min_stock": 18, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p045", "sku": "TL50CT180001", "barcode": "5412345000455", "name_fr": "Cutter Pro 18mm", "name_nl": "Afbreekmes Pro 18mm", "category_id": "cat-tools", "unit": "piece", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 250, "min_stock": 50, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p046", "sku": "TL60PC200001", "barcode": "5412345000462", "name_fr": "Pince Coupante 200mm", "name_nl": "Kniptang 200mm", "category_id": "cat-tools", "unit": "piece", "price_retail": 19.90, "price_wholesale": 15.90, "vat_rate": 21.0, "stock_qty": 110, "min_stock": 22, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p047", "sku": "TL70TV006010", "barcode": "5412345000479", "name_fr": "Jeu Tournevis 6pc", "name_nl": "Schroevendraaierset 6st", "category_id": "cat-tools", "unit": "piece", "price_retail": 24.50, "price_wholesale": 19.60, "vat_rate": 21.0, "stock_qty": 130, "min_stock": 26, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p048", "sku": "TL80CL008013", "barcode": "5412345000486", "name_fr": "Jeu Clés 8-13mm", "name_nl": "Sleutelset 8-13mm", "category_id": "cat-tools", "unit": "piece", "price_retail": 32.90, "price_wholesale": 26.30, "vat_rate": 21.0, "stock_qty": 70, "min_stock": 14, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p049", "sku": "TL90TR030001", "barcode": "5412345000493", "name_fr": "Truelle 30cm", "name_nl": "Truweel 30cm", "category_id": "cat-tools", "unit": "piece", "price_retail": 16.90, "price_wholesale": 13.50, "vat_rate": 21.0, "stock_qty": 140, "min_stock": 28, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p050", "sku": "TL95GL001001", "barcode": "5412345000509", "name_fr": "Gants Travail XL", "name_nl": "Werkhandschoenen XL", "category_id": "cat-tools", "unit": "piece", "price_retail": 6.90, "price_wholesale": 5.50, "vat_rate": 21.0, "stock_qty": 500, "min_stock": 100, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
]

CUSTOMERS = [
    {"id": "c001", "type": "individual", "name": "Jean Dupont", "phone": "+32 475 12 34 56", "email": "jean.dupont@email.be", "address": "Rue de la Station 15", "city": "Bruxelles", "postal_code": "1000", "credit_limit": 500.0, "balance": 0.0},
    {"id": "c002", "type": "individual", "name": "Marie Janssen", "phone": "+32 476 23 45 67", "email": "marie.janssen@email.be", "address": "Kerkstraat 42", "city": "Gent", "postal_code": "9000", "credit_limit": 300.0, "balance": 0.0},
    {"id": "c003", "type": "individual", "name": "Pierre Van den Berg", "phone": "+32 477 34 56 78", "email": "pierre.vdb@email.be", "address": "Avenue Louise 100", "city": "Bruxelles", "postal_code": "1050", "credit_limit": 750.0, "balance": 0.0},
    {"id": "c004", "type": "individual", "name": "Sophie De Smet", "phone": "+32 478 45 67 89", "email": "sophie.desmet@email.be", "address": "Markt 5", "city": "Antwerpen", "postal_code": "2000", "credit_limit": 400.0, "balance": 0.0},
    {"id": "c005", "type": "individual", "name": "Luc Peeters", "phone": "+32 479 56 78 90", "email": "luc.peeters@email.be", "address": "Stationsplein 8", "city": "Leuven", "postal_code": "3000", "credit_limit": 600.0, "balance": 0.0},
    {"id": "c006", "type": "company", "name": "Batiplus SPRL", "vat_number": "BE0123456789", "phone": "+32 2 345 67 89", "email": "contact@batiplus.be", "address": "Industrielaan 25", "city": "Zaventem", "postal_code": "1930", "credit_limit": 5000.0, "balance": 0.0},
    {"id": "c007", "type": "company", "name": "Construct Pro SA", "vat_number": "BE0234567890", "phone": "+32 2 456 78 90", "email": "info@constructpro.be", "address": "Brusselsesteenweg 150", "city": "Vilvoorde", "postal_code": "1800", "credit_limit": 10000.0, "balance": 0.0},
    {"id": "c008", "type": "company", "name": "Renov'Expert BVBA", "vat_number": "BE0345678901", "phone": "+32 2 567 89 01", "email": "contact@renovexpert.be", "address": "Mechelseweg 75", "city": "Mechelen", "postal_code": "2800", "credit_limit": 7500.0, "balance": 0.0},
    {"id": "c009", "type": "company", "name": "Maison & Co NV", "vat_number": "BE0456789012", "phone": "+32 2 678 90 12", "email": "info@maisonco.be", "address": "Koningslaan 200", "city": "Brussel", "postal_code": "1000", "credit_limit": 15000.0, "balance": 0.0},
    {"id": "c010", "type": "company", "name": "Plomberie Express", "vat_number": "BE0567890123", "phone": "+32 2 789 01 23", "email": "contact@plomberieexpress.be", "address": "Waterloosesteenweg 50", "city": "Uccle", "postal_code": "1180", "credit_limit": 8000.0, "balance": 0.0},
]

# ============= STARTUP =============
@app.on_event("startup")
async def seed_database():
    # Seed categories
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
        await db.categories.insert_many(CATEGORIES)
        logger.info("Seeded categories")
    
    # Seed products
    prod_count = await db.products.count_documents({})
    if prod_count == 0:
        await db.products.insert_many(PRODUCTS)
        logger.info("Seeded products")
    
    # Seed customers
    cust_count = await db.customers.count_documents({})
    if cust_count == 0:
        for c in CUSTOMERS:
            c["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.customers.insert_many(CUSTOMERS)
        logger.info("Seeded customers")
    
    # Create indexes
    await db.documents.create_index("number")
    await db.documents.create_index("doc_type")
    await db.documents.create_index("status")
    await db.documents.create_index("customer_id")
    await db.documents.create_index("created_at")
    await db.stock_movements.create_index("product_id")
    await db.stock_movements.create_index("created_at")
    await db.shifts.create_index("status")
    await db.shifts.create_index("cashier_name")
    await db.products.create_index("barcode")
    await db.products.create_index("name")
    await db.products.create_index("sku")
    await db.customers.create_index("name")
    await db.customers.create_index("email")
    await db.customers.create_index("vat_number")
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email")
    await db.users.create_index("role")
    logger.info("Database indexes created")

# ============= API ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "ALPHA&CO POS API", "version": "2.0.0"}

# --- Users/Cashiers ---
import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(role: Optional[UserRole] = None, active_only: bool = True):
    query = {}
    if role:
        query["role"] = role
    if active_only:
        query["is_active"] = True
    users = await db.users.find(query, {"_id": 0, "password_hash": 0, "pin_code": 0}).to_list(100)
    return users

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "pin_code": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        role=user_data.role,
        pin_code=user_data.pin_code,
        is_active=user_data.is_active
    )
    
    await db.users.insert_one(user.model_dump())
    return UserResponse(**user.model_dump())

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: dict = Body(...)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in user_data.items() if k not in ["id", "password_hash", "created_at"]}
    
    # Hash password if provided
    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "pin_code": 0})
    return updated

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = None
    
    # Login by PIN
    if credentials.pin_code:
        user = await db.users.find_one({"pin_code": credentials.pin_code, "is_active": True})
    # Login by username/password
    elif credentials.username and credentials.password:
        user = await db.users.find_one({"username": credentials.username, "is_active": True})
        if user and not verify_password(credentials.password, user.get("password_hash", "")):
            user = None
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]}, 
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "user": UserResponse(**{k: v for k, v in user.items() if k not in ["password_hash", "pin_code", "_id"]}),
        "message": "Login successful"
    }

@api_router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Get detailed stats for a user/cashier"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get shifts for this user
    shift_query = {"cashier_name": user.get("full_name")}
    if date_from:
        shift_query["opened_at"] = {"$gte": date_from}
    if date_to:
        shift_query.setdefault("opened_at", {})["$lte"] = date_to
    
    shifts = await db.shifts.find(shift_query, {"_id": 0}).to_list(500)
    
    # Calculate stats
    total_shifts = len(shifts)
    total_sales = sum(s.get("sales_count", 0) for s in shifts)
    total_revenue = sum(s.get("sales_total", 0) for s in shifts)
    total_cash = sum(s.get("cash_total", 0) for s in shifts)
    total_card = sum(s.get("card_total", 0) for s in shifts)
    total_refunds = sum(s.get("refunds_total", 0) for s in shifts)
    avg_ticket = total_revenue / total_sales if total_sales > 0 else 0
    
    return {
        "user": UserResponse(**{k: v for k, v in user.items() if k not in ["password_hash", "pin_code", "_id"]}),
        "stats": {
            "total_shifts": total_shifts,
            "total_sales": total_sales,
            "total_revenue": round(total_revenue, 2),
            "total_cash": round(total_cash, 2),
            "total_card": round(total_card, 2),
            "total_refunds": round(total_refunds, 2),
            "average_ticket": round(avg_ticket, 2)
        },
        "recent_shifts": shifts[-10:]  # Last 10 shifts
    }

# --- Categories ---
@api_router.get("/categories")
async def get_categories():
    # Get all categories
    categories = await db.categories.find({}, {"_id": 0}).to_list(500)
    
    # Calculate product count for each category using aggregation
    pipeline = [
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}}
    ]
    product_counts = await db.products.aggregate(pipeline).to_list(500)
    count_map = {item["_id"]: item["count"] for item in product_counts if item["_id"]}
    
    # Add product_count to each category
    for cat in categories:
        cat["product_count"] = count_map.get(cat.get("id"), 0)
    
    # Sort by name
    categories.sort(key=lambda x: x.get("name_fr", "").lower())
    
    return categories

# --- Products ---
@api_router.get("/products", response_model=List[Product])
async def get_products(
    search: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    barcode: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None)
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if barcode:
        query["barcode"] = barcode
    if search:
        query["$or"] = [
            {"sku": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
            {"name_fr": {"$regex": search, "$options": "i"}},
            {"name_nl": {"$regex": search, "$options": "i"}}
        ]
    if low_stock:
        query["$expr"] = {"$lte": ["$stock_qty", "$min_stock"]}
    
    return await db.products.find(query, {"_id": 0}).to_list(500)

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products", response_model=Product)
async def create_product(product: Product):
    product_dict = product.model_dump()
    await db.products.insert_one(product_dict)
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, data: Dict[str, Any] = Body(...)):
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"id": product_id}, {"$set": data})
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Product not found")
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# --- Customers ---
@api_router.get("/customers", response_model=List[Customer])
async def get_customers(search: Optional[str] = Query(None)):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"vat_number": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    return await db.customers.find(query, {"_id": 0}).to_list(500)

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: Customer):
    customer_dict = customer.model_dump()
    await db.customers.insert_one(customer_dict)
    return customer

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, data: Dict[str, Any] = Body(...)):
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customers.update_one({"id": customer_id}, {"$set": data})
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Customer not found")
    return updated

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}

@api_router.get("/customers/{customer_id}/history")
async def get_customer_history(customer_id: str, limit: int = 50):
    """Get purchase history and documents for a customer"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all documents for this customer
    documents = await db.documents.find(
        {"customer_id": customer_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Calculate stats
    total_spent = sum(d.get("total", 0) for d in documents if d.get("status") in ["paid", "partially_paid"])
    total_documents = len(documents)
    invoices_count = len([d for d in documents if d.get("doc_type") == "invoice"])
    quotes_count = len([d for d in documents if d.get("doc_type") == "quote"])
    receipts_count = len([d for d in documents if d.get("doc_type") == "receipt"])
    unpaid_amount = sum(d.get("total", 0) - d.get("paid_total", 0) for d in documents if d.get("status") in ["unpaid", "partially_paid"])
    
    # Get most purchased products
    product_counts = {}
    for doc in documents:
        for item in doc.get("items", []):
            pid = item.get("product_id")
            if pid:
                if pid not in product_counts:
                    product_counts[pid] = {"name": item.get("name"), "qty": 0, "total": 0}
                product_counts[pid]["qty"] += item.get("qty", 0)
                product_counts[pid]["total"] += item.get("qty", 0) * item.get("unit_price", 0)
    
    top_products = sorted(product_counts.values(), key=lambda x: x["total"], reverse=True)[:10]
    
    return {
        "customer": customer,
        "stats": {
            "total_spent": round(total_spent, 2),
            "total_documents": total_documents,
            "invoices_count": invoices_count,
            "quotes_count": quotes_count,
            "receipts_count": receipts_count,
            "unpaid_amount": round(unpaid_amount, 2),
            "average_ticket": round(total_spent / total_documents, 2) if total_documents > 0 else 0
        },
        "top_products": top_products,
        "recent_documents": documents[:20]
    }

# --- Documents (unified) ---
@api_router.post("/documents", response_model=Document)
async def create_document(doc_data: DocumentCreate):
    doc_number = await generate_document_number(doc_data.doc_type)
    
    # Calculate totals
    items, subtotal, vat_total, total = calculate_document_totals(
        doc_data.items, 
        doc_data.global_discount_type, 
        doc_data.global_discount_value
    )
    
    # Get customer info
    customer_name = None
    customer_vat = None
    customer_address = None
    peppol_recipient_id = None
    if doc_data.customer_id:
        customer = await db.customers.find_one({"id": doc_data.customer_id}, {"_id": 0})
        if customer:
            customer_name = customer.get("name")
            customer_vat = customer.get("vat_number")
            # Build structured address
            address_parts = []
            if customer.get("street_name"):
                addr = customer.get("street_name")
                if customer.get("building_number"):
                    addr += f" {customer.get('building_number')}"
                address_parts.append(addr)
            elif customer.get("address"):
                address_parts.append(customer.get("address"))
            if customer.get("postal_code") or customer.get("city"):
                address_parts.append(f"{customer.get('postal_code', '')} {customer.get('city', '')}".strip())
            customer_address = ", ".join(address_parts) if address_parts else None
            
            # Set Peppol recipient if customer has Peppol enabled
            if customer.get("receive_invoices_by_peppol") and customer.get("peppol_id"):
                peppol_recipient_id = customer.get("peppol_id")
    
    # Process payments
    payments = []
    paid_total = 0.0
    for p in (doc_data.payments or []):
        payment = Payment(**p.model_dump())
        payments.append(payment)
        paid_total += p.amount
    
    # Determine status
    if doc_data.doc_type == DocumentType.QUOTE:
        status = DocumentStatus.DRAFT
    elif paid_total >= total:
        status = DocumentStatus.PAID
    elif paid_total > 0:
        status = DocumentStatus.PARTIALLY_PAID
    else:
        status = DocumentStatus.UNPAID
    
    # Get current shift
    shift = await get_current_shift()
    shift_id = shift.get("id") if shift else None
    
    doc = Document(
        number=doc_number,
        doc_type=doc_data.doc_type,
        status=status,
        customer_id=doc_data.customer_id,
        customer_name=customer_name,
        customer_vat=customer_vat,
        customer_address=customer_address,
        items=[i.model_dump() for i in items],
        payments=[p.model_dump() for p in payments],
        subtotal=subtotal,
        vat_total=vat_total,
        total=total,
        paid_total=round(paid_total, 2),
        global_discount_type=doc_data.global_discount_type,
        global_discount_value=doc_data.global_discount_value,
        notes=doc_data.notes,
        due_date=doc_data.due_date,
        payment_terms=doc_data.payment_terms,
        source_document_id=doc_data.source_document_id,
        shift_id=shift_id,
        peppol_recipient_id=peppol_recipient_id,
        # Credit note fields if provided
        reference_invoice_id=doc_data.reference_invoice_id,
        credit_reason=doc_data.credit_reason,
        # Delivery note fields if provided
        delivery_address=doc_data.delivery_address,
        delivery_contact=doc_data.delivery_contact,
        delivery_notes=doc_data.delivery_notes
    )
    
    doc_dict = doc.model_dump()
    await db.documents.insert_one(doc_dict)
    
    # Update stock for invoices/receipts (not quotes)
    stock_movement_ids = []
    if doc_data.doc_type in [DocumentType.INVOICE, DocumentType.RECEIPT]:
        for item in doc_data.items:
            stock_move = await record_stock_movement(
                item.product_id, item.sku, StockMovementType.SALE, 
                item.qty, "document", doc.id
            )
            if stock_move and hasattr(stock_move, 'id'):
                stock_movement_ids.append(stock_move.id)
        
        # Update document with stock movement IDs
        if stock_movement_ids:
            await db.documents.update_one(
                {"id": doc.id},
                {"$set": {"stock_movement_created": True, "stock_movement_ids": stock_movement_ids}}
            )
    
    # Handle delivery note stock movements
    if doc_data.doc_type == DocumentType.DELIVERY_NOTE:
        for item in doc_data.items:
            stock_move = await record_stock_movement(
                item.product_id, item.sku, StockMovementType.DELIVERY,
                item.qty, "delivery_note", doc.id
            )
            if stock_move and hasattr(stock_move, 'id'):
                stock_movement_ids.append(stock_move.id)
        
        if stock_movement_ids:
            await db.documents.update_one(
                {"id": doc.id},
                {"$set": {"stock_movement_created": True, "stock_movement_ids": stock_movement_ids}}
            )
    
    # Update shift totals if there's an active shift
    if shift_id and doc_data.doc_type in [DocumentType.INVOICE, DocumentType.RECEIPT]:
        update_data = {
            "$inc": {
                "sales_count": 1,
                "sales_total": total,
                "vat_collected": vat_total
            }
        }
        for p in payments:
            if p.method == PaymentMethod.CASH:
                update_data["$inc"]["cash_total"] = update_data["$inc"].get("cash_total", 0) + p.amount
            elif p.method == PaymentMethod.CARD:
                update_data["$inc"]["card_total"] = update_data["$inc"].get("card_total", 0) + p.amount
            else:
                update_data["$inc"]["transfer_total"] = update_data["$inc"].get("transfer_total", 0) + p.amount
        await db.shifts.update_one({"id": shift_id}, update_data)
    
    # Update source document if converting
    if doc_data.source_document_id:
        old_status = (await db.documents.find_one({"id": doc_data.source_document_id}, {"status": 1})).get("status")
        await db.documents.update_one(
            {"id": doc_data.source_document_id},
            {"$push": {"related_documents": doc.id}, "$set": {"status": DocumentStatus.ACCEPTED}}
        )
        # Log conversion audit
        await log_audit(
            action=AuditLogAction.CONVERT,
            entity_type="document",
            entity_id=doc_data.source_document_id,
            description=f"Document converted to {doc_data.doc_type.value} ({doc.number})",
            metadata={
                "source_document_id": doc_data.source_document_id,
                "target_document_id": doc.id,
                "target_document_number": doc.number,
                "target_type": doc_data.doc_type.value
            }
        )
    
    # Audit log for document creation
    await log_audit(
        action=AuditLogAction.CREATE,
        entity_type="document",
        entity_id=doc.id,
        entity_number=doc.number,
        description=f"{doc_data.doc_type.value.capitalize()} {doc.number} created",
        metadata={
            "doc_type": doc_data.doc_type.value,
            "customer_id": doc_data.customer_id,
            "customer_name": customer_name,
            "total": total,
            "items_count": len(doc_data.items)
        }
    )
    
    return doc

@api_router.get("/documents", response_model=List[Document])
async def get_documents(
    doc_type: Optional[DocumentType] = Query(None),
    status: Optional[DocumentStatus] = Query(None),
    customer_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    shift_id: Optional[str] = Query(None),
    limit: int = Query(100, le=500)
):
    query = {}
    if doc_type:
        query["doc_type"] = doc_type
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if shift_id:
        query["shift_id"] = shift_id
    if search:
        query["$or"] = [
            {"number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}}
        ]
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to
    
    return await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)

@api_router.get("/documents/{doc_id}", response_model=Document)
async def get_document(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@api_router.post("/documents/{doc_id}/pay")
async def add_payment(doc_id: str, payment: PaymentCreate):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Validate payment amount
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")
    
    shift = await get_current_shift()
    
    new_payment = Payment(
        **payment.model_dump(),
        document_id=doc_id,
        shift_id=shift.get("id") if shift else None
    )
    
    new_paid_total = doc.get("paid_total", 0) + payment.amount
    # Use small epsilon for floating-point comparison
    new_status = DocumentStatus.PAID if new_paid_total >= (doc["total"] - 0.01) else DocumentStatus.PARTIALLY_PAID
    
    await db.documents.update_one(
        {"id": doc_id},
        {
            "$push": {"payments": new_payment.model_dump()},
            "$set": {"paid_total": round(new_paid_total, 2), "status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Update shift
    if shift:
        inc_field = "cash_total" if payment.method == PaymentMethod.CASH else ("card_total" if payment.method == PaymentMethod.CARD else "transfer_total")
        await db.shifts.update_one({"id": shift["id"]}, {"$inc": {inc_field: payment.amount}})
    
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})

@api_router.post("/documents/{doc_id}/convert")
async def convert_document(doc_id: str, target_type: DocumentType = Query(...)):
    """Convert a quote to invoice"""
    source_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not source_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if source_doc["doc_type"] != DocumentType.QUOTE:
        raise HTTPException(status_code=400, detail="Only quotes can be converted")
    
    # Create new document from source
    new_doc_data = DocumentCreate(
        doc_type=target_type,
        customer_id=source_doc.get("customer_id"),
        items=[DocumentItemCreate(**{k: v for k, v in item.items() if k in DocumentItemCreate.model_fields}) for item in source_doc["items"]],
        payments=[],
        global_discount_type=source_doc.get("global_discount_type"),
        global_discount_value=source_doc.get("global_discount_value", 0),
        notes=source_doc.get("notes"),
        source_document_id=doc_id
    )
    
    return await create_document(new_doc_data)

@api_router.post("/documents/{doc_id}/duplicate")
async def duplicate_document(doc_id: str):
    """Duplicate a document as a new draft"""
    source_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not source_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    new_doc_data = DocumentCreate(
        doc_type=source_doc["doc_type"],
        customer_id=source_doc.get("customer_id"),
        items=[DocumentItemCreate(**{k: v for k, v in item.items() if k in DocumentItemCreate.model_fields}) for item in source_doc["items"]],
        payments=[],
        global_discount_type=source_doc.get("global_discount_type"),
        global_discount_value=source_doc.get("global_discount_value", 0),
        notes=f"Duplicated from {source_doc['number']}"
    )
    
    return await create_document(new_doc_data)

# --- Returns / Credit Notes (Peppol Compliant) ---
@api_router.post("/returns")
async def create_return(return_data: ReturnCreate):
    """Process a return and create a Peppol-compliant credit note"""
    original_doc = await db.documents.find_one({"id": return_data.original_document_id}, {"_id": 0})
    if not original_doc:
        raise HTTPException(status_code=404, detail="Original document not found")
    
    # Validate: Can only credit invoices and receipts
    if original_doc["doc_type"] not in [DocumentType.INVOICE, DocumentType.RECEIPT]:
        raise HTTPException(
            status_code=400, 
            detail="Credit notes can only be created for invoices or receipts"
        )
    
    # Validate: Cannot credit an already credited document
    if original_doc.get("status") == DocumentStatus.CREDITED:
        raise HTTPException(
            status_code=400,
            detail="This document has already been credited"
        )
    
    # Create credit note items
    credit_items = []
    total_refund = 0.0
    stock_movement_ids = []
    
    for item in return_data.items:
        line_subtotal = item.qty * item.unit_price
        line_vat = line_subtotal * (item.vat_rate / 100)
        line_total = line_subtotal + line_vat
        total_refund += line_total
        
        credit_items.append(DocumentItemCreate(
            product_id=item.product_id,
            sku=item.sku,
            name=f"RETOUR: {item.name}",
            qty=item.qty,
            unit_price=-item.unit_price,  # Negative for credit
            vat_rate=item.vat_rate
        ))
        
        # Restore stock
        stock_move = await record_stock_movement(
            item.product_id, item.sku, StockMovementType.RETURN,
            item.qty, "return", return_data.original_document_id, item.reason
        )
        if stock_move and hasattr(stock_move, 'id'):
            stock_movement_ids.append(stock_move.id)
    
    # Generate credit note number
    credit_note_number = await generate_document_number(DocumentType.CREDIT_NOTE)
    
    # Calculate totals for credit note
    items, subtotal, vat_total, total = calculate_document_totals(credit_items, None, 0)
    
    # Get current shift
    shift = await get_current_shift()
    shift_id = shift.get("id") if shift else None
    
    # Create Peppol-compliant credit note with proper references
    credit_note = Document(
        number=credit_note_number,
        doc_type=DocumentType.CREDIT_NOTE,
        status=DocumentStatus.UNPAID,  # Credit notes start as unpaid
        customer_id=original_doc.get("customer_id"),
        customer_name=original_doc.get("customer_name"),
        customer_vat=original_doc.get("customer_vat"),
        customer_address=original_doc.get("customer_address"),
        items=[i.model_dump() for i in items],
        payments=[],
        subtotal=subtotal,
        vat_total=vat_total,
        total=total,  # Will be negative
        paid_total=0,
        notes=return_data.notes,
        source_document_id=return_data.original_document_id,
        # Peppol-required reference fields
        reference_invoice_id=return_data.original_document_id,
        reference_invoice_number=original_doc.get("number"),
        credit_reason=return_data.items[0].reason if return_data.items else "return",
        # Stock tracking
        stock_movement_created=len(stock_movement_ids) > 0,
        stock_movement_ids=stock_movement_ids,
        shift_id=shift_id,
        peppol_recipient_id=original_doc.get("peppol_recipient_id")
    )
    
    credit_note_dict = credit_note.model_dump()
    await db.documents.insert_one(credit_note_dict)
    
    # Process refund payment if specified
    if return_data.refund_method:
        refund_payment = Payment(
            method=return_data.refund_method,
            amount=-total_refund,  # Negative for refund
            document_id=credit_note.id,
            shift_id=shift_id
        )
        await db.documents.update_one(
            {"id": credit_note.id},
            {
                "$push": {"payments": refund_payment.model_dump()},
                "$set": {
                    "paid_total": round(-total_refund, 2),
                    "status": DocumentStatus.PAID,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    # Update original document
    await db.documents.update_one(
        {"id": return_data.original_document_id},
        {
            "$set": {"status": DocumentStatus.CREDITED, "updated_at": datetime.now(timezone.utc).isoformat()}, 
            "$push": {"related_documents": credit_note.id}
        }
    )
    
    # Update shift refunds
    if shift:
        refund_inc = {"refunds_total": total_refund}
        if return_data.refund_method == PaymentMethod.CASH:
            refund_inc["cash_total"] = -total_refund
        elif return_data.refund_method == PaymentMethod.CARD:
            refund_inc["card_total"] = -total_refund
        await db.shifts.update_one({"id": shift["id"]}, {"$inc": refund_inc})
    
    # Audit log for Peppol compliance
    await log_audit(
        action=AuditLogAction.CREATE,
        entity_type="credit_note",
        entity_id=credit_note.id,
        entity_number=credit_note.number,
        description=f"Credit note {credit_note.number} created for invoice {original_doc.get('number')}",
        metadata={
            "original_invoice_id": return_data.original_document_id,
            "original_invoice_number": original_doc.get("number"),
            "credit_reason": return_data.items[0].reason if return_data.items else "return",
            "total_refund": total_refund,
            "items_count": len(credit_items),
            "refund_method": return_data.refund_method.value if return_data.refund_method else None
        }
    )
    
    return await db.documents.find_one({"id": credit_note.id}, {"_id": 0})

@api_router.post("/documents/{doc_id}/credit-note")
async def create_credit_note_from_invoice(doc_id: str, credit_data: CreditNoteCreate):
    """Create a credit note from an existing invoice (Peppol compliant)"""
    # Get original invoice
    original_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not original_doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Validate document type
    if original_doc["doc_type"] not in [DocumentType.INVOICE, DocumentType.RECEIPT]:
        raise HTTPException(
            status_code=400,
            detail="Credit notes can only be created for invoices or receipts"
        )
    
    # Validate status
    if original_doc.get("status") == DocumentStatus.CREDITED:
        raise HTTPException(
            status_code=400,
            detail="This document has already been fully credited"
        )
    
    # Convert credit items to return items for processing
    return_items = []
    for item in credit_data.items:
        return_items.append(ReturnItemCreate(
            product_id=item.product_id,
            sku=item.sku,
            name=item.name,
            qty=item.qty,
            unit_price=item.unit_price,
            vat_rate=item.vat_rate,
            reason=credit_data.credit_reason
        ))
    
    return_data = ReturnCreate(
        original_document_id=doc_id,
        items=return_items,
        notes=credit_data.notes,
        refund_method=credit_data.refund_method
    )
    
    return await create_return(return_data)

# --- Shifts ---
@api_router.post("/shifts/open", response_model=Shift)
async def open_shift(data: ShiftCreate):
    existing = await db.shifts.find_one({"status": ShiftStatus.OPEN, "register_number": data.register_number})
    if existing:
        raise HTTPException(status_code=400, detail=f"Caisse {data.register_number} est déjà ouverte")
    
    shift = Shift(
        opening_cash=data.opening_cash,
        cashier_name=data.cashier_name,
        register_number=data.register_number,
        cash_movements=[CashMovement(type=CashMovementType.CASH_IN, amount=data.opening_cash, reason="Opening cash").model_dump()]
    )
    
    await db.shifts.insert_one(shift.model_dump())
    return shift

@api_router.post("/shifts/close")
async def close_shift(data: ShiftClose):
    shift = await db.shifts.find_one({"status": ShiftStatus.OPEN}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=400, detail="No open shift")
    
    # Calculate expected cash
    expected_cash = shift.get("opening_cash", 0) + shift.get("cash_total", 0) - shift.get("refunds_total", 0)
    for movement in shift.get("cash_movements", []):
        if movement["type"] == CashMovementType.CASH_IN:
            expected_cash += movement["amount"]
        elif movement["type"] == CashMovementType.CASH_OUT:
            expected_cash -= movement["amount"]
    
    discrepancy = data.counted_cash - expected_cash
    
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$set": {
            "status": ShiftStatus.CLOSED,
            "closing_cash": expected_cash,
            "counted_cash": data.counted_cash,
            "discrepancy": round(discrepancy, 2),
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "notes": data.notes
        }}
    )
    
    return await db.shifts.find_one({"id": shift["id"]}, {"_id": 0})

@api_router.get("/shifts/current")
async def get_current_shift_api():
    shift = await get_current_shift()
    if not shift:
        return {"status": "no_shift", "message": "No open shift"}
    return shift

@api_router.get("/shifts", response_model=List[Shift])
async def get_shifts(limit: int = Query(30)):
    return await db.shifts.find({}, {"_id": 0}).sort("opened_at", -1).to_list(limit)

@api_router.get("/shifts/{shift_id}")
async def get_shift(shift_id: str):
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift

@api_router.post("/shifts/cash-movement")
async def add_cash_movement(movement_type: CashMovementType, amount: float, reason: str = None):
    shift = await get_current_shift()
    if not shift:
        raise HTTPException(status_code=400, detail="No open shift")
    
    movement = CashMovement(type=movement_type, amount=amount, reason=reason)
    
    await db.shifts.update_one(
        {"id": shift["id"]},
        {"$push": {"cash_movements": movement.model_dump()}}
    )
    
    return await db.shifts.find_one({"id": shift["id"]}, {"_id": 0})

@api_router.get("/shifts/{shift_id}/z-report")
async def get_z_report(shift_id: str):
    """Generate Z report for a shift"""
    shift = await db.shifts.find_one({"id": shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Get all documents for this shift
    docs = await db.documents.find({"shift_id": shift_id}, {"_id": 0}).to_list(1000)
    
    # Calculate VAT breakdown
    vat_breakdown = {}
    for doc in docs:
        for item in doc.get("items", []):
            rate = str(item.get("vat_rate", 21))
            if rate not in vat_breakdown:
                vat_breakdown[rate] = {"base": 0, "vat": 0}
            vat_breakdown[rate]["base"] += item.get("line_subtotal", 0)
            vat_breakdown[rate]["vat"] += item.get("line_vat", 0)
    
    # Count by document type
    doc_counts = {}
    for doc in docs:
        dt = doc.get("doc_type")
        doc_counts[dt] = doc_counts.get(dt, 0) + 1
    
    return {
        "shift_id": shift_id,
        "cashier": shift.get("cashier_name"),
        "opened_at": shift.get("opened_at"),
        "closed_at": shift.get("closed_at"),
        "opening_cash": shift.get("opening_cash", 0),
        "closing_cash": shift.get("closing_cash"),
        "counted_cash": shift.get("counted_cash"),
        "discrepancy": shift.get("discrepancy"),
        "sales_count": shift.get("sales_count", 0),
        "sales_total": round(shift.get("sales_total", 0), 2),
        "cash_total": round(shift.get("cash_total", 0), 2),
        "card_total": round(shift.get("card_total", 0), 2),
        "transfer_total": round(shift.get("transfer_total", 0), 2),
        "refunds_total": round(shift.get("refunds_total", 0), 2),
        "vat_collected": round(shift.get("vat_collected", 0), 2),
        "vat_breakdown": vat_breakdown,
        "document_counts": doc_counts,
        "cash_movements": shift.get("cash_movements", [])
    }

# --- Stock Movements ---
@api_router.get("/stock-movements")
async def get_stock_movements(
    product_id: Optional[str] = Query(None),
    movement_type: Optional[StockMovementType] = Query(None),
    limit: int = Query(100)
):
    query = {}
    if product_id:
        query["product_id"] = product_id
    if movement_type:
        query["type"] = movement_type
    
    return await db.stock_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)

@api_router.post("/stock-adjustments")
async def create_stock_adjustment(
    product_id: str,
    qty_change: int,
    reason: str
):
    """Manual stock adjustment"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await record_stock_movement(
        product_id, product["sku"], StockMovementType.ADJUSTMENT,
        abs(qty_change), "adjustment", None, reason
    )
    
    return await db.products.find_one({"id": product_id}, {"_id": 0})

@api_router.get("/stock-alerts")
async def get_stock_alerts():
    """Get products below minimum stock"""
    products = await db.products.find(
        {"$expr": {"$lte": ["$stock_qty", "$min_stock"]}},
        {"_id": 0}
    ).to_list(100)
    return products

# --- Legacy Sales Endpoints (backward compatibility) ---
@api_router.post("/sales")
async def create_sale_legacy(sale_data: Dict[str, Any] = Body(...)):
    """Legacy endpoint - creates an invoice/receipt"""
    doc_data = DocumentCreate(
        doc_type=DocumentType.RECEIPT,
        customer_id=sale_data.get("customer_id"),
        items=[DocumentItemCreate(
            product_id=item["product_id"],
            sku=item["sku"],
            name=item["name"],
            qty=item["qty"],
            unit_price=item["unit_price"],
            discount_type=item.get("discount_type"),
            discount_value=item.get("discount_value", 0),
            vat_rate=item.get("vat_rate", 21)
        ) for item in sale_data.get("items", [])],
        payments=[PaymentCreate(
            method=PaymentMethod(p["method"]),
            amount=p["amount"],
            reference=p.get("reference")
        ) for p in sale_data.get("payments", [])],
        global_discount_type=sale_data.get("global_discount_type"),
        global_discount_value=sale_data.get("global_discount_value", 0)
    )
    
    doc = await create_document(doc_data)
    
    # Return in legacy format
    return {
        "id": doc.id,
        "number": doc.number,
        "status": doc.status,
        "customer_id": doc.customer_id,
        "customer_name": doc.customer_name,
        "items": doc.items,
        "payments": doc.payments,
        "subtotal": doc.subtotal,
        "vat_total": doc.vat_total,
        "total": doc.total,
        "paid_total": doc.paid_total,
        "created_at": doc.created_at
    }

@api_router.get("/sales")
async def get_sales_legacy(limit: int = Query(50)):
    """Legacy endpoint - returns invoices/receipts"""
    docs = await db.documents.find(
        {"doc_type": {"$in": [DocumentType.INVOICE, DocumentType.RECEIPT]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return docs

# --- PDF Generation ---
@api_router.get("/documents/{doc_id}/pdf")
async def generate_document_pdf(doc_id: str):
    """Generate PDF for a document"""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create PDF in memory
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Company header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "ALPHA&CO BOUWMATERIALEN & DESIGN")
    c.setFont("Helvetica", 9)
    c.drawString(50, height - 65, "Ninoofsesteenweg 77-79, 1700 Dilbeek")
    c.drawString(50, height - 78, "TVA: BE 1028.386.674 | Tél: +32 2 449 81 22")
    
    # Document info
    c.setFont("Helvetica-Bold", 14)
    doc_type_labels = {
        "quote": "DEVIS / OFFERTE",
        "invoice": "FACTURE / FACTUUR",
        "receipt": "TICKET DE CAISSE / KASSABON",
        "credit_note": "NOTE DE CRÉDIT / CREDITNOTA",
        "proforma": "PROFORMA",
        "delivery_note": "BON DE LIVRAISON / LEVERINGSBON"
    }
    doc_title = doc_type_labels.get(doc.get("doc_type", ""), "DOCUMENT")
    c.drawString(50, height - 110, doc_title)
    
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 130, f"N°: {doc.get('number', '')}")
    c.drawString(50, height - 145, f"Date: {datetime.fromisoformat(doc['created_at']).strftime('%d/%m/%Y')}")
    
    # Customer info
    if doc.get("customer_name"):
        c.setFont("Helvetica-Bold", 11)
        c.drawString(350, height - 130, "Client / Klant:")
        c.setFont("Helvetica", 10)
        c.drawString(350, height - 145, doc["customer_name"])
        if doc.get("customer_vat"):
            c.drawString(350, height - 160, f"TVA: {doc['customer_vat']}")
        if doc.get("customer_address"):
            c.drawString(350, height - 175, doc["customer_address"])
    
    # Status watermark for unpaid
    if doc.get("status") in ["unpaid", "partially_paid"]:
        c.setFont("Helvetica-Bold", 60)
        c.setFillColorRGB(0.9, 0.1, 0.1, alpha=0.3)
        c.saveState()
        c.translate(width/2, height/2)
        c.rotate(45)
        c.drawCentredString(0, 0, "IMPAYÉ")
        c.restoreState()
        c.setFillColorRGB(0, 0, 0)
    
    # Items table
    y_position = height - 220
    
    # Table headers
    c.setFont("Helvetica-Bold", 9)
    c.drawString(50, y_position, "SKU")
    c.drawString(130, y_position, "Description")
    c.drawString(320, y_position, "Qté")
    c.drawString(370, y_position, "Prix Unit.")
    c.drawString(440, y_position, "TVA%")
    c.drawString(490, y_position, "Total")
    
    c.line(50, y_position - 5, width - 50, y_position - 5)
    y_position -= 20
    
    # Items
    c.setFont("Helvetica", 9)
    for item in doc.get("items", []):
        if y_position < 100:
            c.showPage()
            y_position = height - 50
        
        c.drawString(50, y_position, str(item.get("sku", ""))[:15])
        c.drawString(130, y_position, str(item.get("name", ""))[:30])
        c.drawRightString(350, y_position, str(item.get("qty", 0)))
        c.drawRightString(420, y_position, f"€{abs(item.get('unit_price', 0)):.2f}")
        c.drawRightString(470, y_position, f"{item.get('vat_rate', 21):.0f}%")
        c.drawRightString(540, y_position, f"€{abs(item.get('line_total', 0)):.2f}")
        y_position -= 15
    
    # Totals
    y_position -= 10
    c.line(400, y_position, width - 50, y_position)
    y_position -= 20
    
    c.setFont("Helvetica", 10)
    c.drawString(400, y_position, "Sous-total:")
    c.drawRightString(540, y_position, f"€{doc.get('subtotal', 0):.2f}")
    y_position -= 15
    
    c.drawString(400, y_position, "TVA (21%):")
    c.drawRightString(540, y_position, f"€{doc.get('vat_total', 0):.2f}")
    y_position -= 15
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(400, y_position, "TOTAL:")
    c.drawRightString(540, y_position, f"€{doc.get('total', 0):.2f}")
    
    # Payments if any
    if doc.get("payments") and len(doc["payments"]) > 0:
        y_position -= 25
        c.setFont("Helvetica-Bold", 10)
        c.drawString(400, y_position, "Payé:")
        c.drawRightString(540, y_position, f"€{doc.get('paid_total', 0):.2f}")
        
        remaining = doc.get('total', 0) - doc.get('paid_total', 0)
        if remaining > 0:
            y_position -= 15
            c.setFont("Helvetica", 10)
            c.drawString(400, y_position, "Reste à payer:")
            c.drawRightString(540, y_position, f"€{remaining:.2f}")
    
    # Footer
    c.setFont("Helvetica", 8)
    c.drawCentredString(width/2, 30, "Merci pour votre confiance / Bedankt voor uw vertrouwen")
    
    c.save()
    buffer.seek(0)
    
    # Return PDF as streaming response
    filename = f"{doc.get('number', 'document')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# --- Company Settings Endpoints ---
@api_router.get("/company-settings")
async def get_company_settings():
    """Get company settings for invoicing and Peppol"""
    settings = await db.company_settings.find_one({}, {"_id": 0})
    if not settings:
        # Return default settings
        default = CompanySettings()
        return default.model_dump()
    return settings

@api_router.post("/company-settings")
async def update_company_settings(settings_data: dict = Body(...)):
    """Update company settings"""
    existing = await db.company_settings.find_one({})
    
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        await db.company_settings.update_one(
            {"id": existing["id"]},
            {"$set": settings_data}
        )
        updated = await db.company_settings.find_one({"id": existing["id"]}, {"_id": 0})
        return updated
    else:
        settings_data["id"] = str(uuid.uuid4())
        await db.company_settings.insert_one(settings_data)
        return settings_data

# --- Peppyrus/Peppol Integration Endpoints ---
@api_router.get("/peppyrus/settings")
async def get_peppyrus_settings():
    """Get Peppyrus API settings for Peppol integration"""
    settings = await db.peppyrus_settings.find_one({}, {"_id": 0})
    if not settings:
        default = PeppyrusSettings()
        return default.model_dump()
    # Mask sensitive data
    if settings.get("api_secret"):
        settings["api_secret"] = "***" + settings["api_secret"][-4:] if len(settings.get("api_secret", "")) > 4 else "****"
    return settings

@api_router.post("/peppyrus/settings")
async def update_peppyrus_settings(settings_data: dict = Body(...)):
    """Update Peppyrus settings"""
    existing = await db.peppyrus_settings.find_one({})
    
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        # Don't update secret if masked
        if settings_data.get("api_secret", "").startswith("***"):
            del settings_data["api_secret"]
        
        await db.peppyrus_settings.update_one(
            {"id": existing["id"]},
            {"$set": settings_data}
        )
        updated = await db.peppyrus_settings.find_one({"id": existing["id"]}, {"_id": 0})
        return updated
    else:
        settings_data["id"] = str(uuid.uuid4())
        await db.peppyrus_settings.insert_one(settings_data)
        return settings_data

@api_router.post("/peppyrus/test-connection")
async def test_peppyrus_connection():
    """Test connection to Peppyrus API"""
    import requests
    
    settings = await db.peppyrus_settings.find_one({}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="Peppyrus pas encore configuré. Veuillez d'abord sauvegarder vos paramètres API.")
    if not settings.get("api_key"):
        raise HTTPException(status_code=400, detail="Clé API Peppyrus manquante")
    if not settings.get("api_url"):
        raise HTTPException(status_code=400, detail="URL API Peppyrus manquante")
    
    try:
        # Test API connection
        api_url = settings['api_url'].rstrip('/')
        response = requests.get(
            f"{api_url}/api/v1/status",
            headers={"Authorization": f"Bearer {settings['api_key']}"},
            timeout=10
        )
        
        if response.status_code == 200:
            return {"status": "connected", "message": "Connexion Peppyrus réussie"}
        elif response.status_code == 401:
            return {"status": "error", "message": "Clé API invalide ou expirée"}
        elif response.status_code == 403:
            return {"status": "error", "message": "Accès refusé - vérifiez vos permissions"}
        else:
            return {"status": "error", "message": f"Erreur API: {response.status_code} - {response.text[:100]}"}
    except requests.exceptions.Timeout:
        return {"status": "error", "message": "Timeout - le serveur Peppyrus ne répond pas"}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "Impossible de se connecter au serveur Peppyrus"}
    except Exception as e:
        return {"status": "error", "message": f"Erreur: {str(e)}"}

@api_router.post("/documents/{document_id}/send-peppol")
async def send_document_to_peppol(document_id: str):
    """Send invoice to Peppol network via Peppyrus"""
    import requests
    
    # Get document
    doc = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc["doc_type"] not in ["invoice", "credit_note"]:
        raise HTTPException(status_code=400, detail="Only invoices and credit notes can be sent via Peppol")
    
    if doc.get("peppol_sent"):
        raise HTTPException(status_code=400, detail="Document already sent via Peppol")
    
    # Get Peppyrus settings
    peppyrus = await db.peppyrus_settings.find_one({}, {"_id": 0})
    if not peppyrus or not peppyrus.get("enabled"):
        raise HTTPException(status_code=400, detail="Peppyrus not configured or disabled")
    
    # Get company settings
    company = await db.company_settings.find_one({}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=400, detail="Company settings not configured")
    
    # Get customer
    customer = None
    if doc.get("customer_id"):
        customer = await db.customers.find_one({"id": doc["customer_id"]}, {"_id": 0})
    
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")
    
    # Check for Peppol ID
    peppol_recipient = customer.get("peppol_id") or doc.get("peppol_recipient_id")
    if not peppol_recipient:
        raise HTTPException(status_code=400, detail="Customer has no Peppol ID configured")
    
    # Generate UBL XML
    ubl_xml = generate_ubl_invoice(doc, company, customer)
    
    try:
        # Send to Peppyrus
        api_url = peppyrus.get('api_url', 'https://api.peppyrus.com')
        response = requests.post(
            f"{api_url}/api/v1/documents/send",
            headers={
                "Authorization": f"Bearer {peppyrus['api_key']}",
                "Content-Type": "application/xml",
                "X-Sender-ID": peppyrus.get('sender_id', company.get('peppol_id', '')),
                "X-Recipient-ID": peppol_recipient
            },
            data=ubl_xml,
            timeout=30
        )
        
        if response.status_code in [200, 201, 202]:
            result = response.json()
            peppol_message_id = result.get("document_id") or result.get("message_id") or result.get("id")
            
            # Update document with Peppol status
            await db.documents.update_one(
                {"id": document_id},
                {"$set": {
                    "peppol_status": "sent",
                    "peppol_sent": True,
                    "peppol_sent_at": datetime.now(timezone.utc).isoformat(),
                    "peppol_message_id": peppol_message_id,
                    "peppol_recipient_id": peppol_recipient,
                    "peppol_delivery_status": "pending",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Audit log for Peppol send
            await log_audit(
                action=AuditLogAction.SEND,
                entity_type="document",
                entity_id=document_id,
                entity_number=doc.get("number"),
                description=f"Document {doc.get('number')} sent via Peppol",
                metadata={
                    "peppol_message_id": peppol_message_id,
                    "peppol_recipient_id": peppol_recipient,
                    "doc_type": doc.get("doc_type")
                }
            )
            
            return {
                "status": "success", 
                "peppol_message_id": peppol_message_id,
                "recipient": peppol_recipient
            }
        else:
            await db.documents.update_one(
                {"id": document_id},
                {"$set": {
                    "peppol_status": "failed", 
                    "peppol_delivery_status": f"Error: {response.status_code}",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Audit log for failed Peppol send
            await log_audit(
                action=AuditLogAction.SEND,
                entity_type="document",
                entity_id=document_id,
                entity_number=doc.get("number"),
                description=f"Peppol send failed for {doc.get('number')}",
                metadata={
                    "error_code": response.status_code,
                    "error_message": response.text[:200],
                    "doc_type": doc.get("doc_type")
                }
            )
            
            raise HTTPException(status_code=500, detail=f"Peppol sending failed: {response.text}")
    
    except requests.RequestException as e:
        await db.documents.update_one(
            {"id": document_id},
            {"$set": {
                "peppol_status": "failed", 
                "peppol_delivery_status": f"Network error: {str(e)}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")

def generate_ubl_invoice(doc: dict, company: dict, customer: dict) -> str:
    """Generate UBL 2.1 XML for Peppol BIS Billing 3.0"""
    from xml.etree.ElementTree import Element, SubElement, tostring
    from xml.dom import minidom
    
    # Namespaces
    ns = {
        "": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    }
    
    # Root element
    invoice = Element("Invoice", xmlns=ns[""])
    invoice.set("xmlns:cac", ns["cac"])
    invoice.set("xmlns:cbc", ns["cbc"])
    
    # Customization and Profile ID (Peppol BIS Billing 3.0)
    SubElement(invoice, "{%s}CustomizationID" % ns["cbc"]).text = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
    SubElement(invoice, "{%s}ProfileID" % ns["cbc"]).text = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
    
    # Document info
    SubElement(invoice, "{%s}ID" % ns["cbc"]).text = doc["number"]
    SubElement(invoice, "{%s}IssueDate" % ns["cbc"]).text = doc["created_at"][:10]
    
    # Due date
    if doc.get("due_date"):
        SubElement(invoice, "{%s}DueDate" % ns["cbc"]).text = doc["due_date"][:10]
    
    # Invoice type code (380 = Invoice, 381 = Credit Note)
    type_code = "381" if doc["doc_type"] == "credit_note" else "380"
    SubElement(invoice, "{%s}InvoiceTypeCode" % ns["cbc"]).text = type_code
    
    # Currency
    SubElement(invoice, "{%s}DocumentCurrencyCode" % ns["cbc"]).text = "EUR"
    
    # Supplier (AccountingSupplierParty)
    supplier_party = SubElement(invoice, "{%s}AccountingSupplierParty" % ns["cac"])
    supplier = SubElement(supplier_party, "{%s}Party" % ns["cac"])
    
    # Supplier Endpoint
    endpoint = SubElement(supplier, "{%s}EndpointID" % ns["cbc"])
    endpoint.set("schemeID", "0208")
    endpoint.text = company.get("vat_number", "").replace("BE", "")
    
    # Supplier Name
    party_name = SubElement(supplier, "{%s}PartyName" % ns["cac"])
    SubElement(party_name, "{%s}Name" % ns["cbc"]).text = company.get("company_name", "")
    
    # Supplier Address
    postal_addr = SubElement(supplier, "{%s}PostalAddress" % ns["cac"])
    SubElement(postal_addr, "{%s}StreetName" % ns["cbc"]).text = company.get("street_name", company.get("address_line", ""))
    SubElement(postal_addr, "{%s}CityName" % ns["cbc"]).text = company.get("city", "")
    SubElement(postal_addr, "{%s}PostalZone" % ns["cbc"]).text = company.get("postal_code", "")
    country = SubElement(postal_addr, "{%s}Country" % ns["cac"])
    SubElement(country, "{%s}IdentificationCode" % ns["cbc"]).text = company.get("country", "BE")
    
    # Supplier VAT
    tax_scheme = SubElement(supplier, "{%s}PartyTaxScheme" % ns["cac"])
    SubElement(tax_scheme, "{%s}CompanyID" % ns["cbc"]).text = company.get("vat_number", "")
    tax_scheme_id = SubElement(tax_scheme, "{%s}TaxScheme" % ns["cac"])
    SubElement(tax_scheme_id, "{%s}ID" % ns["cbc"]).text = "VAT"
    
    # Supplier Legal Entity
    legal = SubElement(supplier, "{%s}PartyLegalEntity" % ns["cac"])
    SubElement(legal, "{%s}RegistrationName" % ns["cbc"]).text = company.get("legal_name", company.get("company_name", ""))
    SubElement(legal, "{%s}CompanyID" % ns["cbc"]).text = company.get("company_id", "")
    
    # Customer (AccountingCustomerParty)
    customer_party = SubElement(invoice, "{%s}AccountingCustomerParty" % ns["cac"])
    cust = SubElement(customer_party, "{%s}Party" % ns["cac"])
    
    # Customer Endpoint
    cust_endpoint = SubElement(cust, "{%s}EndpointID" % ns["cbc"])
    cust_endpoint.set("schemeID", "0208")
    cust_endpoint.text = customer.get("peppol_id", "").split(":")[-1] if customer.get("peppol_id") else ""
    
    # Customer Name
    cust_party_name = SubElement(cust, "{%s}PartyName" % ns["cac"])
    SubElement(cust_party_name, "{%s}Name" % ns["cbc"]).text = customer.get("name", "")
    
    # Customer Address
    cust_postal = SubElement(cust, "{%s}PostalAddress" % ns["cac"])
    SubElement(cust_postal, "{%s}StreetName" % ns["cbc"]).text = customer.get("street_name", customer.get("address", ""))
    SubElement(cust_postal, "{%s}CityName" % ns["cbc"]).text = customer.get("city", "")
    SubElement(cust_postal, "{%s}PostalZone" % ns["cbc"]).text = customer.get("postal_code", "")
    cust_country = SubElement(cust_postal, "{%s}Country" % ns["cac"])
    SubElement(cust_country, "{%s}IdentificationCode" % ns["cbc"]).text = customer.get("country", "BE")
    
    # Customer VAT
    if customer.get("vat_number"):
        cust_tax = SubElement(cust, "{%s}PartyTaxScheme" % ns["cac"])
        SubElement(cust_tax, "{%s}CompanyID" % ns["cbc"]).text = customer.get("vat_number", "")
        cust_tax_scheme = SubElement(cust_tax, "{%s}TaxScheme" % ns["cac"])
        SubElement(cust_tax_scheme, "{%s}ID" % ns["cbc"]).text = "VAT"
    
    # Customer Legal Entity
    cust_legal = SubElement(cust, "{%s}PartyLegalEntity" % ns["cac"])
    SubElement(cust_legal, "{%s}RegistrationName" % ns["cbc"]).text = customer.get("name", "")
    
    # Payment Means
    payment = SubElement(invoice, "{%s}PaymentMeans" % ns["cac"])
    SubElement(payment, "{%s}PaymentMeansCode" % ns["cbc"]).text = "30"  # Credit transfer
    
    if company.get("bank_account_iban"):
        payee_account = SubElement(payment, "{%s}PayeeFinancialAccount" % ns["cac"])
        SubElement(payee_account, "{%s}ID" % ns["cbc"]).text = company.get("bank_account_iban", "")
        if company.get("bank_account_bic"):
            fin_inst = SubElement(payee_account, "{%s}FinancialInstitutionBranch" % ns["cac"])
            SubElement(fin_inst, "{%s}ID" % ns["cbc"]).text = company.get("bank_account_bic", "")
    
    # Tax Total
    tax_total = SubElement(invoice, "{%s}TaxTotal" % ns["cac"])
    tax_amount = SubElement(tax_total, "{%s}TaxAmount" % ns["cbc"])
    tax_amount.set("currencyID", "EUR")
    tax_amount.text = f"{doc.get('vat_total', 0):.2f}"
    
    # Group items by VAT rate
    vat_groups = {}
    for item in doc.get("items", []):
        rate = item.get("vat_rate", 21)
        if rate not in vat_groups:
            vat_groups[rate] = {"base": 0, "vat": 0}
        vat_groups[rate]["base"] += item.get("line_subtotal", 0)
        vat_groups[rate]["vat"] += item.get("line_vat", 0)
    
    for rate, amounts in vat_groups.items():
        subtotal = SubElement(tax_total, "{%s}TaxSubtotal" % ns["cac"])
        taxable = SubElement(subtotal, "{%s}TaxableAmount" % ns["cbc"])
        taxable.set("currencyID", "EUR")
        taxable.text = f"{amounts['base']:.2f}"
        
        tax_amt = SubElement(subtotal, "{%s}TaxAmount" % ns["cbc"])
        tax_amt.set("currencyID", "EUR")
        tax_amt.text = f"{amounts['vat']:.2f}"
        
        tax_cat = SubElement(subtotal, "{%s}TaxCategory" % ns["cac"])
        SubElement(tax_cat, "{%s}ID" % ns["cbc"]).text = "S"
        SubElement(tax_cat, "{%s}Percent" % ns["cbc"]).text = str(rate)
        cat_scheme = SubElement(tax_cat, "{%s}TaxScheme" % ns["cac"])
        SubElement(cat_scheme, "{%s}ID" % ns["cbc"]).text = "VAT"
    
    # Legal Monetary Total
    monetary = SubElement(invoice, "{%s}LegalMonetaryTotal" % ns["cac"])
    
    line_ext = SubElement(monetary, "{%s}LineExtensionAmount" % ns["cbc"])
    line_ext.set("currencyID", "EUR")
    line_ext.text = f"{doc.get('subtotal', 0):.2f}"
    
    tax_excl = SubElement(monetary, "{%s}TaxExclusiveAmount" % ns["cbc"])
    tax_excl.set("currencyID", "EUR")
    tax_excl.text = f"{doc.get('subtotal', 0):.2f}"
    
    tax_incl = SubElement(monetary, "{%s}TaxInclusiveAmount" % ns["cbc"])
    tax_incl.set("currencyID", "EUR")
    tax_incl.text = f"{doc.get('total', 0):.2f}"
    
    payable = SubElement(monetary, "{%s}PayableAmount" % ns["cbc"])
    payable.set("currencyID", "EUR")
    payable.text = f"{doc.get('total', 0) - doc.get('paid_total', 0):.2f}"
    
    # Invoice Lines
    for idx, item in enumerate(doc.get("items", []), 1):
        line = SubElement(invoice, "{%s}InvoiceLine" % ns["cac"])
        SubElement(line, "{%s}ID" % ns["cbc"]).text = str(idx)
        
        qty = SubElement(line, "{%s}InvoicedQuantity" % ns["cbc"])
        qty.set("unitCode", "C62")  # One (piece)
        qty.text = str(item.get("qty", 1))
        
        line_amt = SubElement(line, "{%s}LineExtensionAmount" % ns["cbc"])
        line_amt.set("currencyID", "EUR")
        line_amt.text = f"{item.get('line_subtotal', 0):.2f}"
        
        # Item
        inv_item = SubElement(line, "{%s}Item" % ns["cac"])
        SubElement(inv_item, "{%s}Name" % ns["cbc"]).text = item.get("name", "")[:100]
        
        # Item VAT
        item_tax = SubElement(inv_item, "{%s}ClassifiedTaxCategory" % ns["cac"])
        SubElement(item_tax, "{%s}ID" % ns["cbc"]).text = "S"
        SubElement(item_tax, "{%s}Percent" % ns["cbc"]).text = str(item.get("vat_rate", 21))
        item_scheme = SubElement(item_tax, "{%s}TaxScheme" % ns["cac"])
        SubElement(item_scheme, "{%s}ID" % ns["cbc"]).text = "VAT"
        
        # Price
        price = SubElement(line, "{%s}Price" % ns["cac"])
        price_amt = SubElement(price, "{%s}PriceAmount" % ns["cbc"])
        price_amt.set("currencyID", "EUR")
        price_amt.text = f"{item.get('unit_price', 0):.2f}"
    
    # Convert to string
    xml_str = tostring(invoice, encoding="unicode")
    # Pretty print
    parsed = minidom.parseString(xml_str)
    return parsed.toprettyxml(indent="  ")

# --- Audit Log Endpoints (Peppol Compliance) ---
@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, le=500)
):
    """Get audit logs for Peppol compliance and traceability"""
    query = {}
    
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

@api_router.get("/audit-logs/document/{doc_id}")
async def get_document_audit_trail(doc_id: str):
    """Get complete audit trail for a document (Peppol requirement)"""
    # Get the document
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get all audit logs for this document
    logs = await db.audit_logs.find(
        {"entity_id": doc_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Also get logs for related documents
    related_doc_ids = doc.get("related_documents", [])
    if doc.get("source_document_id"):
        related_doc_ids.append(doc.get("source_document_id"))
    if doc.get("reference_invoice_id"):
        related_doc_ids.append(doc.get("reference_invoice_id"))
    
    related_logs = []
    if related_doc_ids:
        related_logs = await db.audit_logs.find(
            {"entity_id": {"$in": related_doc_ids}},
            {"_id": 0}
        ).sort("created_at", 1).to_list(100)
    
    return {
        "document": doc,
        "audit_trail": logs,
        "related_document_logs": related_logs,
        "total_entries": len(logs) + len(related_logs)
    }

@api_router.get("/audit-logs/summary")
async def get_audit_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None)
):
    """Get audit log summary statistics"""
    query = {}
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        query.setdefault("created_at", {})["$lte": date_to]
    
    # Get counts by action type
    pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {
            "_id": {"action": "$action", "entity_type": "$entity_type"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.audit_logs.aggregate(pipeline).to_list(100)
    
    # Format results
    by_action = {}
    by_entity = {}
    
    for r in results:
        action = r["_id"]["action"]
        entity = r["_id"]["entity_type"]
        count = r["count"]
        
        by_action[action] = by_action.get(action, 0) + count
        by_entity[entity] = by_entity.get(entity, 0) + count
    
    total = await db.audit_logs.count_documents(query) if query else await db.audit_logs.count_documents({})
    
    return {
        "total_entries": total,
        "by_action": by_action,
        "by_entity_type": by_entity,
        "detailed": results
    }

# --- Shopify Integration Endpoints ---
@api_router.get("/shopify/settings")
async def get_shopify_settings():
    """Get Shopify integration settings"""
    settings = await db.shopify_settings.find_one({}, {"_id": 0})
    if not settings:
        return None
    return settings

@api_router.post("/shopify/settings")
async def create_or_update_shopify_settings(settings_data: ShopifySettingsUpdate):
    """Create or update Shopify settings"""
    existing = await db.shopify_settings.find_one({})
    
    if existing:
        update_data = {k: v for k, v in settings_data.model_dump(exclude_unset=True).items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.shopify_settings.update_one(
            {"id": existing["id"]},
            {"$set": update_data}
        )
        updated = await db.shopify_settings.find_one({"id": existing["id"]}, {"_id": 0})
        return updated
    else:
        new_settings = ShopifySettings(**settings_data.model_dump(exclude_unset=True))
        await db.shopify_settings.insert_one(new_settings.model_dump())
        return new_settings

@api_router.post("/shopify/sync/products")
async def sync_shopify_products():
    """Import products from Shopify including collections as categories"""
    import requests
    from requests.auth import HTTPBasicAuth
    
    settings = await db.shopify_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("import_products_enabled"):
        raise HTTPException(status_code=400, detail="Shopify not configured or product import disabled")
    
    try:
        store_domain = settings["store_domain"]
        
        # Determine authentication method - prioritize access_token
        if settings.get("access_token"):
            # Use Access Token (preferred method)
            headers = {
                "X-Shopify-Access-Token": settings["access_token"],
                "Content-Type": "application/json"
            }
            auth = None
        elif settings.get("api_key") and settings.get("api_secret"):
            # Use Basic Auth with API Key and Password (legacy)
            auth = HTTPBasicAuth(settings["api_key"], settings["api_secret"])
            headers = {"Content-Type": "application/json"}
        else:
            raise HTTPException(status_code=400, detail="No valid authentication credentials")
        
        items_processed = 0
        items_succeeded = 0
        items_failed = 0
        
        # ============ SYNC COLLECTIONS AS CATEGORIES FIRST ============
        collection_to_category = {}  # Map collection_id -> category_id
        product_collections = {}  # Map product_id -> [collection_ids]
        
        # Fetch custom collections
        try:
            collections_url = f"https://{store_domain}/admin/api/2024-01/custom_collections.json?limit=250"
            if auth:
                coll_response = requests.get(collections_url, auth=auth, headers=headers)
            else:
                coll_response = requests.get(collections_url, headers=headers)
            
            if coll_response.status_code == 200:
                custom_collections = coll_response.json().get("custom_collections", [])
                for coll in custom_collections:
                    coll_id = str(coll["id"])
                    coll_name = coll.get("title", "Collection")
                    
                    # Check if category exists
                    existing_cat = await db.categories.find_one({
                        "$or": [
                            {"name_fr": {"$regex": f"^{coll_name}$", "$options": "i"}},
                            {"shopify_collection_id": coll_id}
                        ]
                    })
                    
                    # Get collection image
                    coll_image = None
                    if coll.get("image") and coll["image"].get("src"):
                        coll_image = coll["image"]["src"]
                    
                    if existing_cat:
                        collection_to_category[coll_id] = existing_cat["id"]
                        # Update image if available
                        if coll_image:
                            await db.categories.update_one(
                                {"id": existing_cat["id"]},
                                {"$set": {"image_url": coll_image}}
                            )
                    else:
                        new_cat = Category(
                            id=str(uuid.uuid4()),
                            name_fr=coll_name,
                            name_nl=coll_name,
                            description=f"Shopify Collection: {coll_name}",
                            image_url=coll_image,
                            active=True
                        )
                        cat_data = new_cat.model_dump()
                        cat_data["shopify_collection_id"] = coll_id
                        await db.categories.insert_one(cat_data)
                        collection_to_category[coll_id] = new_cat.id
                    
                    # Fetch products in this collection (collects)
                    collects_url = f"https://{store_domain}/admin/api/2024-01/collects.json?collection_id={coll_id}&limit=250"
                    if auth:
                        collects_resp = requests.get(collects_url, auth=auth, headers=headers)
                    else:
                        collects_resp = requests.get(collects_url, headers=headers)
                    
                    if collects_resp.status_code == 200:
                        for collect in collects_resp.json().get("collects", []):
                            prod_id = str(collect["product_id"])
                            if prod_id not in product_collections:
                                product_collections[prod_id] = []
                            product_collections[prod_id].append(coll_id)
                            
            logger.info(f"Synced {len(collection_to_category)} collections as categories")
        except Exception as coll_error:
            logger.warning(f"Could not sync collections: {coll_error}")
        
        # Fetch smart collections too
        try:
            smart_url = f"https://{store_domain}/admin/api/2024-01/smart_collections.json?limit=250"
            if auth:
                smart_response = requests.get(smart_url, auth=auth, headers=headers)
            else:
                smart_response = requests.get(smart_url, headers=headers)
            
            if smart_response.status_code == 200:
                smart_collections = smart_response.json().get("smart_collections", [])
                for coll in smart_collections:
                    coll_id = str(coll["id"])
                    coll_name = coll.get("title", "Smart Collection")
                    
                    existing_cat = await db.categories.find_one({
                        "$or": [
                            {"name_fr": {"$regex": f"^{coll_name}$", "$options": "i"}},
                            {"shopify_collection_id": coll_id}
                        ]
                    })
                    
                    # Get collection image
                    coll_image = None
                    if coll.get("image") and coll["image"].get("src"):
                        coll_image = coll["image"]["src"]
                    
                    if existing_cat:
                        collection_to_category[coll_id] = existing_cat["id"]
                        # Update image if available
                        if coll_image:
                            await db.categories.update_one(
                                {"id": existing_cat["id"]},
                                {"$set": {"image_url": coll_image}}
                            )
                    else:
                        new_cat = Category(
                            id=str(uuid.uuid4()),
                            name_fr=coll_name,
                            name_nl=coll_name,
                            description=f"Shopify Smart Collection: {coll_name}",
                            image_url=coll_image,
                            active=True
                        )
                        cat_data = new_cat.model_dump()
                        cat_data["shopify_collection_id"] = coll_id
                        await db.categories.insert_one(cat_data)
                        collection_to_category[coll_id] = new_cat.id
        except Exception as smart_error:
            logger.warning(f"Could not sync smart collections: {smart_error}")
        
        # ============ SYNC PRODUCTS ============
        # Pagination: Fetch all products
        page_info = None
        has_next_page = True
        
        while has_next_page:
            # Build URL with pagination
            if page_info:
                api_url = f"https://{store_domain}/admin/api/2024-01/products.json?limit=250&page_info={page_info}"
            else:
                api_url = f"https://{store_domain}/admin/api/2024-01/products.json?limit=250"
            
            # Make request
            if auth:
                response = requests.get(api_url, auth=auth, headers=headers)
            else:
                response = requests.get(api_url, headers=headers)
            
            response.raise_for_status()
            
            shopify_products = response.json().get("products", [])
            
            # Check for next page in Link header
            link_header = response.headers.get("Link", "")
            has_next_page = 'rel="next"' in link_header
            
            if has_next_page:
                # Extract page_info from Link header
                import re
                next_link = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
                if next_link:
                    next_url = next_link.group(1)
                    page_info_match = re.search(r'page_info=([^&]+)', next_url)
                    if page_info_match:
                        page_info = page_info_match.group(1)
        
            for shop_product in shopify_products:
                # Get product image (first image or variant-specific image)
                product_image = None
                if shop_product.get("images") and len(shop_product["images"]) > 0:
                    product_image = shop_product["images"][0].get("src")
                
                # Map Shopify product_type to POS category
                shopify_category_name = shop_product.get("product_type") or shop_product.get("vendor") or "Default"
                category_id = "default"
                
                if shopify_category_name:
                    # Try to find existing category by name (case-insensitive)
                    existing_category = await db.categories.find_one({
                        "$or": [
                            {"name_fr": {"$regex": f"^{shopify_category_name}$", "$options": "i"}},
                            {"name_nl": {"$regex": f"^{shopify_category_name}$", "$options": "i"}}
                        ]
                    })
                    
                    if existing_category:
                        category_id = existing_category["id"]
                    else:
                        # Create new category from Shopify product_type
                        new_category = Category(
                            id=str(uuid.uuid4()),
                            name_fr=shopify_category_name,
                            name_nl=shopify_category_name,
                            description=f"Imported from Shopify: {shopify_category_name}",
                            active=True
                        )
                        await db.categories.insert_one(new_category.model_dump())
                        category_id = new_category.id
                
                for variant in shop_product.get("variants", []):
                    items_processed += 1
                    
                    # Check if product already exists by SKU or Shopify ID
                    existing = await db.products.find_one({
                        "$or": [
                            {"shopify_variant_id": str(variant["id"])},
                            {"sku": variant.get("sku")} if variant.get("sku") else {}
                        ]
                    })
                    
                    # Get variant-specific image if available, otherwise use product image
                    variant_image = product_image
                    if variant.get("image_id") and shop_product.get("images"):
                        for img in shop_product["images"]:
                            if img.get("id") == variant.get("image_id"):
                                variant_image = img.get("src")
                                break
                    
                    # Extract weight (convert to kg)
                    weight = variant.get("weight")
                    weight_unit = variant.get("weight_unit", "kg")
                    if weight and weight_unit == "g":
                        weight = weight / 1000
                        weight_unit = "kg"
                    elif weight and weight_unit == "lb":
                        weight = weight * 0.453592
                        weight_unit = "kg"
                    
                    # Get barcode/EAN - prioritize barcode field
                    barcode_value = variant.get("barcode") or ""
                    gtin_value = barcode_value if barcode_value and len(barcode_value) >= 8 else None
                    
                    # Build variant title for multi-variant products
                    variant_title = shop_product["title"]
                    variant_options_str = None
                    if variant.get("title") and variant.get("title") != "Default Title":
                        variant_title = f"{shop_product['title']} - {variant['title']}"
                        variant_options_str = variant.get("title")
                    
                    # Extract variant options (option1, option2, option3 = size, color, etc.)
                    option1 = variant.get("option1")  # Usually size
                    option2 = variant.get("option2")  # Usually color
                    option3 = variant.get("option3")  # Other attribute
                    
                    # Get option names from product options
                    product_options = shop_product.get("options", [])
                    option_names = {i+1: opt.get("name", f"Option {i+1}") for i, opt in enumerate(product_options)}
                    
                    # Build metafields from variant options
                    metafields = {}
                    if option1 and option_names.get(1):
                        metafields[option_names[1].lower()] = option1
                    if option2 and option_names.get(2):
                        metafields[option_names[2].lower()] = option2
                    if option3 and option_names.get(3):
                        metafields[option_names[3].lower()] = option3
                    
                    # Determine category: prefer collection, then product_type
                    shop_product_id = str(shop_product["id"])
                    final_category_id = category_id  # Default from product_type
                    collection_ids_list = []
                    
                    if shop_product_id in product_collections and product_collections[shop_product_id]:
                        collection_ids_list = product_collections[shop_product_id]
                        # Use first collection as primary category
                        first_collection_id = collection_ids_list[0]
                        if first_collection_id in collection_to_category:
                            final_category_id = collection_to_category[first_collection_id]
                    
                    product_data = {
                        "name_fr": variant_title,
                        "name_nl": variant_title,
                        "description_fr": shop_product.get("body_html", "")[:500] if shop_product.get("body_html") else None,
                        "description_nl": shop_product.get("body_html", "")[:500] if shop_product.get("body_html") else None,
                        "sku": variant.get("sku") or f"SHOP-{variant['id']}",
                        "barcode": barcode_value,
                        "gtin": gtin_value,  # EAN-13, UPC, etc.
                        "price_retail": float(variant.get("price", 0)),
                        "compare_at_price": float(variant.get("compare_at_price")) if variant.get("compare_at_price") else None,
                        "cost_price": float(variant.get("inventory_item", {}).get("cost")) if variant.get("inventory_item", {}).get("cost") else None,
                        "unit": "piece",  # Default unit
                        "stock_qty": variant.get("inventory_quantity", 0),
                        "category_id": final_category_id,
                        # Physical attributes
                        "weight": weight,
                        "weight_unit": weight_unit,
                        # Variant options as attributes
                        "size": option1 if option_names.get(1, "").lower() in ["size", "taille", "maat", "größe"] else None,
                        "color": option2 if option_names.get(2, "").lower() in ["color", "colour", "couleur", "kleur", "farbe"] else (option1 if option_names.get(1, "").lower() in ["color", "colour", "couleur", "kleur", "farbe"] else None),
                        "variant_title": variant_options_str,
                        "metafields": metafields if metafields else None,
                        "collection_ids": collection_ids_list if collection_ids_list else None,
                        # Shopify specific
                        "vendor": shop_product.get("vendor"),
                        "tags": shop_product.get("tags"),  # Comma-separated
                        "product_type": shop_product.get("product_type"),
                        "image_url": variant_image,
                        "origin": ProductOrigin.SHOPIFY,
                        "shopify_product_id": str(shop_product["id"]),
                        "shopify_variant_id": str(variant["id"]),
                        "shopify_inventory_item_id": str(variant.get("inventory_item_id")) if variant.get("inventory_item_id") else None,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    if existing:
                        # Update existing product
                        await db.products.update_one(
                            {"id": existing["id"]},
                            {"$set": product_data}
                        )
                        items_succeeded += 1
                    else:
                        # Create new product
                        new_product = Product(
                            id=str(uuid.uuid4()),
                            **product_data,
                            created_at=datetime.now(timezone.utc).isoformat()
                        )
                        await db.products.insert_one(new_product.model_dump())
                        items_succeeded += 1
        
        # Log success
        log = ShopifySyncLog(
            sync_type="product_import",
            status=ShopifySyncStatus.SUCCESS,
            items_processed=items_processed,
            items_succeeded=items_succeeded,
            items_failed=items_failed,
            details={"products_imported": items_succeeded}
        )
        await db.shopify_sync_logs.insert_one(log.model_dump())
        
        await db.shopify_settings.update_one(
            {"id": settings["id"]},
            {"$set": {"last_product_sync": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "status": "success", 
            "items_processed": items_processed,
            "items_succeeded": items_succeeded,
            "items_failed": items_failed
        }
        
    except Exception as e:
        logger.error(f"Shopify sync error: {str(e)}")
        
        # Log failure
        log = ShopifySyncLog(
            sync_type="product_import",
            status=ShopifySyncStatus.FAILED,
            items_processed=0,
            items_succeeded=0,
            items_failed=0,
            error_message=str(e),
            details={"error": str(e)}
        )
        await db.shopify_sync_logs.insert_one(log.model_dump())
        
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@api_router.post("/shopify/sync/stock")
async def sync_stock_to_shopify():
    """Push stock quantities to Shopify"""
    import requests
    
    settings = await db.shopify_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("export_stock_enabled"):
        raise HTTPException(status_code=400, detail="Shopify not configured or stock export disabled")
    
    try:
        headers = {
            "X-Shopify-Access-Token": settings["access_token"],
            "Content-Type": "application/json"
        }
        
        store_domain = settings["store_domain"]
        
        # Get all products with Shopify mapping
        products = await db.products.find(
            {"shopify_variant_id": {"$ne": None, "$exists": True}},
            {"_id": 0}
        ).to_list(1000)
        
        items_processed = 0
        items_succeeded = 0
        items_failed = 0
        
        for product in products:
            items_processed += 1
            variant_id = product.get("shopify_variant_id")
            
            try:
                # Get inventory item ID from variant
                variant_url = f"https://{store_domain}/admin/api/2024-01/variants/{variant_id}.json"
                variant_response = requests.get(variant_url, headers=headers)
                variant_response.raise_for_status()
                
                inventory_item_id = variant_response.json()["variant"]["inventory_item_id"]
                
                # Get location ID (first location)
                locations_url = f"https://{store_domain}/admin/api/2024-01/locations.json"
                locations_response = requests.get(locations_url, headers=headers)
                locations_response.raise_for_status()
                
                locations = locations_response.json().get("locations", [])
                if not locations:
                    continue
                    
                location_id = locations[0]["id"]
                
                # Update inventory level
                inventory_url = f"https://{store_domain}/admin/api/2024-01/inventory_levels/set.json"
                inventory_data = {
                    "location_id": location_id,
                    "inventory_item_id": inventory_item_id,
                    "available": product.get("stock", 0)
                }
                
                inventory_response = requests.post(inventory_url, headers=headers, json=inventory_data)
                inventory_response.raise_for_status()
                
                items_succeeded += 1
                
            except Exception as e:
                logger.error(f"Failed to update stock for variant {variant_id}: {str(e)}")
                items_failed += 1
        
        # Log success
        log = ShopifySyncLog(
            sync_type="stock_export",
            status=ShopifySyncStatus.SUCCESS,
            items_processed=items_processed,
            items_succeeded=items_succeeded,
            items_failed=items_failed,
            details={"stock_updated": items_succeeded}
        )
        await db.shopify_sync_logs.insert_one(log.model_dump())
        
        await db.shopify_settings.update_one(
            {"id": settings["id"]},
            {"$set": {"last_stock_sync": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "status": "success",
            "items_synced": items_succeeded,
            "items_failed": items_failed
        }
        
    except Exception as e:
        logger.error(f"Stock sync error: {str(e)}")
        
        log = ShopifySyncLog(
            sync_type="stock_export",
            status=ShopifySyncStatus.FAILED,
            items_processed=0,
            items_succeeded=0,
            items_failed=0,
            error_message=str(e)
        )
        await db.shopify_sync_logs.insert_one(log.model_dump())
        
        raise HTTPException(status_code=500, detail=f"Stock sync failed: {str(e)}")

@api_router.post("/shopify/sync/orders")
async def sync_shopify_orders():
    """Import orders from Shopify as POS sales with channel='Online'"""
    settings = await db.shopify_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("import_orders_enabled"):
        raise HTTPException(status_code=400, detail="Shopify not configured or order import disabled")
    
    # TODO: Actual Shopify Orders API integration
    log = ShopifySyncLog(
        sync_type="order_import",
        status=ShopifySyncStatus.SUCCESS,
        items_processed=0,
        items_succeeded=0,
        items_failed=0,
        details={"message": "Shopify Orders API integration pending"}
    )
    await db.shopify_sync_logs.insert_one(log.model_dump())
    
    await db.shopify_settings.update_one(
        {"id": settings["id"]},
        {"$set": {"last_order_sync": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "message": "Order sync placeholder executed"}

# ============= REPORTS API =============
@api_router.get("/reports/dashboard")
async def get_reports_dashboard(date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Get dashboard statistics for reports"""
    # Build date query
    date_query = {}
    if date_from:
        date_query["$gte"] = date_from
    if date_to:
        date_query["$lte"] = date_to + "T23:59:59"
    
    query = {}
    if date_query:
        query["created_at"] = date_query
    
    # Get documents for period
    docs = await db.documents.find(
        {**query, "doc_type": {"$in": ["invoice", "receipt"]}},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate totals
    total_sales = sum(d.get("total", 0) for d in docs if d.get("status") in ["paid", "partially_paid"])
    transactions_count = len(docs)
    products_sold = sum(sum(item.get("qty", 0) for item in d.get("items", [])) for d in docs)
    
    # Get unique customers
    customer_ids = set(d.get("customer_id") for d in docs if d.get("customer_id"))
    active_customers = len(customer_ids)
    
    # Calculate previous period for comparison
    # (simplified - just show zeros for now if no comparison data)
    
    # Top products
    product_counts = {}
    for doc in docs:
        for item in doc.get("items", []):
            pid = item.get("product_id", item.get("sku"))
            if pid:
                if pid not in product_counts:
                    product_counts[pid] = {"name": item.get("name"), "qty": 0, "revenue": 0}
                product_counts[pid]["qty"] += item.get("qty", 0)
                product_counts[pid]["revenue"] += item.get("line_subtotal", item.get("qty", 0) * item.get("unit_price", 0))
    
    top_products = sorted(product_counts.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Sales by payment method
    payment_methods = {"cash": 0, "card": 0, "bank_transfer": 0}
    for doc in docs:
        for payment in doc.get("payments", []):
            method = payment.get("method", "cash")
            payment_methods[method] = payment_methods.get(method, 0) + payment.get("amount", 0)
    
    # Daily sales trend
    daily_sales = {}
    for doc in docs:
        date = doc.get("created_at", "")[:10]
        if date:
            if date not in daily_sales:
                daily_sales[date] = {"date": date, "total": 0, "count": 0}
            daily_sales[date]["total"] += doc.get("total", 0)
            daily_sales[date]["count"] += 1
    
    daily_trend = sorted(daily_sales.values(), key=lambda x: x["date"])
    
    # VAT breakdown
    vat_breakdown = {}
    for doc in docs:
        for item in doc.get("items", []):
            rate = str(int(item.get("vat_rate", 21)))
            if rate not in vat_breakdown:
                vat_breakdown[rate] = {"rate": rate, "base": 0, "vat": 0}
            vat_breakdown[rate]["base"] += item.get("line_subtotal", 0)
            vat_breakdown[rate]["vat"] += item.get("line_vat", 0)
    
    return {
        "summary": {
            "total_sales": round(total_sales, 2),
            "transactions_count": transactions_count,
            "products_sold": int(products_sold),
            "active_customers": active_customers,
            "average_ticket": round(total_sales / transactions_count, 2) if transactions_count > 0 else 0
        },
        "top_products": top_products,
        "payment_methods": payment_methods,
        "daily_trend": daily_trend,
        "vat_breakdown": list(vat_breakdown.values())
    }

@api_router.get("/reports/vat")
async def get_vat_report(date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Get VAT report for accounting"""
    date_query = {}
    if date_from:
        date_query["$gte"] = date_from
    if date_to:
        date_query["$lte"] = date_to + "T23:59:59"
    
    query = {"doc_type": {"$in": ["invoice", "receipt"]}}
    if date_query:
        query["created_at"] = date_query
    
    docs = await db.documents.find(query, {"_id": 0}).to_list(10000)
    
    vat_breakdown = {}
    for doc in docs:
        for item in doc.get("items", []):
            rate = str(int(item.get("vat_rate", 21)))
            if rate not in vat_breakdown:
                vat_breakdown[rate] = {"rate": int(rate), "base": 0, "vat": 0, "total": 0}
            vat_breakdown[rate]["base"] += item.get("line_subtotal", 0)
            vat_breakdown[rate]["vat"] += item.get("line_vat", 0)
            vat_breakdown[rate]["total"] += item.get("line_total", 0)
    
    totals = {
        "base": sum(v["base"] for v in vat_breakdown.values()),
        "vat": sum(v["vat"] for v in vat_breakdown.values()),
        "total": sum(v["total"] for v in vat_breakdown.values())
    }
    
    return {
        "period": {"from": date_from, "to": date_to},
        "breakdown": list(vat_breakdown.values()),
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "documents_count": len(docs)
    }

@api_router.get("/reports/inventory")
async def get_inventory_report():
    """Get current inventory status"""
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    total_value = sum(p.get("stock_qty", 0) * p.get("price_retail", 0) for p in products)
    total_items = sum(p.get("stock_qty", 0) for p in products)
    
    low_stock = [p for p in products if p.get("stock_qty", 0) <= p.get("min_stock", 0)]
    out_of_stock = [p for p in products if p.get("stock_qty", 0) == 0]
    
    return {
        "summary": {
            "total_products": len(products),
            "total_items": total_items,
            "total_value": round(total_value, 2),
            "low_stock_count": len(low_stock),
            "out_of_stock_count": len(out_of_stock)
        },
        "low_stock": low_stock[:20],
        "out_of_stock": out_of_stock[:20]
    }

@api_router.get("/shopify/sync-logs")
async def get_shopify_sync_logs(limit: int = Query(50)):
    """Get Shopify sync logs"""
    logs = await db.shopify_sync_logs.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return logs

@api_router.get("/shopify/unmapped-products")
async def get_unmapped_products():
    """Get products from Shopify that couldn't be auto-mapped"""
    unmapped = await db.unmapped_products.find({}, {"_id": 0}).to_list(100)
    return unmapped

@api_router.post("/shopify/unmapped-products/{unmapped_id}/map")
async def map_unmapped_product(unmapped_id: str, pos_product_id: str):
    """Manually map an unmapped Shopify product to a POS product"""
    unmapped = await db.unmapped_products.find_one({"id": unmapped_id}, {"_id": 0})
    if not unmapped:
        raise HTTPException(status_code=404, detail="Unmapped product not found")
    
    pos_product = await db.products.find_one({"id": pos_product_id}, {"_id": 0})
    if not pos_product:
        raise HTTPException(status_code=404, detail="POS product not found")
    
    # Update POS product with Shopify mapping
    await db.products.update_one(
        {"id": pos_product_id},
        {"$set": {
            "shopify_variant_id": unmapped["shopify_variant_id"],
            "shopify_product_id": unmapped["shopify_product_id"],
            "origin": ProductOrigin.SHOPIFY
        }}
    )
    
    # Remove from unmapped queue
    await db.unmapped_products.delete_one({"id": unmapped_id})
    
    return {"status": "success", "message": "Product mapped successfully"}

# ============= SETUP =============
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= HEALTH CHECK =============
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and Docker"""
    try:
        # Check database connection
        await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

from fastapi import FastAPI, APIRouter, HTTPException, Query, Body
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
    CREDIT_NOTE = "credit_note"  # Note de crédit
    DELIVERY_NOTE = "delivery_note"  # Bon de livraison

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

class ShiftStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"

class CashMovementType(str, Enum):
    CASH_IN = "cash_in"
    CASH_OUT = "cash_out"
    SALE = "sale"
    REFUND = "refund"

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

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    barcode: Optional[str] = None
    name_fr: str
    name_nl: str
    category_id: str
    unit: Unit
    price_retail: float
    price_wholesale: Optional[float] = None
    price_loyal: Optional[float] = None
    vat_rate: float = 21.0
    stock_qty: int = 0
    min_stock: int = 0
    image_url: Optional[str] = None
    origin: ProductOrigin = ProductOrigin.LOCAL
    shopify_variant_id: Optional[str] = None
    shopify_product_id: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: CustomerType
    name: str
    vat_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "BE"
    credit_limit: float = 0.0
    balance: float = 0.0  # Negative = owes money
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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
    # Peppol fields
    peppol_status: Optional[str] = None
    peppol_id: Optional[str] = None

# Shifts
class ShiftCreate(BaseModel):
    opening_cash: float
    cashier_name: Optional[str] = None

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

class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: ShiftStatus = ShiftStatus.OPEN
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
    access_token: str
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
    await db.products.create_index("barcode")

# ============= API ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "ALPHA&CO POS API", "version": "2.0.0"}

# --- Categories ---
@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(100)

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
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})

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
    if doc_data.customer_id:
        customer = await db.customers.find_one({"id": doc_data.customer_id}, {"_id": 0})
        if customer:
            customer_name = customer.get("name")
            customer_vat = customer.get("vat_number")
            customer_address = f"{customer.get('address', '')}, {customer.get('postal_code', '')} {customer.get('city', '')}"
    
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
        shift_id=shift_id
    )
    
    doc_dict = doc.model_dump()
    await db.documents.insert_one(doc_dict)
    
    # Update stock for invoices/receipts (not quotes)
    if doc_data.doc_type in [DocumentType.INVOICE, DocumentType.RECEIPT]:
        for item in doc_data.items:
            await record_stock_movement(
                item.product_id, item.sku, StockMovementType.SALE, 
                item.qty, "document", doc.id
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
        await db.documents.update_one(
            {"id": doc_data.source_document_id},
            {"$push": {"related_documents": doc.id}, "$set": {"status": DocumentStatus.ACCEPTED}}
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
    
    shift = await get_current_shift()
    
    new_payment = Payment(
        **payment.model_dump(),
        document_id=doc_id,
        shift_id=shift.get("id") if shift else None
    )
    
    new_paid_total = doc.get("paid_total", 0) + payment.amount
    new_status = DocumentStatus.PAID if new_paid_total >= doc["total"] else DocumentStatus.PARTIALLY_PAID
    
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

# --- Returns / Credit Notes ---
@api_router.post("/returns")
async def create_return(return_data: ReturnCreate):
    """Process a return and create a credit note"""
    original_doc = await db.documents.find_one({"id": return_data.original_document_id}, {"_id": 0})
    if not original_doc:
        raise HTTPException(status_code=404, detail="Original document not found")
    
    # Create credit note items
    credit_items = []
    total_refund = 0.0
    
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
        await record_stock_movement(
            item.product_id, item.sku, StockMovementType.RETURN,
            item.qty, "return", return_data.original_document_id, item.reason
        )
    
    # Create credit note
    credit_note_data = DocumentCreate(
        doc_type=DocumentType.CREDIT_NOTE,
        customer_id=original_doc.get("customer_id"),
        items=credit_items,
        payments=[PaymentCreate(method=return_data.refund_method or PaymentMethod.CASH, amount=-total_refund)] if return_data.refund_method else [],
        notes=return_data.notes,
        source_document_id=return_data.original_document_id
    )
    
    credit_note = await create_document(credit_note_data)
    
    # Update original document
    await db.documents.update_one(
        {"id": return_data.original_document_id},
        {"$set": {"status": DocumentStatus.CREDITED}, "$push": {"related_documents": credit_note.id}}
    )
    
    # Update shift refunds
    shift = await get_current_shift()
    if shift:
        await db.shifts.update_one({"id": shift["id"]}, {"$inc": {"refunds_total": total_refund}})
    
    return credit_note

# --- Shifts ---
@api_router.post("/shifts/open", response_model=Shift)
async def open_shift(data: ShiftCreate):
    existing = await db.shifts.find_one({"status": ShiftStatus.OPEN})
    if existing:
        raise HTTPException(status_code=400, detail="A shift is already open")
    
    shift = Shift(
        opening_cash=data.opening_cash,
        cashier_name=data.cashier_name,
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

# --- Peppol Placeholder ---
@api_router.post("/documents/{doc_id}/send-peppol")
async def send_peppol(doc_id: str):
    """Placeholder for Peppol e-invoicing"""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # TODO: Implement actual Peppol UBL XML generation and sending
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {"peppol_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "pending", "message": "Peppol integration not yet implemented"}

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
    """Import products from Shopify (MVP: manual trigger only)"""
    settings = await db.shopify_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("import_products_enabled"):
        raise HTTPException(status_code=400, detail="Shopify not configured or product import disabled")
    
    # TODO: Actual Shopify API integration
    # For MVP, this is a placeholder that logs the sync attempt
    log = ShopifySyncLog(
        sync_type="product_import",
        status=ShopifySyncStatus.SUCCESS,
        items_processed=0,
        items_succeeded=0,
        items_failed=0,
        details={"message": "Shopify API integration pending"}
    )
    await db.shopify_sync_logs.insert_one(log.model_dump())
    
    await db.shopify_settings.update_one(
        {"id": settings["id"]},
        {"$set": {"last_product_sync": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "message": "Product sync placeholder executed"}

@api_router.post("/shopify/sync/stock")
async def sync_stock_to_shopify():
    """Push stock quantities to Shopify (batch operation)"""
    settings = await db.shopify_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("export_stock_enabled"):
        raise HTTPException(status_code=400, detail="Shopify not configured or stock export disabled")
    
    # Get all products with Shopify mapping
    products = await db.products.find(
        {"shopify_variant_id": {"$ne": None}},
        {"_id": 0}
    ).to_list(1000)
    
    # TODO: Actual Shopify API stock update
    log = ShopifySyncLog(
        sync_type="stock_export",
        status=ShopifySyncStatus.SUCCESS,
        items_processed=len(products),
        items_succeeded=len(products),
        items_failed=0,
        details={"message": f"Found {len(products)} mapped products for stock sync"}
    )
    await db.shopify_sync_logs.insert_one(log.model_dump())
    
    await db.shopify_settings.update_one(
        {"id": settings["id"]},
        {"$set": {"last_stock_sync": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "items_synced": len(products)}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

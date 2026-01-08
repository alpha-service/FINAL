from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ALPHA&CO POS API")
api_router = APIRouter(prefix="/api")

# Enums
class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"

class SaleStatus(str, Enum):
    DRAFT = "draft"
    UNPAID = "unpaid"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"

class CustomerType(str, Enum):
    INDIVIDUAL = "individual"
    COMPANY = "company"

class Unit(str, Enum):
    PIECE = "piece"
    METER = "meter"
    M2 = "m²"
    BOX = "box"

# Models
class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_fr: str
    name_nl: str

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name_fr: str
    name_nl: str
    category_id: str
    unit: Unit
    price_retail: float
    price_wholesale: Optional[float] = None
    price_loyal: Optional[float] = None
    vat_rate: float = 21.0
    stock_qty: int = 0
    image_url: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: CustomerType
    name: str
    vat_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaleItemCreate(BaseModel):
    product_id: str
    sku: str
    name: str
    qty: int
    unit_price: float
    discount_type: Optional[str] = None
    discount_value: float = 0.0
    vat_rate: float = 21.0

class SaleItem(SaleItemCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    line_total: float = 0.0

class PaymentCreate(BaseModel):
    method: PaymentMethod
    amount: float
    reference: Optional[str] = None

class Payment(PaymentCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaleCreate(BaseModel):
    customer_id: Optional[str] = None
    items: List[SaleItemCreate]
    payments: List[PaymentCreate]
    global_discount_type: Optional[str] = None
    global_discount_value: float = 0.0

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: str
    status: SaleStatus = SaleStatus.DRAFT
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    items: List[SaleItem] = []
    payments: List[Payment] = []
    subtotal: float = 0.0
    vat_total: float = 0.0
    total: float = 0.0
    paid_total: float = 0.0
    global_discount_type: Optional[str] = None
    global_discount_value: float = 0.0
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Helper to generate invoice number
async def generate_sale_number() -> str:
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    count = await db.sales.count_documents({"number": {"$regex": f"^{today}"}})
    return f"{today}-{str(count + 1).zfill(3)}"

# Seed data
CATEGORIES = [
    {"id": "cat-pipes", "name_fr": "Tuyaux", "name_nl": "Buizen"},
    {"id": "cat-fasteners", "name_fr": "Fixations", "name_nl": "Bevestigingen"},
    {"id": "cat-insulation", "name_fr": "Isolation", "name_nl": "Isolatie"},
    {"id": "cat-tools", "name_fr": "Outils", "name_nl": "Gereedschap"},
]

PRODUCTS = [
    # Pipes (12 products)
    {"id": "p001", "sku": "GG10WP035020", "name_fr": "Tuyau PVC 35mm", "name_nl": "PVC Buis 35mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 4.50, "price_wholesale": 3.80, "vat_rate": 21.0, "stock_qty": 250, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p002", "sku": "GG10WP050020", "name_fr": "Tuyau PVC 50mm", "name_nl": "PVC Buis 50mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 6.80, "price_wholesale": 5.50, "vat_rate": 21.0, "stock_qty": 180, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p003", "sku": "GG10WP075020", "name_fr": "Tuyau PVC 75mm", "name_nl": "PVC Buis 75mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 9.20, "price_wholesale": 7.80, "vat_rate": 21.0, "stock_qty": 120, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p004", "sku": "GG10WP100020", "name_fr": "Tuyau PVC 100mm", "name_nl": "PVC Buis 100mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 12.50, "price_wholesale": 10.20, "vat_rate": 21.0, "stock_qty": 90, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p005", "sku": "GG20CU015010", "name_fr": "Tube Cuivre 15mm", "name_nl": "Koperen Buis 15mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 8.90, "price_wholesale": 7.50, "vat_rate": 21.0, "stock_qty": 200, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p006", "sku": "GG20CU022010", "name_fr": "Tube Cuivre 22mm", "name_nl": "Koperen Buis 22mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 12.30, "price_wholesale": 10.50, "vat_rate": 21.0, "stock_qty": 150, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p007", "sku": "GG30PE032025", "name_fr": "Tuyau PE 32mm", "name_nl": "PE Buis 32mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 3.20, "price_wholesale": 2.60, "vat_rate": 21.0, "stock_qty": 500, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p008", "sku": "GG30PE050025", "name_fr": "Tuyau PE 50mm", "name_nl": "PE Buis 50mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 5.40, "price_wholesale": 4.30, "vat_rate": 21.0, "stock_qty": 350, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p009", "sku": "GG40MU020015", "name_fr": "Multicouche 20mm", "name_nl": "Meerlagenbuis 20mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 4.80, "price_wholesale": 3.90, "vat_rate": 21.0, "stock_qty": 400, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p010", "sku": "GG40MU026015", "name_fr": "Multicouche 26mm", "name_nl": "Meerlagenbuis 26mm", "category_id": "cat-pipes", "unit": "meter", "price_retail": 6.50, "price_wholesale": 5.30, "vat_rate": 21.0, "stock_qty": 300, "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"},
    {"id": "p011", "sku": "GG50DR110020", "name_fr": "Drain 110mm", "name_nl": "Afvoerbuis 110mm", "category_id": "cat-pipes", "unit": "piece", "price_retail": 18.90, "price_wholesale": 15.50, "vat_rate": 21.0, "stock_qty": 80, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    {"id": "p012", "sku": "GG50DR160020", "name_fr": "Drain 160mm", "name_nl": "Afvoerbuis 160mm", "category_id": "cat-pipes", "unit": "piece", "price_retail": 28.50, "price_wholesale": 23.00, "vat_rate": 21.0, "stock_qty": 50, "image_url": "https://images.unsplash.com/photo-1581092160607-ee67df9c9389?w=400"},
    
    # Fasteners (13 products)
    {"id": "p013", "sku": "FX10VS004025", "name_fr": "Vis 4x25mm (100pc)", "name_nl": "Schroef 4x25mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 6.90, "price_wholesale": 5.50, "vat_rate": 21.0, "stock_qty": 500, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p014", "sku": "FX10VS005040", "name_fr": "Vis 5x40mm (100pc)", "name_nl": "Schroef 5x40mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 8.50, "price_wholesale": 6.80, "vat_rate": 21.0, "stock_qty": 400, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p015", "sku": "FX10VS006060", "name_fr": "Vis 6x60mm (100pc)", "name_nl": "Schroef 6x60mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 12.30, "price_wholesale": 9.90, "vat_rate": 21.0, "stock_qty": 350, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p016", "sku": "FX20BL006050", "name_fr": "Boulon M6x50 (50pc)", "name_nl": "Bout M6x50 (50st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 14.80, "price_wholesale": 11.90, "vat_rate": 21.0, "stock_qty": 200, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p017", "sku": "FX20BL008070", "name_fr": "Boulon M8x70 (50pc)", "name_nl": "Bout M8x70 (50st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 18.50, "price_wholesale": 14.90, "vat_rate": 21.0, "stock_qty": 180, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p018", "sku": "FX30CH006010", "name_fr": "Cheville 6mm (100pc)", "name_nl": "Plug 6mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 5.90, "price_wholesale": 4.70, "vat_rate": 21.0, "stock_qty": 600, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p019", "sku": "FX30CH008010", "name_fr": "Cheville 8mm (100pc)", "name_nl": "Plug 8mm (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 7.20, "price_wholesale": 5.80, "vat_rate": 21.0, "stock_qty": 550, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p020", "sku": "FX30CH010010", "name_fr": "Cheville 10mm (50pc)", "name_nl": "Plug 10mm (50st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 400, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p021", "sku": "FX40CL025001", "name_fr": "Clou 25mm (1kg)", "name_nl": "Spijker 25mm (1kg)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 9.80, "price_wholesale": 7.80, "vat_rate": 21.0, "stock_qty": 300, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p022", "sku": "FX40CL040001", "name_fr": "Clou 40mm (1kg)", "name_nl": "Spijker 40mm (1kg)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 10.50, "price_wholesale": 8.40, "vat_rate": 21.0, "stock_qty": 280, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p023", "sku": "FX50TQ010002", "name_fr": "Tire-fond 10x80 (25pc)", "name_nl": "Houtdraadbout 10x80 (25st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 16.90, "price_wholesale": 13.50, "vat_rate": 21.0, "stock_qty": 150, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p024", "sku": "FX60EC006001", "name_fr": "Écrou M6 (100pc)", "name_nl": "Moer M6 (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 4.50, "price_wholesale": 3.60, "vat_rate": 21.0, "stock_qty": 700, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    {"id": "p025", "sku": "FX70RD006001", "name_fr": "Rondelle M6 (100pc)", "name_nl": "Ring M6 (100st)", "category_id": "cat-fasteners", "unit": "box", "price_retail": 3.20, "price_wholesale": 2.50, "vat_rate": 21.0, "stock_qty": 800, "image_url": "https://images.pexels.com/photos/5691590/pexels-photo-5691590.jpeg?w=400"},
    
    # Insulation (13 products)
    {"id": "p026", "sku": "IS10LV050060", "name_fr": "Laine Verre 50mm", "name_nl": "Glaswol 50mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 450, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p027", "sku": "IS10LV080060", "name_fr": "Laine Verre 80mm", "name_nl": "Glaswol 80mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 12.50, "price_wholesale": 10.00, "vat_rate": 21.0, "stock_qty": 380, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p028", "sku": "IS10LV100060", "name_fr": "Laine Verre 100mm", "name_nl": "Glaswol 100mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 15.80, "price_wholesale": 12.60, "vat_rate": 21.0, "stock_qty": 320, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p029", "sku": "IS20LR050040", "name_fr": "Laine Roche 50mm", "name_nl": "Rotswol 50mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 11.20, "price_wholesale": 9.00, "vat_rate": 21.0, "stock_qty": 400, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p030", "sku": "IS20LR080040", "name_fr": "Laine Roche 80mm", "name_nl": "Rotswol 80mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 16.50, "price_wholesale": 13.20, "vat_rate": 21.0, "stock_qty": 350, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p031", "sku": "IS30PS020120", "name_fr": "Polystyrène 20mm", "name_nl": "Polystyreen 20mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 3.80, "price_wholesale": 3.00, "vat_rate": 21.0, "stock_qty": 600, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p032", "sku": "IS30PS040120", "name_fr": "Polystyrène 40mm", "name_nl": "Polystyreen 40mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 6.20, "price_wholesale": 4.90, "vat_rate": 21.0, "stock_qty": 500, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p033", "sku": "IS30PS060120", "name_fr": "Polystyrène 60mm", "name_nl": "Polystyreen 60mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 420, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p034", "sku": "IS40PU030060", "name_fr": "Polyuréthane 30mm", "name_nl": "Polyurethaan 30mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 18.50, "price_wholesale": 14.80, "vat_rate": 21.0, "stock_qty": 280, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p035", "sku": "IS40PU050060", "name_fr": "Polyuréthane 50mm", "name_nl": "Polyurethaan 50mm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 24.80, "price_wholesale": 19.80, "vat_rate": 21.0, "stock_qty": 220, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p036", "sku": "IS50FB009010", "name_fr": "Film Pare-vapeur", "name_nl": "Dampscherm", "category_id": "cat-insulation", "unit": "m²", "price_retail": 1.80, "price_wholesale": 1.40, "vat_rate": 21.0, "stock_qty": 1000, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p037", "sku": "IS60SC050050", "name_fr": "Scotch Alu 50m", "name_nl": "Alu Tape 50m", "category_id": "cat-insulation", "unit": "piece", "price_retail": 12.90, "price_wholesale": 10.30, "vat_rate": 21.0, "stock_qty": 300, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    {"id": "p038", "sku": "IS70MO010025", "name_fr": "Mousse Expansive 750ml", "name_nl": "PU Schuim 750ml", "category_id": "cat-insulation", "unit": "piece", "price_retail": 8.50, "price_wholesale": 6.80, "vat_rate": 21.0, "stock_qty": 400, "image_url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400"},
    
    # Tools (12 products)
    {"id": "p039", "sku": "TL10MT005001", "name_fr": "Mètre 5m", "name_nl": "Meetlint 5m", "category_id": "cat-tools", "unit": "piece", "price_retail": 9.90, "price_wholesale": 7.90, "vat_rate": 21.0, "stock_qty": 200, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p040", "sku": "TL10MT008001", "name_fr": "Mètre 8m", "name_nl": "Meetlint 8m", "category_id": "cat-tools", "unit": "piece", "price_retail": 14.50, "price_wholesale": 11.60, "vat_rate": 21.0, "stock_qty": 150, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p041", "sku": "TL20NV045001", "name_fr": "Niveau 45cm", "name_nl": "Waterpas 45cm", "category_id": "cat-tools", "unit": "piece", "price_retail": 18.90, "price_wholesale": 15.10, "vat_rate": 21.0, "stock_qty": 100, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p042", "sku": "TL20NV080001", "name_fr": "Niveau 80cm", "name_nl": "Waterpas 80cm", "category_id": "cat-tools", "unit": "piece", "price_retail": 28.50, "price_wholesale": 22.80, "vat_rate": 21.0, "stock_qty": 80, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p043", "sku": "TL30MR500001", "name_fr": "Marteau 500g", "name_nl": "Hamer 500g", "category_id": "cat-tools", "unit": "piece", "price_retail": 22.90, "price_wholesale": 18.30, "vat_rate": 21.0, "stock_qty": 120, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p044", "sku": "TL40SC180001", "name_fr": "Scie Égoïne 18\"", "name_nl": "Handzaag 18\"", "category_id": "cat-tools", "unit": "piece", "price_retail": 24.90, "price_wholesale": 19.90, "vat_rate": 21.0, "stock_qty": 90, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p045", "sku": "TL50CT180001", "name_fr": "Cutter Pro 18mm", "name_nl": "Afbreekmes Pro 18mm", "category_id": "cat-tools", "unit": "piece", "price_retail": 8.90, "price_wholesale": 7.10, "vat_rate": 21.0, "stock_qty": 250, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p046", "sku": "TL60PC200001", "name_fr": "Pince Coupante 200mm", "name_nl": "Kniptang 200mm", "category_id": "cat-tools", "unit": "piece", "price_retail": 19.90, "price_wholesale": 15.90, "vat_rate": 21.0, "stock_qty": 110, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p047", "sku": "TL70TV006010", "name_fr": "Jeu Tournevis 6pc", "name_nl": "Schroevendraaierset 6st", "category_id": "cat-tools", "unit": "piece", "price_retail": 24.50, "price_wholesale": 19.60, "vat_rate": 21.0, "stock_qty": 130, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p048", "sku": "TL80CL008013", "name_fr": "Jeu Clés 8-13mm", "name_nl": "Sleutelset 8-13mm", "category_id": "cat-tools", "unit": "piece", "price_retail": 32.90, "price_wholesale": 26.30, "vat_rate": 21.0, "stock_qty": 70, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p049", "sku": "TL90TR030001", "name_fr": "Truelle 30cm", "name_nl": "Truweel 30cm", "category_id": "cat-tools", "unit": "piece", "price_retail": 16.90, "price_wholesale": 13.50, "vat_rate": 21.0, "stock_qty": 140, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
    {"id": "p050", "sku": "TL95GL001001", "name_fr": "Gants Travail XL", "name_nl": "Werkhandschoenen XL", "category_id": "cat-tools", "unit": "piece", "price_retail": 6.90, "price_wholesale": 5.50, "vat_rate": 21.0, "stock_qty": 500, "image_url": "https://images.pexels.com/photos/364984/pexels-photo-364984.jpeg?w=400"},
]

CUSTOMERS = [
    {"id": "c001", "type": "individual", "name": "Jean Dupont", "phone": "+32 475 12 34 56", "email": "jean.dupont@email.be", "credit_limit": 500.0},
    {"id": "c002", "type": "individual", "name": "Marie Janssen", "phone": "+32 476 23 45 67", "email": "marie.janssen@email.be", "credit_limit": 300.0},
    {"id": "c003", "type": "individual", "name": "Pierre Van den Berg", "phone": "+32 477 34 56 78", "email": "pierre.vdb@email.be", "credit_limit": 750.0},
    {"id": "c004", "type": "individual", "name": "Sophie De Smet", "phone": "+32 478 45 67 89", "email": "sophie.desmet@email.be", "credit_limit": 400.0},
    {"id": "c005", "type": "individual", "name": "Luc Peeters", "phone": "+32 479 56 78 90", "email": "luc.peeters@email.be", "credit_limit": 600.0},
    {"id": "c006", "type": "company", "name": "Batiplus SPRL", "vat_number": "BE0123456789", "phone": "+32 2 345 67 89", "email": "contact@batiplus.be", "credit_limit": 5000.0},
    {"id": "c007", "type": "company", "name": "Construct Pro SA", "vat_number": "BE0234567890", "phone": "+32 2 456 78 90", "email": "info@constructpro.be", "credit_limit": 10000.0},
    {"id": "c008", "type": "company", "name": "Renov'Expert BVBA", "vat_number": "BE0345678901", "phone": "+32 2 567 89 01", "email": "contact@renovexpert.be", "credit_limit": 7500.0},
    {"id": "c009", "type": "company", "name": "Maison & Co NV", "vat_number": "BE0456789012", "phone": "+32 2 678 90 12", "email": "info@maisonco.be", "credit_limit": 15000.0},
    {"id": "c010", "type": "company", "name": "Plomberie Express", "vat_number": "BE0567890123", "phone": "+32 2 789 01 23", "email": "contact@plomberieexpress.be", "credit_limit": 8000.0},
]

# Seed database on startup
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

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "ALPHA&CO POS API", "version": "1.0.0"}

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.get("/products", response_model=List[Product])
async def get_products(
    search: Optional[str] = Query(None, description="Search by SKU, name_fr or name_nl"),
    category_id: Optional[str] = Query(None, description="Filter by category")
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if search:
        query["$or"] = [
            {"sku": {"$regex": search, "$options": "i"}},
            {"name_fr": {"$regex": search, "$options": "i"}},
            {"name_nl": {"$regex": search, "$options": "i"}}
        ]
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(
    search: Optional[str] = Query(None, description="Search by name, phone or VAT")
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"vat_number": {"$regex": search, "$options": "i"}}
        ]
    customers = await db.customers.find(query, {"_id": 0}).to_list(500)
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate):
    sale_number = await generate_sale_number()
    
    # Calculate totals
    items = []
    subtotal = 0.0
    vat_total = 0.0
    
    for item in sale_data.items:
        line_subtotal = item.qty * item.unit_price
        
        # Apply line discount
        if item.discount_type == "percent":
            line_subtotal -= line_subtotal * (item.discount_value / 100)
        elif item.discount_type == "fixed":
            line_subtotal -= item.discount_value
        
        line_vat = line_subtotal * (item.vat_rate / 100)
        line_total = line_subtotal + line_vat
        
        sale_item = SaleItem(
            **item.model_dump(),
            id=str(uuid.uuid4()),
            line_total=round(line_total, 2)
        )
        items.append(sale_item)
        subtotal += line_subtotal
        vat_total += line_vat
    
    # Apply global discount
    if sale_data.global_discount_type == "percent":
        discount_amount = subtotal * (sale_data.global_discount_value / 100)
        subtotal -= discount_amount
        vat_total = subtotal * 0.21  # Recalculate VAT
    elif sale_data.global_discount_type == "fixed":
        subtotal -= sale_data.global_discount_value
        vat_total = subtotal * 0.21
    
    total = subtotal + vat_total
    
    # Calculate payments
    payments = []
    paid_total = 0.0
    for payment in sale_data.payments:
        p = Payment(
            **payment.model_dump(),
            id=str(uuid.uuid4()),
            created_at=datetime.now(timezone.utc).isoformat()
        )
        payments.append(p)
        paid_total += payment.amount
    
    # Determine status
    if paid_total >= total:
        status = SaleStatus.PAID
    elif paid_total > 0:
        status = SaleStatus.PARTIALLY_PAID
    else:
        status = SaleStatus.UNPAID
    
    # Get customer name if provided
    customer_name = None
    if sale_data.customer_id:
        customer = await db.customers.find_one({"id": sale_data.customer_id}, {"_id": 0})
        if customer:
            customer_name = customer.get("name")
    
    sale = Sale(
        number=sale_number,
        status=status,
        customer_id=sale_data.customer_id,
        customer_name=customer_name,
        items=[i.model_dump() for i in items],
        payments=[p.model_dump() for p in payments],
        subtotal=round(subtotal, 2),
        vat_total=round(vat_total, 2),
        total=round(total, 2),
        paid_total=round(paid_total, 2),
        global_discount_type=sale_data.global_discount_type,
        global_discount_value=sale_data.global_discount_value,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    # Save to database
    sale_dict = sale.model_dump()
    await db.sales.insert_one(sale_dict)
    
    # Update stock for each product
    for item in sale_data.items:
        await db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"stock_qty": -item.qty}}
        )
    
    return sale

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    status: Optional[SaleStatus] = Query(None),
    customer_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200)
):
    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    
    sales = await db.sales.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return sales

@api_router.get("/sales/{sale_id}", response_model=Sale)
async def get_sale(sale_id: str):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale

# Include router
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

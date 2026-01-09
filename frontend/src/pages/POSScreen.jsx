import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Search, ShoppingCart, Plus, Minus, Trash2, User, Receipt, X, Printer, Download, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PaymentModal from "@/components/PaymentModal";
import CustomerSelect from "@/components/CustomerSelect";
import { generateReceiptPDF } from "@/utils/pdfGenerator";
import { usePOSLayout } from "@/hooks/usePOSLayout";
import CartCompact from "@/components/pos/CartCompact";
import CartTable from "@/components/pos/CartTable";
import CartDrawer from "@/components/pos/CartDrawer";
import PriceOverrideModal from "@/components/pos/PriceOverrideModal";
import ResizableHandle from "@/components/pos/ResizableHandle";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function POSScreen() {
  const navigate = useNavigate();
  
  // Layout system
  const {
    currentPreset,
    setCurrentPreset,
    config,
    cartWidth,
    updateCartWidth,
    cycleLayout,
    drawerOpen,
    setDrawerOpen,
    LAYOUT_PRESETS,
    PRESET_CONFIG
  } = usePOSLayout();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState({ type: null, value: 0 });
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountInput, setDiscountInput] = useState({ type: "percent", value: "" });
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  
  // New layout-related state
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  const [priceOverrideItem, setPriceOverrideItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Fetch products and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          axios.get(`${API}/products`),
          axios.get(`${API}/categories`)
        ]);
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
        
        // Load reorder cart if exists
        const reorderCart = sessionStorage.getItem('reorder_cart');
        const reorderCustomerId = sessionStorage.getItem('reorder_customer_id');
        
        if (reorderCart) {
          const cartItems = JSON.parse(reorderCart);
          setCart(cartItems);
          sessionStorage.removeItem('reorder_cart');
          
          // Load customer if exists
          if (reorderCustomerId) {
            try {
              const customerRes = await axios.get(`${API}/customers/${reorderCustomerId}`);
              setSelectedCustomer(customerRes.data);
            } catch (err) {
              console.error("Error loading reorder customer:", err);
            }
            sessionStorage.removeItem('reorder_customer_id');
          }
          
          toast.success("Commande rechargée dans le panier");
        }
      } catch (error) {
        toast.error("Erreur de chargement / Laadfout");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Hotkey handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F6: Cycle layout (Shift+F6 for previous)
      if (e.key === 'F6') {
        e.preventDefault();
        cycleLayout(!e.shiftKey);
        toast.info(`Mode: ${PRESET_CONFIG[currentPreset].name}`);
      }
      // Enter: Pay (if cart not empty and payment modal not open)
      if (e.key === 'Enter' && cart.length > 0 && !showPayment && !priceOverrideItem) {
        e.preventDefault();
        setShowPayment(true);
      }
      // Delete: Remove selected item (table view)
      if (e.key === 'Delete' && selectedItemId) {
        e.preventDefault();
        removeFromCart(selectedItemId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, showPayment, priceOverrideItem, selectedItemId, cycleLayout, currentPreset, PRESET_CONFIG]);

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name_fr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name_nl.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Add to cart
  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        // Highlight item when quantity increases
        setHighlightedItemId(product.id);
        setTimeout(() => setHighlightedItemId(null), 800);
        
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      
      // Highlight new item
      setHighlightedItemId(product.id);
      setTimeout(() => setHighlightedItemId(null), 800);
      
      return [...prev, {
        product_id: product.id,
        sku: product.sku,
        name: product.name_fr,
        name_nl: product.name_nl,
        qty: 1,
        unit_price: product.price_retail,
        unit: product.unit,
        vat_rate: product.vat_rate,
        discount_type: null,
        discount_value: 0,
        stock_qty: product.stock_qty
      }];
    });
    toast.success(`${product.name_fr} ajouté`, { duration: 1500 });
  }, []);

  // Update cart item quantity
  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(1, item.qty + delta);
        if (newQty > item.stock_qty) {
          toast.error(`Stock insuffisant (max: ${item.stock_qty})`);
          return item;
        }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  // Apply line discount
  const applyLineDiscount = (productId, type, value) => {
    setCart(prev => prev.map(item =>
      item.product_id === productId
        ? { ...item, discount_type: type, discount_value: parseFloat(value) || 0 }
        : item
    ));
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let vatTotal = 0;

    cart.forEach(item => {
      let lineSubtotal = item.qty * item.unit_price;
      if (item.discount_type === "percent") {
        lineSubtotal -= lineSubtotal * (item.discount_value / 100);
      } else if (item.discount_type === "fixed") {
        lineSubtotal -= item.discount_value;
      }
      const lineVat = lineSubtotal * (item.vat_rate / 100);
      subtotal += lineSubtotal;
      vatTotal += lineVat;
    });

    // Apply global discount
    if (globalDiscount.type === "percent") {
      const discountAmount = subtotal * (globalDiscount.value / 100);
      subtotal -= discountAmount;
      vatTotal = subtotal * 0.21;
    } else if (globalDiscount.type === "fixed") {
      subtotal -= globalDiscount.value;
      vatTotal = subtotal * 0.21;
    }

    return {
      subtotal: Math.max(0, subtotal).toFixed(2),
      vatTotal: Math.max(0, vatTotal).toFixed(2),
      total: Math.max(0, subtotal + vatTotal).toFixed(2)
    };
  };

  const totals = calculateTotals();

  // Handle payment completion
  const handlePaymentComplete = async (payments) => {
    try {
      const saleData = {
        customer_id: selectedCustomer?.id || null,
        items: cart.map(item => ({
          product_id: item.product_id,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          unit_price: item.unit_price,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          vat_rate: item.vat_rate
        })),
        payments: payments,
        global_discount_type: globalDiscount.type,
        global_discount_value: globalDiscount.value
      };

      const response = await axios.post(`${API}/sales`, saleData);
      const sale = response.data;

      // Generate and download PDF
      generateReceiptPDF(sale, selectedCustomer);

      toast.success(`Vente ${sale.number} enregistrée!`, { duration: 3000 });

      // Reset state
      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscount({ type: null, value: 0 });
      setShowPayment(false);
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    }
  };

  // Save cart as Devis (Quote) - NO stock impact
  const handleSaveAsDevis = async () => {
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }

    try {
      const devisData = {
        doc_type: "quote",
        customer_id: selectedCustomer?.id || null,
        items: cart.map(item => ({
          product_id: item.product_id,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          unit_price: item.unit_price,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          vat_rate: item.vat_rate
        })),
        payments: [], // No payments for quote
        global_discount_type: globalDiscount.type,
        global_discount_value: globalDiscount.value
      };

      const response = await axios.post(`${API}/documents`, devisData);
      const devis = response.data;

      toast.success(`Devis ${devis.number} créé!`, { duration: 3000 });

      // Reset state
      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscount({ type: null, value: 0 });

      // Navigate to document detail
      navigate(`/documents/${devis.id}`);
    } catch (error) {
      toast.error("Erreur lors de la création du devis");
      console.error(error);
    }
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setGlobalDiscount({ type: null, value: 0 });
  };

  // Apply global discount
  const handleApplyDiscount = () => {
    if (discountInput.value) {
      setGlobalDiscount({
        type: discountInput.type,
        value: parseFloat(discountInput.value)
      });
      toast.success("Remise appliquée / Korting toegepast");
    }
    setShowDiscountDialog(false);
  };

  // Cart component for reuse
  const CartContent = () => (
    <div className="flex flex-col h-full">
      {/* Cart Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-brand-navy">
            Panier / Winkelwagen
          </h2>
          <Badge variant="secondary" className="bg-brand-navy text-white">
            {cart.length} article{cart.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        {/* Customer selection */}
        <div className="mt-3">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-brand-navy" />
                <span className="text-sm font-medium">{selectedCustomer.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="h-7 w-7 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground border-dashed"
              onClick={() => setShowCustomerSelect(true)}
              data-testid="select-customer-btn"
            >
              <User className="w-4 h-4 mr-2" />
              Ajouter client / Klant toevoegen
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1 p-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Panier vide / Lege winkelwagen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="cart-item bg-white rounded-lg border border-slate-200 p-3"
                data-testid={`cart-item-${item.product_id}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => removeFromCart(item.product_id)}
                    data-testid={`remove-item-${item.product_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="qty-btn h-8 w-8 p-0"
                      onClick={() => updateQuantity(item.product_id, -1)}
                      data-testid={`qty-minus-${item.product_id}`}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.qty}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="qty-btn h-8 w-8 p-0"
                      onClick={() => updateQuantity(item.product_id, 1)}
                      data-testid={`qty-plus-${item.product_id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-navy price-tag">
                      €{(item.qty * item.unit_price * (1 - (item.discount_type === "percent" ? item.discount_value / 100 : 0)) - (item.discount_type === "fixed" ? item.discount_value : 0)).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      €{item.unit_price.toFixed(2)} / {item.unit}
                    </p>
                  </div>
                </div>

                {/* Line discount input */}
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Remise %"
                    className="h-7 text-xs w-20"
                    value={item.discount_type === "percent" ? item.discount_value : ""}
                    onChange={(e) => applyLineDiscount(item.product_id, "percent", e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <Input
                    type="number"
                    placeholder="€ fixe"
                    className="h-7 text-xs w-20"
                    value={item.discount_type === "fixed" ? item.discount_value : ""}
                    onChange={(e) => applyLineDiscount(item.product_id, "fixed", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Cart Footer */}
      <div className="p-4 border-t border-slate-200 bg-white space-y-3">
        {/* Global discount */}
        <Button
          variant="outline"
          className="w-full border-dashed text-brand-orange hover:bg-brand-orange/5"
          onClick={() => setShowDiscountDialog(true)}
          data-testid="global-discount-btn"
        >
          KORTING / REMISE
          {globalDiscount.value > 0 && (
            <Badge className="ml-2 bg-brand-orange">
              {globalDiscount.type === "percent" ? `${globalDiscount.value}%` : `€${globalDiscount.value}`}
            </Badge>
          )}
        </Button>

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sous-total / Subtotaal</span>
            <span>€{totals.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TVA / BTW (21%)</span>
            <span>€{totals.vatTotal}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-lg font-bold text-brand-navy">
            <span>TOTAL</span>
            <span className="price-tag">€{totals.total}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={clearCart}
            disabled={cart.length === 0}
            data-testid="clear-cart-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Annuler
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSaveAsDevis}
            disabled={cart.length === 0}
            data-testid="save-devis-btn"
          >
            <FileText className="w-4 h-4 mr-2" />
            Devis
          </Button>
          <Button
            className="flex-1 bg-brand-orange hover:bg-brand-orange/90 pay-button"
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            data-testid="pay-btn"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Payer
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-gray">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-navy border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement / Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-brand-gray" data-testid="pos-screen">
      {/* Header */}
      <header className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-brand-navy font-heading font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg leading-tight">ALPHA&CO</h1>
            <p className="text-xs text-slate-300 hidden sm:block">BOUWMATERIALEN & DESIGN</p>
          </div>
        </div>
        
        {/* Mobile cart button */}
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="secondary" 
              className="md:hidden relative"
              data-testid="mobile-cart-btn"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96 p-0">
            <CartContent />
          </SheetContent>
        </Sheet>

        <div className="hidden md:flex items-center gap-4 text-xs text-slate-300">
          <span>Ninoofsesteenweg 77-79, 1700 Dilbeek</span>
          <span>TVA: BE 1028.386.674</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search and Categories */}
          <div className="p-4 bg-white border-b border-slate-200 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Rechercher SKU, nom... / Zoek SKU, naam..."
                className="pl-10 h-12 text-base search-input bg-slate-50 border-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="product-search"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                className={`shrink-0 category-tab ${selectedCategory === null ? 'active bg-brand-navy' : ''}`}
                onClick={() => setSelectedCategory(null)}
                data-testid="category-all"
              >
                Tout / Alles
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  className={`shrink-0 category-tab ${selectedCategory === cat.id ? 'active bg-brand-navy' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  data-testid={`category-${cat.id}`}
                >
                  {cat.name_fr} / {cat.name_nl}
                </Button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <ScrollArea className="flex-1 p-4">
            <div className="product-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  className="product-card bg-white border border-slate-200 rounded-lg overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  onClick={() => addToCart(product)}
                  data-testid={`product-${product.id}`}
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name_fr}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">
                        📦
                      </div>
                    )}
                    {product.stock_qty < 10 && (
                      <Badge className="absolute top-2 right-2 bg-red-500 text-xs">
                        Stock: {product.stock_qty}
                      </Badge>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                    <p className="font-medium text-sm truncate mt-1">{product.name_fr}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.name_nl}</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-lg font-bold text-brand-navy price-tag">
                        €{product.price_retail.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ {product.unit}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <p>Aucun produit trouvé / Geen producten gevonden</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Cart Section - Desktop */}
        <div className="hidden md:flex w-80 lg:w-96 border-l border-slate-200 bg-slate-50 flex-col shadow-xl">
          <CartContent />
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        total={parseFloat(totals.total)}
        onPaymentComplete={handlePaymentComplete}
      />

      <CustomerSelect
        open={showCustomerSelect}
        onClose={() => setShowCustomerSelect(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerSelect(false);
        }}
      />

      {/* Global Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remise globale / Globale korting</DialogTitle>
            <DialogDescription>
              Appliquer une remise sur le total / Korting toepassen op totaal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant={discountInput.type === "percent" ? "default" : "outline"}
                className={discountInput.type === "percent" ? "bg-brand-navy" : ""}
                onClick={() => setDiscountInput(prev => ({ ...prev, type: "percent" }))}
              >
                Pourcentage (%)
              </Button>
              <Button
                variant={discountInput.type === "fixed" ? "default" : "outline"}
                className={discountInput.type === "fixed" ? "bg-brand-navy" : ""}
                onClick={() => setDiscountInput(prev => ({ ...prev, type: "fixed" }))}
              >
                Montant fixe (€)
              </Button>
            </div>
            <Input
              type="number"
              placeholder={discountInput.type === "percent" ? "Ex: 10" : "Ex: 50.00"}
              value={discountInput.value}
              onChange={(e) => setDiscountInput(prev => ({ ...prev, value: e.target.value }))}
              className="h-12 text-lg"
              data-testid="discount-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountDialog(false)}>
              Annuler
            </Button>
            <Button className="bg-brand-orange hover:bg-brand-orange/90" onClick={handleApplyDiscount}>
              Appliquer / Toepassen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

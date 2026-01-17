import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Search, ShoppingCart, Plus, Minus, Trash2, User, Receipt, X, Printer, Download, FileText, FileCheck, Settings, LayoutGrid, Package, Truck, CreditCard, Minimize2, Maximize2, ArrowLeft, FolderOpen, ChevronRight, Home, Layers, Percent, Tag } from "lucide-react";
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
import ResizableHandle from "@/components/pos/ResizableHandle";
import LayoutSelector from "@/components/pos/LayoutSelector";
import { useTheme } from "@/hooks/useTheme";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function POSScreen() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { colors } = useTheme();
  
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
  const [posViewMode, setPosViewMode] = useState("collections"); // NEW: "collections" | "products"
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false); // NEW: For smooth category switching
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState({ type: null, value: 0 });
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountInput, setDiscountInput] = useState({ type: "percent", value: "" });
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [productGridSize, setProductGridSize] = useState(() => localStorage.getItem('product_grid_size') || 'medium');
  
  // NEW: Compact cart mode and price editing
  const [compactCart, setCompactCart] = useState(() => localStorage.getItem('compact_cart') === 'true');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice, setTempPrice] = useState("");
  const [selectedSize, setSelectedSize] = useState(null); // NEW: Size filter
  
  // NEW: Individual item discount editing
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [tempDiscount, setTempDiscount] = useState({ type: "percent", value: "" });
  
  // Layout-related state
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  const [priceOverrideItem, setPriceOverrideItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Toggle compact cart and save preference
  const toggleCompactCart = () => {
    const newValue = !compactCart;
    setCompactCart(newValue);
    localStorage.setItem('compact_cart', newValue.toString());
  };

  // Grid size update function
  const updateGridSize = (size) => {
    setProductGridSize(size);
    localStorage.setItem('product_grid_size', size);
  };

  // Get grid classes based on size - OPTIMIZED for more products
  const getGridClasses = () => {
    switch (productGridSize) {
      case 'small':
        return 'grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-10';
      case 'large':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
      default: // medium
        return 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7';
    }
  };

  // Fetch products and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Always fetch categories
        const categoriesRes = await axios.get(`${API}/categories`);
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

  // Fetch products when a category is selected
  useEffect(() => {
    if (selectedCategory) {
      const fetchProducts = async () => {
        setLoadingProducts(true); // Use light loading instead of full loading
        try {
          const response = await axios.get(`${API}/products?category_id=${selectedCategory.id}`);
          setProducts(response.data);
          setPosViewMode("products");
        } catch (error) {
          toast.error("Erreur de chargement des produits");
          console.error(error);
        } finally {
          setLoadingProducts(false);
        }
      };
      fetchProducts();
    } else {
      setProducts([]);
      setPosViewMode("collections");
    }
  }, [selectedCategory]);

  // Go back to collections view
  const goBackToCollections = useCallback(() => {
    setSelectedCategory(null);
    setSearchQuery("");
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

  // Filter products with useMemo for performance
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Normalize tags to array
      const tagsArray = Array.isArray(product.tags) ? product.tags : 
        (product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
      
      const matchesSearch = !searchQuery || 
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.name_fr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.name_nl?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.gtin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tagsArray.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Size/variant filter - extract size from product name (e.g., "Product - XL" or "Product - 50x100")
      const matchesSize = !selectedSize || (() => {
        const nameParts = product.name_fr?.split(' - ') || [];
        const variantPart = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';
        return variantPart.includes(selectedSize.toLowerCase());
      })();
      
      return matchesSearch && matchesSize;
    });
  }, [products, searchQuery, selectedSize]);

  // Filter categories for search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(cat =>
      cat.name_fr?.toLowerCase().includes(q) ||
      cat.name_nl?.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  // Extract available sizes/variants from products
  const availableSizes = useMemo(() => {
    const sizeSet = new Set();
    products.forEach(product => {
      const nameParts = product.name_fr?.split(' - ') || [];
      if (nameParts.length > 1) {
        const variant = nameParts[nameParts.length - 1].trim();
        // Filter out common non-size variants
        if (variant && variant.length <= 20 && !variant.toLowerCase().includes('default')) {
          sizeSet.add(variant);
        }
      }
    });
    return Array.from(sizeSet).sort();
  }, [products]);

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

  // Barcode scanner support (optimized for Approx and similar USB scanners)
  // Supports: EAN-13, EAN-8, UPC-A, Code128, QR codes with product ID
  useEffect(() => {
    let barcodeBuffer = '';
    let timeout = null;
    let lastKeyTime = 0;
    
    // Normalize barcode: remove check digit for EAN-13, handle prefixes
    const normalizeBarcode = (barcode) => {
      // Remove any non-alphanumeric characters
      let clean = barcode.replace(/[^a-zA-Z0-9]/g, '');
      
      // EAN-13: Sometimes scanned with leading zeros
      if (/^\d{13}$/.test(clean)) {
        // Remove leading zeros if it's an EAN-13 with padded zeros
        clean = clean.replace(/^0+/, '') || clean;
      }
      
      return clean;
    };
    
    // Find product by barcode, GTIN, or SKU
    const findProductByBarcode = (barcode) => {
      const searchTerms = [
        barcode.toLowerCase(),
        normalizeBarcode(barcode).toLowerCase()
      ];
      
      // Also try without leading zeros for EAN codes
      if (/^\d+$/.test(barcode)) {
        searchTerms.push(barcode.replace(/^0+/, '').toLowerCase());
        // Try with padded zeros (to 13 digits for EAN-13)
        searchTerms.push(barcode.padStart(13, '0').toLowerCase());
      }
      
      return products.find(p => {
        // Exact match on GTIN (from Shopify)
        if (p.gtin && searchTerms.some(term => 
          p.gtin.toLowerCase() === term ||
          p.gtin.toLowerCase().includes(term) ||
          term.includes(p.gtin.toLowerCase())
        )) {
          return true;
        }
        
        // Exact match on barcode field
        if (p.barcode && searchTerms.some(term => 
          p.barcode.toLowerCase() === term
        )) {
          return true;
        }
        
        // Exact match on SKU
        if (p.sku && searchTerms.some(term => 
          p.sku.toLowerCase() === term
        )) {
          return true;
        }
        
        // Partial match on SKU (for shortened barcodes)
        if (p.sku && searchTerms.some(term => 
          p.sku.toLowerCase().includes(term) ||
          term.includes(p.sku.toLowerCase())
        )) {
          return true;
        }
        
        return false;
      });
    };
    
    const processBarcode = (barcode) => {
      // Clean barcode: remove Enter, spaces, and trim
      const cleanBarcode = barcode.replace(/[\r\n\t]/g, '').trim();
      
      if (cleanBarcode.length >= 3) {
        const foundProduct = findProductByBarcode(cleanBarcode);
        
        if (foundProduct) {
          addToCart(foundProduct);
          // Show product image briefly if available
          toast.success(
            <div className="flex items-center gap-2">
              {foundProduct.image_url && (
                <img src={foundProduct.image_url} alt="" className="w-8 h-8 rounded object-cover" />
              )}
              <span>✓ {foundProduct.name_fr}</span>
            </div>,
            { duration: 2000 }
          );
        } else {
          // Show the scanned code for debugging
          toast.error(
            <div>
              <div className="font-semibold">Code non trouvé</div>
              <div className="text-xs opacity-75 font-mono">{cleanBarcode}</div>
            </div>,
            { duration: 4000 }
          );
        }
      }
      barcodeBuffer = '';
    };
    
    const handleKeyDown = (e) => {
      // If input is focused, don't interfere (except for dedicated barcode input)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow barcode processing if it's the search field and scanner detected
        if (e.target.dataset.barcodeSearch !== 'true') {
          return;
        }
      }
      
      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;
      
      // Scanner types fast (< 50ms between keys), human types slow
      // If too slow, reset buffer (likely human typing)
      // Approx scanners typically send at 10-30ms intervals
      if (timeDiff > 100 && barcodeBuffer.length > 0 && timeDiff < 1000) {
        // Might be a pause in scanning, don't reset yet
      } else if (timeDiff > 150 && barcodeBuffer.length > 0) {
        barcodeBuffer = '';
      }
      
      // Enter key = end of barcode scan (Approx suffix)
      if (e.key === 'Enter' && barcodeBuffer.length >= 3) {
        e.preventDefault();
        e.stopPropagation();
        processBarcode(barcodeBuffer);
        return;
      }
      
      // Tab key = some scanners use Tab as suffix
      if (e.key === 'Tab' && barcodeBuffer.length >= 3) {
        e.preventDefault();
        e.stopPropagation();
        processBarcode(barcodeBuffer);
        return;
      }
      
      // Only add printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer += e.key;
        
        // Clear existing timeout
        if (timeout) clearTimeout(timeout);
        
        // Fallback: process after 150ms of no input (faster for scanner)
        timeout = setTimeout(() => {
          if (barcodeBuffer.length >= 3) {
            processBarcode(barcodeBuffer);
          } else {
            barcodeBuffer = '';
          }
        }, 150);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeout) clearTimeout(timeout);
    };
  }, [products, addToCart]);

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
    if (selectedItemId === productId) {
      setSelectedItemId(null);
    }
  };

  // Update cart item price (override)
  const updateItemPrice = (productId, newPrice) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    setCart(prev => prev.map(item =>
      item.product_id === productId
        ? { ...item, unit_price: price, priceOverridden: true }
        : item
    ));
  };

  // Start editing price - click on price
  const startEditingPrice = (productId, currentPrice) => {
    setEditingPriceId(productId);
    setTempPrice(currentPrice.toString());
  };

  // Confirm price edit
  const confirmPriceEdit = (productId) => {
    updateItemPrice(productId, tempPrice);
    setEditingPriceId(null);
    setTempPrice("");
  };

  // Cancel price edit
  const cancelPriceEdit = () => {
    setEditingPriceId(null);
    setTempPrice("");
  };

  // Handle price override
  const handlePriceOverride = (newPrice, metadata) => {
    const updatedCart = cart.map(item => 
      item.product_id === priceOverrideItem.product_id
        ? { 
            ...item, 
            unit_price: newPrice, 
            priceOverridden: true, 
            overrideMetadata: metadata 
          }
        : item
    );
    setCart(updatedCart);
    
    // Log to console (TODO: Send to backend)
    console.log('Price Override:', metadata);
    toast.success(`Prix modifié: €${newPrice.toFixed(2)}`);
  };

  // Apply line discount
  const applyLineDiscount = (productId, type, value) => {
    setCart(prev => prev.map(item =>
      item.product_id === productId
        ? { ...item, discount_type: type, discount_value: parseFloat(value) || 0 }
        : item
    ));
  };

  // Start editing item discount
  const startEditingDiscount = (productId, currentType, currentValue) => {
    setEditingDiscountId(productId);
    setTempDiscount({ type: currentType || "percent", value: currentValue?.toString() || "" });
  };

  // Confirm item discount
  const confirmDiscountEdit = (productId) => {
    applyLineDiscount(productId, tempDiscount.type, tempDiscount.value);
    setEditingDiscountId(null);
    setTempDiscount({ type: "percent", value: "" });
    toast.success("Remise appliquée");
  };

  // Cancel discount edit
  const cancelDiscountEdit = () => {
    setEditingDiscountId(null);
    setTempDiscount({ type: "percent", value: "" });
  };

  // Remove item discount
  const removeItemDiscount = (productId) => {
    applyLineDiscount(productId, null, 0);
    toast.success("Remise supprimée");
  };

  // Calculate line item details with VAT
  const calculateLineItem = useCallback((item) => {
    let lineSubtotal = item.qty * item.unit_price;
    let discountAmount = 0;
    
    if (item.discount_type === "percent") {
      discountAmount = lineSubtotal * (item.discount_value / 100);
    } else if (item.discount_type === "fixed") {
      discountAmount = item.discount_value;
    }
    
    const afterDiscount = lineSubtotal - discountAmount;
    const lineVat = afterDiscount * (item.vat_rate / 100);
    const lineTotal = afterDiscount + lineVat;
    
    return {
      subtotal: lineSubtotal,
      discount: discountAmount,
      afterDiscount,
      vat: lineVat,
      vatRate: item.vat_rate,
      total: lineTotal
    };
  }, []);

  // Calculate totals with useMemo for performance
  const totals = useMemo(() => {
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
  }, [cart, globalDiscount]);

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

  // Save cart as Invoice (Facture) - WITH stock impact
  const handleSaveAsInvoice = async () => {
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }

    try {
      const invoiceData = {
        doc_type: "invoice",
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
        payments: [], // No payments yet for invoice
        global_discount_type: globalDiscount.type,
        global_discount_value: globalDiscount.value,
        status: "unpaid"
      };

      const response = await axios.post(`${API}/documents`, invoiceData);
      const invoice = response.data;

      toast.success(`Facture ${invoice.number} créée!`, { duration: 3000 });

      // Reset state
      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscount({ type: null, value: 0 });

      // Navigate to document detail
      navigate(`/documents/${invoice.id}`);
    } catch (error) {
      toast.error("Erreur lors de la création de la facture");
      console.error(error);
    }
  };

  // Save as Purchase Order (Bon de commande)
  const handleSaveAsPurchaseOrder = async () => {
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }

    try {
      const orderData = {
        doc_type: "purchase_order",
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
        payments: [],
        global_discount_type: globalDiscount.type,
        global_discount_value: globalDiscount.value,
        status: "draft"
      };

      const response = await axios.post(`${API}/documents`, orderData);
      toast.success(`Bon de commande ${response.data.number} créé!`, { duration: 3000 });

      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscount({ type: null, value: 0 });
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la création du bon de commande");
      console.error(error);
    }
  };

  // Save as Delivery Note (Bon de livraison)
  const handleSaveAsDeliveryNote = async () => {
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }

    try {
      const deliveryData = {
        doc_type: "delivery_note",
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
        payments: [],
        global_discount_type: globalDiscount.type,
        global_discount_value: globalDiscount.value,
        status: "draft"
      };

      const response = await axios.post(`${API}/documents`, deliveryData);
      toast.success(`Bon de livraison ${response.data.number} créé!`, { duration: 3000 });

      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscount({ type: null, value: 0 });
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la création du bon de livraison");
      console.error(error);
    }
  };

  // Save as Credit Note (Bon d'avoir / Note de crédit)
  const handleSaveAsCreditNote = async () => {
    if (cart.length === 0) {
      toast.error("Panier vide");
      return;
    }

    try {
      const creditData = {
        doc_type: "credit_note",
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
        payments: [],
        global_discount_type: globalDiscount.type,
        global_discount_value: globalDiscount.value,
        status: "draft"
      };

      const response = await axios.post(`${API}/documents`, creditData);
      toast.success(`Note de crédit ${response.data.number} créée!`, { duration: 3000 });

      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscount({ type: null, value: 0 });
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la création de la note de crédit");
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
      <div className="p-2 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading font-bold text-sm text-brand-navy">
            Panier / Winkelwagen
          </h2>
          <div className="flex items-center gap-1">
            {/* Compact mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={toggleCompactCart}
              title={compactCart ? "Vue normale" : "Vue compacte"}
            >
              {compactCart ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </Button>
            <Badge variant="secondary" style={{ backgroundColor: colors.primary }} className="text-white text-xs">
              {cart.length}
            </Badge>
          </div>
        </div>
        
        {/* Customer selection */}
        <div>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-slate-50 rounded p-1.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-brand-navy" />
                <span className="text-xs font-medium truncate">{selectedCustomer.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="h-5 w-5 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-7 justify-start text-xs border-dashed"
              onClick={() => setShowCustomerSelect(true)}
              data-testid="select-customer-btn"
            >
              <User className="w-3 h-3 mr-1.5" />
              Client
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items - COMPACT or NORMAL mode */}
      <ScrollArea className="flex-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Panier vide / Lege winkelwagen</p>
          </div>
        ) : compactCart ? (
          /* COMPACT MODE - Table-like for maximum items with discount and TVA */
          <div className="divide-y divide-slate-100">
            {cart.map((item) => {
              const lineCalc = calculateLineItem(item);
              return (
              <div
                key={item.product_id}
                className={`flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-50 ${
                  highlightedItemId === item.product_id ? 'bg-orange-50' : ''
                } ${item.priceOverridden ? 'bg-amber-50' : ''} ${item.discount_value > 0 ? 'bg-green-50' : ''}`}
              >
                {/* Product info - compact */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span>TVA {item.vat_rate}%</span>
                    {item.discount_value > 0 && (
                      <span className="text-green-600">
                        | -{item.discount_type === "percent" ? `${item.discount_value}%` : `€${item.discount_value}`}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Quantity controls - ultra compact */}
                <div className="flex items-center gap-0.5 bg-slate-100 rounded px-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => updateQuantity(item.product_id, -1)}
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </Button>
                  <span className="w-5 text-center text-xs font-medium">{item.qty}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => updateQuantity(item.product_id, 1)}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </Button>
                </div>
                
                {/* Discount button - compact */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-5 w-5 p-0 ${item.discount_value > 0 ? 'text-green-600' : 'text-muted-foreground'}`}
                  onClick={() => startEditingDiscount(item.product_id, item.discount_type, item.discount_value)}
                  title="Remise"
                >
                  <Tag className="w-3 h-3" />
                </Button>
                
                {/* Price - click to edit */}
                {editingPriceId === item.product_id ? (
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-5 w-14 text-[10px] p-1"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmPriceEdit(item.product_id);
                        if (e.key === 'Escape') cancelPriceEdit();
                      }}
                      onBlur={() => confirmPriceEdit(item.product_id)}
                      autoFocus
                    />
                  </div>
                ) : (
                  <span 
                    className={`text-xs font-bold cursor-pointer hover:text-brand-orange ${
                      item.priceOverridden ? 'text-amber-600' : item.discount_value > 0 ? 'text-green-600' : 'text-brand-navy'
                    }`}
                    onClick={() => startEditingPrice(item.product_id, item.unit_price)}
                    title="Modifier le prix"
                  >
                    €{lineCalc.afterDiscount.toFixed(2)}
                  </span>
                )}
                
                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-red-500 hover:text-red-600"
                  onClick={() => removeFromCart(item.product_id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            );})}
          </div>
        ) : (
          /* NORMAL MODE - Cards with full details, TVA and discounts */
          <div className="p-2 space-y-1.5">
            {cart.map((item) => {
              const lineCalc = calculateLineItem(item);
              return (
              <div
                key={item.product_id}
                className={`cart-item bg-white rounded-lg border p-2 transition-all ${
                  highlightedItemId === item.product_id 
                    ? 'border-brand-orange bg-orange-50 scale-[1.02]' 
                    : 'border-slate-200'
                } ${item.priceOverridden ? 'ring-1 ring-amber-400' : ''} ${item.discount_value > 0 ? 'ring-1 ring-green-400' : ''}`}
                data-testid={`cart-item-${item.product_id}`}
              >
                {/* Header: Name + Delete */}
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-medium text-xs truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    onClick={() => removeFromCart(item.product_id)}
                    data-testid={`remove-item-${item.product_id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                
                {/* Quantity + Price Row */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="qty-btn h-6 w-6 p-0"
                      onClick={() => updateQuantity(item.product_id, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="qty-btn h-6 w-6 p-0"
                      onClick={() => updateQuantity(item.product_id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {/* Unit price - click to edit */}
                  {editingPriceId === item.product_id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-5 w-14 text-[10px] text-right p-1 border-brand-orange"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmPriceEdit(item.product_id);
                          if (e.key === 'Escape') cancelPriceEdit();
                        }}
                        onBlur={() => confirmPriceEdit(item.product_id)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      className={`flex items-center gap-1 cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 ${
                        item.priceOverridden ? 'bg-amber-50' : ''
                      }`}
                      onClick={() => startEditingPrice(item.product_id, item.unit_price)}
                      title="Modifier le prix unitaire"
                    >
                      <span className={`text-[10px] ${item.priceOverridden ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                        €{item.unit_price.toFixed(2)} / {item.unit}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Discount Row */}
                <div className="flex items-center justify-between gap-2 mb-1 py-1 border-t border-slate-100">
                  {editingDiscountId === item.product_id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <select
                        className="h-5 text-[10px] border rounded px-1"
                        value={tempDiscount.type}
                        onChange={(e) => setTempDiscount(prev => ({ ...prev, type: e.target.value }))}
                      >
                        <option value="percent">%</option>
                        <option value="fixed">€</option>
                      </select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-5 w-14 text-[10px] p-1"
                        value={tempDiscount.value}
                        onChange={(e) => setTempDiscount(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmDiscountEdit(item.product_id);
                          if (e.key === 'Escape') cancelDiscountEdit();
                        }}
                        placeholder="0"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600"
                        onClick={() => confirmDiscountEdit(item.product_id)}
                      >
                        ✓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-red-500"
                        onClick={cancelDiscountEdit}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-5 px-1 text-[10px] ${item.discount_value > 0 ? 'text-green-600 bg-green-50' : 'text-muted-foreground'}`}
                        onClick={() => startEditingDiscount(item.product_id, item.discount_type, item.discount_value)}
                        title="Ajouter une remise"
                      >
                        <Tag className="w-3 h-3 mr-0.5" />
                        {item.discount_value > 0 
                          ? (item.discount_type === "percent" ? `-${item.discount_value}%` : `-€${item.discount_value}`)
                          : "Remise"
                        }
                      </Button>
                      {item.discount_value > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                          onClick={() => removeItemDiscount(item.product_id)}
                          title="Supprimer la remise"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* TVA info */}
                  <span className="text-[10px] text-muted-foreground">
                    TVA {item.vat_rate}%: €{lineCalc.vat.toFixed(2)}
                  </span>
                </div>
                
                {/* Line Total Row */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="text-[10px] text-muted-foreground">
                    {item.discount_value > 0 && (
                      <span className="text-green-600">
                        Remise: -€{lineCalc.discount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-navy text-sm">
                      €{lineCalc.afterDiscount.toFixed(2)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      TTC: €{lineCalc.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            );})}
          </div>
        )}
      </ScrollArea>

      {/* Cart Footer */}
      <div className="p-2 border-t border-slate-200 bg-white space-y-2">
        {/* Totals */}
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Sous-total</span>
            <span className="font-medium">€{totals.subtotal}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">TVA (21%)</span>
            <span className="font-medium">€{totals.vatTotal}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between items-center text-base font-bold text-brand-navy">
            <span>TOTAL</span>
            <span className="price-tag">€{totals.total}</span>
          </div>
        </div>

        {/* Global discount button - inline */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 border-dashed text-brand-orange hover:bg-brand-orange/5 text-xs"
          onClick={() => setShowDiscountDialog(true)}
          data-testid="global-discount-btn"
        >
          REMISE
          {globalDiscount.value > 0 && (
            <Badge className="ml-1.5 bg-brand-orange text-[10px] h-4">
              {globalDiscount.type === "percent" ? `${globalDiscount.value}%` : `€${globalDiscount.value}`}
            </Badge>
          )}
        </Button>

        {/* Action buttons - more compact */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={clearCart}
              disabled={cart.length === 0}
              data-testid="clear-cart-btn"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs col-span-2"
                  disabled={cart.length === 0}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Document
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground">Créer un document</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSaveAsDevis} className="text-xs">
                  <FileText className="w-3 h-3 mr-2 text-blue-500" />
                  Devis / Offerte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSaveAsPurchaseOrder} className="text-xs">
                  <Package className="w-3 h-3 mr-2 text-purple-500" />
                  Bon de commande
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSaveAsInvoice} className="text-xs">
                  <FileCheck className="w-3 h-3 mr-2 text-green-500" />
                  Facture / Factuur
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSaveAsDeliveryNote} className="text-xs">
                  <Truck className="w-3 h-3 mr-2 text-orange-500" />
                  Bon de livraison
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSaveAsCreditNote} className="text-xs">
                  <CreditCard className="w-3 h-3 mr-2 text-red-500" />
                  Note de crédit / Bon d'avoir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            className="w-full bg-brand-orange hover:bg-brand-orange/90 pay-button h-10 text-sm font-bold"
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            data-testid="pay-btn"
          >
            <Receipt className="w-4 h-4 mr-2" />
            PAYER / BETALEN
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
      <header 
        className="text-white px-4 py-3 flex items-center justify-between shadow-lg z-10"
        style={{ backgroundColor: colors.sidebar }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-brand-navy font-heading font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg leading-tight">ALPHA&CO</h1>
            <p className="text-xs text-slate-300 hidden sm:block">BOUWMATERIALEN & DESIGN</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Layout Selector */}
          <div className="hidden md:block">
            <LayoutSelector 
              currentPreset={currentPreset}
              onSelectPreset={setCurrentPreset}
            />
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
        </div>

        <div className="hidden lg:flex items-center gap-4 text-xs text-slate-300">
          <span>Ninoofsesteenweg 77-79, 1700 Dilbeek</span>
          <span>TVA: BE 1028.386.674</span>
        </div>
      </header>

      {/* Main Content - Dynamic Layouts */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
        style={{
          flexDirection: config.layout === 'vertical' ? 'column' : 'row'
        }}
      >
        {/* Products Section */}
        <div 
          className="flex flex-col min-w-0"
          style={{
            width: config.layout === 'horizontal' ? `${cartWidth}%` : '100%',
            height: config.layout === 'vertical' ? `${cartWidth}%` : '100%',
            flex: config.layout === 'drawer' ? '1' : 'none'
          }}
        >
          {/* Search and Categories */}
          <div className="p-4 bg-white border-b border-slate-200 space-y-3">
            {/* Search and Zoom Controls */}
            {/* Breadcrumb and Back Button for products view */}
            {posViewMode === "products" && selectedCategory && (
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBackToCollections}
                  className="h-8 px-2 hover:bg-brand-orange/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <button 
                    onClick={goBackToCollections}
                    className="hover:text-brand-orange flex items-center gap-1"
                  >
                    <Layers className="w-4 h-4" />
                    Collections
                  </button>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-brand-navy font-medium">{selectedCategory.name_fr}</span>
                  <Badge variant="secondary" className="ml-2">{filteredProducts.length}</Badge>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder={posViewMode === "collections" ? "Rechercher une collection..." : "Rechercher SKU, nom... / Zoek SKU, naam..."}
                  className="pl-10 h-12 text-base search-input bg-slate-50 border-slate-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="product-search"
                />
              </div>
              
              {/* Grid Size Selector - only show in products view */}
              {posViewMode === "products" && (
                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <Button
                    variant={productGridSize === 'small' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => updateGridSize('small')}
                    title="Petite taille"
                  >
                    <div className="grid grid-cols-3 gap-0.5 w-3 h-3">
                      {Array(9).fill(0).map((_, i) => (
                        <div key={i} className="bg-current w-0.5 h-0.5 rounded-[1px]" />
                      ))}
                    </div>
                  </Button>
                  <Button
                    variant={productGridSize === 'medium' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => updateGridSize('medium')}
                    title="Taille moyenne"
                  >
                    <div className="grid grid-cols-2 gap-0.5 w-3 h-3">
                      {Array(4).fill(0).map((_, i) => (
                        <div key={i} className="bg-current w-1 h-1 rounded-[1px]" />
                      ))}
                    </div>
                  </Button>
                  <Button
                    variant={productGridSize === 'large' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => updateGridSize('large')}
                    title="Grande taille"
                  >
                    <div className="w-3 h-3 bg-current rounded-[1px]" />
                  </Button>
                </div>
              )}
            </div>

            {/* Size/Variant Filter - only show in products view if sizes exist */}
            {posViewMode === "products" && availableSizes.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <Button
                  variant={selectedSize === null ? "secondary" : "ghost"}
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => setSelectedSize(null)}
                >
                  Toutes tailles
                </Button>
                {availableSizes.slice(0, 20).map((size) => (
                  <Button
                    key={size}
                    variant={selectedSize === size ? "secondary" : "ghost"}
                    size="sm"
                    className={`shrink-0 h-7 text-xs ${selectedSize === size ? 'bg-brand-orange/20 text-brand-orange' : ''}`}
                    onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Collections Grid - when in collections view */}
          {posViewMode === "collections" && (
            <ScrollArea className="flex-1 p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {loading ? (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    Chargement...
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    {searchQuery ? "Aucune collection trouvée" : "Aucune catégorie disponible"}
                  </div>
                ) : (
                  filteredCategories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category)}
                      className="group bg-white rounded-xl border border-slate-200 p-3 hover:border-brand-orange hover:shadow-lg transition-all duration-200 text-left active:scale-95"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-2 transition-colors bg-gradient-to-br from-brand-orange/10 to-brand-navy/10 group-hover:from-brand-orange/20 group-hover:to-brand-navy/20 overflow-hidden">
                          {category.image_url ? (
                            <img 
                              src={category.image_url} 
                              alt={category.name_fr}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FolderOpen className="w-7 h-7 text-brand-orange" />
                          )}
                        </div>
                        <h3 className="font-medium text-xs text-brand-navy group-hover:text-brand-orange transition-colors line-clamp-2 mb-0.5">
                          {category.name_fr}
                        </h3>
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          {category.product_count || 0}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Products Grid - when in products view */}
          {posViewMode === "products" && (
            <ScrollArea className="flex-1 p-2 relative">
              {/* Subtle loading overlay when switching categories */}
              {loadingProducts && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-brand-orange border-t-transparent rounded-full"></div>
                </div>
              )}
              {filteredProducts.length === 0 && !loadingProducts ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>{searchQuery ? "Aucun produit trouvé" : "Aucun produit dans cette collection"}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={goBackToCollections}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Retour aux collections
                  </Button>
                </div>
              ) : (
                <div className={`product-grid grid gap-2 ${getGridClasses()}`}>
                  {filteredProducts.map((product) => {
                // Extract product attributes for display
                const nameParts = product.name_fr?.split(' - ') || [product.name_fr];
                const baseName = nameParts.slice(0, -1).join(' - ') || nameParts[0];
                const variantFromName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
                
                // Get attributes from product data (for card badges)
                const attributes = [];
                if (product.variant_title) attributes.push(product.variant_title);
                else if (variantFromName) attributes.push(variantFromName);
                if (product.size) attributes.push(product.size);
                if (product.color) attributes.push(product.color);
                
                // Build dimensions string
                const hasDimensions = product.length || product.width || product.height || product.depth;
                let dimensionStr = '';
                if (hasDimensions) {
                  const parts = [];
                  if (product.length) parts.push(`L:${product.length}`);
                  if (product.width) parts.push(`W:${product.width}`);
                  if (product.height) parts.push(`H:${product.height}`);
                  if (product.depth) parts.push(`D:${product.depth}`);
                  dimensionStr = parts.join(' × ') + 'cm';
                  attributes.push(dimensionStr);
                }
                
                if (product.weight) attributes.push(`${product.weight}${product.weight_unit || 'kg'}`);
                if (product.material) attributes.push(product.material);
                
                // Get metafields for tooltip (all available attributes)
                const metafields = product.metafields || {};
                const metaEntries = Object.entries(metafields);
                
                // Build complete attributes list for tooltip
                const allAttributes = [];
                if (product.variant_title) allAttributes.push({ label: 'Variante', value: product.variant_title });
                if (product.size) allAttributes.push({ label: 'Taille', value: product.size });
                if (product.color) allAttributes.push({ label: 'Couleur', value: product.color });
                if (product.material) allAttributes.push({ label: 'Matériau', value: product.material });
                if (product.weight) allAttributes.push({ label: 'Poids', value: `${product.weight} ${product.weight_unit || 'kg'}` });
                if (product.length) allAttributes.push({ label: 'Longueur', value: `${product.length} cm` });
                if (product.width) allAttributes.push({ label: 'Largeur', value: `${product.width} cm` });
                if (product.height) allAttributes.push({ label: 'Hauteur', value: `${product.height} cm` });
                if (product.depth) allAttributes.push({ label: 'Profondeur', value: `${product.depth} cm` });
                
                // Add metafields to attributes
                metaEntries.forEach(([key, value]) => {
                  if (value && !allAttributes.some(a => a.label.toLowerCase() === key.toLowerCase())) {
                    allAttributes.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value: value });
                  }
                });
                
                // Build tooltip content
                const tooltipContent = (
                  <div className="max-w-sm p-2 space-y-1.5">
                    <div className="font-bold text-sm border-b border-white/20 pb-1.5">{product.name_fr}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      <div><span className="opacity-70">SKU:</span> {product.sku}</div>
                      {product.vendor && <div><span className="opacity-70">Marque:</span> {product.vendor}</div>}
                      {product.barcode && <div><span className="opacity-70">Code:</span> {product.barcode}</div>}
                      {product.product_type && <div><span className="opacity-70">Type:</span> {product.product_type}</div>}
                    </div>
                    
                    {allAttributes.length > 0 && (
                      <div className="pt-1.5 border-t border-white/20">
                        <div className="font-medium text-xs mb-1 text-brand-orange">📐 Attributs / Kenmerken:</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                          {allAttributes.map((attr, idx) => (
                            <div key={idx}>
                              <span className="opacity-70">{attr.label}:</span> <span className="font-medium">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {product.tags && (
                      <div className="text-xs pt-1 border-t border-white/20 opacity-75">
                        🏷️ {Array.isArray(product.tags) ? product.tags.join(', ') : product.tags}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-1.5 border-t border-white/20">
                      <span className="text-xs font-bold text-green-400">📦 Stock: {product.stock_qty} {product.unit}</span>
                      <span className="text-sm font-bold text-brand-orange">€{product.price_retail.toFixed(2)}</span>
                    </div>
                  </div>
                );

                return (
                  <TooltipProvider key={product.id} delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`product-card bg-white border border-slate-200 rounded-lg overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-brand-navy/20 hover:border-brand-navy hover:shadow-md transition-all active:scale-95 ${
                            productGridSize === 'small' ? 'p-1' : ''
                          }`}
                          onClick={() => addToCart(product)}
                          data-testid={`product-${product.id}`}
                        >
                          {/* Image - responsive size */}
                          <div className={`bg-slate-100 relative overflow-hidden ${
                            productGridSize === 'small' ? 'aspect-square' : 'aspect-[4/3]'
                          }`}>
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name_fr}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-slate-300 ${
                                productGridSize === 'small' ? 'text-xl' : 'text-3xl'
                              }`}>
                                📦
                              </div>
                            )}
                            {product.stock_qty < 10 && (
                              <Badge className={`absolute bg-red-500 ${
                                productGridSize === 'small' ? 'top-0.5 right-0.5 text-[8px] px-1 py-0' : 'top-1 right-1 text-[10px]'
                              }`}>
                                {productGridSize === 'small' ? product.stock_qty : `Stock: ${product.stock_qty}`}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Product info - responsive with better name visibility */}
                          <div className={productGridSize === 'small' ? 'p-1' : 'p-2'}>
                            {productGridSize !== 'small' && (
                              <p className="text-[10px] text-muted-foreground font-mono truncate">{product.sku}</p>
                            )}
                            <p 
                              className={`font-medium leading-tight ${
                                productGridSize === 'small' ? 'text-[10px] truncate' : 
                                productGridSize === 'large' ? 'text-sm line-clamp-2' : 'text-xs line-clamp-2'
                              }`}
                            >
                              {baseName}
                            </p>
                            {/* Show variant/attributes below name */}
                            {productGridSize !== 'small' && attributes.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {attributes.slice(0, 2).map((attr, idx) => (
                                  <span key={idx} className="inline-block px-1 py-0.5 text-[8px] font-medium bg-brand-orange/10 text-brand-orange rounded truncate max-w-[60px]">
                                    {attr}
                                  </span>
                                ))}
                                {attributes.length > 2 && (
                                  <span className="inline-block px-1 py-0.5 text-[8px] font-medium bg-slate-100 text-slate-500 rounded">
                                    +{attributes.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                            {productGridSize === 'large' && (
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{product.name_nl}</p>
                            )}
                            <div className={`flex items-baseline justify-between ${
                              productGridSize === 'small' ? 'mt-0.5' : 'mt-1'
                            }`}>
                              <span className={`font-bold text-brand-navy price-tag ${
                                productGridSize === 'small' ? 'text-xs' : productGridSize === 'large' ? 'text-base' : 'text-sm'
                              }`}>
                                €{product.price_retail.toFixed(2)}
                              </span>
                              {productGridSize !== 'small' && (
                                <span className="text-[10px] text-muted-foreground">/ {product.unit}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
                        {tooltipContent}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* Resizable Handle - Only for horizontal and vertical layouts */}
        {config.layout !== 'drawer' && (
          <ResizableHandle
            onResize={updateCartWidth}
            direction={config.layout === 'horizontal' ? 'vertical' : 'horizontal'}
            containerRef={containerRef}
            minPercent={config.minWidth}
            maxPercent={config.maxWidth}
          />
        )}

        {/* Cart Section - Desktop (not for drawer layout) */}
        {config.layout !== 'drawer' && (
          <div 
            className="hidden md:flex border-l border-slate-200 bg-slate-50 flex-col shadow-xl"
            style={{
              width: config.layout === 'horizontal' ? `${100 - cartWidth}%` : '100%',
              height: config.layout === 'vertical' ? `${100 - cartWidth}%` : '100%'
            }}
          >
            <CartContent />
          </div>
        )}

        {/* Cart Drawer - For Focus layout */}
        {config.layout === 'drawer' && (
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button 
                className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl bg-brand-orange hover:bg-brand-orange/90 z-50"
                size="icon"
              >
                <div className="relative">
                  <ShoppingCart className="w-7 h-7" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-brand-orange text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {cart.length}
                    </span>
                  )}
                </div>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[450px] p-0">
              <CartContent />
            </SheetContent>
          </Sheet>
        )}
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
                style={discountInput.type === "percent" ? { backgroundColor: colors.accent } : {}}
                className={discountInput.type === "percent" ? "text-white" : ""}
                onClick={() => setDiscountInput(prev => ({ ...prev, type: "percent" }))}
              >
                Pourcentage (%)
              </Button>
              <Button
                variant={discountInput.type === "fixed" ? "default" : "outline"}
                style={discountInput.type === "fixed" ? { backgroundColor: colors.accent } : {}}
                className={discountInput.type === "fixed" ? "text-white" : ""}
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

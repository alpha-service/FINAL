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
import { useDesign, DESIGNS } from "@/hooks/useDesign";
import { cn } from "@/lib/utils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function POSScreen() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { colors } = useTheme();
  const { currentDesign, design } = useDesign();
  
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
  // Cart persistence - load from localStorage
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('pos_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch { return []; }
  });
  // Customer persistence
  const [savedCustomerId, setSavedCustomerId] = useState(() => localStorage.getItem('pos_customer_id'));
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
  
  // Quick add product popup
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false);
  const [quickProductData, setQuickProductData] = useState({
    name: "",
    price: "",
    qty: "1",
    vat_rate: "21"
  });
  
  // Refs for discount/price input navigation
  const discountInputRefs = useRef({});
  const priceInputRefs = useRef({});

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

  // Get grid classes based on size - OPTIMIZED for more products and mobile
  const getGridClasses = () => {
    switch (productGridSize) {
      case 'small':
        return 'grid-cols-3 xs:grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-10';
      case 'large':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
      default: // medium
        return 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7';
    }
  };

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  // Persist selected customer
  useEffect(() => {
    if (selectedCustomer) {
      localStorage.setItem('pos_customer_id', selectedCustomer.id);
    } else {
      localStorage.removeItem('pos_customer_id');
    }
  }, [selectedCustomer]);

  // Load saved customer on mount
  useEffect(() => {
    const loadSavedCustomer = async () => {
      const customerId = localStorage.getItem('pos_customer_id');
      if (customerId && !selectedCustomer) {
        try {
          const res = await axios.get(`${API}/customers/${customerId}`);
          setSelectedCustomer(res.data);
        } catch (err) {
          localStorage.removeItem('pos_customer_id');
        }
      }
    };
    loadSavedCustomer();
  }, []);

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

  // Get next/previous item index for keyboard navigation
  const getNextItemIndex = (currentProductId) => {
    const currentIndex = cart.findIndex(item => item.product_id === currentProductId);
    return currentIndex < cart.length - 1 ? currentIndex + 1 : 0;
  };

  const getPrevItemIndex = (currentProductId) => {
    const currentIndex = cart.findIndex(item => item.product_id === currentProductId);
    return currentIndex > 0 ? currentIndex - 1 : cart.length - 1;
  };

  // Navigate to next item's discount field
  const moveToNextDiscount = (currentProductId) => {
    const nextIndex = getNextItemIndex(currentProductId);
    const nextItem = cart[nextIndex];
    if (nextItem) {
      setEditingDiscountId(nextItem.product_id);
      setTempDiscount({ type: nextItem.discount_type || "percent", value: nextItem.discount_value?.toString() || "" });
      setTimeout(() => {
        discountInputRefs.current[nextItem.product_id]?.focus();
      }, 50);
    }
  };

  // Navigate to next item's price field
  const moveToNextPrice = (currentProductId) => {
    const nextIndex = getNextItemIndex(currentProductId);
    const nextItem = cart[nextIndex];
    if (nextItem) {
      setEditingPriceId(nextItem.product_id);
      setTempPrice(nextItem.unit_price.toString());
      setTimeout(() => {
        priceInputRefs.current[nextItem.product_id]?.focus();
      }, 50);
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

  // Confirm price edit and optionally move to next
  const confirmPriceEdit = (productId, moveToNext = false) => {
    updateItemPrice(productId, tempPrice);
    setEditingPriceId(null);
    setTempPrice("");
    if (moveToNext && cart.length > 1) {
      moveToNextPrice(productId);
    }
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

  // Confirm item discount and optionally move to next
  const confirmDiscountEdit = (productId, moveToNext = false) => {
    applyLineDiscount(productId, tempDiscount.type, tempDiscount.value);
    setEditingDiscountId(null);
    setTempDiscount({ type: "percent", value: "" });
    if (tempDiscount.value) {
      toast.success("Remise appliquée");
    }
    if (moveToNext && cart.length > 1) {
      moveToNextDiscount(productId);
    }
  };

  // Cancel discount edit
  const cancelDiscountEdit = () => {
    setEditingDiscountId(null);
    setTempDiscount({ type: "percent", value: "" });
  };

  // Quick add product - add a custom product to cart without existing product
  const handleQuickAddProduct = () => {
    if (!quickProductData.name || !quickProductData.price) {
      toast.error("Nom et prix requis");
      return;
    }
    
    const newItem = {
      product_id: `quick_${Date.now()}`,
      sku: `QUICK-${Date.now()}`,
      name: quickProductData.name,
      name_nl: quickProductData.name,
      qty: parseInt(quickProductData.qty) || 1,
      unit_price: parseFloat(quickProductData.price),
      unit: "piece",
      vat_rate: parseFloat(quickProductData.vat_rate) || 21,
      discount_type: null,
      discount_value: 0,
      stock_qty: 999,
      isQuickAdd: true
    };
    
    setCart(prev => [...prev, newItem]);
    setShowQuickAddProduct(false);
    setQuickProductData({ name: "", price: "", qty: "1", vat_rate: "21" });
    toast.success(`${newItem.name} ajouté au panier`);
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
      <div className={cn(
        "p-2 border-b",
        currentDesign === DESIGNS.MODERN ? "bg-white/80 backdrop-blur-xl border-purple-200/50" :
        currentDesign === DESIGNS.MINIMAL ? "bg-white border-neutral-300" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between mb-2">
          <h2 className={cn(
            "font-heading font-bold text-sm",
            currentDesign === DESIGNS.MODERN ? "text-purple-900" :
            currentDesign === DESIGNS.MINIMAL ? "text-black tracking-wider" : "text-brand-navy"
          )}>
            Panier / Winkelwagen
          </h2>
          <div className="flex items-center gap-1">
            {/* Compact mode toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0",
                currentDesign === DESIGNS.MODERN ? "hover:bg-purple-100 rounded-full" :
                currentDesign === DESIGNS.MINIMAL ? "hover:bg-neutral-200 rounded-none" : ""
              )}
              onClick={toggleCompactCart}
              title={compactCart ? "Vue normale" : "Vue compacte"}
            >
              {compactCart ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </Button>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-white text-xs",
                currentDesign === DESIGNS.MODERN ? "bg-purple-600 rounded-full" :
                currentDesign === DESIGNS.MINIMAL ? "bg-black rounded-none" : ""
              )}
              style={{ backgroundColor: currentDesign === DESIGNS.CLASSIC ? colors.primary : undefined }}
            >
              {cart.length}
            </Badge>
          </div>
        </div>
        
        {/* Customer selection */}
        <div>
          {selectedCustomer ? (
            <div className={cn(
              "flex items-center justify-between p-1.5",
              currentDesign === DESIGNS.MODERN ? "bg-purple-50 rounded-xl" :
              currentDesign === DESIGNS.MINIMAL ? "bg-neutral-100 rounded-none" : "bg-slate-50 rounded"
            )}>
              <div className="flex items-center gap-1.5">
                <User className={cn(
                  "w-3 h-3",
                  currentDesign === DESIGNS.MODERN ? "text-purple-600" :
                  currentDesign === DESIGNS.MINIMAL ? "text-black" : "text-brand-navy"
                )} />
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
              className={cn(
                "w-full h-7 justify-start text-xs border-dashed",
                currentDesign === DESIGNS.MODERN ? "rounded-xl border-purple-300 hover:bg-purple-50" :
                currentDesign === DESIGNS.MINIMAL ? "rounded-none border-neutral-400 border-2" : ""
              )}
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
      <ScrollArea className={cn(
        "flex-1",
        currentDesign === DESIGNS.MODERN ? "bg-gradient-to-b from-purple-50/30 to-white" :
        currentDesign === DESIGNS.MINIMAL ? "bg-neutral-50" : ""
      )}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <ShoppingCart className={cn(
              "w-12 h-12 mb-3 opacity-30",
              currentDesign === DESIGNS.MODERN ? "text-purple-400" :
              currentDesign === DESIGNS.MINIMAL ? "text-neutral-400" : ""
            )} />
            <p className="text-sm">Panier vide / Lege winkelwagen</p>
          </div>
        ) : compactCart ? (
          /* COMPACT MODE - Table-like for maximum items with discount and TVA */
          <div className={cn(
            "divide-y",
            currentDesign === DESIGNS.MODERN ? "divide-purple-100" :
            currentDesign === DESIGNS.MINIMAL ? "divide-neutral-200" : "divide-slate-100"
          )}>
            {cart.map((item) => {
              const lineCalc = calculateLineItem(item);
              return (
              <div
                key={item.product_id}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5",
                  design.transition,
                  currentDesign === DESIGNS.MODERN ? "hover:bg-purple-50" :
                  currentDesign === DESIGNS.MINIMAL ? "hover:bg-neutral-100" : "hover:bg-slate-50",
                  highlightedItemId === item.product_id && (
                    currentDesign === DESIGNS.MODERN ? "bg-purple-100" :
                    currentDesign === DESIGNS.MINIMAL ? "bg-neutral-200" : "bg-orange-50"
                  ),
                  item.priceOverridden && "bg-amber-50",
                  item.discount_value > 0 && (
                    currentDesign === DESIGNS.MODERN ? "bg-green-50/50" :
                    currentDesign === DESIGNS.MINIMAL ? "bg-green-50" : "bg-green-50"
                  )
                )}
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
                <div className={cn(
                  "flex items-center gap-0.5 px-1",
                  currentDesign === DESIGNS.MODERN ? "bg-purple-100 rounded-full" :
                  currentDesign === DESIGNS.MINIMAL ? "bg-neutral-200 rounded-none" : "bg-slate-100 rounded"
                )}>
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
                  className={cn(
                    "h-5 w-5 p-0",
                    item.discount_value > 0 ? "text-green-600" : "text-muted-foreground"
                  )}
                  onClick={() => startEditingDiscount(item.product_id, item.discount_type, item.discount_value)}
                  title="Remise"
                >
                  <Tag className="w-3 h-3" />
                </Button>
                
                {/* Price - click to edit */}
                {editingPriceId === item.product_id ? (
                  <div className="flex items-center gap-0.5">
                    <Input
                      ref={(el) => priceInputRefs.current[item.product_id] = el}
                      type="number"
                      step="0.01"
                      className={cn(
                        "h-5 w-14 text-[10px] p-1",
                        currentDesign === DESIGNS.MODERN ? "rounded-lg" :
                        currentDesign === DESIGNS.MINIMAL ? "rounded-none" : ""
                      )}
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          confirmPriceEdit(item.product_id, true);
                        }
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          confirmPriceEdit(item.product_id, true);
                        }
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
                        ref={(el) => priceInputRefs.current[item.product_id] = el}
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-5 w-14 text-[10px] text-right p-1 border-brand-orange"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmPriceEdit(item.product_id, true);
                          }
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            confirmPriceEdit(item.product_id, true);
                          }
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
                        ref={(el) => discountInputRefs.current[item.product_id] = el}
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-5 w-14 text-[10px] p-1"
                        value={tempDiscount.value}
                        onChange={(e) => setTempDiscount(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmDiscountEdit(item.product_id, true);
                          }
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            confirmDiscountEdit(item.product_id, true);
                          }
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
                <div className={cn(
                  "flex items-center justify-between pt-1 border-t",
                  currentDesign === DESIGNS.MODERN ? "border-purple-100" :
                  currentDesign === DESIGNS.MINIMAL ? "border-neutral-200" : "border-slate-100"
                )}>
                  <div className="text-[10px] text-muted-foreground">
                    {item.discount_value > 0 && (
                      <span className="text-green-600">
                        Remise: -€{lineCalc.discount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-bold text-sm",
                      currentDesign === DESIGNS.MODERN ? "text-purple-900" :
                      currentDesign === DESIGNS.MINIMAL ? "text-black" : "text-brand-navy"
                    )}>
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
      <div className={cn(
        "p-2 border-t space-y-2",
        currentDesign === DESIGNS.MODERN ? "bg-white/80 backdrop-blur-xl border-purple-200/50" :
        currentDesign === DESIGNS.MINIMAL ? "bg-white border-neutral-300" : "bg-white border-slate-200"
      )}>
        {/* Quick Add Product Button */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full h-7 border-dashed text-xs",
            currentDesign === DESIGNS.MODERN 
              ? "text-blue-600 hover:bg-blue-50 border-blue-300 rounded-full" 
              : currentDesign === DESIGNS.MINIMAL 
              ? "text-black hover:bg-neutral-100 border-neutral-400 rounded-none border-2" 
              : "text-blue-600 hover:bg-blue-50"
          )}
          onClick={() => setShowQuickAddProduct(true)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Ajouter produit rapide
        </Button>
        
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
          <Separator className={cn(
            "my-1",
            currentDesign === DESIGNS.MODERN ? "bg-purple-200" :
            currentDesign === DESIGNS.MINIMAL ? "bg-neutral-300" : ""
          )} />
          <div className={cn(
            "flex justify-between items-center text-base font-bold",
            currentDesign === DESIGNS.MODERN ? "text-purple-900" :
            currentDesign === DESIGNS.MINIMAL ? "text-black" : "text-brand-navy"
          )}>
            <span>TOTAL</span>
            <span className="price-tag">€{totals.total}</span>
          </div>
        </div>

        {/* Global discount button - inline */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full h-7 border-dashed text-xs",
            currentDesign === DESIGNS.MODERN 
              ? "text-purple-600 hover:bg-purple-50 border-purple-300 rounded-full" 
              : currentDesign === DESIGNS.MINIMAL 
              ? "text-black hover:bg-neutral-100 border-neutral-400 rounded-none border-2" 
              : "text-brand-orange hover:bg-brand-orange/5"
          )}
          onClick={() => setShowDiscountDialog(true)}
          data-testid="global-discount-btn"
        >
          REMISE
          {globalDiscount.value > 0 && (
            <Badge className={cn(
              "ml-1.5 text-[10px] h-4",
              currentDesign === DESIGNS.MODERN ? "bg-purple-600 rounded-full" :
              currentDesign === DESIGNS.MINIMAL ? "bg-black rounded-none" : "bg-brand-orange"
            )}>
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
              className={cn(
                "h-8 text-xs",
                currentDesign === DESIGNS.MODERN ? "rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200" :
                currentDesign === DESIGNS.MINIMAL ? "rounded-none border-2" : ""
              )}
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
                  className={cn(
                    "h-8 text-xs col-span-2",
                    currentDesign === DESIGNS.MODERN ? "rounded-xl" :
                    currentDesign === DESIGNS.MINIMAL ? "rounded-none border-2" : ""
                  )}
                  disabled={cart.length === 0}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Document
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={cn(
                "w-48",
                currentDesign === DESIGNS.MODERN ? "rounded-2xl shadow-xl shadow-purple-500/10" :
                currentDesign === DESIGNS.MINIMAL ? "rounded-none border-2 border-black" : ""
              )}>
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
            className={cn(
              "w-full pay-button h-10 text-sm font-bold",
              currentDesign === DESIGNS.MODERN 
                ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-lg shadow-purple-500/20" 
                : currentDesign === DESIGNS.MINIMAL 
                ? "bg-black hover:bg-neutral-800 rounded-none" 
                : "bg-brand-orange hover:bg-brand-orange/90"
            )}
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
      <div className={cn(
        "flex items-center justify-center h-screen",
        currentDesign === DESIGNS.MODERN ? "bg-gradient-to-br from-slate-100 via-purple-50 to-slate-100" :
        currentDesign === DESIGNS.MINIMAL ? "bg-neutral-100" : "bg-brand-gray"
      )}>
        <div className="text-center">
          <div className={cn(
            "w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4",
            currentDesign === DESIGNS.MODERN ? "border-purple-600" :
            currentDesign === DESIGNS.MINIMAL ? "border-black" : "border-brand-navy"
          )}></div>
          <p className="text-muted-foreground">Chargement / Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-screen flex flex-col",
      currentDesign === DESIGNS.MODERN ? "bg-gradient-to-br from-slate-100 via-purple-50 to-slate-100" :
      currentDesign === DESIGNS.MINIMAL ? "bg-neutral-100" : "bg-brand-gray"
    )} data-testid="pos-screen">
      {/* Header */}
      <header 
        className={cn(
          "text-white px-4 py-3 flex items-center justify-between z-10",
          currentDesign === DESIGNS.MODERN ? "bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-xl shadow-purple-500/10" :
          currentDesign === DESIGNS.MINIMAL ? "bg-black border-b-2 border-neutral-800" : "shadow-lg"
        )}
        style={{ backgroundColor: currentDesign === DESIGNS.CLASSIC ? colors.sidebar : undefined }}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center",
            currentDesign === DESIGNS.MODERN ? "w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg" :
            currentDesign === DESIGNS.MINIMAL ? "w-10 h-10 bg-white" : "w-10 h-10 bg-white rounded-lg"
          )}>
            <span className={cn(
              "font-heading font-bold text-lg",
              currentDesign === DESIGNS.MODERN ? "text-white" :
              currentDesign === DESIGNS.MINIMAL ? "text-black" : "text-brand-navy"
            )}>A</span>
          </div>
          <div>
            <h1 className={cn(
              "font-heading leading-tight",
              currentDesign === DESIGNS.MODERN ? "font-semibold text-lg" :
              currentDesign === DESIGNS.MINIMAL ? "font-normal text-lg tracking-widest" : "font-bold text-lg"
            )}>ALPHA&CO</h1>
            <p className={cn(
              "hidden sm:block",
              currentDesign === DESIGNS.MODERN ? "text-xs text-purple-200" :
              currentDesign === DESIGNS.MINIMAL ? "text-xs text-neutral-400 tracking-wider" : "text-xs text-slate-300"
            )}>BOUWMATERIALEN & DESIGN</p>
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
          <div className={cn(
            "p-4 border-b space-y-3",
            currentDesign === DESIGNS.MODERN ? "bg-white/80 backdrop-blur-xl border-purple-200/50" :
            currentDesign === DESIGNS.MINIMAL ? "bg-white border-neutral-300" : "bg-white border-slate-200"
          )}>
            {/* Search and Zoom Controls */}
            {/* Breadcrumb and Back Button for products view */}
            {posViewMode === "products" && selectedCategory && (
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBackToCollections}
                  className={cn(
                    "h-8 px-2",
                    currentDesign === DESIGNS.MODERN ? "hover:bg-purple-100 rounded-xl" :
                    currentDesign === DESIGNS.MINIMAL ? "hover:bg-neutral-200 rounded-none" : "hover:bg-brand-orange/10"
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <button 
                    onClick={goBackToCollections}
                    className={cn(
                      "flex items-center gap-1",
                      currentDesign === DESIGNS.MODERN ? "hover:text-purple-600" :
                      currentDesign === DESIGNS.MINIMAL ? "hover:text-black" : "hover:text-brand-orange"
                    )}
                  >
                    <Layers className="w-4 h-4" />
                    Collections
                  </button>
                  <ChevronRight className="w-4 h-4" />
                  <span className={cn(
                    "font-medium",
                    currentDesign === DESIGNS.MODERN ? "text-purple-900" :
                    currentDesign === DESIGNS.MINIMAL ? "text-black" : "text-brand-navy"
                  )}>{selectedCategory.name_fr}</span>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-2",
                      currentDesign === DESIGNS.MODERN ? "bg-purple-100 text-purple-700 rounded-full" :
                      currentDesign === DESIGNS.MINIMAL ? "bg-neutral-200 text-black rounded-none" : ""
                    )}
                  >
                    {filteredProducts.length}
                  </Badge>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                  currentDesign === DESIGNS.MODERN ? "text-purple-400" :
                  currentDesign === DESIGNS.MINIMAL ? "text-neutral-500" : "text-muted-foreground"
                )} />
                <Input
                  placeholder={posViewMode === "collections" ? "Rechercher une collection..." : "Rechercher SKU, nom... / Zoek SKU, naam..."}
                  className={cn(
                    "pl-10 h-12 text-base search-input",
                    currentDesign === DESIGNS.MODERN ? "bg-purple-50/50 border-purple-200 rounded-2xl focus:ring-purple-400 focus:border-purple-400" :
                    currentDesign === DESIGNS.MINIMAL ? "bg-neutral-100 border-neutral-300 rounded-none focus:ring-black focus:border-black" : "bg-slate-50 border-slate-200"
                  )}
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
                  className={cn(
                    "shrink-0 h-7 text-xs",
                    currentDesign === DESIGNS.MODERN ? "rounded-full" :
                    currentDesign === DESIGNS.MINIMAL ? "rounded-none" : ""
                  )}
                  onClick={() => setSelectedSize(null)}
                >
                  Toutes tailles
                </Button>
                {availableSizes.slice(0, 20).map((size) => (
                  <Button
                    key={size}
                    variant={selectedSize === size ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "shrink-0 h-7 text-xs",
                      currentDesign === DESIGNS.MODERN ? "rounded-full" :
                      currentDesign === DESIGNS.MINIMAL ? "rounded-none" : "",
                      selectedSize === size && (
                        currentDesign === DESIGNS.MODERN ? "bg-purple-100 text-purple-700" :
                        currentDesign === DESIGNS.MINIMAL ? "bg-black text-white" : "bg-brand-orange/20 text-brand-orange"
                      )
                    )}
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
            <ScrollArea className={cn(
              "flex-1 p-3",
              currentDesign === DESIGNS.MODERN ? "bg-gradient-to-b from-purple-50/30 to-transparent" :
              currentDesign === DESIGNS.MINIMAL ? "bg-neutral-50" : ""
            )}>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
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
                      className={cn(
                        "group p-3 text-left active:scale-95",
                        design.transition,
                        currentDesign === DESIGNS.MODERN 
                          ? "bg-white/80 backdrop-blur-sm rounded-2xl border border-purple-200/50 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10" 
                          : currentDesign === DESIGNS.MINIMAL 
                          ? "bg-white rounded-none border-2 border-neutral-200 hover:border-black" 
                          : "bg-white rounded-xl border border-slate-200 hover:border-brand-orange hover:shadow-lg"
                      )}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className={cn(
                          "w-14 h-14 flex items-center justify-center mb-2 overflow-hidden",
                          currentDesign === DESIGNS.MODERN 
                            ? "rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 group-hover:from-purple-200 group-hover:to-pink-200" 
                            : currentDesign === DESIGNS.MINIMAL 
                            ? "rounded-none bg-neutral-100 group-hover:bg-neutral-200" 
                            : "rounded-xl bg-gradient-to-br from-brand-orange/10 to-brand-navy/10 group-hover:from-brand-orange/20 group-hover:to-brand-navy/20"
                        )}>
                          {category.image_url ? (
                            <img 
                              src={category.image_url} 
                              alt={category.name_fr}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FolderOpen className={cn(
                              "w-7 h-7",
                              currentDesign === DESIGNS.MODERN ? "text-purple-500" :
                              currentDesign === DESIGNS.MINIMAL ? "text-black" : "text-brand-orange"
                            )} />
                          )}
                        </div>
                        <h3 className={cn(
                          "font-medium text-xs line-clamp-2 mb-0.5",
                          design.transition,
                          currentDesign === DESIGNS.MODERN ? "text-slate-700 group-hover:text-purple-600" :
                          currentDesign === DESIGNS.MINIMAL ? "text-black group-hover:text-neutral-600" : "text-brand-navy group-hover:text-brand-orange"
                        )}>
                          {category.name_fr}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-[10px] px-1.5",
                            currentDesign === DESIGNS.MODERN ? "bg-purple-100 text-purple-600 rounded-full" :
                            currentDesign === DESIGNS.MINIMAL ? "bg-neutral-200 text-black rounded-none" : ""
                          )}
                        >
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
            <ScrollArea className={cn(
              "flex-1 p-2 relative",
              currentDesign === DESIGNS.MODERN ? "bg-gradient-to-b from-purple-50/20 to-transparent" :
              currentDesign === DESIGNS.MINIMAL ? "bg-neutral-50" : ""
            )}>
              {/* Subtle loading overlay when switching categories */}
              {loadingProducts && (
                <div className={cn(
                  "absolute inset-0 z-10 flex items-center justify-center",
                  currentDesign === DESIGNS.MODERN ? "bg-white/80 backdrop-blur-sm" :
                  currentDesign === DESIGNS.MINIMAL ? "bg-white/90" : "bg-white/60"
                )}>
                  <div className={cn(
                    "animate-spin h-8 w-8 border-4 border-t-transparent rounded-full",
                    currentDesign === DESIGNS.MODERN ? "border-purple-500" :
                    currentDesign === DESIGNS.MINIMAL ? "border-black" : "border-brand-orange"
                  )}></div>
                </div>
              )}
              {filteredProducts.length === 0 && !loadingProducts ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>{searchQuery ? "Aucun produit trouvé" : "Aucun produit dans cette collection"}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "mt-3",
                      currentDesign === DESIGNS.MODERN ? "rounded-full" :
                      currentDesign === DESIGNS.MINIMAL ? "rounded-none border-2" : ""
                    )}
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
                          className={cn(
                            "product-card overflow-hidden text-left focus:outline-none active:scale-95",
                            design.productCardStyle,
                            design.transition,
                            productGridSize === 'small' ? 'p-1' : '',
                            currentDesign === DESIGNS.MODERN && "focus:ring-2 focus:ring-purple-500/30",
                            currentDesign === DESIGNS.MINIMAL && "focus:ring-0 focus:border-black",
                            currentDesign === DESIGNS.CLASSIC && "focus:ring-2 focus:ring-brand-navy/20"
                          )}
                          onClick={() => addToCart(product)}
                          data-testid={`product-${product.id}`}
                        >
                          {/* Image - responsive size */}
                          <div className={cn(
                            "relative overflow-hidden",
                            currentDesign === DESIGNS.MODERN ? "bg-gradient-to-br from-slate-100 to-slate-200" :
                            currentDesign === DESIGNS.MINIMAL ? "bg-neutral-100" : "bg-slate-100",
                            productGridSize === 'small' ? 'aspect-square' : 'aspect-[4/3]'
                          )}>
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

      {/* Quick Add Product Dialog */}
      <Dialog open={showQuickAddProduct} onOpenChange={setShowQuickAddProduct}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un produit rapide</DialogTitle>
            <DialogDescription>
              Ajouter un produit au panier sans l'enregistrer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nom du produit *</label>
              <Input
                value={quickProductData.name}
                onChange={(e) => setQuickProductData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Service, Frais divers..."
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Prix unitaire *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={quickProductData.price}
                    onChange={(e) => setQuickProductData(prev => ({ ...prev, price: e.target.value }))}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantité</label>
                <Input
                  type="number"
                  min="1"
                  value={quickProductData.qty}
                  onChange={(e) => setQuickProductData(prev => ({ ...prev, qty: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">TVA %</label>
              <select
                className="w-full h-10 border rounded-md px-3"
                value={quickProductData.vat_rate}
                onChange={(e) => setQuickProductData(prev => ({ ...prev, vat_rate: e.target.value }))}
              >
                <option value="21">21% (Standard)</option>
                <option value="12">12% (Réduit)</option>
                <option value="6">6% (Super réduit)</option>
                <option value="0">0% (Exonéré)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickAddProduct(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-brand-orange hover:bg-brand-orange/90"
              onClick={handleQuickAddProduct}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter au panier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

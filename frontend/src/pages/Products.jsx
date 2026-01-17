import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, 
  Plus,
  Edit,
  Trash2,
  Package,
  Download,
  Tag,
  Weight,
  Store,
  Barcode,
  FolderOpen,
  ArrowLeft,
  Grid3X3,
  List,
  ChevronRight,
  Home,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentView, setCurrentView] = useState("collections"); // "collections" | "products"
  const [displayMode, setDisplayMode] = useState("grid"); // "grid" | "list"
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    sku: "",
    name_fr: "",
    name_nl: "",
    category_id: "",
    price_retail: "",
    price_wholesale: "",
    price_purchase: "",
    compare_at_price: "",
    stock_qty: "0",
    min_stock: "0",
    barcode: "",
    gtin: "",
    vendor: "",
    weight: "",
    weight_unit: "kg",
    description_fr: "",
    description_nl: ""
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // When a category is selected, load its products
  useEffect(() => {
    if (selectedCategory) {
      setCurrentView("products");
      fetchProducts(selectedCategory.id);
    } else {
      setCurrentView("collections");
      setProducts([]);
    }
  }, [selectedCategory]);

  const fetchProducts = async (categoryId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryId) params.append("category_id", categoryId);
      
      const response = await axios.get(`${API}/products?${params}`);
      setProducts(response.data);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Select a category to view its products
  const selectCategory = (category) => {
    setSelectedCategory(category);
    setSearchQuery("");
  };

  // Go back to categories list
  const goBackToCategories = () => {
    setSelectedCategory(null);
    setSearchQuery("");
  };

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(cat =>
      cat.name_fr?.toLowerCase().includes(q) ||
      cat.name_nl?.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(product => {
      const tagsArray = Array.isArray(product.tags) ? product.tags : 
        (product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
      return (
        product.sku?.toLowerCase().includes(q) ||
        product.name_fr?.toLowerCase().includes(q) ||
        product.name_nl?.toLowerCase().includes(q) ||
        product.barcode?.toLowerCase().includes(q) ||
        product.gtin?.toLowerCase().includes(q) ||
        product.vendor?.toLowerCase().includes(q) ||
        tagsArray.some(tag => tag.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      sku: "",
      name_fr: "",
      name_nl: "",
      category_id: selectedCategory?.id || "",
      price_retail: "",
      price_wholesale: "",
      price_purchase: "",
      compare_at_price: "",
      stock_qty: "0",
      min_stock: "0",
      barcode: "",
      gtin: "",
      vendor: "",
      weight: "",
      weight_unit: "kg",
      description_fr: "",
      description_nl: ""
    });
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku || "",
      name_fr: product.name_fr || "",
      name_nl: product.name_nl || "",
      category_id: product.category_id || "",
      price_retail: product.price_retail || "",
      price_wholesale: product.price_wholesale || "",
      price_purchase: product.price_purchase || "",
      compare_at_price: product.compare_at_price || "",
      stock_qty: product.stock_qty || "0",
      min_stock: product.min_stock || "0",
      barcode: product.barcode || "",
      gtin: product.gtin || "",
      vendor: product.vendor || "",
      weight: product.weight || "",
      weight_unit: product.weight_unit || "kg",
      description_fr: product.description_fr || "",
      description_nl: product.description_nl || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        price_retail: parseFloat(formData.price_retail) || 0,
        price_wholesale: parseFloat(formData.price_wholesale) || 0,
        price_purchase: parseFloat(formData.price_purchase) || 0,
        compare_at_price: parseFloat(formData.compare_at_price) || null,
        stock_qty: parseInt(formData.stock_qty) || 0,
        min_stock: parseInt(formData.min_stock) || 0,
        weight: parseFloat(formData.weight) || null,
      };

      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, data);
        toast.success("Produit modifié");
      } else {
        await axios.post(`${API}/products`, data);
        toast.success("Produit créé");
      }
      
      setShowModal(false);
      if (selectedCategory) fetchProducts(selectedCategory.id);
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    
    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success("Produit supprimé");
      if (selectedCategory) fetchProducts(selectedCategory.id);
    } catch (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  const getStockBadge = (product) => {
    if (product.stock_qty === 0) {
      return <Badge className="bg-red-100 text-red-800">Rupture</Badge>;
    } else if (product.stock_qty <= product.min_stock) {
      return <Badge className="bg-amber-100 text-amber-800">Stock bas</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">En stock</Badge>;
  };

  return (
    <div className="p-6" data-testid="products">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {selectedCategory && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={goBackToCategories}
              className="hover:bg-brand-orange/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <button 
                onClick={goBackToCategories}
                className="hover:text-brand-orange flex items-center gap-1"
              >
                <Home className="w-4 h-4" />
                Collections
              </button>
              {selectedCategory && (
                <span className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-brand-navy font-medium">{selectedCategory.name_fr}</span>
                </span>
              )}
            </div>
            
            <h1 className="text-2xl font-heading font-bold text-brand-navy flex items-center gap-2">
              {!selectedCategory ? (
                <>
                  <Layers className="w-6 h-6" />
                  Collections / Collecties
                </>
              ) : (
                selectedCategory.name_fr
              )}
              {currentView === "products" && (
                <Badge variant="secondary" className="text-sm ml-2">
                  {filteredProducts.length} produit(s)
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentView === "collections" 
                ? `${filteredCategories.length} catégorie(s) disponible(s)` 
                : selectedCategory?.name_nl || "Produits de cette collection"
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentView === "products" && (
            <>
              <div className="flex border rounded-md">
                <Button 
                  variant={displayMode === "grid" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setDisplayMode("grid")}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button 
                  variant={displayMode === "list" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setDisplayMode("list")}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              <Button className="bg-brand-orange hover:bg-brand-orange/90" onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau produit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={currentView === "collections" ? "Rechercher une collection..." : "SKU, nom, code-barres..."}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-products"
              />
            </div>
          </div>
          
          {currentView === "products" && (
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
          )}
        </div>
      </div>

      {/* Collections/Categories Grid */}
      {currentView === "collections" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
                onClick={() => selectCategory(category)}
                className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-orange hover:shadow-lg transition-all duration-200 text-left"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-3 transition-colors bg-gradient-to-br from-brand-orange/10 to-brand-navy/10 group-hover:from-brand-orange/20 group-hover:to-brand-navy/20">
                    {category.image_url ? (
                      <img 
                        src={category.image_url} 
                        alt={category.name_fr}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <FolderOpen className="w-8 h-8 text-brand-orange" />
                    )}
                  </div>
                  <h3 className="font-medium text-sm text-brand-navy group-hover:text-brand-orange transition-colors line-clamp-2 mb-1">
                    {category.name_fr}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {category.name_nl}
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {category.product_count || 0} produits
                  </Badge>
                </div>
                <div className="flex items-center justify-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-brand-orange flex items-center gap-1">
                    Voir produits <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Products Grid View */}
      {currentView === "products" && displayMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Chargement des produits...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Aucun produit dans cette collection
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-brand-orange hover:shadow-lg transition-all duration-200"
              >
                <div className="aspect-square bg-slate-50 relative">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name_fr}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStockBadge(product)}
                  </div>
                  {/* Quick actions overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEditModal(product)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-mono text-muted-foreground mb-1">{product.sku}</p>
                  <h3 className="font-medium text-sm line-clamp-2 mb-1" title={product.name_fr}>
                    {product.name_fr}
                  </h3>
                  {product.variant_title && (
                    <Badge variant="outline" className="text-xs mb-2">
                      {product.variant_title}
                    </Badge>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-brand-navy">
                      €{product.price_retail?.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Stock: {product.stock_qty}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Products Table/List View */}
      {currentView === "products" && displayMode === "list" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">Image</th>
                  <th className="text-left p-4 font-medium text-sm">SKU</th>
                  <th className="text-left p-4 font-medium text-sm">Produit</th>
                  <th className="text-left p-4 font-medium text-sm">Attributs</th>
                  <th className="text-right p-4 font-medium text-sm">Prix</th>
                  <th className="text-center p-4 font-medium text-sm">Stock</th>
                  <th className="text-center p-4 font-medium text-sm">Statut</th>
                  <th className="text-right p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Chargement...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Aucun produit trouvé
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr 
                      key={product.id} 
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="w-12 h-12 rounded border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                          {product.image_url ? (
                            <img 
                              src={product.image_url} 
                              alt={product.name_fr}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono font-medium">{product.sku}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{product.name_fr}</p>
                          <p className="text-sm text-muted-foreground">{product.name_nl}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {product.gtin && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs font-mono">
                                      <Barcode className="w-3 h-3 mr-1" />
                                      {product.gtin.length > 10 ? `...${product.gtin.slice(-8)}` : product.gtin}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>EAN/GTIN: {product.gtin}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {product.vendor && (
                              <Badge variant="secondary" className="text-xs">
                                <Store className="w-3 h-3 mr-1" />
                                {product.vendor}
                              </Badge>
                            )}
                            {product.weight && product.weight > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Weight className="w-3 h-3 mr-1" />
                                {product.weight} {product.weight_unit || 'kg'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {product.variant_title && (
                            <Badge className="text-xs bg-brand-orange/10 text-brand-orange border-0">
                              {product.variant_title}
                            </Badge>
                          )}
                          {product.size && (
                            <Badge variant="outline" className="text-xs">
                              Taille: {product.size}
                            </Badge>
                          )}
                          {product.color && (
                            <Badge variant="outline" className="text-xs">
                              {product.color}
                            </Badge>
                          )}
                          {product.material && (
                            <Badge variant="outline" className="text-xs">
                              {product.material}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-brand-navy">
                          €{product.price_retail?.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-medium">{product.stock_qty}</span>
                      </td>
                      <td className="p-4 text-center">
                        {getStockBadge(product)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(product)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-200">
            <p className="text-sm text-muted-foreground">
              {filteredProducts.length} produit(s)
            </p>
          </div>
        </div>
      )}

      {/* Product Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? "Modifiez les informations du produit" : "Créez un nouveau produit"}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="gtin">EAN / GTIN</Label>
                <Input
                  id="gtin"
                  value={formData.gtin}
                  onChange={(e) => setFormData({...formData, gtin: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name_fr">Nom (FR) *</Label>
                <Input
                  id="name_fr"
                  required
                  value={formData.name_fr}
                  onChange={(e) => setFormData({...formData, name_fr: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="name_nl">Nom (NL) *</Label>
                <Input
                  id="name_nl"
                  required
                  value={formData.name_nl}
                  onChange={(e) => setFormData({...formData, name_nl: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({...formData, category_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name_fr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="price_retail">Prix détail (€) *</Label>
                <Input
                  id="price_retail"
                  type="number"
                  step="0.01"
                  required
                  value={formData.price_retail}
                  onChange={(e) => setFormData({...formData, price_retail: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="compare_at_price">Prix barré</Label>
                <Input
                  id="compare_at_price"
                  type="number"
                  step="0.01"
                  value={formData.compare_at_price}
                  onChange={(e) => setFormData({...formData, compare_at_price: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="price_wholesale">Prix gros</Label>
                <Input
                  id="price_wholesale"
                  type="number"
                  step="0.01"
                  value={formData.price_wholesale}
                  onChange={(e) => setFormData({...formData, price_wholesale: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="price_purchase">Prix achat</Label>
                <Input
                  id="price_purchase"
                  type="number"
                  step="0.01"
                  value={formData.price_purchase}
                  onChange={(e) => setFormData({...formData, price_purchase: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="stock_qty">Stock</Label>
                <Input
                  id="stock_qty"
                  type="number"
                  value={formData.stock_qty}
                  onChange={(e) => setFormData({...formData, stock_qty: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="min_stock">Stock min</Label>
                <Input
                  id="min_stock"
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({...formData, min_stock: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="weight">Poids</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.001"
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="weight_unit">Unité</Label>
                <Select value={formData.weight_unit} onValueChange={(value) => setFormData({...formData, weight_unit: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendor">Fournisseur</Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="barcode">Code-barres interne</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-brand-orange hover:bg-brand-orange/90">
                {editingProduct ? "Sauvegarder" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

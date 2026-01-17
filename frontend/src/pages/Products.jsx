import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, 
  Plus,
  Edit,
  Trash2,
  Package,
  Filter,
  Download,
  Tag,
  Weight,
  Store,
  Barcode
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
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
    fetchProducts();
    fetchCategories();
  }, [categoryFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("category_id", categoryFilter);
      if (searchQuery) params.append("search", searchQuery);
      
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
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
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
      fetchProducts();
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
      fetchProducts();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      product.sku?.toLowerCase().includes(q) ||
      product.name_fr?.toLowerCase().includes(q) ||
      product.name_nl?.toLowerCase().includes(q) ||
      product.barcode?.toLowerCase().includes(q) ||
      product.gtin?.toLowerCase().includes(q) ||
      product.vendor?.toLowerCase().includes(q) ||
      product.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  });

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
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Produits / Producten
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez votre catalogue de produits
          </p>
        </div>
        <Button className="bg-brand-orange hover:bg-brand-orange/90" onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau produit
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="SKU, nom, code-barres..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-products"
              />
            </div>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name_fr} / {cat.name_nl}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="submit" variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </Button>

          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Image</th>
                <th className="text-left p-4 font-medium text-sm">SKU</th>
                <th className="text-left p-4 font-medium text-sm">Produit</th>
                <th className="text-left p-4 font-medium text-sm">Catégorie</th>
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
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`product-row-${product.id}`}
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
                        {product.tags && (Array.isArray(product.tags) ? product.tags : product.tags.split(',')).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(product.tags) ? product.tags : product.tags.split(',').map(t => t.trim()).filter(Boolean)).slice(0, 3).map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-slate-50">
                                <Tag className="w-2 h-2 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                            {(Array.isArray(product.tags) ? product.tags : product.tags.split(',')).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(Array.isArray(product.tags) ? product.tags : product.tags.split(',')).length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {categories.find(c => c.id === product.category_id)?.name_fr || "—"}
                    </td>
                    <td className="p-4">
                      {/* Attributes column - show size, dimensions, metafields */}
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
                        {(product.length || product.width || product.height || product.depth) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs cursor-help">
                                  📐 Dimensions
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-0.5">
                                  {product.length && <div>Longueur: {product.length} cm</div>}
                                  {product.width && <div>Largeur: {product.width} cm</div>}
                                  {product.height && <div>Hauteur: {product.height} cm</div>}
                                  {product.depth && <div>Profondeur: {product.depth} cm</div>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {product.material && (
                          <Badge variant="outline" className="text-xs">
                            {product.material}
                          </Badge>
                        )}
                        {product.metafields && Object.entries(product.metafields).slice(0, 2).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs capitalize">
                            {key}: {value}
                          </Badge>
                        ))}
                        {product.metafields && Object.keys(product.metafields).length > 2 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs cursor-help">
                                  +{Object.keys(product.metafields).length - 2}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-0.5">
                                  {Object.entries(product.metafields).slice(2).map(([key, value]) => (
                                    <div key={key} className="capitalize">{key}: {value}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-brand-navy">
                        €{product.price_retail.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium">{product.stock_qty}</span>
                      {product.min_stock > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">/ {product.min_stock}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {getStockBadge(product)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Modifier" onClick={() => openEditModal(product)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Supprimer" className="text-red-500" onClick={() => handleDelete(product.id)}>
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
                <Label htmlFor="gtin">EAN / GTIN (Code-barres)</Label>
                <Input
                  id="gtin"
                  placeholder="EAN-13, UPC-A..."
                  value={formData.gtin}
                  onChange={(e) => setFormData({...formData, gtin: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendor">Fournisseur / Vendor</Label>
                <Input
                  id="vendor"
                  placeholder="Nom du fournisseur"
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
              <Label htmlFor="category">Catégorie *</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({...formData, category_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name_fr} / {cat.name_nl}</SelectItem>
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
                <Label htmlFor="compare_at_price">Prix barré (€)</Label>
                <Input
                  id="compare_at_price"
                  type="number"
                  step="0.01"
                  placeholder="Ancien prix"
                  value={formData.compare_at_price}
                  onChange={(e) => setFormData({...formData, compare_at_price: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="price_wholesale">Prix gros (€)</Label>
                <Input
                  id="price_wholesale"
                  type="number"
                  step="0.01"
                  value={formData.price_wholesale}
                  onChange={(e) => setFormData({...formData, price_wholesale: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="price_purchase">Prix achat (€)</Label>
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
                <Label htmlFor="stock_qty">Stock actuel</Label>
                <Input
                  id="stock_qty"
                  type="number"
                  value={formData.stock_qty}
                  onChange={(e) => setFormData({...formData, stock_qty: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="min_stock">Stock minimum</Label>
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
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="description_fr">Description (FR)</Label>
                <textarea
                  id="description_fr"
                  className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md"
                  value={formData.description_fr}
                  onChange={(e) => setFormData({...formData, description_fr: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="description_nl">Description (NL)</Label>
                <textarea
                  id="description_nl"
                  className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md"
                  value={formData.description_nl}
                  onChange={(e) => setFormData({...formData, description_nl: e.target.value})}
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

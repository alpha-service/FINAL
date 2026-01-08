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
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);

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

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      product.sku?.toLowerCase().includes(q) ||
      product.name_fr?.toLowerCase().includes(q) ||
      product.name_nl?.toLowerCase().includes(q) ||
      product.barcode?.toLowerCase().includes(q)
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
        <Button className="bg-brand-orange hover:bg-brand-orange/90">
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
                <th className="text-left p-4 font-medium text-sm">SKU</th>
                <th className="text-left p-4 font-medium text-sm">Produit</th>
                <th className="text-left p-4 font-medium text-sm">Catégorie</th>
                <th className="text-right p-4 font-medium text-sm">Prix</th>
                <th className="text-center p-4 font-medium text-sm">Stock</th>
                <th className="text-center p-4 font-medium text-sm">Statut</th>
                <th className="text-right p-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
                      <span className="font-mono font-medium">{product.sku}</span>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{product.name_fr}</p>
                        <p className="text-sm text-muted-foreground">{product.name_nl}</p>
                        {product.barcode && (
                          <p className="text-xs text-muted-foreground mt-1">CB: {product.barcode}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {categories.find(c => c.id === product.category_id)?.name_fr || "—"}
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
                        <Button variant="ghost" size="sm" title="Modifier">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Supprimer" className="text-red-500">
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
    </div>
  );
}

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, 
  Plus,
  Edit,
  Trash2,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Filter,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Clients() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await axios.get(`${API}/customers?${params}`);
      setCustomers(response.data);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCustomers();
  };

  const filteredCustomers = customers.filter(customer => {
    if (typeFilter !== "all" && customer.type !== typeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(q) ||
      customer.email?.toLowerCase().includes(q) ||
      customer.phone?.toLowerCase().includes(q) ||
      customer.vat_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6" data-testid="clients">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Clients / Klanten
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos clients particuliers et professionnels
          </p>
        </div>
        <Button className="bg-brand-orange hover:bg-brand-orange/90">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau client
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nom, email, téléphone, TVA..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-clients"
              />
            </div>
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="individual">Particulier</SelectItem>
              <SelectItem value="company">Entreprise</SelectItem>
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

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Client</th>
                <th className="text-left p-4 font-medium text-sm">Type</th>
                <th className="text-left p-4 font-medium text-sm">Contact</th>
                <th className="text-left p-4 font-medium text-sm">Adresse</th>
                <th className="text-right p-4 font-medium text-sm">Solde</th>
                <th className="text-right p-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`customer-row-${customer.id}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {customer.type === "company" ? (
                          <Building2 className="w-5 h-5 text-brand-navy" />
                        ) : (
                          <User className="w-5 h-5 text-brand-navy" />
                        )}
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          {customer.vat_number && (
                            <p className="text-xs text-muted-foreground">TVA: {customer.vat_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">
                        {customer.type === "individual" ? "Particulier" : "Entreprise"}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {customer.address ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3 h-3 mt-1" />
                          <span>{customer.address}, {customer.postal_code} {customer.city}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-bold ${customer.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                        €{Math.abs(customer.balance).toFixed(2)}
                      </span>
                      {customer.balance < 0 && (
                        <p className="text-xs text-red-600">À payer</p>
                      )}
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
            {filteredCustomers.length} client(s)
          </p>
        </div>
      </div>
    </div>
  );
}

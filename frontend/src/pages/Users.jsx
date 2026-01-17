import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, 
  Plus,
  Edit,
  Trash2,
  User,
  Shield,
  ShieldCheck,
  Eye,
  UserCog,
  BarChart3,
  Lock,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Receipt,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_CONFIG = {
  admin: { label: "Administrateur", color: "bg-purple-100 text-purple-800", icon: ShieldCheck },
  manager: { label: "Manager", color: "bg-blue-100 text-blue-800", icon: Shield },
  cashier: { label: "Caissier", color: "bg-green-100 text-green-800", icon: User },
  viewer: { label: "Lecteur", color: "bg-slate-100 text-slate-800", icon: Eye }
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    phone: "",
    role: "cashier",
    pin_code: "",
    is_active: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users?active_only=false`);
      setUsers(response.data);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: "",
      password: "",
      full_name: "",
      email: "",
      phone: "",
      role: "cashier",
      pin_code: "",
      is_active: true
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || "",
      password: "",
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "cashier",
      pin_code: "",
      is_active: user.is_active !== false
    });
    setShowModal(true);
  };

  const openStatsModal = async (user) => {
    setSelectedUser(user);
    try {
      const response = await axios.get(`${API}/users/${user.id}/stats`);
      setUserStats(response.data);
      setShowStatsModal(true);
    } catch (error) {
      toast.error("Erreur de chargement des statistiques");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      if (!data.password) delete data.password;
      if (!data.pin_code) delete data.pin_code;

      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, data);
        toast.success("Utilisateur modifié");
      } else {
        if (!data.password) {
          toast.error("Mot de passe requis");
          return;
        }
        await axios.post(`${API}/users`, data);
        toast.success("Utilisateur créé");
      }
      
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de la sauvegarde");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success("Utilisateur supprimé");
      fetchUsers();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const toggleUserActive = async (user) => {
    try {
      await axios.put(`${API}/users/${user.id}`, { is_active: !user.is_active });
      toast.success(user.is_active ? "Utilisateur désactivé" : "Utilisateur activé");
      fetchUsers();
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const filteredUsers = users.filter(user => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(q) ||
      user.full_name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6" data-testid="users">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Utilisateurs / Gebruikers
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les caissiers et comptes utilisateurs
          </p>
        </div>
        <Button className="bg-brand-orange hover:bg-brand-orange/90" onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nom, email, username..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="cashier">Caissier</SelectItem>
              <SelectItem value="viewer">Lecteur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">Chargement...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</p>
        ) : (
          filteredUsers.map((user) => {
            const RoleIcon = ROLE_CONFIG[user.role]?.icon || User;
            return (
              <Card key={user.id} className={`relative ${!user.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${ROLE_CONFIG[user.role]?.color || 'bg-slate-100'}`}>
                        <RoleIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{user.full_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                    <Badge className={ROLE_CONFIG[user.role]?.color}>
                      {ROLE_CONFIG[user.role]?.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm">
                    {user.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Receipt className="w-4 h-4" />
                      <span>{user.total_sales || 0} ventes</span>
                      <span className="text-brand-navy font-medium ml-auto">
                        €{(user.total_revenue || 0).toFixed(2)}
                      </span>
                    </div>
                    {user.last_login && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <Clock className="w-3 h-3" />
                        <span>Dernière connexion: {new Date(user.last_login).toLocaleDateString("fr-BE")}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => toggleUserActive(user)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {user.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openStatsModal(user)} title="Statistiques">
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(user)} title="Modifier">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)} title="Supprimer" className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? "Modifiez les informations de l'utilisateur" : "Créez un nouveau compte utilisateur"}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Nom d'utilisateur *</Label>
                <Input
                  id="username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <Label htmlFor="password">{editingUser ? "Nouveau mot de passe" : "Mot de passe *"}</Label>
                <Input
                  id="password"
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="full_name">Nom complet *</Label>
              <Input
                id="full_name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Caissier</SelectItem>
                    <SelectItem value="viewer">Lecteur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pin_code">Code PIN (4 chiffres)</Label>
                <Input
                  id="pin_code"
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  placeholder="••••"
                  value={formData.pin_code}
                  onChange={(e) => setFormData({...formData, pin_code: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                />
                <p className="text-xs text-muted-foreground mt-1">Pour connexion rapide à la caisse</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active">Compte actif</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-brand-orange hover:bg-brand-orange/90">
                {editingUser ? "Sauvegarder" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Modal */}
      <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Statistiques - {selectedUser?.full_name}
            </DialogTitle>
            <DialogDescription>
              Performance et historique du caissier
            </DialogDescription>
          </DialogHeader>
          
          {userStats && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-brand-navy">{userStats.stats.total_shifts}</p>
                    <p className="text-sm text-muted-foreground">Shifts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-brand-navy">{userStats.stats.total_sales}</p>
                    <p className="text-sm text-muted-foreground">Ventes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">€{userStats.stats.total_revenue}</p>
                    <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-brand-orange">€{userStats.stats.average_ticket}</p>
                    <p className="text-sm text-muted-foreground">Ticket moyen</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Répartition des paiements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-lg font-bold text-green-700">€{userStats.stats.total_cash}</p>
                      <p className="text-xs text-green-600">Espèces</p>
                    </div>
                    <div className="flex-1 text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-lg font-bold text-blue-700">€{userStats.stats.total_card}</p>
                      <p className="text-xs text-blue-600">Carte</p>
                    </div>
                    <div className="flex-1 text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-lg font-bold text-red-700">€{userStats.stats.total_refunds}</p>
                      <p className="text-xs text-red-600">Remboursements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Shifts */}
              {userStats.recent_shifts?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Derniers shifts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userStats.recent_shifts.map((shift) => (
                        <div key={shift.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                          <div>
                            <p className="font-medium">
                              {new Date(shift.opened_at).toLocaleDateString("fr-BE")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {shift.sales_count} ventes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-brand-navy">€{shift.sales_total?.toFixed(2)}</p>
                            <Badge variant={shift.status === "open" ? "default" : "secondary"} className="text-xs">
                              {shift.status === "open" ? "En cours" : "Clôturé"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

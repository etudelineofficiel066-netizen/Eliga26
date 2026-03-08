import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Plus, Trash2, CheckCircle, Eye, EyeOff, Shield, Tag, Phone, Store, Package, MessageCircle, Send, ZoomIn, X as XIcon, Circle, Wallet, Star, Upload, Coins, Copy, Check, Camera, AlertTriangle, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Listing = {
  id: string;
  sellerId: string;
  sellerPseudo: string;
  sellerCountry: string;
  sellerAvatarUrl?: string | null;
  photoUrl: string;
  forceCollective: number;
  price: number;
  paymentNumber: string;
  status: string;
  createdAt: string;
  inCart?: boolean;
};

const MAX_FC = 3300;

function ForceBar({ value }: { value: number }) {
  const pct = Math.round((value / MAX_FC) * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-2 ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-10 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

function ContactDialog({ listing }: { listing: Listing }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/messages", {
        receiverId: listing.sellerId,
        content: `[Annonce FC ${listing.forceCollective} – ${listing.price.toLocaleString()} FCFA]\n${text.trim()}`,
      }),
    onSuccess: () => {
      setOpen(false);
      setText("");
      toast({
        title: "Message envoyé !",
        description: (
          <button
            className="underline text-primary text-xs mt-1"
            onClick={() => navigate("/messages")}
          >
            Voir dans Messages →
          </button>
        ) as any,
      });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 flex-1" data-testid={`button-contact-${listing.id}`}>
          <MessageCircle className="w-3 h-3" />
          Contacter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4 text-primary" />
            Contacter {listing.sellerPseudo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
            <Shield className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              Annonce · FC {listing.forceCollective} · {listing.price.toLocaleString()} FCFA
            </span>
          </div>
          <Textarea
            placeholder={`Bonjour ${listing.sellerPseudo}, je suis intéressé par votre compte eFootball...`}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            className="resize-none text-sm"
            data-testid={`input-contact-message-${listing.id}`}
          />
          <Button
            className="w-full gap-2"
            disabled={!text.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
            data-testid={`button-send-contact-${listing.id}`}
          >
            <Send className="w-3.5 h-3.5" />
            {sendMutation.isPending ? "Envoi..." : "Envoyer le message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(5, Math.max(1, s - e.deltaY * 0.002)));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPos(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => { dragging.current = false; };

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="image-lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/25 transition-colors text-white"
        data-testid="button-lightbox-close"
      >
        <XIcon className="w-6 h-6" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        <button
          onClick={() => setScale(s => Math.max(1, s - 0.5))}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white text-sm font-bold transition-colors"
          data-testid="button-lightbox-zoom-out"
        >−</button>
        <span className="text-white/70 text-sm min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale(s => Math.min(5, s + 0.5))}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white text-sm font-bold transition-colors"
          data-testid="button-lightbox-zoom-in"
        >+</button>
        {scale > 1 && (
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white text-xs transition-colors"
            data-testid="button-lightbox-reset"
          >Réinitialiser</button>
        )}
      </div>

      <div
        className="overflow-hidden w-full h-full flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
            transition: dragging.current ? "none" : "transform 0.15s ease",
            cursor: scale > 1 ? "grab" : "zoom-in",
            maxWidth: "95vw",
            maxHeight: "90vh",
            objectFit: "contain",
            userSelect: "none",
          }}
          onDoubleClick={() => scale > 1 ? reset() : setScale(2)}
          data-testid="image-lightbox-img"
        />
      </div>

      <p className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none">
        Double-clic pour zoomer · Molette pour zoomer · Echap pour fermer
      </p>
    </div>
  );
}

function ListingCard({ listing, showPayment, onTogglePayment, onCart, onSold, onDelete, isMine }: {
  listing: Listing;
  showPayment: boolean;
  onTogglePayment: () => void;
  onCart?: () => void;
  onSold?: () => void;
  onDelete?: () => void;
  isMine?: boolean;
}) {
  const soldBadge = listing.status === "sold";
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <>
      {lightboxOpen && (
        <ImageLightbox
          src={listing.photoUrl}
          alt={`Équipe de ${listing.sellerPseudo}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    <Card className={`overflow-hidden border-2 ${soldBadge ? "border-red-200 opacity-70" : "border-green-200"}`} data-testid={`card-listing-${listing.id}`}>
      <div
        className="relative group cursor-zoom-in"
        onClick={() => setLightboxOpen(true)}
        data-testid={`button-zoom-${listing.id}`}
        title="Cliquez pour agrandir"
      >
        <img
          src={listing.photoUrl}
          alt="Équipe"
          className="w-full object-contain bg-black transition-transform duration-200 group-hover:scale-[1.02]"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-team.png"; }}
        />
        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="w-4 h-4" />
        </div>
        {soldBadge && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Badge className="text-lg px-4 py-1 bg-red-600 text-white border-0 shadow-lg">VENDU</Badge>
          </div>
        )}
        {/* Status badge on image corner */}
        <div className="absolute top-2 left-2 pointer-events-none">
          {soldBadge ? (
            <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow" data-testid={`status-${listing.id}`}>
              <Circle className="w-1.5 h-1.5 fill-white" />
              Vendu
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow" data-testid={`status-${listing.id}`}>
              <Circle className="w-1.5 h-1.5 fill-white animate-pulse" />
              En cours
            </span>
          )}
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8 flex-shrink-0">
              {listing.sellerAvatarUrl && <AvatarImage src={listing.sellerAvatarUrl} alt={listing.sellerPseudo} />}
              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{listing.sellerPseudo?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{listing.sellerPseudo}</p>
              <p className="text-xs text-muted-foreground">{listing.sellerCountry}</p>
            </div>
          </div>
          {!isMine && (
            <div className="flex items-center gap-1">
              {!soldBadge && onCart && (
                <Button
                  size="sm"
                  variant={listing.inCart ? "secondary" : "default"}
                  onClick={onCart}
                  className="h-8 text-xs"
                  data-testid={`button-cart-${listing.id}`}
                >
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  {listing.inCart ? "✓" : "Panier"}
                </Button>
              )}
            </div>
          )}
          {isMine && (
            <div className="flex items-center gap-1">
              {!soldBadge && (
                <Button size="sm" variant="outline" onClick={onSold} className="h-7 text-xs" data-testid={`button-sold-${listing.id}`}>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Marquer vendu
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50" data-testid={`button-delete-${listing.id}`}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" />Force collective</span>
          </div>
          <ForceBar value={listing.forceCollective} />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Tag className="w-3 h-3" />Prix
          </span>
          <span className="font-bold text-primary">{listing.price.toLocaleString()} FCFA</span>
        </div>

        {(isMine || listing.inCart) && (
          <div className="border-t pt-2 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />N° de paiement
              </span>
              <button onClick={onTogglePayment} className="text-xs text-primary flex items-center gap-1 hover:underline">
                {showPayment ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPayment ? "Cacher" : "Voir"}
              </button>
            </div>
            {showPayment && (
              <p className="text-sm font-mono font-bold mt-1 text-center tracking-wider bg-muted rounded p-1" data-testid={`text-payment-${listing.id}`}>
                {listing.paymentNumber}
              </p>
            )}
          </div>
        )}

        {!isMine && !soldBadge && (
          <div className="border-t pt-2 mt-1">
            <ContactDialog listing={listing} />
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}

const DEFAULT_COIN_PACKS = [
  { name: "Starter",  coins: 100, priceFcfa: 150, promoFcfa: null as number | null, popular: false },
  { name: "Champion", coins: 300, priceFcfa: 600, promoFcfa: null as number | null, popular: true },
  { name: "Élite",    coins: 600, priceFcfa: 900, promoFcfa: null as number | null, popular: false },
];
type CoinPack = typeof DEFAULT_COIN_PACKS[0];

export default function Market() {
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const tabFromUrl = new URLSearchParams(search).get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl === "coins" ? "coins" : "market");
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedPayments, setRevealedPayments] = useState<Set<string>>(new Set());
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ forceCollective: "", price: "", paymentNumber: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  // Coin state
  const [selectedPack, setSelectedPack] = useState<CoinPack | null>(null);
  const [coinProofPreview, setCoinProofPreview] = useState<string | null>(null);
  const [coinProofBase64, setCoinProofBase64] = useState<string | null>(null);
  const coinProofRef = useRef<HTMLInputElement>(null);

  const { data: coinBalance } = useQuery<{ coins: number; bonusStars: number }>({
    queryKey: ["/api/coins/me"],
    enabled: !!user && !user.isAdmin,
  });

  const coinPurchaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/coins/purchase", data),
    onSuccess: () => {
      toast({ title: "Demande envoyée !", description: "L'administrateur validera votre paiement sous peu." });
      setSelectedPack(null);
      setCoinProofPreview(null);
      setCoinProofBase64(null);
      queryClient.invalidateQueries({ queryKey: ["/api/coins/me"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const buyStarMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/coins/buy-star", {}),
    onSuccess: (data: any) => {
      toast({ title: "⭐ Étoile achetée !", description: "Votre niveau a été mis à jour !" });
      queryClient.invalidateQueries({ queryKey: ["/api/coins/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/stats"] });
    },
    onError: (e: any) => toast({ title: "Impossible", description: e.message, variant: "destructive" }),
  });

  const { data: coinPacks = DEFAULT_COIN_PACKS } = useQuery<CoinPack[]>({
    queryKey: ["/api/coin-packs"],
    refetchInterval: 60000,
  });

  const { data: listings = [], isLoading: loadingListings } = useQuery<Listing[]>({
    queryKey: ["/api/market"],
    refetchInterval: 15000,
  });

  const { data: mine = [], isLoading: loadingMine } = useQuery<Listing[]>({
    queryKey: ["/api/market/mine"],
  });

  const { data: cart = [], isLoading: loadingCart } = useQuery<Listing[]>({
    queryKey: ["/api/market/cart"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/market", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/mine"] });
      setCreateOpen(false);
      setPhotoPreview(null);
      setForm({ forceCollective: "", price: "", paymentNumber: "" });
      toast({ title: "Annonce publiée !" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const cartMutation = useMutation({
    mutationFn: ({ id, inCart }: { id: string; inCart: boolean }) =>
      inCart ? apiRequest("DELETE", `/api/market/cart/${id}`) : apiRequest("POST", `/api/market/cart/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/cart"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/market/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/mine"] });
      toast({ title: "Annonce supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const soldMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/market/${id}/sold`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/mine"] });
      toast({ title: "Marqué comme vendu" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  function togglePayment(id: string) {
    setRevealedPayments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image trop lourde (max 5 Mo)", variant: "destructive" }); return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photoPreview) { toast({ title: "Photo requise", variant: "destructive" }); return; }
    const fc = parseInt(form.forceCollective);
    const price = parseInt(form.price);
    if (!fc || fc < 1 || fc > MAX_FC) { toast({ title: `Force collective: 1–${MAX_FC}`, variant: "destructive" }); return; }
    if (!price || price < 1) { toast({ title: "Prix invalide", variant: "destructive" }); return; }
    if (!form.paymentNumber.trim()) { toast({ title: "N° de paiement requis", variant: "destructive" }); return; }
    createMutation.mutate({ photoUrl: photoPreview, forceCollective: fc, price, paymentNumber: form.paymentNumber.trim() });
  }

  const cartCount = cart.length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Marché eFootball
          </h1>
          <p className="text-sm text-muted-foreground">Achetez et vendez des comptes eFootball</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" data-testid="button-create-listing">
              <Plus className="w-4 h-4" />
              Vendre mon compte
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Publier une annonce</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-orange-500" />
                  <Label>Photo de l'équipe <span className="text-red-500 font-bold">* obligatoire</span></Label>
                </div>
                <input id="listing-photo-input" ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} data-testid="input-file" />
                {photoPreview ? (
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-500">
                    <img src={photoPreview} alt="Aperçu équipe" className="w-full max-h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-lg px-2 py-1 font-medium"
                    >✕ Supprimer</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs text-center py-1 font-semibold">
                      ✓ Photo ajoutée
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="listing-photo-input"
                    className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl py-5 px-4 transition-colors select-none"
                    data-testid="input-photo-upload"
                  >
                    <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Appuyer pour ajouter la photo</p>
                      <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">Photo complète de l'équipe — JPG, PNG</p>
                    </div>
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fc">Force collective (1–3300) *</Label>
                <Input
                  id="fc"
                  type="number"
                  min={1}
                  max={3300}
                  placeholder="ex: 2450"
                  value={form.forceCollective}
                  onChange={e => setForm(p => ({ ...p, forceCollective: e.target.value }))}
                  data-testid="input-force-collective"
                />
                {form.forceCollective && (
                  <ForceBar value={Math.min(MAX_FC, Math.max(0, parseInt(form.forceCollective) || 0))} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Prix (FCFA) *</Label>
                <Input
                  id="price"
                  type="number"
                  min={1}
                  placeholder="ex: 15000"
                  value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  data-testid="input-price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment">Numéro de paiement (Wave/Orange/MTN) *</Label>
                <Input
                  id="payment"
                  type="tel"
                  placeholder="ex: +221 77 000 00 00"
                  value={form.paymentNumber}
                  onChange={e => setForm(p => ({ ...p, paymentNumber: e.target.value }))}
                  data-testid="input-payment-number"
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-listing">
                {createMutation.isPending ? "Publication..." : "Publier l'annonce"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full" data-testid="tabs-market">
          <TabsTrigger value="market" data-testid="tab-market">
            <Store className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Annonces</span>
            <span className="sm:hidden">Marché</span>
          </TabsTrigger>
          <TabsTrigger value="mine" data-testid="tab-mine">
            <Package className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Mes annonces</span>
            <span className="sm:hidden">Mes ann.</span>
          </TabsTrigger>
          <TabsTrigger value="cart" data-testid="tab-cart" className="relative">
            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
            Panier
            {cartCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-primary text-primary-foreground rounded-full">
                {cartCount}
              </span>
            )}
          </TabsTrigger>
          {!user?.isAdmin && (
            <TabsTrigger value="coins" data-testid="tab-coins">
              <Coins className="w-3.5 h-3.5 mr-1" />
              Pièces
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── ALL LISTINGS ── */}
        <TabsContent value="market" className="mt-4">
          {/* Status filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Filtrer :</span>
            <button
              onClick={() => setStatusFilter("all")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${statusFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:border-foreground"}`}
              data-testid="filter-all"
            >
              Tous
              <span className="opacity-60 font-normal">({listings.length})</span>
            </button>
            <button
              onClick={() => setStatusFilter("available")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${statusFilter === "available" ? "bg-green-600 text-white border-green-600" : "bg-background text-muted-foreground border-border hover:border-green-400"}`}
              data-testid="filter-available"
            >
              <Circle className="w-1.5 h-1.5 fill-current" />
              En cours
              <span className="opacity-70 font-normal">({listings.filter(l => l.status === "available").length})</span>
            </button>
            <button
              onClick={() => setStatusFilter("sold")}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${statusFilter === "sold" ? "bg-red-600 text-white border-red-600" : "bg-background text-muted-foreground border-border hover:border-red-400"}`}
              data-testid="filter-sold"
            >
              <Circle className="w-1.5 h-1.5 fill-current" />
              Vendus
              <span className="opacity-70 font-normal">({listings.filter(l => l.status === "sold").length})</span>
            </button>
          </div>

          {loadingListings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune annonce disponible</p>
              <p className="text-sm mt-1">Soyez le premier à vendre votre compte !</p>
            </div>
          ) : (() => {
            const filtered = statusFilter === "all" ? listings : listings.filter(l => l.status === statusFilter);
            return filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Circle className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-sm">Aucune annonce {statusFilter === "sold" ? "vendue" : "en cours"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(l => {
                  const isOwn = l.sellerId === user?.id;
                  return (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      showPayment={revealedPayments.has(l.id)}
                      onTogglePayment={() => togglePayment(l.id)}
                      onCart={isOwn ? undefined : () => cartMutation.mutate({ id: l.id, inCart: !!l.inCart })}
                      isMine={isOwn}
                      onDelete={isOwn ? () => deleteMutation.mutate(l.id) : undefined}
                      onSold={isOwn ? () => soldMutation.mutate(l.id) : undefined}
                    />
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        {/* ── MY LISTINGS ── */}
        <TabsContent value="mine" className="mt-4">
          {loadingMine ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
            </div>
          ) : mine.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Vous n'avez aucune annonce</p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-1" />
                Créer ma première annonce
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mine.map(l => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isMine
                  showPayment={revealedPayments.has(l.id)}
                  onTogglePayment={() => togglePayment(l.id)}
                  onSold={() => soldMutation.mutate(l.id)}
                  onDelete={() => deleteMutation.mutate(l.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CART ── */}
        <TabsContent value="cart" className="mt-4">
          {loadingCart ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
            </div>
          ) : cart.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Votre panier est vide</p>
              <p className="text-sm mt-1">Ajoutez des annonces qui vous intéressent</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {cart.length} article{cart.length > 1 ? "s" : ""} dans votre panier
                </span>
                <span className="text-sm font-bold text-primary">
                  Total : {cart.reduce((s, l) => s + l.price, 0).toLocaleString()} FCFA
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cart.map(l => (
                  <ListingCard
                    key={l.id}
                    listing={{ ...l, inCart: true }}
                    showPayment={revealedPayments.has(l.id)}
                    onTogglePayment={() => togglePayment(l.id)}
                    onCart={() => cartMutation.mutate({ id: l.id, inCart: true })}
                  />
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Pour acheter, cliquez sur "Voir" à côté du numéro de paiement et contactez le vendeur via Wave, Orange Money ou MTN Mobile Money.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── COINS ── */}
        <TabsContent value="coins" className="mt-4">
          {/* Balance banner */}
          <div className="flex items-center justify-between bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 rounded-xl p-4 mb-5">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Mon solde</p>
              <p className="text-2xl font-bold text-yellow-500 flex items-center gap-1.5" data-testid="text-coin-balance">
                <Coins className="w-5 h-5" />
                {coinBalance?.coins ?? 0} pièces
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {coinBalance?.bonusStars ?? 0} étoile{(coinBalance?.bonusStars ?? 0) > 1 ? "s" : ""} bonus obtenue{(coinBalance?.bonusStars ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-xs text-muted-foreground">300 pièces = 1 étoile ⭐</p>
              <Button
                size="sm"
                disabled={(coinBalance?.coins ?? 0) < 300 || buyStarMutation.isPending}
                onClick={() => buyStarMutation.mutate()}
                data-testid="button-buy-star"
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-xs"
              >
                <Star className="w-3.5 h-3.5 mr-1" />
                {buyStarMutation.isPending ? "..." : "Acheter 1 ⭐ (300 pièces)"}
              </Button>
            </div>
          </div>

          <p className="text-sm font-semibold mb-3">Acheter des pièces</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {coinPacks.map(pack => {
              const hasPromo = pack.promoFcfa != null && pack.promoFcfa > 0 && pack.promoFcfa < pack.priceFcfa;
              const displayPrice = hasPromo ? pack.promoFcfa! : pack.priceFcfa;
              return (
                <button
                  key={pack.name}
                  onClick={() => setSelectedPack(pack)}
                  data-testid={`card-coin-pack-${pack.name}`}
                  className={`relative rounded-xl border-2 p-3 text-center transition-all ${selectedPack?.name === pack.name ? "border-yellow-500 bg-yellow-500/10" : "border-border hover:border-yellow-400"} ${pack.popular ? "ring-1 ring-yellow-400" : ""} ${hasPromo ? "ring-2 ring-red-400" : ""}`}
                >
                  {hasPromo && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      PROMO
                    </span>
                  )}
                  {!hasPromo && pack.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full">
                      POPULAIRE
                    </span>
                  )}
                  <Coins className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
                  <p className="text-lg font-bold">{pack.coins}</p>
                  <p className="text-[10px] text-muted-foreground">pièces</p>
                  {hasPromo ? (
                    <div className="mt-1">
                      <p className="text-[10px] text-muted-foreground line-through">{pack.priceFcfa} FCFA</p>
                      <p className="text-sm font-bold text-red-500">{displayPrice} FCFA</p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-primary mt-1">{pack.priceFcfa} FCFA</p>
                  )}
                </button>
              );
            })}
          </div>

          {selectedPack && (() => {
            const selHasPromo = selectedPack.promoFcfa != null && selectedPack.promoFcfa > 0 && selectedPack.promoFcfa < selectedPack.priceFcfa;
            const selPrice = selHasPromo ? selectedPack.promoFcfa! : selectedPack.priceFcfa;
            const PAYMENT_NUMBER = "775 771 443";
            return (
            <div className="space-y-4">

              {/* Recap pack sélectionné */}
              <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground">{selectedPack.name} — {selectedPack.coins} pièces</p>
                  <p className="text-xs text-muted-foreground">
                    Montant à envoyer :
                    {selHasPromo ? (
                      <> <span className="line-through text-muted-foreground">{selectedPack.priceFcfa} FCFA</span> <span className="text-red-500 font-bold ml-1">{selPrice} FCFA</span></>
                    ) : (
                      <span className="font-bold text-yellow-600 ml-1">{selPrice} FCFA</span>
                    )}
                  </p>
                </div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => { setSelectedPack(null); setCoinProofPreview(null); setCoinProofBase64(null); }}
                >Changer</button>
              </div>

              {/* Étapes de paiement */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Comment procéder</p>

                {/* Étape 1 */}
                <div className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-xs">1</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Envoyez {selPrice} FCFA</p>
                    <p className="text-xs text-muted-foreground">Via Orange Money ou Wave au numéro ci-dessous</p>
                    <div className="mt-2 bg-muted rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-xl text-foreground tracking-widest">{PAYMENT_NUMBER}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Orange Money · Wave · MTN — eLIGA Admin</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(PAYMENT_NUMBER.replace(/\s/g, "")); toast({ title: "Numéro copié !" }); }}
                        className="flex-shrink-0 flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 rounded-lg px-2.5 py-1.5 hover:bg-primary/20 transition-colors"
                        data-testid="button-copy-payment-number"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copier
                      </button>
                    </div>
                  </div>
                </div>

                {/* Étape 2 */}
                <div className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-xs">2</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Notez la transaction</p>
                    <p className="text-xs text-muted-foreground">Indiquez en note :</p>
                    <div className="mt-1.5 bg-muted rounded-lg px-3 py-2 inline-block">
                      <p className="font-mono text-xs font-bold text-foreground">eLIGA Pièces {selectedPack.name}</p>
                    </div>
                  </div>
                </div>

                {/* Étape 3 — Upload preuve */}
                <div className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-xs">3</div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Uploadez la preuve <span className="text-red-500">*</span></p>
                      <p className="text-xs text-muted-foreground">Capture d'écran de la transaction confirmée</p>
                    </div>
                    <input
                      id="coin-proof-input"
                      ref={coinProofRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => {
                          const result = ev.target?.result as string;
                          setCoinProofPreview(result);
                          setCoinProofBase64(result);
                        };
                        reader.readAsDataURL(file);
                      }}
                      data-testid="input-coin-proof"
                    />
                    {coinProofPreview ? (
                      <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-500">
                        <img src={coinProofPreview} alt="Preuve de paiement" className="w-full max-h-48 object-contain bg-black/5" />
                        <button
                          type="button"
                          onClick={() => { setCoinProofPreview(null); setCoinProofBase64(null); if (coinProofRef.current) coinProofRef.current.value = ""; }}
                          className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-lg px-2 py-1 font-medium"
                        >✕ Supprimer</button>
                        <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs text-center py-1 font-semibold">
                          ✓ Preuve de paiement ajoutée
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="coin-proof-input"
                        className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl py-5 px-4 transition-colors select-none"
                        data-testid="button-upload-proof"
                      >
                        <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          <Camera className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Appuyer pour ajouter la capture</p>
                          <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">Capture d'écran de la transaction confirmée</p>
                          <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70">JPG, PNG, WEBP</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Étape 4 — Attente */}
                <div className="flex gap-3 items-center bg-card border border-border rounded-xl p-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Validation sous 24h</p>
                    <p className="text-xs text-muted-foreground">Les pièces seront créditées après validation par l'admin</p>
                  </div>
                </div>
              </div>

              {/* Avertissement fraude */}
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-red-700 dark:text-red-400 leading-relaxed">
                  Toute fraude (fausse preuve, paiement annulé) entraîne le <strong>blocage immédiat et définitif</strong> du compte. <strong>3 rejets</strong> = blocage automatique.
                </p>
              </div>

              {/* Bouton soumettre */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => { setSelectedPack(null); setCoinProofPreview(null); setCoinProofBase64(null); }}
                  data-testid="button-cancel-coin-purchase"
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold gap-1.5"
                  disabled={!coinProofBase64 || coinPurchaseMutation.isPending}
                  onClick={() => coinPurchaseMutation.mutate({
                    packName: selectedPack.name,
                    coinsAmount: selectedPack.coins,
                    priceFcfa: selPrice,
                    proofUrl: coinProofBase64,
                  })}
                  data-testid="button-confirm-coin-purchase"
                >
                  {coinPurchaseMutation.isPending ? (
                    <><Clock className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Soumettre la demande</>
                  )}
                </Button>
              </div>
            </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

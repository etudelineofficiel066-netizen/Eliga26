import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, Trophy, MessageSquare, Swords, Trash2, Sword,
  Search, BarChart3, Globe, Lock, Unlock, Gamepad2, AlertTriangle, LogOut, Store, Wifi, TrendingUp,
  Plus, Sparkles, Star, CalendarDays, Settings, Upload, X, Banknote, CheckCircle2, XCircle, Eye, Wallet, Coins, PiggyBank, Scale,
  Film, Pin, PinOff, VideoOff, Video, Bell, BellRing, CreditCard, UserPlus, Clock, ArrowRight
} from "lucide-react";

function AdminClipsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("technique");
  const [isFeatured, setIsFeatured] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewClip, setPreviewClip] = useState<any | null>(null);

  const { data: clips = [], isLoading: loadingClips } = useQuery<any[]>({ queryKey: ["/api/admin/clips"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });
  const { data: clipsGlobal } = useQuery<{ enabled: boolean }>({ queryKey: ["/api/settings/clips-enabled"] });
  const clipsPublishingEnabled = clipsGlobal?.enabled !== false;

  const toggleClipsPublishingMutation = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("PATCH", "/api/admin/settings/clips-enabled", { enabled }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings/clips-enabled"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const featureMutation = useMutation({
    mutationFn: (clipId: string) => apiRequest("PATCH", `/api/admin/clips/${clipId}/feature`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/clips"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteClipMutation = useMutation({
    mutationFn: (clipId: string) => apiRequest("DELETE", `/api/clips/${clipId}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/clips"] }); toast({ title: "Clip supprimé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const clipsPermMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/admin/users/${userId}/clips-permission`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast({ title: "Fichier invalide", variant: "destructive" }); return; }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) { toast({ title: "Titre et vidéo requis", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      formData.append("tag", tag);
      formData.append("isFeatured", isFeatured ? "true" : "false");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/clips/upload");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => { if (xhr.status === 200) resolve(); else reject(new Error(JSON.parse(xhr.responseText)?.error || "Erreur")); };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(formData);
      });
      toast({ title: isFeatured ? "Clip mis en avant publié !" : "Clip publié !" });
      setTitle(""); setDescription(""); setFile(null); setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clips"] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const players = (users as any[]).filter(u => !u.isAdmin);
  const featuredClips = (clips as any[]).filter(c => c.is_featured);
  const regularClips = (clips as any[]).filter(c => !c.is_featured);

  return (
    <div className="space-y-6" data-testid="tab-content-clips">
      {/* Global toggle: clips publishing */}
      <Card className={clipsPublishingEnabled ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {clipsPublishingEnabled
                ? <Video className="w-5 h-5 text-green-600 flex-shrink-0" />
                : <VideoOff className="w-5 h-5 text-red-500 flex-shrink-0" />}
              <div>
                <p className="font-semibold text-sm">Publication de clips</p>
                <p className="text-xs text-muted-foreground">
                  {clipsPublishingEnabled
                    ? "Tous les utilisateurs autorisés peuvent publier des clips"
                    : "Le bouton de publication est masqué pour tous les utilisateurs"}
                </p>
              </div>
            </div>
            <Switch
              checked={clipsPublishingEnabled}
              onCheckedChange={(v) => toggleClipsPublishingMutation.mutate(v)}
              disabled={toggleClipsPublishingMutation.isPending}
              data-testid="switch-global-clips-publishing"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Admin upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            Publier une vidéo officielle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${file ? "border-primary bg-primary/5" : "border-orange-400 bg-orange-50 hover:bg-orange-100"}`}
            onClick={() => fileInputRef.current?.click()}
            data-testid="input-admin-video"
          >
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
            {file ? (
              <p className="text-sm font-medium text-primary">{file.name}</p>
            ) : (
              <div className="space-y-1">
                <Upload className="w-6 h-6 text-orange-400 mx-auto" />
                <p className="text-sm font-medium text-orange-700">Sélectionner une vidéo</p>
              </div>
            )}
          </div>
          <Input placeholder="Titre *" value={title} onChange={e => setTitle(e.target.value)} data-testid="input-admin-clip-title" />
          <Input placeholder="Description (optionnel)" value={description} onChange={e => setDescription(e.target.value)} data-testid="input-admin-clip-desc" />
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} id="featured-toggle" data-testid="switch-featured" />
              <label htmlFor="featured-toggle" className="text-xs font-medium whitespace-nowrap">
                {isFeatured ? <span className="text-yellow-600 flex items-center gap-1"><Star className="w-3 h-3" /> Mis en avant</span> : "Normal"}
              </label>
            </div>
          </div>
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-center text-muted-foreground">{progress < 100 ? `${progress}%` : "Finalisation..."}</p>
            </div>
          )}
          <Button className="w-full" onClick={handleUpload} disabled={uploading || !file || !title.trim()} data-testid="button-admin-upload-clip">
            {uploading ? "Publication en cours..." : "Publier"}
          </Button>
        </CardContent>
      </Card>

      {/* Video preview modal */}
      {previewClip && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewClip(null)}>
          <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white flex items-center gap-1 text-sm"
              onClick={() => setPreviewClip(null)}
              data-testid="button-close-preview"
            >
              <X className="w-5 h-5" /> Fermer
            </button>
            <p className="text-white font-semibold mb-2 truncate">{previewClip.title}</p>
            <video
              src={previewClip.video_url}
              controls
              autoPlay
              className="w-full rounded-xl bg-black max-h-[70vh]"
              data-testid="video-preview-player"
            />
            <p className="text-white/60 text-xs mt-2">{previewClip.pseudo} · {parseInt(previewClip.views_count)||0} vues · {parseInt(previewClip.likes_count)||0} likes</p>
          </div>
        </div>
      )}

      {/* Section 2: Manage clips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            Gestion des clips ({clips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingClips ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : clips.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Aucun clip publié</p>
          ) : (
            <div className="space-y-4">
              {featuredClips.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-yellow-600 mb-2 flex items-center gap-1">
                    <Star className="w-3 h-3" /> Mis en avant ({featuredClips.length})
                  </p>
                  <div className="space-y-2">
                    {featuredClips.map((c: any) => (
                      <div key={c.id} className="rounded-lg border-2 border-yellow-200 bg-yellow-50 overflow-hidden" data-testid={`admin-clip-${c.id}`}>
                        {/* Video thumbnail */}
                        <div
                          className="relative bg-black cursor-pointer group"
                          style={{ aspectRatio: "16/9", maxHeight: "160px" }}
                          onClick={() => setPreviewClip(c)}
                          data-testid={`button-preview-${c.id}`}
                        >
                          <video
                            src={c.video_url}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow">
                              <Video className="w-5 h-5 text-black ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{c.title}</p>
                            <p className="text-xs text-muted-foreground">{c.pseudo} · {parseInt(c.views_count)||0} vues · {parseInt(c.likes_count)||0} likes</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-300" onClick={() => featureMutation.mutate(c.id)} disabled={featureMutation.isPending} data-testid={`button-unfeature-${c.id}`}>
                              <PinOff className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteClipMutation.mutate(c.id)} disabled={deleteClipMutation.isPending} data-testid={`button-admin-delete-clip-${c.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {regularClips.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Clips utilisateurs ({regularClips.length})</p>
                  <div className="space-y-2">
                    {regularClips.map((c: any) => (
                      <div key={c.id} className="rounded-lg border border-border overflow-hidden" data-testid={`admin-clip-${c.id}`}>
                        {/* Video thumbnail */}
                        <div
                          className="relative bg-black cursor-pointer group"
                          style={{ aspectRatio: "16/9", maxHeight: "160px" }}
                          onClick={() => setPreviewClip(c)}
                          data-testid={`button-preview-${c.id}`}
                        >
                          <video
                            src={c.video_url}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow">
                              <Video className="w-5 h-5 text-black ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{c.title}</p>
                            <p className="text-xs text-muted-foreground">{c.pseudo} · {parseInt(c.views_count)||0} vues · {parseInt(c.likes_count)||0} likes</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => featureMutation.mutate(c.id)} disabled={featureMutation.isPending} title="Mettre en avant" data-testid={`button-feature-${c.id}`}>
                              <Pin className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteClipMutation.mutate(c.id)} disabled={deleteClipMutation.isPending} data-testid={`button-admin-delete-clip-${c.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: User clips permission */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Permissions de publication ({players.length} joueurs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Aucun joueur</p>
          ) : (
            <div className="space-y-2">
              {players.map((u: any) => (
                <div key={u.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${u.canPostClips === false ? "border-destructive/30 bg-destructive/5" : "border-border"}`} data-testid={`admin-user-clips-perm-${u.id}`}>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{u.pseudo?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{u.pseudo}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.canPostClips === false ? (
                      <span className="flex items-center gap-1 text-xs text-destructive font-medium"><VideoOff className="w-3.5 h-3.5" /> Bloqué</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Video className="w-3.5 h-3.5" /> Autorisé</span>
                    )}
                    <Switch
                      checked={u.canPostClips !== false}
                      onCheckedChange={() => clipsPermMutation.mutate(u.id)}
                      disabled={clipsPermMutation.isPending}
                      data-testid={`switch-clips-perm-${u.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const createTournamentSchema = z.object({
  name: z.string().min(3, "Au moins 3 caractères"),
  championshipType: z.enum(["pool", "league"]),
  playersPerPool: z.number().min(2).optional(),
  numPools: z.number().min(1).optional(),
  playerLimit: z.number().min(2).optional(),
  visibility: z.enum(["public", "private"]),
  gameType: z.enum(["ps", "xbox", "mobile"]),
  gameTime: z.string().min(1),
  gameForm: z.string().min(1),
  extraTime: z.boolean(),
  penalties: z.boolean(),
  otherRules: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isSponsored: z.boolean().optional(),
  sponsorName: z.string().optional(),
  sponsorLogo: z.string().optional(),
  prizeInfo: z.string().optional(),
  isElite: z.boolean().optional(),
  minStars: z.number().min(0).max(5).optional(),
  elitePrizeAmount: z.number().min(0).optional(),
  isPaid: z.boolean().optional(),
  entryFee: z.number().min(0).optional(),
  entryPaymentNumber: z.string().optional(),
});
type CreateTournamentData = z.infer<typeof createTournamentSchema>;

function AdminTournamentStatusButton({ tournament, onRefresh }: { tournament: any; onRefresh: () => void }) {
  const { toast } = useToast();
  const statusMap: Record<string, { label: string; next: string; nextLabel: string; color: string }> = {
    waiting:     { label: "En attente", next: "in_progress", nextLabel: "▶ Démarrer", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
    in_progress: { label: "En cours",   next: "finished",    nextLabel: "⏹ Terminer",  color: "bg-primary/10 text-primary border-primary/20" },
    finished:    { label: "Terminé",    next: "waiting",     nextLabel: "↺ Réouvrir",  color: "bg-muted text-muted-foreground" },
  };
  const info = statusMap[tournament.status] ?? statusMap.waiting;

  const mutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/tournaments/${tournament.id}/status`, { status: info.next }),
    onSuccess: () => { onRefresh(); toast({ title: "Statut mis à jour", description: `Tournoi "${tournament.name}" → ${info.nextLabel}` }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      data-testid={`button-status-${tournament.id}`}
    >
      {mutation.isPending ? "..." : info.nextLabel}
    </Button>
  );
}

function DisputesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<{ id: string; challengerPseudo: string; opponentPseudo: string; challengerId: string; opponentId: string } | null>(null);

  const { data: disputes = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/challenges/disputes"] });

  const resolveMutation = useMutation({
    mutationFn: ({ id, winnerId }: { id: string; winnerId: string }) =>
      apiRequest("POST", `/api/admin/challenges/${id}/resolve`, { winnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenges/disputes"] });
      setResolving(null);
      toast({ title: "Litige résolu", description: "Le vainqueur a été désigné et les pièces distribuées." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="tab-content-disputes">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-semibold">Litiges de défis</h2>
        <Badge variant="outline" className="ml-auto">{disputes.length}</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucun litige en attente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: any) => {
            const pot = parseInt(d.coinsEscrowed ?? 0);
            const payout = Math.floor(pot * 0.85);
            return (
              <div key={d.id} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-4" data-testid={`dispute-card-${d.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sword className="w-4 h-4 text-red-600" />
                      <span className="font-semibold text-sm">{d.challengerPseudo} vs {d.opponentPseudo}</span>
                      {pot > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
                          <Coins className="w-3 h-3" /> {pot} pièces • gagnant : {payout}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{d.proposedDate} à {d.proposedTime}</p>
                    {d.propScoreC !== null && d.propScoreO !== null && (
                      <p className="text-xs mt-1">Score proposé : <span className="font-mono font-bold">{d.propScoreC} – {d.propScoreO}</span></p>
                    )}
                    {d.message && <p className="text-xs italic text-muted-foreground mt-1">"{d.message}"</p>}
                  </div>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                    onClick={() => setResolving({ id: d.id, challengerPseudo: d.challengerPseudo, opponentPseudo: d.opponentPseudo, challengerId: d.challengerId, opponentId: d.opponentId })}
                    data-testid={`button-resolve-dispute-${d.id}`}
                  >
                    <Scale className="w-3.5 h-3.5 mr-1" /> Trancher
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve modal */}
      <Dialog open={!!resolving} onOpenChange={open => !open && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-red-600" />
              Désigner le vainqueur
            </DialogTitle>
          </DialogHeader>
          {resolving && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Qui a gagné ce match ? Les pièces seront immédiatement transférées.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => resolveMutation.mutate({ id: resolving.id, winnerId: resolving.challengerId })}
                  disabled={resolveMutation.isPending}
                  className="h-16 flex-col gap-1"
                  data-testid="button-pick-challenger"
                >
                  <Trophy className="w-5 h-5" />
                  <span className="text-sm font-semibold">{resolving.challengerPseudo}</span>
                  <span className="text-[10px] opacity-70">Challenger</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => resolveMutation.mutate({ id: resolving.id, winnerId: resolving.opponentId })}
                  disabled={resolveMutation.isPending}
                  className="h-16 flex-col gap-1 border-primary"
                  data-testid="button-pick-opponent"
                >
                  <Trophy className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold">{resolving.opponentPseudo}</span>
                  <span className="text-[10px] opacity-70">Adversaire</span>
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setResolving(null)}>Annuler</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewingProof, setViewingProof] = useState<string | null>(null);

  const { data: payments, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/payments"] });

  const confirmMutation = useMutation({
    mutationFn: (participantId: string) => apiRequest("PATCH", `/api/admin/payments/${participantId}/confirm`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); toast({ title: "Paiement confirmé ✓", description: "Le joueur est maintenant inscrit." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (participantId: string) => apiRequest("PATCH", `/api/admin/payments/${participantId}/reject`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] }); toast({ title: "Paiement rejeté", description: "Le joueur a été notifié du rejet." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-24 w-full"/>)}</div>;

  if (!payments?.length) return (
    <Card>
      <CardContent className="py-12 text-center">
        <Banknote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Aucune preuve de paiement en attente</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-4 h-4 text-green-600" />
        <h3 className="font-semibold text-sm">Preuves de paiement en attente ({payments.length})</h3>
      </div>
      {payments.map((p: any) => (
        <Card key={p.participantId} className="border-green-200 dark:border-green-800" data-testid={`payment-${p.participantId}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10 flex-shrink-0">
                {p.userAvatarUrl && <AvatarImage src={p.userAvatarUrl} />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{p.userPseudo?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{p.userPseudo}</p>
                  <span className="text-xs text-muted-foreground">@{p.userUsername}</span>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-300 text-amber-700">En attente</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Tournoi : <span className="font-medium text-foreground">{p.tournamentName}</span></p>
                <p className="text-xs text-green-700 dark:text-green-400 font-semibold">{p.entryFee?.toLocaleString()} XAF → {p.entryPaymentNumber}</p>
                <p className="text-xs text-muted-foreground">Inscrit le {new Date(p.joinedAt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {p.paymentProof && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setViewingProof(p.paymentProof)} data-testid={`button-view-proof-${p.participantId}`}>
                  <Eye className="w-3.5 h-3.5" /> Voir la preuve
                </Button>
              )}
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmMutation.mutate(p.participantId)} disabled={confirmMutation.isPending} data-testid={`button-confirm-payment-${p.participantId}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmer
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => rejectMutation.mutate(p.participantId)} disabled={rejectMutation.isPending} data-testid={`button-reject-payment-${p.participantId}`}>
                <XCircle className="w-3.5 h-3.5" /> Rejeter
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Proof viewer dialog */}
      <Dialog open={!!viewingProof} onOpenChange={open => !open && setViewingProof(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Preuve de paiement</DialogTitle></DialogHeader>
          {viewingProof && <img src={viewingProof} alt="Preuve de paiement" className="w-full rounded-lg object-contain max-h-[70vh]" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [searchUser, setSearchUser] = useState("");
  const [searchTournament, setSearchTournament] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  const [sponsorLogoPreview, setSponsorLogoPreview] = useState<string | null>(null);
  const sponsorLogoRef = useRef<HTMLInputElement>(null);

  function handleSponsorLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Image trop lourde (max 3 Mo)", variant: "destructive" }); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setSponsorLogoPreview(url);
      ctForm.setValue("sponsorLogo", url);
    };
    reader.readAsDataURL(file);
  }

  const ctForm = useForm<CreateTournamentData>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
      name: "", championshipType: "league", visibility: "public",
      gameType: "ps", gameTime: "10", gameForm: "excellent",
      extraTime: false, penalties: true, otherRules: "",
      isSponsored: false, sponsorName: "", sponsorLogo: "", prizeInfo: "",
      isElite: false, minStars: 0, elitePrizeAmount: 0,
      isPaid: false, entryFee: 0, entryPaymentNumber: "",
    },
  });
  const ctWatchType = ctForm.watch("championshipType");
  const ctWatchVis = ctForm.watch("visibility");
  const ctWatchSponsored = ctForm.watch("isSponsored");
  const ctWatchElite = ctForm.watch("isElite");
  const ctWatchPaid = ctForm.watch("isPaid");
  const ctWatchEntryFee = ctForm.watch("entryFee") ?? 0;

  const createTournamentMutation = useMutation({
    mutationFn: (data: CreateTournamentData) => apiRequest("POST", "/api/tournaments", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      ctForm.reset();
      setSponsorLogoPreview(null);
      if (sponsorLogoRef.current) sponsorLogoRef.current.value = "";
      toast({ title: "Tournoi créé !", description: data.code ? `Code privé : ${data.code}` : data.isSponsored ? `Tournoi sponsorisé par ${data.sponsorName || "—"} créé.` : "Tournoi créé avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const { data: stats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 10000,
  });

  const { data: allUsers, isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: allTournaments, isLoading: loadingTournaments } = useQuery<any[]>({
    queryKey: ["/api/admin/tournaments"],
  });



  const { data: allListings, isLoading: loadingListings } = useQuery<any[]>({
    queryKey: ["/api/admin/market"],
  });

  const { data: pendingCoinPurchases = [], isLoading: loadingCoinPurchases } = useQuery<any[]>({
    queryKey: ["/api/admin/coin-purchases"],
    refetchInterval: 15000,
  });

  const { data: adminNotifs } = useQuery<any>({
    queryKey: ["/api/admin/notifications"],
    refetchInterval: 20000,
  });
  const urgentCount = adminNotifs?.urgent ?? 0;

  const { data: finances } = useQuery<any>({
    queryKey: ["/api/admin/finances"],
    refetchInterval: 30000,
  });

  const { data: coinPacksData = [] } = useQuery<any[]>({
    queryKey: ["/api/coin-packs"],
    refetchInterval: 30000,
  });

  const [promoValues, setPromoValues] = useState<Record<string, string>>({});
  const [promoEditing, setPromoEditing] = useState(false);

  const savePromoMutation = useMutation({
    mutationFn: (data: { starter: string; champion: string; elite: string }) =>
      apiRequest("POST", "/api/admin/coin-promos", {
        starter:  data.starter  !== "" ? parseInt(data.starter)  : null,
        champion: data.champion !== "" ? parseInt(data.champion) : null,
        elite:    data.elite    !== "" ? parseInt(data.elite)    : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coin-packs"] });
      toast({ title: "✅ Promos mises à jour", description: "Les nouvelles promotions sont actives." });
      setPromoEditing(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const clearPromoMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/coin-promos", { starter: null, champion: null, elite: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coin-packs"] });
      toast({ title: "Promos supprimées", description: "Les prix sont revenus au tarif normal." });
      setPromoValues({});
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const confirmCoinMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/coin-purchases/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coin-purchases"] });
      toast({ title: "✅ Paiement validé", description: "Les pièces ont été créditées." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectCoinMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/coin-purchases/${id}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coin-purchases"] });
      toast({ title: "❌ Demande rejetée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const blockUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/users/${id}/block`, { reason: "Décision administrative." }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte bloqué" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const unblockUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/users/${id}/unblock`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Compte débloqué" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteListingMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/market/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market"] });
      toast({ title: "Annonce supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteConfirm(null);
      toast({ title: "Utilisateur supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/tournaments/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteConfirm(null);
      toast({ title: "Tournoi supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const distributeMutation = useMutation({
    mutationFn: (tournamentId: string) => apiRequest("POST", `/api/admin/finances/${tournamentId}/distribute`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finances"] });
      toast({ title: "Distribution effectuée !", description: "Les gains ont été calculés et les gagnants notifiés." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const filteredUsers = allUsers?.filter(u =>
    u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.pseudo.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.country.toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredTournaments = allTournaments?.filter(t =>
    t.name.toLowerCase().includes(searchTournament.toLowerCase()) ||
    t.creator?.pseudo?.toLowerCase().includes(searchTournament.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    waiting: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-primary/10 text-primary",
    finished: "bg-muted text-muted-foreground",
  };
  const statusLabel: Record<string, string> = {
    waiting: "En attente", in_progress: "En cours", finished: "Terminé",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-foreground">eLIGA Admin</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Tableau de bord administrateur</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium">{user?.pseudo}</p>
            <Badge variant="destructive" className="text-xs">Administrateur</Badge>
          </div>
          <Avatar className="w-8 h-8 sm:w-9 sm:h-9">
            <AvatarFallback className="bg-destructive/10 text-destructive font-bold text-sm">
              {user?.pseudo?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" onClick={logout} data-testid="button-admin-logout" className="gap-1.5">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 sm:space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {loadingStats ? (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : (
            <>
              {[
                { label: "Utilisateurs", value: stats?.users ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Tournois", value: stats?.tournaments ?? 0, icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Matchs", value: stats?.matches ?? 0, icon: Swords, color: "text-primary", bg: "bg-primary/10" },
                { label: "Messages", value: stats?.messages ?? 0, icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500/10" },
                { label: "Tournois actifs", value: stats?.activeTournaments ?? 0, icon: BarChart3, color: "text-green-500", bg: "bg-green-500/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}

              {/* Online users – live card */}
              <Card className="hover-elevate border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-950/20" data-testid="card-online-users">
                <CardContent className="p-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3 relative">
                    <Wifi className="w-5 h-5 text-green-500" />
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-online-count">
                    {stats?.onlineUsers ?? 0}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-500 font-medium">En ligne</p>
                </CardContent>
              </Card>

              {/* Today's visitors */}
              <Card className="hover-elevate border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20" data-testid="card-today-visitors">
                <CardContent className="p-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-today-visitors">
                    {stats?.todayVisitors ?? 0}
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-500 font-medium">Visiteurs aujourd'hui</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Daily visitors chart – last 7 days */}
        {!loadingStats && stats?.dailyVisits?.length > 0 && (
          <Card data-testid="card-daily-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                Visiteurs uniques — 7 derniers jours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const visits: { date: string; visitors: number }[] = stats.dailyVisits;
                const max = Math.max(...visits.map((v: any) => v.visitors), 1);
                const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
                return (
                  <div className="flex items-end gap-2 h-32">
                    {visits.map((v: any) => {
                      const d = new Date(v.date + "T12:00:00");
                      const pct = Math.round((v.visitors / max) * 100);
                      const isToday = v.date === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={v.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" data-testid={`bar-visit-${v.date}`}>
                          <span className="text-xs font-semibold text-foreground">{v.visitors > 0 ? v.visitors : ""}</span>
                          <div
                            className={`w-full rounded-t-md transition-all ${isToday ? "bg-orange-500" : "bg-orange-300 dark:bg-orange-700"}`}
                            style={{ height: `${Math.max(pct, v.visitors > 0 ? 8 : 2)}%` }}
                          />
                          <span className={`text-[10px] ${isToday ? "font-bold text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                            {days[d.getDay()]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Quick action: Create tournament */}
        {activeTab !== "create" && (
          <button
            onClick={() => setActiveTab("create")}
            data-testid="button-quick-create-tournament"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all text-primary group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Créer un tournoi</p>
              <p className="text-xs text-primary/60">Sponsorisé · Élite · Cotisation · Privé</p>
            </div>
          </button>
        )}

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Custom nav bar - always shows icon + label */}
          <div className="flex overflow-x-auto gap-1 pb-1 border-b bg-muted/40 rounded-xl p-1.5">
            {[
              { id: "notifications", icon: <span className="relative inline-flex"><Bell className="w-4 h-4" />{urgentCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{urgentCount > 9 ? "9+" : urgentCount}</span>}</span>, label: "Alertes" },
              { id: "users",       icon: <Users className="w-4 h-4" />,       label: "Joueurs" },
              { id: "create",      icon: <Plus className="w-4 h-4" />,        label: "Créer" },
              { id: "payments",    icon: <Wallet className="w-4 h-4" />,      label: "Paiements" },
              { id: "tournaments", icon: <Trophy className="w-4 h-4" />,      label: "Tournois" },
              { id: "market",      icon: <Store className="w-4 h-4" />,       label: "Marché" },
              { id: "coins",       icon: <span className="relative inline-flex"><Star className="w-4 h-4" />{pendingCoinPurchases.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-500 text-black text-[8px] font-bold rounded-full flex items-center justify-center">{pendingCoinPurchases.length}</span>}</span>, label: "Pièces" },
              { id: "finances",    icon: <TrendingUp className="w-4 h-4" />,  label: "Finances" },
              { id: "disputes",    icon: <Scale className="w-4 h-4" />,       label: "Litiges" },
              { id: "clips",       icon: <Film className="w-4 h-4" />,        label: "Clips" },
            ].map(tab => (
              <button
                key={tab.id}
                data-testid={`admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-all",
                  activeTab === tab.id
                    ? tab.id === "create"
                      ? "bg-primary text-primary-foreground shadow"
                      : tab.id === "payments"
                        ? "bg-green-600 text-white shadow"
                        : "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                ].join(" ")}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notifications" className="mt-4">
            <div className="space-y-3" data-testid="tab-content-notifications">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                {urgentCount > 0
                  ? <BellRing className="w-5 h-5 text-red-500 animate-pulse" />
                  : <Bell className="w-5 h-5 text-muted-foreground" />}
                <h2 className="font-bold text-base">
                  {urgentCount > 0 ? `${urgentCount} action${urgentCount > 1 ? "s" : ""} requise${urgentCount > 1 ? "s" : ""}` : "Tout est à jour ✓"}
                </h2>
              </div>

              {/* Pending payments */}
              <button
                onClick={() => setActiveTab("payments")}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${(adminNotifs?.pendingPayments ?? 0) > 0 ? "border-orange-300 bg-orange-50" : "border-border bg-muted/30"}`}
                data-testid="notif-card-payments"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(adminNotifs?.pendingPayments ?? 0) > 0 ? "bg-orange-100" : "bg-muted"}`}>
                  <CreditCard className={`w-5 h-5 ${(adminNotifs?.pendingPayments ?? 0) > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Preuves de paiement</p>
                  <p className="text-xs text-muted-foreground">
                    {(adminNotifs?.pendingPayments ?? 0) > 0
                      ? `${adminNotifs.pendingPayments} preuve${adminNotifs.pendingPayments > 1 ? "s" : ""} en attente de validation`
                      : "Aucune preuve en attente"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(adminNotifs?.pendingPayments ?? 0) > 0 && (
                    <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{adminNotifs.pendingPayments}</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>

              {/* Proposed scores */}
              <button
                onClick={() => setActiveTab("disputes")}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${(adminNotifs?.proposedScores ?? 0) > 0 ? "border-blue-300 bg-blue-50" : "border-border bg-muted/30"}`}
                data-testid="notif-card-scores"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(adminNotifs?.proposedScores ?? 0) > 0 ? "bg-blue-100" : "bg-muted"}`}>
                  <Swords className={`w-5 h-5 ${(adminNotifs?.proposedScores ?? 0) > 0 ? "text-blue-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Scores proposés (tournois)</p>
                  <p className="text-xs text-muted-foreground">
                    {(adminNotifs?.proposedScores ?? 0) > 0
                      ? `${adminNotifs.proposedScores} score${adminNotifs.proposedScores > 1 ? "s" : ""} en attente de confirmation`
                      : "Aucun score en attente"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(adminNotifs?.proposedScores ?? 0) > 0 && (
                    <span className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">{adminNotifs.proposedScores}</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>

              {/* Disputed challenges */}
              <button
                onClick={() => setActiveTab("disputes")}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${(adminNotifs?.disputedChallenges ?? 0) > 0 ? "border-red-300 bg-red-50" : "border-border bg-muted/30"}`}
                data-testid="notif-card-challenges"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(adminNotifs?.disputedChallenges ?? 0) > 0 ? "bg-red-100" : "bg-muted"}`}>
                  <Scale className={`w-5 h-5 ${(adminNotifs?.disputedChallenges ?? 0) > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Litiges défis</p>
                  <p className="text-xs text-muted-foreground">
                    {(adminNotifs?.disputedChallenges ?? 0) > 0
                      ? `${adminNotifs.disputedChallenges} défi${adminNotifs.disputedChallenges > 1 ? "s" : ""} avec score contesté`
                      : "Aucun litige en cours"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(adminNotifs?.disputedChallenges ?? 0) > 0 && (
                    <span className="w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">{adminNotifs.disputedChallenges}</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>

              {/* Pending coin purchases */}
              <button
                onClick={() => setActiveTab("coins")}
                className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${(adminNotifs?.pendingCoins ?? 0) > 0 ? "border-yellow-300 bg-yellow-50" : "border-border bg-muted/30"}`}
                data-testid="notif-card-coins"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${(adminNotifs?.pendingCoins ?? 0) > 0 ? "bg-yellow-100" : "bg-muted"}`}>
                  <Coins className={`w-5 h-5 ${(adminNotifs?.pendingCoins ?? 0) > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Achats de pièces</p>
                  <p className="text-xs text-muted-foreground">
                    {(adminNotifs?.pendingCoins ?? 0) > 0
                      ? `${adminNotifs.pendingCoins} achat${adminNotifs.pendingCoins > 1 ? "s" : ""} en attente de confirmation`
                      : "Aucun achat en attente"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(adminNotifs?.pendingCoins ?? 0) > 0 && (
                    <span className="w-7 h-7 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">{adminNotifs.pendingCoins}</span>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>

              {/* New users info */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-green-200 bg-green-50">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Nouveaux inscrits</p>
                  <p className="text-xs text-muted-foreground">
                    {(adminNotifs?.newUsers ?? 0) > 0
                      ? `${adminNotifs.newUsers} nouveau${adminNotifs.newUsers > 1 ? "x" : ""} utilisateur${adminNotifs.newUsers > 1 ? "s" : ""} dans les dernières 24h`
                      : "Aucune nouvelle inscription aujourd'hui"}
                  </p>
                </div>
                {(adminNotifs?.newUsers ?? 0) > 0 && (
                  <span className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{adminNotifs.newUsers}</span>
                )}
              </div>

              {/* Last refresh info */}
              <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Actualisé toutes les 20 secondes
              </p>
            </div>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base">Gestion des utilisateurs ({allUsers?.length ?? 0})</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchUser}
                      onChange={e => setSearchUser(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-users"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (() => {
                  const adminAccounts = filteredUsers?.filter(u => u.isAdmin) ?? [];
                  const playerAccounts = filteredUsers?.filter(u => !u.isAdmin) ?? [];
                  const UserRow = ({ u }: { u: any }) => (
                    <tr key={u.id} className={`py-2 ${u.isBlocked ? "opacity-60" : ""}`} data-testid={`admin-user-${u.id}`}>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.pseudo} />}
                            <AvatarFallback className={`text-xs font-bold ${u.isAdmin ? "bg-destructive/10 text-destructive" : u.isBlocked ? "bg-gray-200 text-gray-500" : "bg-primary/10 text-primary"}`}>
                              {u.pseudo.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium leading-tight">{u.pseudo}</p>
                              {u.isBlocked && <Lock className="w-3 h-3 text-destructive" />}
                            </div>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 hidden md:table-cell text-muted-foreground">{u.phone}</td>
                      <td className="py-3 hidden sm:table-cell text-muted-foreground">{u.country}, {u.region}</td>
                      <td className="py-3 hidden lg:table-cell text-muted-foreground text-xs">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="py-3">
                        {u.isAdmin
                          ? <Badge variant="destructive" className="text-xs">Admin</Badge>
                          : u.isBlocked
                            ? <Badge className="text-xs bg-gray-500 text-white">Bloqué</Badge>
                            : <Badge variant="outline" className="text-xs">Joueur</Badge>}
                      </td>
                      <td className="py-3 text-right">
                        {!u.isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            {u.isBlocked ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700"
                                title="Débloquer le compte"
                                disabled={unblockUserMutation.isPending}
                                onClick={() => unblockUserMutation.mutate(u.id)}
                                data-testid={`button-unblock-user-${u.id}`}
                              >
                                <Unlock className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-orange-500 hover:text-orange-700"
                                title="Bloquer le compte"
                                disabled={blockUserMutation.isPending}
                                onClick={() => blockUserMutation.mutate(u.id)}
                                data-testid={`button-block-user-${u.id}`}
                              >
                                <Lock className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setDeleteConfirm({ type: "user", id: u.id, name: u.pseudo })}
                              data-testid={`button-delete-user-${u.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );

                  const colHeader = (
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">Compte</th>
                      <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                      <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Localisation</th>
                      <th className="pb-3 font-medium text-muted-foreground hidden lg:table-cell">Inscrit le</th>
                      <th className="pb-3 font-medium text-muted-foreground">Rôle</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  );

                  return (
                    <div className="space-y-4 overflow-x-auto">
                      {/* Admin accounts section */}
                      {adminAccounts.length > 0 && (
                        <div className="rounded-lg border-2 border-destructive/20 bg-destructive/5 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-destructive" />
                            <span className="text-xs font-bold uppercase tracking-wide text-destructive">Administrateurs ({adminAccounts.length})</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>{colHeader}</thead>
                            <tbody className="divide-y divide-border">
                              {adminAccounts.map(u => <UserRow key={u.id} u={u} />)}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Separator */}
                      {adminAccounts.length > 0 && playerAccounts.length > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Joueurs ({playerAccounts.length})</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}

                      {/* Regular players */}
                      {playerAccounts.length > 0 && (
                        <table className="w-full text-sm">
                          <thead>{colHeader}</thead>
                          <tbody className="divide-y divide-border">
                            {playerAccounts.map(u => <UserRow key={u.id} u={u} />)}
                          </tbody>
                        </table>
                      )}

                      {filteredUsers?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">Aucun utilisateur trouvé</div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TOURNAMENTS TAB */}
          <TabsContent value="tournaments" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Tous les tournois ({allTournaments?.length ?? 0})
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTournament}
                    onChange={e => setSearchTournament(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-tournaments"
                  />
                </div>
              </div>

              {loadingTournaments ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
              ) : (() => {
                const myT = filteredTournaments?.filter((t: any) => t.creatorId === user?.id) ?? [];
                const playerT = filteredTournaments?.filter((t: any) => t.creatorId !== user?.id) ?? [];

                const TournamentCard = ({ t }: { t: any }) => (
                  <Card key={t.id} data-testid={`admin-tournament-${t.id}`} className={`border ${t.isSponsored ? "border-amber-200 dark:border-amber-800" : t.isElite ? "border-yellow-200 dark:border-yellow-800" : t.isPaid ? "border-green-200 dark:border-green-800" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.isSponsored ? "bg-amber-100 dark:bg-amber-900/30" : t.isElite ? "bg-yellow-100 dark:bg-yellow-900/30" : t.isPaid ? "bg-green-100 dark:bg-green-900/30" : "bg-primary/10"}`}>
                          {t.isSponsored ? <Sparkles className="w-5 h-5 text-amber-600" /> : t.isElite ? <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> : t.isPaid ? <Banknote className="w-5 h-5 text-green-600" /> : <Trophy className="w-5 h-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-semibold text-sm leading-tight">{t.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">par {t.creator?.pseudo} · {t.championshipType === "pool" ? "Poules" : "Ligue"} · {t.gameType?.toUpperCase()} {t.gameTime}min</p>
                            </div>
                            <Badge className={`text-xs flex-shrink-0 ${statusColor[t.status]}`}>{statusLabel[t.status] || t.status}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {t.visibility === "private" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                <Lock className="w-2.5 h-2.5" /> Privé {t.code && `· ${t.code}`}
                              </span>
                            )}
                            {t.isSponsored && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                                <Sparkles className="w-2.5 h-2.5" /> Sponsorisé{t.sponsorName ? ` · ${t.sponsorName}` : ""}
                              </span>
                            )}
                            {t.isElite && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                                {"★".repeat(t.minStars ?? 1)} Élite
                              </span>
                            )}
                            {t.isPaid && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                                <Banknote className="w-2.5 h-2.5" /> {t.entryFee?.toLocaleString()} XAF
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                              <Users className="w-2.5 h-2.5" /> {t.participantCount}{t.playerLimit ? `/${t.playerLimit}` : ""} joueurs
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <AdminTournamentStatusButton tournament={t} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/tournaments"] })} />
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => navigate(`/tournaments/${t.id}`)}
                          data-testid={`button-manage-tournament-${t.id}`}
                        >
                          <Settings className="w-3.5 h-3.5" /> Gérer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 gap-1.5 ml-auto"
                          onClick={() => setDeleteConfirm({ type: "tournament", id: t.id, name: t.name })}
                          data-testid={`button-delete-tournament-${t.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );

                if ((filteredTournaments?.length ?? 0) === 0) return (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Aucun tournoi trouvé</p>
                    </CardContent>
                  </Card>
                );

                return (
                  <div className="space-y-4">
                    {/* Admin's own tournaments */}
                    {myT.length > 0 && (
                      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-xs font-bold uppercase tracking-wide text-primary">Mes tournois ({myT.length})</span>
                        </div>
                        {myT.map((t: any) => <TournamentCard key={t.id} t={t} />)}
                      </div>
                    )}

                    {/* Separator */}
                    {myT.length > 0 && playerT.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Tournois des joueurs ({playerT.length})
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}

                    {/* Players' tournaments */}
                    {playerT.length > 0 && (
                      <div className="space-y-3">
                        {playerT.map((t: any) => <TournamentCard key={t.id} t={t} />)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* MARKET TAB */}
          <TabsContent value="market" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Annonces Marché ({allListings?.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingListings ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : allListings?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Aucune annonce
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-3 font-medium text-muted-foreground">Vendeur</th>
                          <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Pays</th>
                          <th className="pb-3 font-medium text-muted-foreground">FC</th>
                          <th className="pb-3 font-medium text-muted-foreground">Prix</th>
                          <th className="pb-3 font-medium text-muted-foreground">Statut</th>
                          <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                          <th className="pb-3 font-medium text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {allListings?.map(l => (
                          <tr key={l.id} className="hover:bg-muted/30 transition-colors" data-testid={`admin-listing-${l.id}`}>
                            <td className="py-3 font-medium">{l.seller?.pseudo}</td>
                            <td className="py-3 hidden sm:table-cell text-muted-foreground">{l.seller?.country}</td>
                            <td className="py-3 font-mono font-bold">{l.forceCollective}</td>
                            <td className="py-3 text-primary font-semibold">{l.price?.toLocaleString()} FCFA</td>
                            <td className="py-3">
                              <Badge variant={l.status === "sold" ? "outline" : "secondary"} className="text-xs">
                                {l.status === "sold" ? "Vendu" : "Disponible"}
                              </Badge>
                            </td>
                            <td className="py-3 hidden md:table-cell text-muted-foreground text-xs">
                              {new Date(l.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </td>
                            <td className="py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                disabled={deleteListingMutation.isPending}
                                onClick={() => deleteListingMutation.mutate(l.id)}
                                data-testid={`admin-delete-listing-${l.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COINS TAB */}
          <TabsContent value="coins" className="mt-4 space-y-4">

            {/* Promo Management Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="w-4 h-4 text-red-500" />
                    Prix promotionnels des packs
                  </CardTitle>
                  {!promoEditing ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const vals: Record<string, string> = {};
                        for (const pack of coinPacksData) {
                          vals[pack.name] = pack.promoFcfa != null ? String(pack.promoFcfa) : "";
                        }
                        setPromoValues(vals);
                        setPromoEditing(true);
                      }}
                      data-testid="button-edit-promos"
                    >
                      <Settings className="w-3.5 h-3.5 mr-1" /> Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPromoEditing(false)} data-testid="button-cancel-promos">Annuler</Button>
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white"
                        disabled={savePromoMutation.isPending}
                        onClick={() => savePromoMutation.mutate({
                          starter:  promoValues["Starter"]  ?? "",
                          champion: promoValues["Champion"] ?? "",
                          elite:    promoValues["Élite"]    ?? "",
                        })}
                        data-testid="button-save-promos"
                      >
                        {savePromoMutation.isPending ? "..." : "Enregistrer"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coinPacksData.map((pack: any) => {
                    const hasPromo = pack.promoFcfa != null && pack.promoFcfa > 0;
                    return (
                      <div key={pack.name} className="flex items-center gap-3 p-3 border rounded-xl" data-testid={`row-promo-${pack.name}`}>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{pack.name} — {pack.coins} pièces</p>
                          <p className="text-xs text-muted-foreground">Prix normal : {pack.priceFcfa} FCFA</p>
                        </div>
                        {promoEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Prix promo"
                              className="w-32 h-8 text-sm"
                              value={promoValues[pack.name] ?? ""}
                              onChange={e => setPromoValues(prev => ({ ...prev, [pack.name]: e.target.value }))}
                              data-testid={`input-promo-${pack.name}`}
                            />
                            <span className="text-xs text-muted-foreground">FCFA</span>
                          </div>
                        ) : (
                          hasPromo ? (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded-full border border-red-200 dark:border-red-800">
                                PROMO : {pack.promoFcfa} FCFA
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pas de promo</span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
                {!promoEditing && coinPacksData.some((p: any) => p.promoFcfa != null && p.promoFcfa > 0) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-3 text-muted-foreground hover:text-destructive"
                    disabled={clearPromoMutation.isPending}
                    onClick={() => clearPromoMutation.mutate()}
                    data-testid="button-clear-promos"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Supprimer toutes les promos
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground mt-3">
                  Laissez un champ vide pour désactiver la promo de ce pack. Les prix promo apparaissent immédiatement dans le Marché avec un badge rouge "PROMO".
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Achats de pièces en attente ({pendingCoinPurchases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCoinPurchases ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
                ) : pendingCoinPurchases.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Aucun achat en attente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingCoinPurchases.map((p: any) => (
                      <div key={p.id} className="border rounded-xl p-4 space-y-3" data-testid={`card-coin-purchase-${p.id}`}>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            {p.userAvatarUrl && <AvatarFallback className="text-sm font-bold">{p.userPseudo?.charAt(0)}</AvatarFallback>}
                            <AvatarFallback className="text-sm font-bold">{p.userPseudo?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{p.userPseudo}</p>
                            <p className="text-xs text-muted-foreground">@{p.userUsername}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-yellow-500">{p.coinsAmount} pièces</p>
                            <p className="text-xs text-muted-foreground">{p.priceFcfa} FCFA · {p.packName}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Demande du {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {p.proofUrl && (
                          <div className="rounded-lg overflow-hidden border max-h-48">
                            <img
                              src={p.proofUrl}
                              alt="Preuve de paiement"
                              className="w-full object-contain max-h-48"
                              data-testid={`img-coin-proof-${p.id}`}
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            disabled={rejectCoinMutation.isPending}
                            onClick={() => rejectCoinMutation.mutate(p.id)}
                            data-testid={`button-reject-coin-${p.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Rejeter
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            disabled={confirmCoinMutation.isPending}
                            onClick={() => confirmCoinMutation.mutate(p.id)}
                            data-testid={`button-confirm-coin-${p.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Valider (+{p.coinsAmount} pièces)
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREATE TOURNAMENT TAB */}
          <TabsContent value="create" className="mt-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Créer un tournoi</h2>
                  <p className="text-xs text-muted-foreground">Vous pouvez créer des tournois sponsorisés et des championnats élite</p>
                </div>
              </div>
              <Form {...ctForm}>
                <form onSubmit={ctForm.handleSubmit(d => createTournamentMutation.mutate(d))} className="space-y-4">
                  {/* Basic Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informations générales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={ctForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du tournoi</FormLabel>
                          <FormControl><Input placeholder="Super Ligue Elite 2025..." data-testid="admin-input-tournament-name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={ctForm.control} name="championshipType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger data-testid="admin-select-championship-type"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="league">Ligue</SelectItem>
                                <SelectItem value="pool">Poules</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={ctForm.control} name="gameType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plateforme</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger data-testid="admin-select-game-type"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="ps">PlayStation</SelectItem>
                                <SelectItem value="xbox">Xbox</SelectItem>
                                <SelectItem value="mobile">Mobile</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      {ctWatchType === "pool" && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={ctForm.control} name="numPools" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre de poules</FormLabel>
                              <FormControl><Input type="number" min={1} placeholder="2" data-testid="admin-input-num-pools" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={ctForm.control} name="playersPerPool" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Joueurs/poule</FormLabel>
                              <FormControl><Input type="number" min={2} placeholder="4" data-testid="admin-input-players-per-pool" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      )}
                      {ctWatchType === "league" && (
                        <FormField control={ctForm.control} name="playerLimit" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Limite de joueurs</FormLabel>
                            <FormControl><Input type="number" min={2} placeholder="8" data-testid="admin-input-player-limit" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                          </FormItem>
                        )} />
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={ctForm.control} name="visibility" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visibilité</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger data-testid="admin-select-visibility"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="public"><span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Public</span></SelectItem>
                                <SelectItem value="private"><span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Privé</span></SelectItem>
                              </SelectContent>
                            </Select>
                            {ctWatchVis === "private" && <p className="text-xs text-muted-foreground mt-1">Un code à 6 chiffres sera généré automatiquement</p>}
                          </FormItem>
                        )} />
                        <FormField control={ctForm.control} name="gameTime" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Temps de jeu (min)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger data-testid="admin-select-game-time"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                {[6,8,9,10,11,12,15].map(t => <SelectItem key={t} value={String(t)}>{t} min</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={ctForm.control} name="startDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Début</FormLabel>
                            <FormControl><Input type="datetime-local" data-testid="admin-input-start-date" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={ctForm.control} name="endDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Fin</FormLabel>
                            <FormControl><Input type="datetime-local" data-testid="admin-input-end-date" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <FormField control={ctForm.control} name="extraTime" render={({ field }) => (
                          <FormItem className="flex items-center gap-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="admin-switch-extra-time" /></FormControl><FormLabel className="cursor-pointer">Prolongations</FormLabel></FormItem>
                        )} />
                        <FormField control={ctForm.control} name="penalties" render={({ field }) => (
                          <FormItem className="flex items-center gap-3"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="admin-switch-penalties" /></FormControl><FormLabel className="cursor-pointer">Tirs au but</FormLabel></FormItem>
                        )} />
                      </div>
                      <FormField control={ctForm.control} name="otherRules" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Autres règles (optionnel)</FormLabel>
                          <FormControl><Textarea placeholder="Règles supplémentaires..." className="resize-none" data-testid="admin-input-other-rules" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  {/* SPONSORED */}
                  <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Tournoi sponsorisé
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={ctForm.control} name="isSponsored" render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="admin-switch-sponsored" /></FormControl>
                          <FormLabel className="cursor-pointer">Activer le sponsoring</FormLabel>
                        </FormItem>
                      )} />
                      {ctWatchSponsored && (
                        <div className="space-y-3">
                          <FormField control={ctForm.control} name="sponsorName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom du sponsor</FormLabel>
                              <FormControl><Input placeholder="ex: Nike, Adidas, MTN..." data-testid="admin-input-sponsor-name" {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <FormItem>
                            <FormLabel>Logo du sponsor (optionnel)</FormLabel>
                            <div
                              className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors"
                              onClick={() => sponsorLogoRef.current?.click()}
                              data-testid="admin-upload-sponsor-logo"
                            >
                              {sponsorLogoPreview ? (
                                <div className="relative inline-block">
                                  <img src={sponsorLogoPreview} alt="Logo sponsor" className="h-16 object-contain rounded mx-auto" />
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setSponsorLogoPreview(null); ctForm.setValue("sponsorLogo", ""); if (sponsorLogoRef.current) sponsorLogoRef.current.value = ""; }}
                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="text-muted-foreground space-y-1">
                                  <Upload className="w-6 h-6 mx-auto" />
                                  <p className="text-xs">Cliquez pour uploader le logo</p>
                                  <p className="text-[10px]">PNG, JPG — max 3 Mo</p>
                                </div>
                              )}
                            </div>
                            <input ref={sponsorLogoRef} type="file" accept="image/*" className="hidden" onChange={handleSponsorLogoChange} data-testid="admin-input-sponsor-logo-file" />
                          </FormItem>
                          <FormField control={ctForm.control} name="prizeInfo" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dotation / Prix à gagner</FormLabel>
                              <FormControl><Input placeholder="ex: 50 000 XAF, Maillot officiel..." data-testid="admin-input-prize-info" {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={ctForm.control} name="minStars" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                Niveau d'étoiles minimum requis
                              </FormLabel>
                              <Select onValueChange={v => field.onChange(parseInt(v))} value={String(field.value ?? 0)}>
                                <FormControl><SelectTrigger data-testid="admin-select-sponsored-min-stars"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="0">☆☆☆☆☆ — 0 étoile (ouvert à tous)</SelectItem>
                                  {[1,2,3,4,5].map(s => (
                                    <SelectItem key={s} value={String(s)}>
                                      {"★".repeat(s)}{"☆".repeat(5-s)} — {s} étoile{s > 1 ? "s" : ""} minimum
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-[11px] text-muted-foreground">0 = accès sans restriction d'étoiles</p>
                            </FormItem>
                          )} />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ELITE */}
                  <Card className="border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        Championnat Élite 5 étoiles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={ctForm.control} name="isElite" render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="admin-switch-elite" /></FormControl>
                          <FormLabel className="cursor-pointer">Réserver aux meilleurs joueurs</FormLabel>
                        </FormItem>
                      )} />
                      {ctWatchElite && (
                        <>
                          <FormField control={ctForm.control} name="minStars" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Niveau minimum requis</FormLabel>
                              <Select onValueChange={v => field.onChange(parseInt(v))} defaultValue={String(field.value ?? 1)}>
                                <FormControl><SelectTrigger data-testid="admin-select-min-stars"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {[1,2,3,4,5].map(s => (
                                    <SelectItem key={s} value={String(s)}>
                                      {"★".repeat(s)}{"☆".repeat(5-s)} — {s} étoile{s > 1 ? "s" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={ctForm.control} name="elitePrizeAmount" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                                Prix du vainqueur (XAF) — optionnel
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="ex: 25 000"
                                  data-testid="admin-input-elite-prize"
                                  value={field.value || ""}
                                  onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              {!!field.value && (field.value as number) > 0 && (
                                <div className="flex items-center gap-2 mt-1 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2">
                                  <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                                  <span className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold">
                                    🥇 Vainqueur : <strong>{(field.value as number).toLocaleString()} XAF</strong>
                                  </span>
                                </div>
                              )}
                            </FormItem>
                          )} />
                          <p className="text-xs text-muted-foreground">Les joueurs devront avoir ce niveau d'étoiles (basé sur leurs stats) pour rejoindre ce championnat.</p>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Cotisation section */}
                  <Card className="border-green-200 dark:border-green-800">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Banknote className="w-4 h-4" />
                        Tournoi à cotisation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <FormField control={ctForm.control} name="isPaid" render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="admin-switch-paid" /></FormControl>
                          <FormLabel className="cursor-pointer">Les joueurs doivent cotiser pour participer</FormLabel>
                        </FormItem>
                      )} />
                      {ctWatchPaid && (
                        <>
                          <FormField control={ctForm.control} name="entryFee" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Montant de la cotisation (XAF)</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" placeholder="ex: 5000" data-testid="admin-input-entry-fee"
                                  value={field.value ?? ""} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                              </FormControl>
                            </FormItem>
                          )} />
                          {ctWatchEntryFee > 0 && (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-1.5" data-testid="prize-preview">
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5" />
                                Répartition de la cagnotte (par joueur participant)
                              </p>
                              <p className="text-[11px] text-amber-600 dark:text-amber-500">Ex. avec 10 joueurs — {(ctWatchEntryFee * 10).toLocaleString()} XAF de cagnotte :</p>
                              <div className="space-y-1">
                                {[
                                  { emoji: "🥇", label: "Vainqueur", pct: 50, share: Math.floor(ctWatchEntryFee * 10 * 0.50), color: "text-amber-700 dark:text-amber-300 font-bold" },
                                  { emoji: "🥈", label: "Finaliste", pct: 20, share: Math.floor(ctWatchEntryFee * 10 * 0.20), color: "text-muted-foreground font-semibold" },
                                  { emoji: "🏛️", label: "Plateforme", pct: 30, share: Math.floor(ctWatchEntryFee * 10 * 0.30), color: "text-blue-600 dark:text-blue-400 font-semibold" },
                                ].map(row => (
                                  <div key={row.label} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-white/60 dark:bg-black/20">
                                    <span className="flex items-center gap-1.5">{row.emoji} <span className="text-muted-foreground">{row.label}</span></span>
                                    <span className={row.color}>{row.share.toLocaleString()} XAF <span className="font-normal opacity-60">({row.pct}%)</span></span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[10px] text-muted-foreground">⚠️ Les gains sont distribués uniquement si le tournoi compte plus de 5 participants.</p>
                            </div>
                          )}
                          <FormField control={ctForm.control} name="entryPaymentNumber" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Numéro de paiement (Mobile Money, Orange Money...)</FormLabel>
                              <FormControl>
                                <Input placeholder="ex: 6XX XXX XXX" data-testid="admin-input-payment-number" {...field} />
                              </FormControl>
                            </FormItem>
                          )} />
                          <p className="text-xs text-muted-foreground">Les joueurs devront uploader une capture de leur paiement. Vous verrez les preuves dans l'onglet <strong>Paiements</strong> pour confirmer ou rejeter.</p>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Button type="submit" className="w-full" disabled={createTournamentMutation.isPending} data-testid="admin-button-submit-tournament">
                    {createTournamentMutation.isPending ? "Création en cours..." : "Créer le tournoi"}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>

          {/* PAYMENTS TAB */}
          <TabsContent value="payments" className="mt-4">
            <PaymentsTab />
          </TabsContent>

          <TabsContent value="finances" className="mt-4">
            <div className="space-y-4" data-testid="tab-content-finances">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 dark:border-green-800 p-3 text-center">
                  <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-[10px] text-green-700 dark:text-green-400 font-medium">Total revenus</p>
                  <p className="text-lg font-black text-green-700 dark:text-green-300" data-testid="finance-total">{(finances?.totalRevenue ?? 0).toLocaleString()}</p>
                  <p className="text-[9px] text-green-600/70">FCFA</p>
                </div>
                <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 dark:border-amber-800 p-3 text-center">
                  <Coins className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Pièces validées</p>
                  <p className="text-lg font-black text-amber-700 dark:text-amber-300" data-testid="finance-coins">{(finances?.coinRevenue ?? 0).toLocaleString()}</p>
                  <p className="text-[9px] text-amber-600/70">FCFA</p>
                </div>
                <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 dark:border-blue-800 p-3 text-center">
                  <PiggyBank className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">Cotisations (30%)</p>
                  <p className="text-lg font-black text-blue-700 dark:text-blue-300" data-testid="finance-cotisation">{(finances?.cotisationRevenue ?? 0).toLocaleString()}</p>
                  <p className="text-[9px] text-blue-600/70">FCFA</p>
                </div>
              </div>

              {/* Distribution by tournament */}
              <div className="rounded-xl border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <Banknote className="w-4 h-4 text-muted-foreground" />
                  <p className="font-semibold text-sm">Distributions par tournoi</p>
                </div>
                {!finances?.distributions?.length ? (
                  <div className="text-center py-8">
                    <PiggyBank className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune distribution pour l'instant</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Utilisez le bouton "Distribuer" sur un tournoi à cotisation terminé.</p>
                  </div>
                ) : (() => {
                  const byTournament: Record<string, any[]> = {};
                  for (const d of finances.distributions) {
                    if (!byTournament[d.tournamentId]) byTournament[d.tournamentId] = [];
                    byTournament[d.tournamentId].push(d);
                  }
                  return (
                    <div className="divide-y">
                      {Object.entries(byTournament).map(([tid, dists]) => {
                        const platform = dists.find((d: any) => d.role === 'platform');
                        const winner = dists.find((d: any) => d.role === 'winner');
                        const runnerUp = dists.find((d: any) => d.role === 'runner_up');
                        return (
                          <div key={tid} className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{dists[0].tournamentName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {dists[0].participantCount} joueurs × {dists[0].entryFee?.toLocaleString()} FCFA = <span className="font-bold text-foreground">{dists[0].totalPool?.toLocaleString()} FCFA</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                                  +{platform?.amountFcfa?.toLocaleString() ?? 0} FCFA
                                </Badge>
                                <button
                                  onClick={() => { if (window.confirm("Recalculer et redistribuer les gains pour ce tournoi ?")) distributeMutation.mutate(tid); }}
                                  disabled={distributeMutation.isPending}
                                  className="text-[10px] px-2 py-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 transition-colors disabled:opacity-50"
                                  data-testid={`button-redistribute-${tid}`}
                                >
                                  Redistribuer
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg px-2 py-1.5">
                                <p className="text-base">🥇</p>
                                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 truncate">{winner?.pseudo ?? "—"}</p>
                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{winner?.amountFcfa?.toLocaleString() ?? 0} F</p>
                              </div>
                              <div className="bg-gray-100 dark:bg-gray-800/30 rounded-lg px-2 py-1.5">
                                <p className="text-base">🥈</p>
                                <p className="text-[10px] font-semibold text-muted-foreground truncate">{runnerUp?.pseudo ?? "—"}</p>
                                <p className="text-[10px] font-bold text-muted-foreground">{runnerUp?.amountFcfa?.toLocaleString() ?? 0} F</p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg px-2 py-1.5">
                                <p className="text-base">🏛️</p>
                                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">eLIGA</p>
                                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">{platform?.amountFcfa?.toLocaleString() ?? 0} F</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Paid tournaments without distribution yet */}
              {(() => {
                const distributedIds = new Set((finances?.distributions ?? []).map((d: any) => d.tournamentId));
                const paidTournaments = (allTournaments ?? []).filter((t: any) => t.isPaid && !distributedIds.has(t.id));
                if (!paidTournaments.length) return null;
                return (
                  <div className="rounded-xl border bg-card">
                    <div className="flex items-center gap-2 px-4 py-3 border-b">
                      <Banknote className="w-4 h-4 text-amber-500" />
                      <p className="font-semibold text-sm">Tournois à cotisation sans distribution</p>
                    </div>
                    <div className="divide-y">
                      {paidTournaments.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.entryFee?.toLocaleString()} FCFA · {t.status === "finished" ? "Terminé" : t.status === "in_progress" ? "En cours" : "En attente"}</p>
                          </div>
                          <button
                            onClick={() => { if (window.confirm(`Calculer et distribuer les gains pour "${t.name}" ?`)) distributeMutation.mutate(t.id); }}
                            disabled={distributeMutation.isPending}
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                            data-testid={`button-distribute-${t.id}`}
                          >
                            Distribuer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Info box */}
              <div className="flex items-start gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2.5">
                <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Répartition : <strong>50% Vainqueur</strong> · <strong>30% Finaliste</strong> · <strong>20% Plateforme (eLIGA)</strong>. Distribution manuelle possible à tout moment.
                </p>
              </div>
            </div>
          </TabsContent>
          {/* LITIGES TAB */}
          <TabsContent value="disputes" className="mt-4">
            <DisputesTab />
          </TabsContent>

          {/* CLIPS TAB */}
          <TabsContent value="clips" className="mt-4">
            <AdminClipsTab />
          </TabsContent>

        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la suppression
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous êtes sur le point de supprimer <span className="font-semibold text-foreground">"{deleteConfirm?.name}"</span>.
              Cette action est irréversible.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={deleteUserMutation.isPending || deleteTournamentMutation.isPending}
                onClick={() => {
                  if (!deleteConfirm) return;
                  if (deleteConfirm.type === "user") deleteUserMutation.mutate(deleteConfirm.id);
                  else deleteTournamentMutation.mutate(deleteConfirm.id);
                }}
                data-testid="button-confirm-delete"
              >
                Supprimer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

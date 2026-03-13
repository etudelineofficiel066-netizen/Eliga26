import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Trophy, Gamepad2, Lock, Globe, Settings, CalendarDays, Star, Sparkles, Copy, Check, ArrowRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const schema = z.object({
  name: z.string().min(3, "Au moins 3 caractères"),
  championshipType: z.enum(["pool", "league"]),
  playersPerPool: z.number().min(2).optional(),
  numPools: z.number().min(1).optional(),
  playerLimit: z.number().min(2).optional(),
  visibility: z.enum(["public", "private"]),
  gameType: z.enum(["ps", "xbox", "mobile"]),
  gameTime: z.string().min(1, "Temps requis"),
  gameForm: z.string().min(1, "Forme requise"),
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
  minStars: z.number().min(1).max(5).optional(),
});

type FormData = z.infer<typeof schema>;

export default function CreateTournament() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [createdPrivate, setCreatedPrivate] = useState<{ code: string; id: string; name: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", championshipType: "league", visibility: "public",
      gameType: "ps", gameTime: "10", gameForm: "excellent",
      extraTime: false, penalties: true, otherRules: "",
      isSponsored: false, sponsorName: "", sponsorLogo: "", prizeInfo: "",
      isElite: false, minStars: 1,
    }
  });

  const watchSponsored = form.watch("isSponsored");
  const watchElite = form.watch("isElite");

  const watchType = form.watch("championshipType");
  const watchVisibility = form.watch("visibility");

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/tournaments", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/mine"] });
      if (data.code) {
        setCreatedPrivate({ code: data.code, id: data.id, name: data.name });
      } else {
        toast({ title: "Tournoi créé !", description: "Votre tournoi est public" });
        navigate(`/tournaments/${data.id}`);
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Créer un tournoi</h1>
          <p className="text-sm text-muted-foreground">Configurez votre compétition eFootball</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du tournoi</FormLabel>
                  <FormControl>
                    <Input placeholder="Super Ligue Elite 2025..." data-testid="input-tournament-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="championshipType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de championnat</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-championship-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="league">Ligue (Championnat direct)</SelectItem>
                        <SelectItem value="pool">Poules (Groupes + Phase finale)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {watchType === "league" 
                        ? "Tout le monde s'affronte. Le 1er au classement gagne." 
                        : "Chaque membre du groupe affronte tous les autres membres de son groupe. Les 2 meilleurs se qualifient pour la phase finale (Huitièmes, Quarts, Demis ou Finale selon les qualifiés)."}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="gameType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plateforme</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-game-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ps">PlayStation</SelectItem>
                        <SelectItem value="xbox">Xbox</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchType === "pool" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="numPools" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de poules</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="2" data-testid="input-num-pools"
                          {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">
                        2 poules : Qualifie les 2 meilleurs de chaque groupe pour des Demi-finales croisées.<br/>
                        4 poules : Qualifie les 2 meilleurs pour des Quarts de finale croisés.<br/>
                        8 poules : Qualifie les 2 meilleurs pour des Huitièmes de finale croisés.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="playersPerPool" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joueurs par poule</FormLabel>
                      <FormControl>
                        <Input type="number" min={3} placeholder="4" data-testid="input-players-per-pool"
                          {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">
                        Tous les membres d'une poule s'affrontent entre eux. Si vous mettez 2 joueurs par poule, seul le 1er sera qualifié pour la phase suivante.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {watchType === "league" && (
                <FormField control={form.control} name="playerLimit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre limite de joueurs</FormLabel>
                    <FormControl>
                      <Input type="number" min={2} placeholder="8" data-testid="input-player-limit"
                        {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Visibilité</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="visibility" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: "public", icon: Globe, label: "Public", desc: "Visible par tous" },
                      { val: "private", icon: Lock, label: "Privé", desc: "Code requis" },
                    ].map(({ val, icon: Icon, label, desc }) => (
                      <div
                        key={val}
                        onClick={() => field.onChange(val)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${field.value === val ? "border-primary bg-primary/5" : "border-border"}`}
                        data-testid={`visibility-${val}`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${field.value === val ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                  {watchVisibility === "private" && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      Un code à 6 chiffres sera généré automatiquement
                    </p>
                  )}
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Calendrier */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <CalendarDays className="w-4 h-4 inline mr-1" />
                Calendrier (optionnel)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" data-testid="input-start-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de fin</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" data-testid="input-end-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Game Rules */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <Settings className="w-4 h-4 inline mr-1" />
                Règles de jeu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gameTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temps de jeu (min)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-game-time">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[6, 8, 9, 10, 11, 12, 15].map(t => <SelectItem key={t} value={String(t)}>{t} minutes</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="gameForm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition de forme</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-game-form">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="any">Peu importe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="extraTime" render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-extra-time" />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Prolongations</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="penalties" render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-penalties" />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Tirs au but</FormLabel>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="otherRules" render={({ field }) => (
                <FormItem>
                  <FormLabel>Autres règles (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Précisez d'autres règles si nécessaire..." className="resize-none" data-testid="input-other-rules" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Admin-only: Sponsored & Elite */}
          {user?.isAdmin && (
            <>
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Tournoi sponsorisé (Admin)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="isSponsored" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="switch-sponsored" />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Activer le sponsoring</FormLabel>
                    </FormItem>
                  )} />
                  {watchSponsored && (
                    <div className="space-y-3">
                      <FormField control={form.control} name="sponsorName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du sponsor</FormLabel>
                          <FormControl>
                            <Input placeholder="ex: Nike, Adidas..." data-testid="input-sponsor-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="sponsorLogo" render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL du logo sponsor (optionnel)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." data-testid="input-sponsor-logo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="prizeInfo" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dotation / Prix à gagner</FormLabel>
                          <FormControl>
                            <Input placeholder="ex: 50 000 XAF, Maillot officiel..." data-testid="input-prize-info" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    Championnat élite (Admin)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="isElite" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} data-testid="switch-elite" />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Réserver aux meilleurs joueurs</FormLabel>
                    </FormItem>
                  )} />
                  {watchElite && (
                    <FormField control={form.control} name="minStars" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niveau minimum requis (étoiles)</FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} defaultValue={String(field.value ?? 1)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-min-stars">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1,2,3,4,5].map(s => (
                              <SelectItem key={s} value={String(s)}>
                                {"★".repeat(s)}{"☆".repeat(5-s)} — {s} étoile{s > 1 ? "s" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  {watchElite && (
                    <p className="text-xs text-muted-foreground">
                      Les joueurs devront justifier de ce niveau via leurs statistiques pour rejoindre ce championnat.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-tournament">
            {mutation.isPending ? "Création en cours..." : "Créer le tournoi"}
          </Button>
        </form>
      </Form>

      {/* Modal code privé + QR */}
      <Dialog open={!!createdPrivate} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
              Tournoi privé créé !
            </DialogTitle>
          </DialogHeader>

          {createdPrivate && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                Partagez ce code ou ce QR avec les joueurs invités
              </p>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl border-2 border-border shadow-sm">
                  <QRCodeSVG
                    value={createdPrivate.code}
                    size={180}
                    level="M"
                    data-testid="img-tournament-qr"
                  />
                </div>
              </div>

              {/* Code 6 chiffres */}
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Code d'accès</p>
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="font-mono text-4xl font-extrabold tracking-[0.25em] text-primary"
                    data-testid="text-private-code"
                  >
                    {createdPrivate.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(createdPrivate.code)}
                    className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                    data-testid="button-copy-code"
                    title="Copier le code"
                  >
                    {codeCopied
                      ? <Check className="w-4 h-4 text-green-600" />
                      : <Copy className="w-4 h-4 text-primary" />
                    }
                  </button>
                </div>
                {codeCopied && (
                  <p className="text-xs text-green-600 font-medium">✓ Code copié !</p>
                )}
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => { setCreatedPrivate(null); navigate(`/tournaments/${createdPrivate.id}`); }}
                data-testid="button-go-to-tournament"
              >
                Aller au tournoi
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

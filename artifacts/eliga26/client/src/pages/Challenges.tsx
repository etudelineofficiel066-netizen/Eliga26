import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Swords, Plus, Check, X, Clock, Trophy, Coins, Camera, Users, Globe, Lock, Trash2 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  accepted: "Accepté",
  refused: "Refusé",
  rescheduled: "Reprogrammé",
  completed: "Terminé",
};

const LEVEL_NAMES = ["Débutant", "Participant", "Amateur", "Compétiteur", "Pro", "Élite"];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  refused: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rescheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400",
};

function ChallengeForm({ opponentId, opponentPseudo, onClose }: {
  opponentId?: string; opponentPseudo?: string; onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);

  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [message, setMessage] = useState("");
  const [coinBet, setCoinBet] = useState("");
  const [teamPhotoUrl, setTeamPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFriendly, setIsFriendly] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 800;
        let w = img.width, h = img.height;
        if (w > max) { h = (h * max) / w; w = max; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.75);
        setTeamPhotoUrl(compressed);
        setPhotoPreview(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/challenges", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/open"] });
      toast({ title: "Défi lancé !", description: opponentId ? "Votre adversaire a été notifié." : "Votre défi est visible dans la recherche." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleTime = (v: string) => {
    let val = v.replace(/[^0-9]/g, "");
    if (val.length >= 3) val = val.slice(0, 2) + ":" + val.slice(2, 4);
    setProposedTime(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedDate || !proposedTime) return;
    createMutation.mutate({
      opponentId: opponentId || null,
      proposedDate, proposedTime,
      message: message || null,
      coinBet: isFriendly ? 0 : (parseInt(coinBet) || 0),
      teamPhotoUrl,
      isPrivate,
      isFriendly,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {opponentPseudo && (
        <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2">
          <Swords className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Défi contre <strong>{opponentPseudo}</strong></span>
        </div>
      )}
      <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isPrivate ? "bg-gray-100 dark:bg-gray-800/50" : "bg-green-50 dark:bg-green-900/20"}`} data-testid="toggle-visibility">
        <div className="flex items-center gap-2">
          {isPrivate ? <Lock className="w-4 h-4 text-gray-500" /> : <Globe className="w-4 h-4 text-green-600" />}
          <div>
            <p className="text-xs font-semibold">{isPrivate ? "Défi privé" : "Défi public"}</p>
            <p className="text-[10px] text-muted-foreground">
              {isPrivate
                ? opponentId ? "Visible uniquement par vous et l'adversaire" : "Visible uniquement par vous"
                : "Visible par tous les joueurs eLIGA"}
            </p>
          </div>
        </div>
        <Switch
          checked={isPrivate}
          onCheckedChange={setIsPrivate}
          data-testid="switch-private"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date du match *</Label>
          <Input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)} required data-testid="input-challenge-date" />
        </div>
        <div className="space-y-1.5">
          <Label>Heure (HH:MM) *</Label>
          <Input
            placeholder="ex: 20:30"
            value={proposedTime}
            onChange={e => handleTime(e.target.value)}
            maxLength={5}
            required
            data-testid="input-challenge-time"
          />
        </div>
      </div>
      {/* Type de défi : Amicale ou Avec pièces */}
      <div className="space-y-1.5">
        <Label>Type de défi</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsFriendly(true)}
            data-testid="button-type-friendly"
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 transition-colors ${isFriendly ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-border bg-muted/30 hover:border-primary/40"}`}
          >
            <span className="text-lg">🤝</span>
            <span className="text-xs font-semibold">Amicale</span>
            <span className="text-[10px] text-muted-foreground text-center">Gagnant +1.5 🪙</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFriendly(false)}
            data-testid="button-type-bet"
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 transition-colors ${!isFriendly ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-border bg-muted/30 hover:border-primary/40"}`}
          >
            <span className="text-lg">🪙</span>
            <span className="text-xs font-semibold">Avec pièces</span>
            <span className="text-[10px] text-muted-foreground text-center">Mise des deux joueurs</span>
          </button>
        </div>
      </div>

      {!isFriendly && (
        <div className="space-y-1.5">
          <Label>Mise en pièces</Label>
          <div className="relative">
            <Coins className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
            <Input
              type="number" min="0" max="50" placeholder="0"
              value={coinBet}
              onChange={e => {
                const v = parseInt(e.target.value) || 0;
                setCoinBet(v > 50 ? "50" : e.target.value);
              }}
              className="pl-9"
              data-testid="input-challenge-bet"
            />
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Coins className="w-3 h-3 text-amber-500 flex-shrink-0" />
            Max 50 pièces · Les deux joueurs misent le même montant · 0 = sans enjeu
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Message (optionnel)</Label>
        <Textarea
          placeholder="Un message pour votre adversaire..."
          value={message} onChange={e => setMessage(e.target.value)}
          rows={2}
          data-testid="input-challenge-message"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Photo de votre équipe (optionnel)</Label>
        <div
          className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => photoRef.current?.click()}
          data-testid="button-upload-team-photo"
        >
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Équipe" className="max-h-40 object-contain rounded-lg mx-auto" />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setTeamPhotoUrl(null); setPhotoPreview(null); if (photoRef.current) photoRef.current.value = ""; }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="space-y-1 text-muted-foreground">
              <Camera className="w-6 h-6 mx-auto" />
              <p className="text-xs">Capture d'écran de votre équipe</p>
              <p className="text-[10px]">JPG, PNG — max 5 Mo</p>
            </div>
          )}
        </div>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button type="submit" className="flex-1" disabled={createMutation.isPending || !proposedDate || !proposedTime} data-testid="button-submit-challenge">
          {createMutation.isPending ? "Envoi..." : "⚔️ Lancer le défi"}
        </Button>
      </div>
    </form>
  );
}

function CounterForm({ challengeId, onClose }: { challengeId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [counterDate, setCounterDate] = useState("");
  const [counterTime, setCounterTime] = useState("");

  const counterMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/challenges/${challengeId}/counter`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] });
      toast({ title: "Proposition envoyée", description: "L'adversaire a été notifié de votre contre-proposition." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleTime = (v: string) => {
    let val = v.replace(/[^0-9]/g, "");
    if (val.length >= 3) val = val.slice(0, 2) + ":" + val.slice(2, 4);
    setCounterTime(val);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nouvelle date</Label>
          <Input type="date" value={counterDate} onChange={e => setCounterDate(e.target.value)} data-testid="input-counter-date" />
        </div>
        <div className="space-y-1.5">
          <Label>Nouvelle heure</Label>
          <Input placeholder="HH:MM" value={counterTime} onChange={e => handleTime(e.target.value)} maxLength={5} data-testid="input-counter-time" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button
          className="flex-1"
          disabled={!counterDate || !counterTime || counterMutation.isPending}
          onClick={() => counterMutation.mutate({ counterDate, counterTime })}
          data-testid="button-submit-counter"
        >
          Proposer
        </Button>
      </div>
    </div>
  );
}

function ChallengeCard({ challenge, myId }: { challenge: any; myId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCounter, setShowCounter] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const isChallenger = challenge.challengerId === myId;
  const isOpponent = challenge.opponentId === myId;
  const canRespond = !isChallenger && (challenge.status === "pending" || challenge.status === "rescheduled");

  // Stats du challenger
  const cPlayed = challenge.challengerPlayed ?? 0;
  const cWins = challenge.challengerWins ?? 0;
  const cLosses = Math.max(0, cPlayed - cWins);
  const cWinRate = cPlayed > 0 ? cWins / cPlayed : 0;
  const cBonusStars = challenge.challengerBonusStars ?? 0;
  const TIERS_CC = [
    { stars: 1, matches: 5,   winRate: 0 },
    { stars: 2, matches: 20,  winRate: 0.35 },
    { stars: 3, matches: 50,  winRate: 0.50 },
    { stars: 4, matches: 100, winRate: 0.65 },
    { stars: 5, matches: 200, winRate: 0.75 },
  ];
  let cPerfStars = 0;
  for (const tier of TIERS_CC) {
    if (cPlayed >= tier.matches && cWinRate >= tier.winRate) cPerfStars = tier.stars;
  }
  const cStars = Math.min(cPerfStars + cBonusStars, 5);
  const cLevel = LEVEL_NAMES[cStars] ?? "Débutant";
  const cWinRatePct = cPlayed > 0 ? Math.round(cWinRate * 100) : 0;

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/accept`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] }); toast({ title: "Défi accepté !" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const refuseMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/refuse`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] }); toast({ title: "Défi refusé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/complete`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] }); toast({ title: "Défi marqué comme terminé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/challenges/${challenge.id}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] }); toast({ title: "Défi supprimé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const canDelete = ["completed", "refused", "pending", "cancelled"].includes(challenge.status)
    && parseInt(challenge.coinsEscrowed ?? 0) === 0;

  const dateLabel = challenge.status === "rescheduled" && challenge.counterDate
    ? `${challenge.counterDate} à ${challenge.counterTime}`
    : `${challenge.proposedDate} à ${challenge.proposedTime}`;

  return (
    <div className="border rounded-xl bg-card p-4 space-y-3" data-testid={`card-challenge-${challenge.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-9 h-9 flex-shrink-0">
            {(isChallenger ? challenge.opponentAvatar : challenge.challengerAvatar) && (
              <AvatarImage src={isChallenger ? challenge.opponentAvatar : challenge.challengerAvatar} className="object-cover" />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {(isChallenger ? (challenge.opponentPseudo ?? "?") : challenge.challengerPseudo ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {isChallenger
                ? (challenge.opponentPseudo ? `vs ${challenge.opponentPseudo}` : "Défi ouvert")
                : `⚔️ ${challenge.challengerPseudo}`}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {dateLabel}
              {challenge.status === "rescheduled" && <span className="text-blue-500 ml-1">(reprogrammé)</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            {challenge.isFriendly && (
              <span className="text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full px-2 py-0.5">🤝 Amical</span>
            )}
            <Badge className={`flex-shrink-0 text-[10px] ${STATUS_COLOR[challenge.status] ?? ""}`}>
              {STATUS_LABEL[challenge.status] ?? challenge.status}
            </Badge>
            {canDelete && (
              <button
                onClick={() => { if (window.confirm("Supprimer ce défi ?")) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                data-testid={`button-delete-challenge-${challenge.id}`}
                title="Supprimer ce défi"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className={`text-[9px] flex items-center gap-0.5 font-medium ${challenge.isPrivate ? "text-gray-400" : "text-green-600 dark:text-green-400"}`}>
            {challenge.isPrivate ? <><Lock className="w-2.5 h-2.5" /> Privé</> : <><Globe className="w-2.5 h-2.5" /> Public</>}
          </span>
        </div>
      </div>

      {/* Stats du challenger */}
      <div className="flex items-center gap-2 flex-wrap py-1 border-t border-b border-border/40">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold w-full">Stats du créateur</p>
        <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5"
              data-testid={`text-level-cc-${challenge.id}`}>
          {cLevel}
        </span>
        <span className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-[11px] ${i < cStars ? "text-amber-400" : "text-muted-foreground/30"}`}>★</span>
          ))}
        </span>
        <span className="text-[10px] text-muted-foreground" data-testid={`text-record-cc-${challenge.id}`}>
          <span className="text-green-600 font-semibold">{cWins}V</span>
          {" · "}
          <span className="text-red-500 font-semibold">{cLosses}D</span>
          {" · "}
          <span className="font-medium">{cWinRatePct}%</span>
        </span>
      </div>

      {challenge.message && (
        <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-2">
          "{challenge.message}"
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {challenge.coinBet > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Coins className="w-3.5 h-3.5" />
            Mise : {challenge.coinBet} pièces
          </span>
        )}
        {challenge.teamPhotoUrl && (
          <button
            className="text-xs text-primary underline flex items-center gap-1"
            onClick={() => setPhotoOpen(true)}
            data-testid={`button-view-photo-${challenge.id}`}
          >
            <Camera className="w-3 h-3" /> Voir l'équipe
          </button>
        )}
      </div>

      {photoOpen && challenge.teamPhotoUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhotoOpen(false)}>
          <div className="relative max-w-lg w-full">
            <img src={challenge.teamPhotoUrl} alt="Équipe" className="rounded-xl w-full object-contain max-h-[80vh]" />
            <button className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white" onClick={() => setPhotoOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {canRespond && !showCounter && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => refuseMutation.mutate()} disabled={refuseMutation.isPending} data-testid={`button-refuse-${challenge.id}`}>
            <X className="w-3.5 h-3.5 mr-1" /> Refuser
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setShowCounter(true)} data-testid={`button-counter-${challenge.id}`}>
            <Clock className="w-3.5 h-3.5 mr-1" /> Autre heure
          </Button>
          <Button size="sm" className="flex-1" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending} data-testid={`button-accept-${challenge.id}`}>
            <Check className="w-3.5 h-3.5 mr-1" /> Accepter
          </Button>
        </div>
      )}

      {canRespond && showCounter && (
        <CounterForm challengeId={challenge.id} onClose={() => setShowCounter(false)} />
      )}

      {challenge.status === "accepted" && (isChallenger || isOpponent) && (
        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} data-testid={`button-complete-${challenge.id}`}>
          <Trophy className="w-3.5 h-3.5 mr-1.5" /> Marquer comme terminé
        </Button>
      )}
    </div>
  );
}

function OpenChallengeCard({ challenge, myId }: { challenge: any; myId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photoOpen, setPhotoOpen] = useState(false);

  const isDirected = !!challenge.opponentId;
  const isDesignatedOpponent = challenge.opponentId === myId;
  const canAccept = !isDirected || isDesignatedOpponent;

  // Calcul niveau + étoiles du challenger
  const cPlayed = challenge.challengerPlayed ?? 0;
  const cWins = challenge.challengerWins ?? 0;
  const cLosses = challenge.challengerLosses ?? 0;
  const cBonusStars = challenge.challengerBonusStars ?? 0;
  const cWinRate = cPlayed > 0 ? cWins / cPlayed : 0;
  const TIERS = [
    { stars: 1, matches: 5,   winRate: 0 },
    { stars: 2, matches: 20,  winRate: 0.35 },
    { stars: 3, matches: 50,  winRate: 0.50 },
    { stars: 4, matches: 100, winRate: 0.65 },
    { stars: 5, matches: 200, winRate: 0.75 },
  ];
  let cPerfStars = 0;
  for (const tier of TIERS) {
    if (cPlayed >= tier.matches && cWinRate >= tier.winRate) cPerfStars = tier.stars;
  }
  const cStars = Math.min(cPerfStars + cBonusStars, 5);
  const cLevel = LEVEL_NAMES[cStars] ?? "Débutant";
  const cWinRatePct = cPlayed > 0 ? Math.round(cWinRate * 100) : 0;

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/accept`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/open"] });
      toast({ title: "Défi accepté !", description: "Le challenger a été notifié." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (challenge.challengerId === myId) return null;

  return (
    <div className="border rounded-xl bg-card p-4 space-y-3" data-testid={`card-open-challenge-${challenge.id}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-12 h-12 flex-shrink-0">
            {challenge.challengerAvatar && <AvatarImage src={challenge.challengerAvatar} className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {(challenge.challengerPseudo ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1">
              <Swords className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              {challenge.challengerPseudo}
              {isDirected && (
                <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium ml-1">
                  → {challenge.opponentPseudo ?? "joueur ciblé"}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {challenge.proposedDate} à {challenge.proposedTime}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {challenge.isFriendly ? (
            <span className="text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full px-2 py-0.5">🤝 Amical</span>
          ) : challenge.coinBet > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
              <Coins className="w-3 h-3" /> {challenge.coinBet} pièces
            </span>
          ) : null}
          <span className={`text-[9px] flex items-center gap-0.5 font-medium ${challenge.isPrivate ? "text-gray-400" : "text-green-600 dark:text-green-400"}`}>
            {challenge.isPrivate ? <><Lock className="w-2.5 h-2.5" /> Privé</> : <><Globe className="w-2.5 h-2.5" /> Public</>}
          </span>
        </div>
      </div>

      {/* Stats du challenger */}
      <div className="flex items-center gap-2 flex-wrap py-1 border-t border-b border-border/40">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold w-full">Stats du créateur</p>
        <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5"
              data-testid={`text-level-${challenge.id}`}>
          {cLevel}
        </span>
        <span className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-[11px] ${i < cStars ? "text-amber-400" : "text-muted-foreground/30"}`}>★</span>
          ))}
        </span>
        <span className="text-[10px] text-muted-foreground" data-testid={`text-record-${challenge.id}`}>
          <span className="text-green-600 font-semibold">{cWins}V</span>
          {" · "}
          <span className="text-red-500 font-semibold">{cLosses}D</span>
          {" · "}
          <span className="font-medium">{cWinRatePct}%</span>
        </span>
      </div>

      {challenge.message && (
        <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-2">"{challenge.message}"</p>
      )}

      {/* Mise + équipe sur la même ligne */}
      {(challenge.coinBet > 0 || challenge.teamPhotoUrl) && !challenge.isFriendly && (
        <div className="flex items-center gap-3 flex-wrap">
          {challenge.coinBet > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              Mise : {challenge.coinBet} pièces
            </span>
          )}
          {challenge.teamPhotoUrl && (
            <button
              className="text-xs text-primary underline flex items-center gap-1"
              onClick={() => setPhotoOpen(true)}
              data-testid={`button-open-photo-${challenge.id}`}
            >
              <Camera className="w-3 h-3" /> Voir l'équipe
            </button>
          )}
        </div>
      )}
      {challenge.isFriendly && challenge.teamPhotoUrl && (
        <button
          className="text-xs text-primary underline flex items-center gap-1"
          onClick={() => setPhotoOpen(true)}
          data-testid={`button-open-photo-friendly-${challenge.id}`}
        >
          <Camera className="w-3 h-3" /> Voir l'équipe
        </button>
      )}

      {photoOpen && challenge.teamPhotoUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhotoOpen(false)}>
          <img src={challenge.teamPhotoUrl} alt="Équipe" className="rounded-xl max-w-lg w-full object-contain max-h-[80vh]" />
        </div>
      )}
      {canAccept ? (
        <Button className="w-full" size="sm" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending} data-testid={`button-accept-open-${challenge.id}`}>
          <Swords className="w-4 h-4 mr-2" /> {acceptMutation.isPending ? "..." : isDesignatedOpponent ? "Accepter ce défi" : "Relever le défi"}
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg py-2">
          <Lock className="w-3 h-3" />
          Défi réservé à <strong className="ml-0.5">{challenge.opponentPseudo}</strong>
        </div>
      )}
    </div>
  );
}

export default function Challenges() {
  const { user } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const preOpponentId = urlParams.get("challenge");
  const preOpponentPseudo = urlParams.get("pseudo");

  const [createOpen, setCreateOpen] = useState(!!preOpponentId);

  const { data: myChallenges = [], isLoading: loadingMine } = useQuery<any[]>({
    queryKey: ["/api/challenges/me"],
    refetchInterval: 15000,
  });

  const { data: openChallenges = [], isLoading: loadingOpen } = useQuery<any[]>({
    queryKey: ["/api/challenges/open"],
    refetchInterval: 15000,
  });

  const sent = myChallenges.filter(c => c.challengerId === user?.id);
  const received = myChallenges.filter(c => c.opponentId === user?.id);
  const pendingReceived = received.filter(c => c.status === "pending" || c.status === "rescheduled").length;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" /> Défis
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Défiez d'autres joueurs hors tournoi</p>
        </div>
        <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open && preOpponentId) { window.history.replaceState({}, "", "/challenges"); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-1.5" data-testid="button-create-challenge">
              <Plus className="w-4 h-4" /> Créer un défi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-primary" /> Nouveau défi
              </DialogTitle>
            </DialogHeader>
            <ChallengeForm
              opponentId={preOpponentId ?? undefined}
              opponentPseudo={preOpponentPseudo ?? undefined}
              onClose={() => { setCreateOpen(false); if (preOpponentId) window.history.replaceState({}, "", "/challenges"); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue={pendingReceived > 0 ? "received" : "open"}>
        <TabsList className="w-full">
          <TabsTrigger value="received" className="flex-1 text-xs" data-testid="tab-received">
            Reçus
            {pendingReceived > 0 && (
              <span className="ml-1.5 min-w-[18px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {pendingReceived}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1 text-xs" data-testid="tab-sent">Envoyés</TabsTrigger>
          <TabsTrigger value="open" className="flex-1 text-xs" data-testid="tab-open">
            Ouverts
            {openChallenges.length > 0 && (
              <span className="ml-1.5 min-w-[18px] h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {openChallenges.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-3 mt-3">
          {loadingMine ? (
            [1,2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : received.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Swords className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun défi reçu</p>
            </div>
          ) : received.map(c => <ChallengeCard key={c.id} challenge={c} myId={user!.id} />)}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3 mt-3">
          {loadingMine ? (
            [1,2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : sent.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Swords className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Vous n'avez envoyé aucun défi</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Créer votre premier défi
              </Button>
            </div>
          ) : sent.map(c => <ChallengeCard key={c.id} challenge={c} myId={user!.id} />)}
        </TabsContent>

        <TabsContent value="open" className="space-y-3 mt-3">
          {loadingOpen ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)
          ) : openChallenges.filter((c: any) => c.challengerId !== user?.id).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Swords className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun défi public pour l'instant</p>
              <p className="text-xs mt-1">Créez un défi public pour qu'il soit visible par tous !</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Créer un défi ouvert
              </Button>
            </div>
          ) : openChallenges.map((c: any) => <OpenChallengeCard key={c.id} challenge={c} myId={user!.id} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

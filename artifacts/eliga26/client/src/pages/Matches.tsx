import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Swords, Trophy, Clock, CalendarClock, CalendarDays, ChevronRight,
  MessageSquare, CheckCircle, CheckCircle2, X, Pencil, Send, Loader2, Camera,
  Sword, Coins, Globe, Lock, Phone
} from "lucide-react";
import { Link, useLocation } from "wouter";

function ChallengeMatchCard({ challenge, myId }: { challenge: any; myId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreMe, setScoreMe] = useState("");
  const [scoreOpp, setScoreOpp] = useState("");
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { toast({ title: "Fichier trop grand", description: "Maximum 30 Mo", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.80);
          setProofBase64(compressed); setProofPreview(compressed);
        } catch { setProofBase64(dataUrl); setProofPreview(dataUrl); }
      };
      img.onerror = () => { setProofBase64(dataUrl); setProofPreview(dataUrl); };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const resetProof = () => { setProofBase64(null); setProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ""; };

  const isChallenger = challenge.challengerId === myId;
  const opponentPseudo = isChallenger ? challenge.opponentPseudo : challenge.challengerPseudo;
  const opponentAvatar = isChallenger ? challenge.opponentAvatar : challenge.challengerAvatar;
  const myPhone = isChallenger ? challenge.challengerPhone : challenge.opponentPhone;
  const opponentPhone = isChallenger ? challenge.opponentPhone : challenge.challengerPhone;
  const opponentId = isChallenger ? challenge.opponentId : challenge.challengerId;
  const hasBet = parseInt(challenge.coinBet) > 0;

  // Compte à rebours auto-confirmation (24h)
  const AUTO_CONFIRM_MS = 24 * 60 * 60 * 1000;
  const submittedAt = challenge.scoreSubmittedAt ? new Date(challenge.scoreSubmittedAt).getTime() : null;
  const autoConfirmAt = submittedAt ? submittedAt + AUTO_CONFIRM_MS : null;
  const msRemaining = autoConfirmAt ? Math.max(0, autoConfirmAt - Date.now()) : null;
  const hoursLeft = msRemaining !== null ? Math.floor(msRemaining / 3600000) : null;
  const minutesLeft = msRemaining !== null ? Math.floor((msRemaining % 3600000) / 60000) : null;
  const autoConfirmLabel = msRemaining !== null
    ? msRemaining === 0 ? "Auto-confirmation imminente…"
    : hoursLeft! > 0 ? `Auto-confirmation dans ${hoursLeft}h${minutesLeft}min`
    : `Auto-confirmation dans ${minutesLeft} min`
    : null;

  // Calcul niveau + étoiles du créateur du défi
  const cPlayed = challenge.challengerPlayed ?? 0;
  const cWins = challenge.challengerWins ?? 0;
  const cLosses = challenge.challengerLosses ?? 0;
  const cBonusStars = challenge.challengerBonusStars ?? 0;
  const cWinRate = cPlayed > 0 ? cWins / cPlayed : 0;
  const TIERS = [
    { stars: 1, matches: 5,   winRate: 0,    label: "Participant" },
    { stars: 2, matches: 20,  winRate: 0.35, label: "Amateur" },
    { stars: 3, matches: 50,  winRate: 0.50, label: "Compétiteur" },
    { stars: 4, matches: 100, winRate: 0.65, label: "Pro" },
    { stars: 5, matches: 200, winRate: 0.75, label: "Élite" },
  ];
  const LEVEL_NAMES = ["Débutant", "Participant", "Amateur", "Compétiteur", "Pro", "Élite"];
  let cPerfStars = 0;
  for (const tier of TIERS) {
    if (cPlayed >= tier.matches && cWinRate >= tier.winRate) cPerfStars = tier.stars;
  }
  const cStars = Math.min(cPerfStars + cBonusStars, 5);
  const cLevel = LEVEL_NAMES[cStars] ?? "Débutant";
  const cWinRatePct = cPlayed > 0 ? Math.round(cWinRate * 100) : 0;
  const pot = parseInt(challenge.coinsEscrowed ?? 0);
  const payout = Math.floor(pot * 0.85);

  // Score proposé vu par chaque joueur
  const myScore = isChallenger ? challenge.propScoreC : challenge.propScoreO;
  const oppScore = isChallenger ? challenge.propScoreO : challenge.propScoreC;
  const scoreSubmittedByMe = challenge.scoreProposedBy === myId;
  const scoreSubmittedByOpp = challenge.scoreProposedBy && !scoreSubmittedByMe;
  const isDisputed = challenge.isDisputed || challenge.status === "dispute";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/complete`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Défi clôturé !" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/score`, { scoreMe: parseInt(scoreMe), scoreOpponent: parseInt(scoreOpp), proofUrl: proofBase64 ?? undefined }),
    onSuccess: () => { invalidate(); setShowScoreForm(false); toast({ title: "Score soumis !", description: "En attente de confirmation par l'adversaire." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/confirm-score`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Score confirmé ! Résultat enregistré." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const disputeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/challenges/${challenge.id}/dispute-score`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Score contesté", description: "Un admin va trancher le litige." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid={`challenge-match-card-${challenge.id}`}>
      <div className="px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Sword className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Défi</span>
            {(challenge as any).isFriendly ? (
              <span className="text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full px-1.5 py-0.5">🤝 Amical</span>
            ) : (
              <span className={`text-[9px] flex items-center gap-0.5 font-medium ${challenge.isPrivate ? "text-gray-400" : "text-green-600 dark:text-green-400"}`}>
                {challenge.isPrivate ? <><Lock className="w-2.5 h-2.5" /> Privé</> : <><Globe className="w-2.5 h-2.5" /> Public</>}
              </span>
            )}
          </div>
          {hasBet && !(challenge as any).isFriendly && (
            <div className="flex flex-col items-end">
              <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
                <Coins className="w-3 h-3" /> Pot : {pot} pièces
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5">Gagnant : {payout} pièces (−15% eLIGA)</span>
            </div>
          )}
          {(challenge as any).isFriendly && (
            <span className="text-[9px] text-muted-foreground">Gagnant : +1.5 🪙</span>
          )}
        </div>

        {/* Date */}
        <div className="mb-2 pb-2 border-b border-border/60">
          <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-2 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium">{challenge.proposedDate} à {challenge.proposedTime}</span>
          </div>
        </div>

        {/* Players + score */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {(isChallenger ? challenge.challengerPseudo : challenge.opponentPseudo ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Vous</p>
              <p className="text-sm font-medium leading-snug truncate">{isChallenger ? challenge.challengerPseudo : challenge.opponentPseudo}</p>
            </div>
          </div>
          <div className="flex-shrink-0 text-center px-2 min-w-[52px]">
            {challenge.scoreProposedBy ? (
              <div>
                <span className="text-base font-bold font-mono tabular-nums text-amber-600 leading-none">
                  {myScore ?? "–"}&nbsp;–&nbsp;{oppScore ?? "–"}
                </span>
                <p className="text-[9px] text-amber-600 leading-none mt-0.5">proposé</p>
              </div>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">vs</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Adversaire</p>
              <p className="text-sm font-semibold leading-snug truncate">{opponentPseudo ?? "?"}</p>
            </div>
            <Avatar className="w-8 h-8 flex-shrink-0">
              {opponentAvatar && <AvatarImage src={opponentAvatar} className="object-cover" />}
              <AvatarFallback className="text-xs bg-orange-500/10 text-orange-500 font-bold">
                {(opponentPseudo ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Compte à rebours auto-confirmation */}
        {challenge.scoreProposedBy && !isDisputed && challenge.status === "accepted" && autoConfirmLabel && (
          <div className={`mt-2 flex items-center gap-2 rounded px-2 py-1.5 ${
            scoreSubmittedByMe
              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
              : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700"
          }`}>
            <Clock className="w-3.5 h-3.5 flex-shrink-0 text-orange-500" />
            <div className="min-w-0">
              {scoreSubmittedByMe ? (
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  En attente de confirmation par {opponentPseudo ?? "l'adversaire"}. <span className="font-medium">{autoConfirmLabel}</span> si pas de réponse.
                </p>
              ) : (
                <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                  ⚠️ {autoConfirmLabel} — confirmez ou contestez le score.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Photo de preuve soumise */}
        {challenge.scoreProofUrl && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1.5 font-semibold">Photo de preuve</p>
            <img
              src={challenge.scoreProofUrl}
              alt="Preuve du score"
              className="w-full max-h-48 object-contain rounded-md border border-border"
              data-testid={`img-score-proof-${challenge.id}`}
            />
          </div>
        )}

        {/* Stats du créateur */}
        <div className="mt-2 pt-2 border-t border-border/40">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1.5 font-semibold">Stats du créateur</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5"
                  data-testid={`text-challenger-level-${challenge.id}`}>
              {cLevel}
            </span>
            <span className="flex gap-0.5" data-testid={`text-challenger-stars-${challenge.id}`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`text-[11px] ${i < cStars ? "text-amber-400" : "text-muted-foreground/30"}`}>★</span>
              ))}
            </span>
            <span className="text-[10px] text-muted-foreground" data-testid={`text-challenger-record-${challenge.id}`}>
              <span className="text-green-600 font-semibold">{cWins}V</span>
              {" · "}
              <span className="text-red-500 font-semibold">{cLosses}D</span>
              {" · "}
              <span className="font-medium">{cWinRatePct}%</span>
            </span>
          </div>
        </div>

        {/* Numéros de téléphone */}
        <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground leading-none">Votre numéro</p>
              <p className="text-xs font-medium">{myPhone ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground leading-none">{opponentPseudo ?? "Adversaire"}</p>
              <p className="text-xs font-medium">{opponentPhone ?? "—"}</p>
            </div>
            <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        {challenge.message && (
          <p className="text-xs text-muted-foreground italic bg-muted/40 rounded px-2 py-1 mt-2">"{challenge.message}"</p>
        )}

        {/* Litige */}
        {isDisputed && (
          <div className="mt-2 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded px-2 py-1.5">
            <X className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            <p className="text-xs font-medium text-red-700 dark:text-red-400">Score contesté — en attente de décision admin</p>
          </div>
        )}

        {/* Score soumis par moi — attente adversaire */}
        {!isDisputed && scoreSubmittedByMe && (
          <div className="mt-2 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">Score soumis — en attente de confirmation</p>
          </div>
        )}

        {/* Score soumis par l'adversaire — j'attends ma réponse */}
        {!isDisputed && scoreSubmittedByOpp && (
          <div className="mt-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-2 py-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
              {opponentPseudo} a soumis le score — confirmez ou contestez
            </p>
          </div>
        )}

        {/* Formulaire de score */}
        {showScoreForm && (
          <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
            <p className="text-xs font-semibold">Votre score final :</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Vous</label>
                <Input type="number" min="0" max="99" placeholder="0" value={scoreMe} onChange={e => setScoreMe(e.target.value)} className="h-8 text-sm" data-testid={`input-score-me-${challenge.id}`} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">{opponentPseudo}</label>
                <Input type="number" min="0" max="99" placeholder="0" value={scoreOpp} onChange={e => setScoreOpp(e.target.value)} className="h-8 text-sm" data-testid={`input-score-opp-${challenge.id}`} />
              </div>
            </div>
            {/* Photo de preuve — OBLIGATOIRE */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-orange-500" />
                <p className="text-xs font-semibold text-foreground">
                  Photo de preuve <span className="text-red-500 font-bold">* obligatoire</span>
                </p>
              </div>
              <input
                id={`challenge-proof-${challenge.id}`}
                ref={proofInputRef}
                type="file"
                accept="image/*,image/heic,image/heif"
                className="hidden"
                onChange={handleProofChange}
                data-testid={`input-proof-upload-${challenge.id}`}
              />
              {proofPreview ? (
                <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-500">
                  <img src={proofPreview} alt="Preuve" className="w-full max-h-48 object-contain bg-black/5" />
                  <button
                    type="button"
                    onClick={resetProof}
                    className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-lg px-2 py-1 font-medium"
                  >✕ Supprimer</button>
                  <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs text-center py-1 font-semibold">
                    ✓ Photo ajoutée
                  </div>
                </div>
              ) : (
                <label
                  htmlFor={`challenge-proof-${challenge.id}`}
                  className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl py-5 px-4 transition-colors select-none"
                  data-testid={`label-proof-upload-${challenge.id}`}
                >
                  <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Appuyer pour ajouter une photo</p>
                    <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">Capture d'écran du score final du match</p>
                  </div>
                </label>
              )}
            </div>

            {hasBet && (
              <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1">
                ⚠️ Le vainqueur de ce score recevra {payout} pièces. Cette action ne peut pas être annulée.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowScoreForm(false); setScoreMe(""); setScoreOpp(""); resetProof(); }}>Annuler</Button>
              <Button size="sm" className="flex-1" disabled={!scoreMe || !scoreOpp || !proofBase64 || scoreMutation.isPending} onClick={() => scoreMutation.mutate()} data-testid={`button-submit-score-${challenge.id}`}>
                {scoreMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Valider"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isDisputed && (
        <div className="border-t border-border/50 bg-muted/20 px-3 py-2 space-y-2">
          {/* Bouton message */}
          {opponentId && (
            <Button
              size="sm" variant="outline"
              className="w-full text-xs gap-1.5"
              onClick={() => navigate(`/messages?with=${opponentId}`)}
              data-testid={`button-message-opponent-${challenge.id}`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Envoyer un message à {opponentPseudo ?? "l'adversaire"}
            </Button>
          )}
          {/* Pas encore de score soumis */}
          {!challenge.scoreProposedBy && !showScoreForm && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 text-xs" onClick={() => setShowScoreForm(true)} data-testid={`button-open-score-${challenge.id}`}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Saisir le score
              </Button>
              {!hasBet && (
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} data-testid={`button-complete-challenge-match-${challenge.id}`}>
                  <Trophy className="w-3.5 h-3.5 mr-1" /> Terminé (sans score)
                </Button>
              )}
            </div>
          )}

          {/* L'adversaire a soumis un score → confirmer / contester */}
          {scoreSubmittedByOpp && !showScoreForm && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => disputeMutation.mutate()} disabled={disputeMutation.isPending} data-testid={`button-dispute-${challenge.id}`}>
                <X className="w-3.5 h-3.5 mr-1" /> Contester
              </Button>
              <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} data-testid={`button-confirm-score-${challenge.id}`}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const { user } = useAuth();

  const { data: matches, isLoading } = useQuery<any[]>({
    queryKey: ["/api/matches/mine"],
    refetchInterval: 8000,
  });

  const { data: allChallenges = [], isLoading: loadingChallenges } = useQuery<any[]>({
    queryKey: ["/api/challenges/me"],
    refetchInterval: 8000,
  });

  const { data: weeklyProgress } = useQuery<{ earned: number; cap: number; remaining: number; perWin: number }>({
    queryKey: ["/api/coins/weekly-progress"],
    refetchInterval: 30000,
  });

  const acceptedChallenges = allChallenges.filter(c => c.status === "accepted" || c.status === "dispute");
  const completedChallenges = allChallenges.filter(c => c.status === "completed");

  const pending = matches?.filter(m => m.status === "pending" || m.status === "proposed") ?? [];
  const done = matches?.filter(m => m.status === "done") ?? [];

  const pendingByTournament = pending.reduce<Record<string, { tournament: any; matches: any[] }>>((acc, m) => {
    const tid = m.tournamentId;
    if (!acc[tid]) acc[tid] = { tournament: m.tournament, matches: [] };
    acc[tid].matches.push(m);
    return acc;
  }, {});

  const tournamentGroups = Object.values(pendingByTournament);

  tournamentGroups.sort((a, b) => {
    const aMin = a.matches.reduce<string | null>((min, m) => m.scheduledAt && (!min || m.scheduledAt < min) ? m.scheduledAt : min, null);
    const bMin = b.matches.reduce<string | null>((min, m) => m.scheduledAt && (!min || m.scheduledAt < min) ? m.scheduledAt : min, null);
    if (aMin && bMin) return aMin.localeCompare(bMin);
    if (aMin) return -1;
    if (bMin) return 1;
    return 0;
  });

  tournamentGroups.forEach(group => {
    group.matches.sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return 0;
    });
  });

  const totalPending = pending.length + acceptedChallenges.length;
  const totalDone = done.length + completedChallenges.length;
  const isLoadingAll = isLoading || loadingChallenges;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Swords className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes matchs</h1>
          <p className="text-sm text-muted-foreground">Tournois et défis — toutes vos rencontres</p>
        </div>
      </div>

      {/* Widget récompenses hebdomadaires */}
      {weeklyProgress !== undefined && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3" data-testid="weekly-reward-progress">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pièces de la semaine</span>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{weeklyProgress.earned} / {weeklyProgress.cap}</span>
          </div>
          <div className="w-full h-2 bg-amber-200 dark:bg-amber-900/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (weeklyProgress.earned / weeklyProgress.cap) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-amber-700 dark:text-amber-400">+{weeklyProgress.perWin} pièces par victoire de tournoi confirmée</p>
            {weeklyProgress.remaining > 0
              ? <p className="text-[11px] text-amber-600 font-medium">{weeklyProgress.remaining} restantes</p>
              : <p className="text-[11px] text-green-600 font-semibold">Plafond atteint !</p>
            }
          </div>
        </div>
      )}

      {isLoadingAll ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : totalPending === 0 && totalDone === 0 ? (
        <div className="text-center py-16">
          <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-1">Aucun match pour l'instant</h3>
          <p className="text-sm text-muted-foreground">Rejoignez un tournoi ou lancez un défi pour commencer</p>
        </div>
      ) : (
        <>
          {totalPending > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold">Matchs à jouer</h2>
                <Badge className="text-xs bg-amber-500/10 text-amber-600">{totalPending}</Badge>
              </div>

              {/* Défis acceptés */}
              {acceptedChallenges.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sword className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Matchs de défis</span>
                    <span className="text-xs text-muted-foreground ml-auto">{acceptedChallenges.length} défi{acceptedChallenges.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-2">
                    {acceptedChallenges.map(c => (
                      <ChallengeMatchCard key={c.id} challenge={c} myId={user!.id} />
                    ))}
                  </div>
                </div>
              )}

              {/* Matchs de tournois */}
              {tournamentGroups.length > 0 && (
                <div className="space-y-5">
                  {tournamentGroups.map(({ tournament, matches: tMatches }) => (
                    <div key={tournament?.id ?? "unknown"}>
                      <Link href={`/tournaments/${tournament?.id}`}>
                        <div className="flex items-center gap-2 mb-2 group cursor-pointer" data-testid={`tournament-group-${tournament?.id}`}>
                          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {tournament?.name ?? "Tournoi inconnu"}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                            {tMatches.length} match{tMatches.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </Link>
                      <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-2">
                        {tMatches.map(m => (
                          <MatchCard key={m.id} match={m} userId={user?.id} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {totalDone > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">Matchs joués</h2>
                <Badge variant="outline" className="text-xs">{totalDone}</Badge>
              </div>
              <div className="space-y-2">
                {done.map(m => (
                  <MatchCard key={m.id} match={m} userId={user?.id} showTournament />
                ))}
                {completedChallenges.map(c => {
                  const isChallenger = c.challengerId === user?.id;
                  const oppPseudo = isChallenger ? c.opponentPseudo : c.challengerPseudo;
                  const iWon = c.winnerId === user?.id;
                  const pot = parseInt(c.coinsEscrowed ?? 0);
                  const payout = Math.floor(pot * 0.85);
                  const myScore = isChallenger ? c.propScoreC : c.propScoreO;
                  const oppScore = isChallenger ? c.propScoreO : c.propScoreC;
                  const hasScore = myScore !== null && myScore !== undefined;
                  return (
                    <div key={c.id} className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3" data-testid={`completed-challenge-${c.id}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${c.winnerId ? (iWon ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30") : "bg-gray-100 dark:bg-gray-800"}`}>
                        {c.winnerId ? (
                          iWon ? <Trophy className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Sword className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Défi vs {oppPseudo ?? "?"}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">{c.proposedDate}</p>
                          {hasScore && <span className="text-xs font-mono font-semibold">{myScore}–{oppScore}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {c.winnerId ? (
                          <Badge className={`text-[10px] ${iWon ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200"}`} variant="outline">
                            {iWon ? "Victoire" : "Défaite"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Terminé</Badge>
                        )}
                        {pot > 0 && (
                          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${iWon ? "text-green-600" : "text-red-500"}`}>
                            <Coins className="w-2.5 h-2.5" />
                            {iWon ? `+${payout}` : `-${parseInt(c.coinBet)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({ match, userId, showTournament = false }: { match: any; userId?: string; showTournament?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [showTimeProposal, setShowTimeProposal] = useState(false);
  const [timeInput, setTimeInput] = useState("");

  const isPlayer1 = match.player1Id === userId;
  const me = isPlayer1 ? match.player1 : match.player2;
  const opponent = isPlayer1 ? match.player2 : match.player1;
  const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
  const myScore = isPlayer1 ? match.score1 : match.score2;
  const opponentScore = isPlayer1 ? match.score2 : match.score1;
  const won = match.status === "done" && myScore > opponentScore;
  const lost = match.status === "done" && myScore < opponentScore;

  const isProposed = match.status === "proposed";
  const iAmProposer = isProposed && userId === match.proposedBy;
  const canConfirm = isProposed && !iAmProposer;

  // Compte à rebours auto-confirmation (2h)
  const TOUR_AUTO_CONFIRM_MS = 2 * 60 * 60 * 1000;
  const tourProposedAt = (match as any).proposedAt ? new Date((match as any).proposedAt).getTime() : null;
  const tourAutoConfirmAt = tourProposedAt ? tourProposedAt + TOUR_AUTO_CONFIRM_MS : null;
  const tourMsRemaining = tourAutoConfirmAt ? Math.max(0, tourAutoConfirmAt - Date.now()) : null;
  const tourHoursLeft = tourMsRemaining !== null ? Math.floor(tourMsRemaining / 3600000) : null;
  const tourMinutesLeft = tourMsRemaining !== null ? Math.floor((tourMsRemaining % 3600000) / 60000) : null;
  const tourAutoConfirmLabel = tourMsRemaining !== null
    ? tourMsRemaining === 0 ? "Auto-confirmation imminente…"
    : tourHoursLeft! > 0 ? `Auto-confirm dans ${tourHoursLeft}h${tourMinutesLeft}min`
    : `Auto-confirm dans ${tourMinutesLeft} min`
    : null;

  const scheduledLabel = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleString("fr-FR", {
        weekday: "short", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  const invalidateMatches = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/matches/mine"] });
  };

  const resetProof = () => { setProofBase64(null); setProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ""; };

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { toast({ title: "Fichier trop grand", description: "Maximum 30 Mo", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { setProofBase64(dataUrl); setProofPreview(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.80);
          setProofBase64(compressed.length > 100 ? compressed : dataUrl);
          setProofPreview(compressed.length > 100 ? compressed : dataUrl);
        } catch { setProofBase64(dataUrl); setProofPreview(dataUrl); }
      };
      img.onerror = () => { setProofBase64(dataUrl); setProofPreview(dataUrl); };
      img.src = dataUrl;
    };
    reader.onerror = () => toast({ title: "Erreur de lecture", variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const scoreMutation = useMutation({
    mutationFn: () => {
      // Correcting the score inversion before sending to API
      // If I am player 2, score1 (input for me) is actually score2 in the database, 
      // and score2 (input for opponent) is score1 in the database.
      const s1 = parseInt(score1);
      const s2 = parseInt(score2);
      const finalScore1 = isPlayer1 ? s1 : s2;
      const finalScore2 = isPlayer1 ? s2 : s1;

      return apiRequest("PATCH", `/api/matches/${match.id}/score`, {
        score1: finalScore1,
        score2: finalScore2,
        proofUrl: proofBase64 || null,
      });
    },
    onSuccess: (data: any) => {
      invalidateMatches();
      setShowScoreForm(false);
      setScore1(""); setScore2(""); resetProof();
      if (data?.confirmed) {
        toast({ title: "Score enregistré !" });
      } else {
        toast({ title: "Score proposé !", description: "En attente de confirmation par l'adversaire." });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${match.id}/confirm-score`, {}),
    onSuccess: () => { invalidateMatches(); toast({ title: "Score confirmé !", description: "Le résultat est enregistré." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${match.id}/reject-score`, {}),
    onSuccess: () => { invalidateMatches(); toast({ title: "Score contesté — le match est remis à jouer." }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const proposeTimeMutation = useMutation({
    mutationFn: (time: string | null) => apiRequest("PATCH", `/api/matches/${match.id}/propose-time`, { time }),
    onSuccess: (data: any) => {
      invalidateMatches();
      setShowTimeProposal(false);
      if (data?.scheduled) {
        toast({ title: "✅ Match programmé !", description: "Accord trouvé ! Les rappels automatiques sont activés." });
      } else {
        toast({ title: "Heure proposée !", description: "Votre adversaire a été notifié. En attente de son accord." });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectTimeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/matches/${match.id}/reject-time`, {}),
    onSuccess: () => {
      invalidateMatches();
      toast({ title: "Proposition refusée", description: "L'adversaire a été notifié et peut proposer un autre créneau." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });




  const isDone = match.status === "done";
  const isPending = match.status === "pending";

  // Time proposal state
  const myProposedTime: string | null = isPlayer1 ? match.proposedTimeP1 : match.proposedTimeP2;
  const opponentProposedTime: string | null = isPlayer1 ? match.proposedTimeP2 : match.proposedTimeP1;
  const opponentWaitsForMe = !!opponentProposedTime && !myProposedTime;
  const iWaitForOpponent = !!myProposedTime && !opponentProposedTime;
  const bothProposedConflict = !!myProposedTime && !!opponentProposedTime && myProposedTime !== opponentProposedTime;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid={`match-card-${match.id}`}>
      {/* Clickable header area → navigate to tournament */}
      <div
        className="px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate(`/tournaments/${match.tournamentId}`)}
      >
        {/* Top bar: tournament name (done view) + pool badge + result */}
        {(showTournament || match.poolNumber) && (
          <div className="flex items-center justify-between gap-2 mb-2">
            {showTournament && (
              <p className="text-xs text-muted-foreground font-medium truncate flex-1">{match.tournament?.name}</p>
            )}
            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
              {match.poolNumber && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Poule {match.poolNumber}</Badge>
              )}
              {isDone && won && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">Victoire</Badge>}
              {isDone && lost && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Défaite</Badge>}
              {isDone && !won && !lost && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Nul</Badge>}
            </div>
          </div>
        )}

        {/* Match confirmé */}
        {!isDone && match.scheduledAt && (
          <div className="mb-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-2 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">
                {new Date(match.scheduledAt).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Date fixée par l'organisateur */}
        {!isDone && !match.scheduledAt && match.matchDate && (
          <div className="mb-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{new Date(match.matchDate).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
          </div>
        )}

        {/* Propositions d'heure — visible sans clic */}
        {!isDone && !match.scheduledAt && (myProposedTime || opponentProposedTime) && (
          <div className="mb-2 pb-2 border-b border-border/60 space-y-1">
            {/* Proposition de l'adversaire en attente de ma réponse */}
            {opponentWaitsForMe && (
              <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-2 py-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-blue-800 dark:text-blue-300 font-medium">
                  {opponent?.pseudo} propose : <strong>{opponentProposedTime}</strong>
                </span>
                <span className="ml-auto text-blue-600 dark:text-blue-400 text-[10px] font-medium animate-pulse">→ À vous de répondre</span>
              </div>
            )}
            {/* Ma proposition en attente de l'adversaire */}
            {iWaitForOpponent && (
              <div className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-muted-foreground">
                  Votre proposition : <strong className="text-foreground">{myProposedTime}</strong>
                </span>
                <span className="ml-auto text-amber-600 text-[10px] animate-pulse">En attente…</span>
              </div>
            )}
            {/* Les deux ont proposé des heures différentes */}
            {bothProposedConflict && (
              <div className="flex items-center gap-2 text-xs bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded px-2 py-1.5 flex-wrap">
                <Clock className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                <span className="text-orange-800 dark:text-orange-300 font-medium">Vous : <strong>{myProposedTime}</strong></span>
                <span className="text-orange-500">·</span>
                <span className="text-muted-foreground">{opponent?.pseudo} : <strong>{opponentProposedTime}</strong></span>
                <span className="ml-auto text-orange-600 text-[10px] font-medium">Désaccord</span>
              </div>
            )}
          </div>
        )}

        {/* Players row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="w-8 h-8 flex-shrink-0">
              {me?.avatarUrl && <AvatarImage src={me.avatarUrl} alt={me.pseudo} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {me?.pseudo?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Vous</p>
              <p className="text-sm font-medium leading-snug truncate">{me?.pseudo}</p>
              <p className="text-[9px] text-muted-foreground leading-none mt-0.5">{me?.phone}</p>
            </div>
          </div>

          <div className="flex-shrink-0 text-center px-2 min-w-[52px]">
            {isDone ? (
              <span className="text-base font-bold font-mono tabular-nums leading-none">
                {myScore ?? "–"}&nbsp;–&nbsp;{opponentScore ?? "–"}
              </span>
            ) : isProposed ? (
              <div>
                <span className="text-sm font-bold font-mono text-amber-600 leading-none">
                  {isPlayer1 ? match.proposedScore1 : match.proposedScore2}&nbsp;–&nbsp;{isPlayer1 ? match.proposedScore2 : match.proposedScore1}
                </span>
                <p className="text-[9px] text-amber-600 leading-none mt-0.5">proposé</p>
              </div>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">vs</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Adversaire</p>
              <p className="text-sm font-semibold leading-snug truncate">{opponent?.pseudo}</p>
              <p className="text-[9px] text-muted-foreground leading-none mt-0.5">{opponent?.phone}</p>
            </div>
            <Avatar className="w-8 h-8 flex-shrink-0">
              {opponent?.avatarUrl && <AvatarImage src={opponent.avatarUrl} alt={opponent.pseudo} />}
              <AvatarFallback className="text-xs bg-orange-500/10 text-orange-500 font-bold">
                {opponent?.pseudo?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Status for done cards without top bar */}
        {isDone && !showTournament && !match.poolNumber && (
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-border/50">
            {won && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">Victoire</Badge>}
            {lost && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Défaite</Badge>}
            {!won && !lost && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Nul</Badge>}
          </div>
        )}
      </div>

      {/* Action area — only for pending/proposed */}
      {!isDone && (
        <div className="border-t border-border/50 bg-muted/20 px-3 py-2 flex flex-col gap-2">

          {/* Proposed: confirm/contest OR waiting */}
          {isProposed && (
            canConfirm ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-600">Score proposé par l'adversaire</p>
                  <p className="text-[11px] text-muted-foreground">Acceptez-vous ce résultat ?</p>
                </div>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending || rejectMutation.isPending}
                  data-testid={`button-confirm-score-${match.id}`}
                >
                  {confirmMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Confirmer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 flex-shrink-0"
                  onClick={() => rejectMutation.mutate()}
                  disabled={confirmMutation.isPending || rejectMutation.isPending}
                  data-testid={`button-reject-score-${match.id}`}
                >
                  {rejectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Contester
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  <p className="text-xs text-amber-600 font-medium truncate">En attente de confirmation par l'adversaire</p>
                </div>
                <button
                  className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                  onClick={() => navigate(`/messages?with=${opponentId}`)}
                  data-testid={`button-msg-${match.id}`}
                  title="Envoyer un message"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>
              {tourAutoConfirmLabel && (
                <div className="flex items-center gap-1.5 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-2 py-1">
                  <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">{tourAutoConfirmLabel} si pas de réponse</p>
                </div>
              )}
              </div>
            )
          )}

          {/* Pending */}
          {isPending && (
            <>
              {/* ── Cas 1 : L'adversaire a proposé, j'attends ma réponse ── */}
              {opponentWaitsForMe && !showScoreForm && !showTimeProposal && (
                <div className="flex flex-col gap-2 rounded-md bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 px-3 py-2.5">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {opponent?.pseudo} propose de jouer à <strong>{opponentProposedTime}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => proposeTimeMutation.mutate(opponentProposedTime)}
                      disabled={proposeTimeMutation.isPending || rejectTimeMutation.isPending}
                      data-testid={`button-accept-time-${match.id}`}
                    >
                      {proposeTimeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => rejectTimeMutation.mutate()}
                      disabled={proposeTimeMutation.isPending || rejectTimeMutation.isPending}
                      data-testid={`button-reject-time-${match.id}`}
                    >
                      {rejectTimeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Refuser
                    </Button>
                    <button
                      className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      onClick={() => { setTimeInput(""); setShowTimeProposal(true); }}
                      title="Proposer une autre heure"
                      data-testid={`button-counter-time-${match.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Cas 2 : J'ai proposé, en attente de l'adversaire ── */}
              {iWaitForOpponent && !showScoreForm && !showTimeProposal && (
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium truncate">
                      Heure proposée : <strong>{myProposedTime}</strong> — en attente de {opponent?.pseudo}
                    </p>
                  </div>
                  <button
                    className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    onClick={() => proposeTimeMutation.mutate(null)}
                    disabled={proposeTimeMutation.isPending}
                    title="Annuler ma proposition"
                    data-testid={`button-cancel-time-${match.id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* ── Cas 3 : Conflit — les deux ont proposé des heures différentes ── */}
              {bothProposedConflict && !showScoreForm && !showTimeProposal && (
                <div className="flex flex-col gap-1.5 rounded-md bg-orange-50/60 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 px-3 py-2.5">
                  <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">⚠️ Désaccord sur l'heure</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Vous : {myProposedTime}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{opponent?.pseudo} : {opponentProposedTime}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full"
                    onClick={() => { setTimeInput(myProposedTime ?? ""); setShowTimeProposal(true); }}
                    data-testid={`button-change-time-${match.id}`}
                  >
                    Modifier mon heure
                  </Button>
                </div>
              )}

              {/* ── Cas 4 : Aucune proposition — boutons normaux ── */}
              {!opponentWaitsForMe && !iWaitForOpponent && !bothProposedConflict && !showScoreForm && !showTimeProposal && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs gap-1.5 flex-1"
                      onClick={() => setShowScoreForm(true)}
                      data-testid={`button-score-${match.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Saisir le score
                    </Button>
                    {!match.scheduledAt && (
                      <button
                        className="p-1.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 transition-colors flex-shrink-0"
                        onClick={() => { setTimeInput(""); setShowTimeProposal(true); }}
                        data-testid={`button-propose-time-${match.id}`}
                        title="Proposer votre heure de jeu"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                      onClick={() => navigate(`/messages?with=${opponentId}`)}
                      data-testid={`button-msg-${match.id}`}
                      title="Envoyer un message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {!match.scheduledAt && (
                    <button
                      className="text-[11px] text-amber-600 dark:text-amber-400 text-left flex items-center gap-1 hover:underline"
                      onClick={() => { setTimeInput(""); setShowTimeProposal(true); }}
                      data-testid={`button-propose-time-label-${match.id}`}
                    >
                      <Clock className="w-3 h-3" />
                      Proposer une heure de match
                    </button>
                  )}
                </div>
              )}

              {/* ── Panneau de saisie d'heure ── */}
              {showTimeProposal && !showScoreForm && (
                <div className="flex flex-col gap-2 rounded-md bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {match.matchDate
                      ? `Proposer votre heure (le ${new Date(match.matchDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })})`
                      : "Proposer votre heure disponible"}
                  </p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="ex: 14:30"
                      maxLength={5}
                      value={timeInput}
                      onChange={e => {
                        let v = e.target.value.replace(/[^0-9:]/g, "");
                        if (v.length === 2 && !v.includes(":") && timeInput.length === 1) v = v + ":";
                        setTimeInput(v);
                      }}
                      className="text-sm flex-1 h-8 font-mono"
                      data-testid={`input-propose-time-${match.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => proposeTimeMutation.mutate(timeInput || null)}
                      disabled={proposeTimeMutation.isPending || !/^\d{2}:\d{2}$/.test(timeInput)}
                      data-testid={`button-confirm-time-${match.id}`}
                    >
                      {proposeTimeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Envoyer
                    </Button>
                    <button
                      className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowTimeProposal(false)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">L'adversaire pourra accepter ou refuser votre proposition.</p>
                </div>
              )}

              {showScoreForm && (
                <div className="flex flex-col gap-2.5">
                  {/* Score inputs */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <p className="text-[10px] text-muted-foreground font-medium truncate max-w-full">{me?.pseudo}</p>
                      <Input
                        type="number" min="0" max="99" placeholder="0"
                        value={score1} onChange={e => setScore1(e.target.value)}
                        className="h-10 text-center text-xl font-bold"
                        data-testid={`input-score1-${match.id}`}
                      />
                    </div>
                    <span className="text-sm font-bold text-muted-foreground flex-shrink-0 pt-5">–</span>
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <p className="text-[10px] text-muted-foreground font-medium truncate max-w-full">{opponent?.pseudo}</p>
                      <Input
                        type="number" min="0" max="99" placeholder="0"
                        value={score2} onChange={e => setScore2(e.target.value)}
                        className="h-10 text-center text-xl font-bold"
                        data-testid={`input-score2-${match.id}`}
                      />
                    </div>
                  </div>

                  {/* Photo de preuve — OBLIGATOIRE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-orange-500" />
                      <p className="text-xs font-semibold text-foreground">
                        Photo de preuve <span className="text-red-500 font-bold">* obligatoire</span>
                      </p>
                    </div>
                    <input
                      id={`proof-input-${match.id}`}
                      ref={proofInputRef}
                      type="file"
                      accept="image/*,image/heic,image/heif"
                      className="hidden"
                      onChange={handleProofChange}
                      data-testid={`input-proof-upload-${match.id}`}
                    />
                    {proofPreview ? (
                      <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-500">
                        <img src={proofPreview} alt="Preuve" className="w-full max-h-48 object-contain bg-black/5" />
                        <button
                          type="button"
                          onClick={resetProof}
                          className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-lg px-2 py-1 font-medium"
                        >✕ Supprimer</button>
                        <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs text-center py-1 font-semibold">
                          ✓ Photo ajoutée
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor={`proof-input-${match.id}`}
                        className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl py-5 px-4 transition-colors select-none"
                        data-testid={`label-proof-upload-${match.id}`}
                      >
                        <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          <Camera className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Appuyer pour ajouter une photo</p>
                          <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">Capture d'écran du score final du match</p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => { setShowScoreForm(false); setScore1(""); setScore2(""); resetProof(); }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={() => scoreMutation.mutate()}
                      disabled={scoreMutation.isPending || score1 === "" || score2 === "" || !proofBase64}
                      data-testid={`button-submit-score-${match.id}`}
                    >
                      {scoreMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                      Proposer le score
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users, Gamepad2, Clock, Lock, Globe, Shuffle, Swords, BarChart3, MessageSquare, Share2, Send, CheckCircle, Trash2, Pencil, LogOut, UserX, Camera, Eye, ThumbsUp, ThumbsDown, Hourglass, CalendarDays, CalendarClock, ChevronDown, ChevronUp, Info, Sparkles, Star, Shield, Banknote, Upload, X, CheckCircle2, XCircle, Copy, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import WinnerCelebration from "@/components/WinnerCelebration";
import { QRCodeSVG } from "qrcode.react";

function PrivateCodePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Code copié !", description: code });
  };

  return (
    <div className="border border-primary/25 bg-primary/5 rounded-xl p-4 space-y-4" data-testid="panel-private-code">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-primary">Tournoi privé — Code d'accès</p>
      </div>

      {/* QR code centré */}
      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-2xl border-2 border-primary/20 shadow-sm" data-testid="panel-qr-code">
          <QRCodeSVG value={code} size={160} level="M" />
        </div>
      </div>

      {/* Code + bouton copier */}
      <div className="flex items-center justify-between bg-background rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Code du tournoi privé</p>
          <p className="text-2xl font-bold font-mono tracking-[0.25em] text-primary">{code}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors flex-shrink-0"
          data-testid="button-copy-private-code"
          title="Copier le code"
        >
          {copied
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : <Copy className="w-5 h-5 text-primary" />
          }
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Partagez ce QR ou ce code avec vos joueurs invités
      </p>
    </div>
  );
}

export default function TournamentDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/tournaments/:id");
  const id = params?.id!;
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProofData, setPaymentProofData] = useState<string | null>(null);
  const paymentProofRef = useRef<HTMLInputElement>(null);

  const { data: tournament, isLoading } = useQuery<any>({ queryKey: ["/api/tournaments", id] });
  const { data: participants } = useQuery<any[]>({ queryKey: ["/api/tournaments", id, "participants"] });
  const { data: matches } = useQuery<any[]>({ queryKey: ["/api/tournaments", id, "matches"], refetchInterval: 8000 });
  const { data: standings } = useQuery<any[]>({ queryKey: ["/api/tournaments", id, "standings"], enabled: !!tournament });
  const { data: myStats } = useQuery<any>({ queryKey: ["/api/stats/me"], enabled: !!user });
  const { data: prizeData } = useQuery<any>({
    queryKey: ["/api/tournaments", id, "prize-distribution"],
    enabled: !!(tournament as any)?.isPaid,
  });
  const { data: chatMessages } = useQuery<any[]>({
    queryKey: ["/api/tournaments", id, "chat"],
    refetchInterval: 5000,
  });

  // Winner detection — identify the champion
  const winnerName = useMemo(() => {
    if (!tournament || tournament.status !== "finished") return "";
    // From prize distributions (paid tournaments)
    if (prizeData?.distributions) {
      const w = prizeData.distributions.find((d: any) => d.role === "winner");
      if (w?.pseudo) return w.pseudo;
    }
    // From standings: top by points then goal difference
    if (standings && standings.length > 0) {
      const sorted = [...standings].sort((a: any, b: any) => {
        const pA = a.wins * 3 + a.draws;
        const pB = b.wins * 3 + b.draws;
        if (pB !== pA) return pB - pA;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
      });
      return sorted[0]?.pseudo ?? sorted[0]?.username ?? "";
    }
    return "";
  }, [tournament, prizeData, standings]);

  const isWinner = useMemo(() => {
    if (!user || !tournament || tournament.status !== "finished") return false;
    if (prizeData?.distributions) {
      const w = prizeData.distributions.find((d: any) => d.role === "winner");
      if (w?.userId === user.id) return true;
    }
    if (standings && standings.length > 0) {
      const sorted = [...standings].sort((a: any, b: any) => {
        const pA = a.wins * 3 + a.draws;
        const pB = b.wins * 3 + b.draws;
        if (pB !== pA) return pB - pA;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
      });
      if (sorted[0]?.userId === user.id) return true;
    }
    return false;
  }, [user, tournament, prizeData, standings]);

  const celebrationKey = `celebration_seen_${id}`;
  const alreadySeen = typeof window !== "undefined" && !!localStorage.getItem(celebrationKey);
  // Show to ALL visitors when tournament finishes, not just the winner
  const showCelebration = !!(tournament && tournament.status === "finished" && !alreadySeen);

  const joinMutation = useMutation({
    mutationFn: (paymentProof?: string) => apiRequest("POST", `/api/tournaments/${id}/join`, paymentProof ? { paymentProof } : {}),
    onSuccess: (_data, paymentProof) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/joined"] });
      setShowPaymentModal(false);
      setPaymentProofData(null);
      if (paymentProof) {
        toast({ title: "Inscription soumise !", description: "Votre preuve de paiement est en attente de validation par l'administrateur." });
      } else {
        toast({ title: "Rejoint !", description: "Vous participez maintenant à ce tournoi." });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const drawMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tournaments/${id}/draw`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id, "matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Tirage effectué !", description: "Les matchs ont été générés et les joueurs notifiés." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/tournaments/${id}`, {
      name: editName, description: editDescription,
      startDate: editStartDate || null, endDate: editEndDate || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/mine"] });
      setEditOpen(false);
      toast({ title: "Tournoi mis à jour !" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tournaments/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/mine"] });
      setDeleteConfirmOpen(false);
      toast({ title: "Tournoi supprimé" });
      window.history.back();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tournaments/${id}/leave`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id, "participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/joined"] });
      toast({ title: "Vous avez quitté le tournoi" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/tournaments/${id}/participants/${userId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id, "participants"] });
      toast({ title: "Participant exclu" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const knockoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tournaments/${id}/knockout-draw`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id, "matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Phase finale lancée !", description: `${data.qualifiedCount} qualifiés s'affrontent.` });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const finishMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tournaments/${id}/finish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Tournoi terminé !", description: "Le tournoi a été clôturé avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleShare = () => {
    const base = window.location.origin;
    const link = tournament?.visibility === "private" && tournament?.code
      ? `${base}/search?code=${tournament.code}`
      : `${base}/tournaments/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Lien copié !", description: "Partagez-le avec vos amis." });
    });
  };

  if (isLoading) return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!tournament) return <div className="p-6 text-center text-muted-foreground">Tournoi introuvable</div>;

  const isCreator = user?.id === tournament.creatorId;
  const myParticipant = participants?.find(p => p.userId === user?.id);
  const isParticipant = !!myParticipant;
  const myPaymentStatus = myParticipant?.paymentStatus; // 'pending' | 'confirmed' | 'rejected' | undefined
  const limit = tournament.playerLimit || (tournament.numPools && tournament.playersPerPool ? tournament.numPools * tournament.playersPerPool : null);
  const full = limit ? (participants?.length ?? 0) >= limit : false;
  const myStars = myStats?.stars ?? 0;
  const sponsoredMinStars = (tournament as any).minStars ?? 0;
  const sponsoredLocked = tournament.isSponsored && !isCreator && sponsoredMinStars > 0 && myStars < sponsoredMinStars && !(tournament as any).isPaid;
  const canChat = isParticipant || isCreator;

  // Match phase analysis
  const poolMatchesList = matches?.filter((m: any) => m.phase === "pool") ?? [];
  const knockoutMatchesList = matches?.filter((m: any) => m.phase === "knockout") ?? [];
  const hasKnockoutPhase = knockoutMatchesList.length > 0;
  const allPoolDone = poolMatchesList.length > 0 && poolMatchesList.every((m: any) => m.status === "done");
  const allKnockoutDone = hasKnockoutPhase && knockoutMatchesList.every((m: any) => m.status === "done");
  const allMatchesDone = !!matches && matches.length > 0 && matches.every((m: any) => m.status === "done");
  const canDrawKnockout = isCreator && tournament.championshipType === "pool" && allPoolDone && !hasKnockoutPhase && tournament.status === "in_progress";
  const canFinish = isCreator && tournament.status === "in_progress" && allMatchesDone;

  const statusColor: Record<string, string> = {
    waiting: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-primary/10 text-primary",
    finished: "bg-muted text-muted-foreground",
  };

  const gameTypeLabels: Record<string, string> = { ps: "PlayStation", xbox: "Xbox", mobile: "Mobile" };
  const formLabels: Record<string, string> = { excellent: "Excellent", normal: "Normal", any: "Peu importe" };
  const poolNumbers = Array.from(new Set(matches?.filter((m: any) => m.poolNumber).map((m: any) => m.poolNumber) ?? [])).sort() as number[];

  const poolStandings = standings ? Array.from(new Set(standings.filter((s: any) => s.poolNumber != null).map((s: any) => s.poolNumber))).sort() : [];

  const t = tournament as any;

  const isOfficial = !!(t as any).creator?.isAdmin;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Winner celebration overlay */}
      {showCelebration && (
        <WinnerCelebration
          tournamentId={id}
          tournamentName={tournament?.name ?? ""}
          playerName={winnerName || (user?.pseudo ?? user?.username ?? "")}
          isWinner={isWinner}
          prizeAmount={(tournament as any)?.elitePrizeAmount ?? prizeData?.winnerShare ?? null}
        />
      )}

      {/* Official admin banner */}
      {isOfficial && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground" data-testid="banner-official">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm tracking-wide uppercase">Officiel eLIGA</p>
            <p className="text-xs text-primary-foreground/80">Tournoi certifié et organisé par l'administration eLIGA</p>
          </div>
          <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">✓ Certifié</span>
        </div>
      )}
      {/* Sponsor banner */}
      {t.isSponsored && (
        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 overflow-hidden" data-testid="banner-sponsor">
          {/* Sponsor logo — full width */}
          {t.sponsorLogo && (
            <div className="bg-white dark:bg-zinc-900">
              <img
                src={t.sponsorLogo}
                alt={t.sponsorName ?? "Sponsor"}
                className="w-full h-auto block"
                onError={e => (e.currentTarget.parentElement!.style.display = "none")}
              />
            </div>
          )}
          {/* Sponsor info strip */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/10">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-amber-700 dark:text-amber-400">
                {t.sponsorName ? `Sponsorisé par ${t.sponsorName}` : "Tournoi sponsorisé"}
              </p>
              {t.prizeInfo && (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">🏆 Dotation : {t.prizeInfo}</p>
              )}
              {(t as any).minStars > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Accès réservé aux joueurs <strong>{(t as any).minStars}★ et plus</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Elite banner */}
      {t.isElite && (
        <div className="rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 dark:border-yellow-700 overflow-hidden" data-testid="banner-elite">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-5 h-5 ${s <= (t.minStars ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-yellow-200"}`} />)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-yellow-700 dark:text-yellow-400">Championnat Élite</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-300">Accès réservé aux joueurs {t.minStars}★ et plus</p>
            </div>
          </div>
          {(t as any).elitePrizeAmount > 0 && (
            <div className="border-t border-yellow-200 dark:border-yellow-800 px-4 py-2.5 bg-yellow-400/10 dark:bg-yellow-500/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🥇</span>
                <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300">Prix du vainqueur</p>
              </div>
              <span className="text-base font-black text-yellow-700 dark:text-yellow-300">{(t as any).elitePrizeAmount.toLocaleString()} XAF</span>
            </div>
          )}
        </div>
      )}
      {/* Cotisation banner */}
      {t.isPaid && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 dark:border-green-700" data-testid="banner-paid">
            <Banknote className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm text-green-700 dark:text-green-400">Tournoi à cotisation</p>
              <p className="text-xs text-green-600 dark:text-green-300">Frais d'inscription : <span className="font-semibold">{t.entryFee?.toLocaleString()} XAF</span> — Payer au : <span className="font-semibold">{t.entryPaymentNumber}</span></p>
            </div>
          </div>

          {/* Prize pool breakdown — always visible for paid tournaments */}
          {prizeData && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-4" data-testid="prize-pool-card">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-amber-700 dark:text-amber-400">Cagnotte du tournoi</p>
                  <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70">
                    {prizeData.participantCount} joueur{prizeData.participantCount !== 1 ? "s" : ""} × {prizeData.entryFee?.toLocaleString()} XAF
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-amber-700 dark:text-amber-300">
                    {prizeData.totalPool.toLocaleString()} XAF
                  </span>
                  {prizeData.projectedPool && prizeData.projectedPool !== prizeData.totalPool && (
                    <p className="text-[10px] text-amber-500/80 dark:text-amber-400/60">
                      objectif {prizeData.projectedPool.toLocaleString()} XAF
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar if tournament has a player limit */}
              {prizeData.playerLimit && (
                <div className="mb-3 mt-2">
                  <div className="w-full bg-amber-200/50 dark:bg-amber-800/30 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 dark:bg-amber-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (prizeData.participantCount / prizeData.playerLimit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-amber-500/80 dark:text-amber-400/60 mt-0.5 text-right">
                    {prizeData.participantCount}/{prizeData.playerLimit} joueurs
                  </p>
                </div>
              )}

              {/* Prize rows */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-yellow-400/20 dark:bg-yellow-500/10 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥇</span>
                    <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Vainqueur</p>
                      {prizeData.distributions?.find((d: any) => d.role === 'winner')?.pseudo && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">{prizeData.distributions.find((d: any) => d.role === 'winner').pseudo}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-amber-700 dark:text-amber-300">
                      {prizeData.winnerShare.toLocaleString()} XAF
                    </span>
                    {prizeData.projectedWinner && prizeData.projectedWinner !== prizeData.winnerShare && (
                      <p className="text-[10px] text-amber-500/70 dark:text-amber-400/50">→ {prizeData.projectedWinner.toLocaleString()} XAF</p>
                    )}
                    <span className="block text-[10px] font-normal opacity-60">(50%)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-gray-200/50 dark:bg-gray-700/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥈</span>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">Finaliste</p>
                      {prizeData.distributions?.find((d: any) => d.role === 'runner_up')?.pseudo && (
                        <p className="text-[10px] text-muted-foreground">{prizeData.distributions.find((d: any) => d.role === 'runner_up').pseudo}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-muted-foreground">
                      {prizeData.runnerUpShare.toLocaleString()} XAF
                    </span>
                    <span className="block text-[10px] font-normal opacity-60">(30%)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-blue-100/50 dark:bg-blue-900/10 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Plateforme eLIGA</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {prizeData.platformShare.toLocaleString()} XAF
                    </span>
                    <span className="block text-[9px] font-normal opacity-60">(20%)</span>
                  </div>
                </div>
              </div>
              {prizeData.participantCount < 2 && (
                <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 mt-2 text-center bg-amber-100/50 dark:bg-amber-900/20 rounded-lg py-1.5">
                  ⚠️ Les gains sont distribués à partir de 2 participants ({prizeData.participantCount}/2)
                </p>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2" data-testid="banner-fraud-warning">
            <span className="text-sm flex-shrink-0">⚠️</span>
            <p className="text-[11px] font-medium text-red-700 dark:text-red-400 leading-relaxed">
              Toute tentative de fraude (fausse preuve, paiement annulé après validation) entraîne le <strong>blocage immédiat et définitif</strong> du compte. <strong>3 rejets de paiement</strong> conduisent également au blocage automatique du compte, sans possibilité de réclamation.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <Badge className={statusColor[tournament.status]}>
              {tournament.status === "waiting" ? "En attente" : tournament.status === "in_progress" ? "En cours" : "Terminé"}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              {tournament.visibility === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {tournament.visibility === "public" ? "Public" : "Privé"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Créé par</span>
            <Avatar className="w-6 h-6 flex-shrink-0">
              {(tournament as any).creator?.avatarUrl && <AvatarImage src={(tournament as any).creator.avatarUrl} />}
              <AvatarFallback className="text-[10px] font-bold">{(tournament as any).creator?.pseudo?.charAt(0) ?? "?"}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">{tournament.creator?.pseudo}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} data-testid="button-share">
            <Share2 className="w-4 h-4 mr-1.5" />
            Partager
          </Button>
          {!isParticipant && !isCreator && !user?.isAdmin && tournament.status === "waiting" && !full && !sponsoredLocked && (
            <Button
              onClick={() => tournament.isPaid ? setShowPaymentModal(true) : joinMutation.mutate(undefined)}
              disabled={joinMutation.isPending}
              data-testid="button-join-tournament"
              className={tournament.isPaid ? "gap-1.5 bg-green-600 hover:bg-green-700 text-white" : ""}
            >
              <Banknote className={`w-4 h-4 ${!tournament.isPaid ? "hidden" : ""}`} />
              {joinMutation.isPending ? "..." : tournament.isPaid ? `Cotiser (${tournament.entryFee?.toLocaleString()} XAF)` : "Rejoindre"}
            </Button>
          )}
          {sponsoredLocked && !user?.isAdmin && tournament.status === "waiting" && (
            <div className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg" data-testid="status-sponsored-locked">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Réservé aux joueurs <strong>{sponsoredMinStars}★ et plus</strong> — vous avez {myStars}★</span>
            </div>
          )}
          {isParticipant && !isCreator && myPaymentStatus === "pending" && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-1.5 rounded-lg" data-testid="status-payment-pending">
              <Hourglass className="w-3.5 h-3.5" />
              <span>Paiement en attente de confirmation</span>
            </div>
          )}
          {isParticipant && !isCreator && myPaymentStatus === "rejected" && (
            <div className="flex flex-col gap-1" data-testid="status-payment-rejected">
              <div className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg">
                <XCircle className="w-3.5 h-3.5" />
                <span>Paiement rejeté — soumettez à nouveau</span>
              </div>
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowPaymentModal(true)}>
                <Banknote className="w-3.5 h-3.5" /> Resoumettre
              </Button>
            </div>
          )}
          {!isParticipant && !isCreator && tournament.status === "in_progress" && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg" data-testid="status-in-progress">
              <span>🔒</span>
              <span>Tournoi en cours — inscription fermée</span>
            </div>
          )}
          {!isParticipant && !isCreator && tournament.status === "finished" && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg" data-testid="status-finished">
              <span>🏁</span>
              <span>Tournoi terminé</span>
            </div>
          )}
          {!isParticipant && !isCreator && tournament.status === "waiting" && full && (
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive bg-destructive/10 border border-destructive/30 px-4 py-2 rounded-lg" data-testid="status-full">
              <span className="text-base">🚫</span>
              <span>Impossible de participer — limite atteinte ({participants?.length ?? 0}/{limit} joueurs)</span>
            </div>
          )}
          {isParticipant && !isCreator && tournament.status === "waiting" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              data-testid="button-leave-tournament"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              {leaveMutation.isPending ? "..." : "Quitter"}
            </Button>
          )}
          {isCreator && tournament.status === "waiting" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditName(tournament.name); setEditDescription(tournament.description ?? ""); setEditStartDate(tournament.startDate ?? ""); setEditEndDate(tournament.endDate ?? ""); setEditOpen(true); }}
                data-testid="button-edit-tournament"
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                Modifier
              </Button>
              <Button
                onClick={() => drawMutation.mutate()}
                disabled={drawMutation.isPending || (!!limit && !full) || (participants?.length ?? 0) < 2}
                variant={(full || !limit) && (participants?.length ?? 0) >= 2 ? "default" : "outline"}
                data-testid="button-draw"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {drawMutation.isPending ? "Tirage..." : "Lancer le tirage"}
              </Button>
            </>
          )}
          {canDrawKnockout && (
            <Button
              onClick={() => {
                if (window.confirm("Lancer la phase finale ? Les 2 premiers de chaque poule seront qualifiés pour les matchs croisés.")) {
                  knockoutMutation.mutate();
                }
              }}
              disabled={knockoutMutation.isPending}
              size="sm"
              data-testid="button-knockout-draw"
            >
              <Trophy className="w-4 h-4 mr-1.5" />
              {knockoutMutation.isPending ? "..." : "Phase finale"}
            </Button>
          )}
          {canFinish && (
            <Button
              onClick={() => {
                if (window.confirm("Tous les matchs sont terminés. Valider la clôture définitive du tournoi ?")) {
                  finishMutation.mutate();
                }
              }}
              disabled={finishMutation.isPending}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-finish-tournament"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              {finishMutation.isPending ? "..." : "Clôturer le tournoi"}
            </Button>
          )}
          {isCreator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              data-testid="button-delete-tournament"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {isCreator && tournament.status === "waiting" && (participants?.length ?? 0) < 2 && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700" data-testid="warning-min-participants">
          Il faut au moins 2 participants pour lancer le tirage. En attente de joueurs ({participants?.length ?? 0}{limit ? `/${limit}` : ""})...
        </div>
      )}
      {isCreator && tournament.status === "waiting" && (participants?.length ?? 0) >= 2 && !full && limit && (
        <div className="bg-amber-500/10 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700" data-testid="warning-not-full">
          Pas encore complet ({participants?.length ?? 0}/{limit}). Vous pouvez lancer maintenant ou attendre plus de joueurs.
        </div>
      )}

      {isCreator && tournament.visibility === "private" && tournament.code && (
        <PrivateCodePanel code={tournament.code} />
      )}

      {/* Collapsible tournament details */}
      <TournamentDetailsPanel tournament={tournament} participants={participants} limit={limit} gameTypeLabels={gameTypeLabels} formLabels={formLabels} />

      {/* Tabs */}
      <Tabs defaultValue="matches">
        {/* Custom grid tab bar — Matchs first */}
        {(() => {
          const hasMatches = !!(matches && matches.length > 0);
          const colCount = [hasMatches, true, hasMatches, canChat].filter(Boolean).length;
          const gridClass = colCount === 4 ? "grid-cols-4" : colCount === 3 ? "grid-cols-3" : colCount === 2 ? "grid-cols-2" : "grid-cols-1";
          return (
            <TabsList className={`w-full grid ${gridClass} h-auto p-1 gap-1 rounded-xl`}>
              {hasMatches && (
                <TabsTrigger
                  value="matches"
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                  data-testid="tab-matches"
                >
                  <Swords className="w-4 h-4" />
                  <span>Matchs</span>
                  <span className="text-[10px] font-bold opacity-80">({matches!.length})</span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="participants"
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                data-testid="tab-participants"
              >
                <Users className="w-4 h-4" />
                <span>Participants</span>
                <span className="text-[10px] font-bold opacity-80">({participants?.length ?? 0})</span>
              </TabsTrigger>
              {hasMatches && (
                <TabsTrigger
                  value="standings"
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                  data-testid="tab-standings"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Classement</span>
                </TabsTrigger>
              )}
              {canChat && (
                <TabsTrigger
                  value="chat"
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                  data-testid="tab-chat"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat</span>
                </TabsTrigger>
              )}
            </TabsList>
          );
        })()}

        {/* Participants */}
        <TabsContent value="participants" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {participants?.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`participant-${p.id}`}>
                <Avatar className="w-9 h-9 flex-shrink-0">
                  {p.user.avatarUrl && <AvatarImage src={p.user.avatarUrl} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {p.user.pseudo.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.user.pseudo}</p>
                  <p className="text-xs text-muted-foreground truncate">@{p.user.username}</p>
                </div>
                {p.userId === tournament.creatorId && (
                  <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                {isCreator && tournament.status === "waiting" && p.userId !== user?.id && (
                  <button
                    onClick={() => { if (window.confirm(`Exclure ${p.user.pseudo} du tournoi ?`)) removeParticipantMutation.mutate(p.userId); }}
                    disabled={removeParticipantMutation.isPending}
                    className="p-1.5 rounded-md text-destructive/70 hover:text-destructive active:bg-destructive/10 bg-muted/60 border border-border flex-shrink-0"
                    title="Exclure"
                    data-testid={`button-exclude-${p.userId}`}
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Matches */}
        {matches && matches.length > 0 && (
          <TabsContent value="matches" className="mt-4 space-y-4">
            {tournament.championshipType === "pool" ? (
              <>
                {poolNumbers.map(pn => (
                  <div key={pn}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Poule {pn}</h3>
                    <div className="space-y-2">
                      {matches.filter((m: any) => m.poolNumber === pn).map((m: any) => (
                        <MatchCard key={m.id} match={m} userId={user?.id} isCreator={isCreator} tournamentId={id} />
                      ))}
                    </div>
                  </div>
                ))}
                {hasKnockoutPhase && (() => {
                  const rounds = Array.from(new Set(knockoutMatchesList.map((m: any) => m.roundNumber ?? 1))).sort((a: number, b: number) => a - b);
                  return rounds.map((rn: number) => {
                    const roundMatches = knockoutMatchesList.filter((m: any) => (m.roundNumber ?? 1) === rn);
                    const cnt = roundMatches.length;
                    const roundTitle = cnt >= 8 ? "Huitièmes de finale" : cnt >= 4 ? "Quarts de finale" : cnt >= 2 ? "Demi-finales" : "FINALE";
                    return (
                      <div key={rn}>
                        <h3 className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide flex items-center gap-1.5">
                          <Trophy className="w-4 h-4" /> {roundTitle}
                        </h3>
                        <div className="space-y-2">
                          {roundMatches.map((m: any) => (
                            <MatchCard key={m.id} match={m} userId={user?.id} isCreator={isCreator} tournamentId={id} />
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
                {canDrawKnockout && (
                  <div className="flex items-center gap-2 p-4 rounded-lg border border-primary/20 bg-primary/5 text-sm text-primary">
                    <Trophy className="w-4 h-4 flex-shrink-0" />
                    <span>Tous les matchs de poule sont terminés. Lancez la phase finale depuis les boutons en haut.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {matches.map((m: any) => <MatchCard key={m.id} match={m} userId={user?.id} isCreator={isCreator} tournamentId={id} />)}
              </div>
            )}
          </TabsContent>
        )}

        {/* Standings */}
        {matches && matches.length > 0 && (
          <TabsContent value="standings" className="mt-4">
            {standings && standings.length > 0 ? (
              <div className="space-y-6">
                {tournament.championshipType === "pool" && poolStandings.length > 1 ? (
                  poolStandings.map(pn => (
                    <div key={String(pn)}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Poule {pn}</h3>
                      <StandingsTable rows={standings.filter(s => s.poolNumber === pn)} userId={user?.id} />
                    </div>
                  ))
                ) : (
                  <StandingsTable rows={standings} userId={user?.id} />
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">Aucun résultat enregistré pour l'instant</div>
            )}
          </TabsContent>
        )}

        {/* Chat */}
        {canChat && (
          <TabsContent value="chat" className="mt-4">
            <TournamentChat tournamentId={id} messages={chatMessages || []} userId={user?.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Tournament Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le tournoi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {tournament?.status === "waiting" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Nom du tournoi</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Nom du tournoi..."
                    data-testid="input-edit-tournament-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-description">Description (optionnel)</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Description du tournoi..."
                    rows={3}
                    data-testid="input-edit-tournament-description"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start-date" className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Date de début
                </Label>
                <Input
                  id="edit-start-date"
                  type="datetime-local"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  data-testid="input-edit-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-end-date" className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Date de fin
                </Label>
                <Input
                  id="edit-end-date"
                  type="datetime-local"
                  value={editEndDate}
                  onChange={e => setEditEndDate(e.target.value)}
                  data-testid="input-edit-end-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={!editName.trim() || editMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {editMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le tournoi ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {tournament.status !== "waiting" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-destructive text-lg leading-none mt-0.5">⚠️</span>
                <p className="text-sm text-destructive font-medium">
                  Ce tournoi est {tournament.status === "in_progress" ? "en cours" : "terminé"}. Tous les scores et résultats enregistrés seront définitivement perdus.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Cette action est irréversible. Tous les participants, matchs et scores seront supprimés.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTournamentMutation.mutate()}
              disabled={deleteTournamentMutation.isPending}
              data-testid="button-confirm-delete-tournament"
            >
              {deleteTournamentMutation.isPending ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Proof Upload Modal */}
      <Dialog open={showPaymentModal} onOpenChange={open => { if (!open) { setShowPaymentModal(false); setPaymentProofData(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              Cotisation — {tournament.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Recap montant */}
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Frais d'inscription</p>
                <p className="text-xl font-bold text-primary">{tournament.entryFee?.toLocaleString()} XAF</p>
              </div>
            </div>

            {/* Étapes */}
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Comment procéder</p>

            {/* Étape 1 — Envoyer */}
            <div className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-xs">1</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Envoyez {tournament.entryFee?.toLocaleString()} XAF</p>
                <p className="text-xs text-muted-foreground mb-2">Via Orange Money, Wave ou MTN au numéro ci-dessous</p>
                <div className="bg-muted rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-lg text-foreground tracking-widest">{tournament.entryPaymentNumber}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Organisateur du tournoi</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(tournament.entryPaymentNumber ?? ""); toast({ title: "Numéro copié !" }); }}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 rounded-lg px-2.5 py-1.5 hover:bg-primary/20 transition-colors"
                    data-testid="button-copy-payment-number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copier
                  </button>
                </div>
              </div>
            </div>

            {/* Étape 2 — Upload preuve */}
            <div className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground font-bold text-xs">2</div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Uploadez la preuve <span className="text-red-500">*</span></p>
                  <p className="text-xs text-muted-foreground">Capture d'écran de la transaction confirmée</p>
                </div>
                <input
                  ref={paymentProofRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast({ title: "Fichier trop volumineux", description: "Maximum 5 Mo", variant: "destructive" });
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = ev => setPaymentProofData(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                {paymentProofData ? (
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-500">
                    <img src={paymentProofData} alt="Preuve" className="w-full max-h-48 object-contain bg-black/5" />
                    <button
                      type="button"
                      onClick={() => { setPaymentProofData(null); if (paymentProofRef.current) paymentProofRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-lg px-2 py-1 font-medium"
                    >✕ Supprimer</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs text-center py-1 font-semibold">
                      ✓ Preuve ajoutée
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="payment-proof-input-modal"
                    className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl py-5 px-4 transition-colors select-none"
                    data-testid="button-upload-payment-proof"
                    onClick={() => paymentProofRef.current?.click()}
                  >
                    <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Appuyer pour ajouter la capture</p>
                      <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">JPG, PNG, WEBP — max 5 Mo</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Étape 3 — Attente validation */}
            <div className="flex gap-3 items-center bg-card border border-border rounded-xl p-3">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Validation par l'organisateur</p>
                <p className="text-xs text-muted-foreground">Votre inscription sera confirmée après vérification de la preuve</p>
              </div>
            </div>

            {/* Avertissement fraude */}
            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-red-700 dark:text-red-400 leading-relaxed">
                Toute fraude (fausse preuve, paiement annulé) entraîne le <strong>blocage immédiat et définitif</strong> du compte. <strong>3 rejets</strong> = blocage automatique.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setShowPaymentModal(false); setPaymentProofData(null); }}>Annuler</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-bold"
              disabled={!paymentProofData || joinMutation.isPending}
              onClick={() => paymentProofData && joinMutation.mutate(paymentProofData)}
              data-testid="button-submit-payment"
            >
              <CheckCircle2 className="w-4 h-4" />
              {joinMutation.isPending ? "Envoi en cours..." : "Soumettre ma preuve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchCard({ match, userId, isCreator, tournamentId }: { match: any; userId?: string; isCreator: boolean; tournamentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [correctScore1, setCorrectScore1] = useState("");
  const [correctScore2, setCorrectScore2] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const toDisplayDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const toIsoDate = (display: string) => {
    const [d, m, y] = display.split("/");
    if (!d || !m || !y || y.length < 4) return null;
    return `${y}-${m}-${d}`;
  };
  const [scheduleInput, setScheduleInput] = useState(toDisplayDate(match.matchDate ?? ""));
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const opponentId = userId === match.player1Id ? match.player2Id : match.player1Id;
  const opponent = userId === match.player1Id ? match.player2 : match.player1;
  const isMyMatch = userId === match.player1Id || userId === match.player2Id;

  const isProposed = match.status === "proposed";
  const isDone = match.status === "done";
  const iAmProposer = isProposed && userId === match.proposedBy;
  const canEnterScore = match.status === "pending" && (isMyMatch || isCreator);
  const canConfirm = isProposed && !iAmProposer && (isMyMatch || isCreator);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId, "matches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId, "standings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches/mine"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
  };

  const { data: chatMessages } = useQuery<any[]>({
    queryKey: ["/api/messages", opponentId, "match"],
    queryFn: () => fetch(`/api/messages/${opponentId}`).then(r => r.json()),
    enabled: showChat && isMyMatch && !!opponentId,
    refetchInterval: showChat ? 4000 : false,
  });

  const sendChatMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/messages", { receiverId: opponentId, content: chatInput.trim() }),
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", opponentId, "match"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (showChat) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [chatMessages, showChat]);

  const scheduleMutation = useMutation({
    mutationFn: (value: string | null) => apiRequest("PATCH", `/api/matches/${match.id}/schedule`, { matchDate: value }),
    onSuccess: () => {
      invalidateAll();
      setShowSchedule(false);
      toast({ title: "Date enregistrée !", description: "Les deux joueurs ont été notifiés." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });


  const correctMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/matches/${match.id}/correct-score`, {
      score1: parseInt(correctScore1), score2: parseInt(correctScore2),
    }),
    onSuccess: (data: any) => {
      invalidateAll();
      setShowCorrectForm(false);
      setCorrectScore1("");
      setCorrectScore2("");
      const remaining = data?.correctionsRemaining ?? 0;
      toast({ title: "Score rectifié !", description: remaining > 0 ? `Il vous reste ${remaining} rectification(s).` : "Aucune rectification possible pour ce match." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: "Fichier trop grand", description: "Maximum 30 Mo", variant: "destructive" });
      return;
    }

    const applyOriginal = (dataUrl: string) => {
      setProofBase64(dataUrl);
      setProofPreview(dataUrl);
    };

    const compressAndSet = (dataUrl: string) => {
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
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { applyOriginal(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.80);
          if (compressed.length < 100) { applyOriginal(dataUrl); return; }
          setProofBase64(compressed);
          setProofPreview(compressed);
        } catch {
          applyOriginal(dataUrl);
        }
      };
      img.onerror = () => applyOriginal(dataUrl);
      img.src = dataUrl;
    };

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      compressAndSet(dataUrl);
    };
    reader.onerror = () => {
      toast({ title: "Erreur de lecture", description: "Impossible de lire ce fichier", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/matches/${match.id}/score`, {
      score1: parseInt(score1), score2: parseInt(score2),
      proofUrl: proofBase64 || undefined,
    }),
    onSuccess: (data: any) => {
      invalidateAll();
      setShowScoreForm(false);
      setProofBase64(null);
      setProofPreview(null);
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
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Score confirmé !", description: "Le résultat est enregistré." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${match.id}/reject-score`, {}),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Score contesté", description: "L'adversaire sera notifié." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <div className={`rounded-lg border overflow-hidden ${isProposed ? "border-amber-300 bg-amber-500/5" : "border-border"}`} data-testid={`match-${match.id}`}>
        {/* Players row — names + score only, no action buttons */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{match.player1.pseudo.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">{match.player1.pseudo}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2 flex-shrink-0">
            {isDone ? (
              <span className="text-lg font-bold font-mono">{match.score1} - {match.score2}</span>
            ) : isProposed ? (
              <div className="text-center">
                <span className="text-base font-bold font-mono text-amber-600">{match.proposedScore1} - {match.proposedScore2}</span>
                <p className="text-[10px] text-amber-600 font-medium leading-none mt-0.5">proposé</p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">vs</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-medium truncate text-right">{match.player2.pseudo}</span>
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs bg-blue-500/10 text-blue-500">{match.player2.pseudo.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Action bar — status icons + buttons */}
        <div className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-border/50 pt-2">
          <div className="flex items-center gap-1 flex-1 flex-wrap">
            {isDone && <CheckCircle className="w-4 h-4 text-green-500" />}
            {isDone && isCreator && (match.correctionCount ?? 0) < 2 && (
              <span className="text-[10px] text-muted-foreground ml-1">{2 - (match.correctionCount ?? 0)} rectif. restante{2 - (match.correctionCount ?? 0) > 1 ? "s" : ""}</span>
            )}
            {isProposed && iAmProposer && <Hourglass className="w-4 h-4 text-amber-500" />}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isMyMatch && (
              <button
                onClick={() => setShowChat(p => !p)}
                className={`p-1.5 rounded-md transition-colors ${showChat ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                title="Chat avec l'adversaire"
                data-testid={`button-chat-${match.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
            {isCreator && !isDone && (
              <button
                onClick={() => { setScheduleInput(toDisplayDate(match.matchDate ?? "")); setShowSchedule(!showSchedule); }}
                className={`p-1.5 rounded-md transition-colors ${showSchedule ? "bg-primary/10 text-primary" : match.matchDate ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                title="Fixer la date du match"
                data-testid={`button-schedule-${match.id}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
              </button>
            )}
            {isDone && isCreator && (match.correctionCount ?? 0) < 2 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                onClick={() => { setCorrectScore1(String(match.score1 ?? "")); setCorrectScore2(String(match.score2 ?? "")); setShowCorrectForm(p => !p); }}
                data-testid={`button-correct-score-${match.id}`}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Rectifier
              </Button>
            )}
            {isProposed && match.proofUrl && (
              <button onClick={() => setShowProof(true)} className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Voir la preuve" data-testid={`button-proof-${match.id}`}>
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
            {canEnterScore && !isProposed && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowScoreForm(!showScoreForm)} data-testid={`button-score-${match.id}`}>
                Saisir
              </Button>
            )}
          </div>
        </div>

        {/* Date / schedule info display */}
        {(match.scheduledAt || match.matchDate) && !showSchedule && (
          <div className="px-3 pb-2">
            {match.scheduledAt ? (
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-2 py-1">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Match programmé : <strong>{new Date(match.scheduledAt).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="w-3 h-3 text-primary" />
                <span>Date fixée : <strong className="text-foreground">{new Date(match.matchDate).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Organizer: date picker */}
        {showSchedule && (
          <div className="px-3 pb-3 pt-2 border-t border-border space-y-2">
            <p className="text-xs font-medium flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-primary" />Fixer la date du match</p>
            <div className="flex gap-2 items-center">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="JJ/MM/AAAA"
                maxLength={10}
                value={scheduleInput}
                onChange={e => {
                  let v = e.target.value.replace(/[^0-9/]/g, "");
                  if (v.length === 2 && !v.includes("/") && scheduleInput.length === 1) v = v + "/";
                  if (v.length === 5 && v.split("/").length === 2 && scheduleInput.length === 4) v = v + "/";
                  setScheduleInput(v);
                }}
                className="text-sm flex-1 font-mono"
                data-testid={`input-schedule-${match.id}`}
              />
              <Button
                size="sm"
                onClick={() => {
                  const iso = toIsoDate(scheduleInput);
                  scheduleMutation.mutate(iso);
                }}
                disabled={scheduleMutation.isPending || !/^\d{2}\/\d{2}\/\d{4}$/.test(scheduleInput)}
                data-testid={`button-confirm-schedule-${match.id}`}
              >
                {scheduleMutation.isPending ? "…" : "OK"}
              </Button>
              {match.matchDate && (
                <Button size="sm" variant="outline" onClick={() => scheduleMutation.mutate(null)} disabled={scheduleMutation.isPending} className="text-xs text-destructive border-destructive/30">
                  Retirer
                </Button>
              )}
            </div>
          </div>
        )}


        {/* Proposed score — confirm/reject panel */}
        {isProposed && canConfirm && (
          <div className="px-3 pb-3 pt-0 border-t border-amber-200 bg-amber-500/5">
            <p className="text-xs text-amber-700 font-medium mt-2 mb-2">
              {iAmProposer ? "En attente de confirmation…" : "L'adversaire a proposé ce score. Confirmez-vous ?"}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || rejectMutation.isPending}
                data-testid={`button-confirm-score-${match.id}`}
              >
                <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                {confirmMutation.isPending ? "…" : "Confirmer"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={() => rejectMutation.mutate()}
                disabled={confirmMutation.isPending || rejectMutation.isPending}
                data-testid={`button-reject-score-${match.id}`}
              >
                <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                {rejectMutation.isPending ? "…" : "Contester"}
              </Button>
            </div>
          </div>
        )}

        {/* Proposer waiting banner */}
        {isProposed && iAmProposer && (
          <div className="px-3 pb-3 pt-0 border-t border-amber-200">
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
              <Hourglass className="w-3 h-3" />
              Score proposé — en attente de confirmation par l'adversaire
            </p>
          </div>
        )}

        {/* Score entry form */}
        {showScoreForm && (
          <div className="px-3 pb-3 pt-0 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2 mt-2">
              {isCreator ? "Entrer le score final (enregistrement direct)" : "Proposer le score final"}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-muted-foreground truncate max-w-16">{match.player1.pseudo}</span>
                <Input type="number" min="0" max="99" placeholder="0" value={score1} onChange={e => setScore1(e.target.value)}
                  className="h-8 w-16 text-center font-bold" data-testid={`input-score1-${match.id}`} />
              </div>
              <span className="text-muted-foreground font-bold">-</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <Input type="number" min="0" max="99" placeholder="0" value={score2} onChange={e => setScore2(e.target.value)}
                  className="h-8 w-16 text-center font-bold" data-testid={`input-score2-${match.id}`} />
                <span className="text-xs text-muted-foreground truncate max-w-16 text-right">{match.player2.pseudo}</span>
              </div>
            </div>
            {/* Photo de preuve — OBLIGATOIRE (joueurs uniquement) */}
            {!isCreator && (
              <div className="mb-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-orange-500" />
                  <p className="text-xs font-semibold text-foreground">
                    Photo de preuve <span className="text-red-500 font-bold">* obligatoire</span>
                  </p>
                </div>
                <input
                  id={`proof-input-${match.id}`}
                  ref={fileInputRef}
                  type="file"
                  accept="image/*, .heic, .heif, .webp, .avif, .jpg, .jpeg, .png, .gif, .bmp, .tiff"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid={`input-proof-${match.id}`}
                />
                {proofPreview ? (
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-green-500">
                    <img src={proofPreview} alt="Preuve" className="w-full max-h-40 object-contain bg-black/5" />
                    <button
                      onClick={() => { setProofBase64(null); setProofPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-lg px-2 py-1 font-medium"
                    >✕ Supprimer</button>
                    <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs text-center py-1 font-semibold">
                      ✓ Photo ajoutée
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor={`proof-input-${match.id}`}
                    className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl py-4 px-4 transition-colors select-none"
                    data-testid={`button-upload-proof-${match.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Appuyer pour ajouter une photo</p>
                      <p className="text-[11px] text-orange-600/70 dark:text-orange-500/70 mt-0.5">Capture d'écran du score final du match</p>
                    </div>
                  </label>
                )}
              </div>
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={() => scoreMutation.mutate()}
              disabled={scoreMutation.isPending || score1 === "" || score2 === "" || (!isCreator && !proofBase64)}
              data-testid={`button-submit-score-${match.id}`}
            >
              {scoreMutation.isPending ? "…" : isCreator ? "Enregistrer" : "Proposer le score"}
            </Button>
          </div>
        )}

        {/* Score correction form — creator only, max 2 times */}
        {showCorrectForm && isDone && isCreator && (
          <div className="px-3 pb-3 pt-0 border-t border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
            <p className="text-xs text-orange-600 dark:text-orange-400 mb-2 mt-2 font-medium flex items-center gap-1.5">
              <Pencil className="w-3 h-3" />
              Rectifier le score ({2 - (match.correctionCount ?? 0)} rectification{2 - (match.correctionCount ?? 0) > 1 ? "s" : ""} restante{2 - (match.correctionCount ?? 0) > 1 ? "s" : ""})
            </p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-muted-foreground truncate max-w-16">{match.player1.pseudo}</span>
                <Input type="number" min="0" max="99" placeholder="0" value={correctScore1} onChange={e => setCorrectScore1(e.target.value)}
                  className="h-8 w-16 text-center font-bold border-orange-300 focus:border-orange-500" data-testid={`input-correct-score1-${match.id}`} />
              </div>
              <span className="text-muted-foreground font-bold">-</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <Input type="number" min="0" max="99" placeholder="0" value={correctScore2} onChange={e => setCorrectScore2(e.target.value)}
                  className="h-8 w-16 text-center font-bold border-orange-300 focus:border-orange-500" data-testid={`input-correct-score2-${match.id}`} />
                <span className="text-xs text-muted-foreground truncate max-w-16 text-right">{match.player2.pseudo}</span>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => correctMutation.mutate()}
              disabled={correctMutation.isPending || correctScore1 === "" || correctScore2 === ""}
              data-testid={`button-submit-correct-score-${match.id}`}
            >
              {correctMutation.isPending ? "…" : "Confirmer la rectification"}
            </Button>
          </div>
        )}
      </div>

      {/* Match chat panel */}
      {showChat && isMyMatch && (
        <div className="border border-border rounded-lg overflow-hidden mt-2 bg-background shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium flex-1">Chat avec <span className="text-primary">{opponent?.pseudo ?? "l'adversaire"}</span></span>
            <button onClick={() => setShowChat(false)} className="text-muted-foreground hover:text-foreground text-xs" data-testid={`button-close-chat-${match.id}`}>✕</button>
          </div>
          <ScrollArea className="h-48 px-3 py-2">
            {!chatMessages || chatMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-8">Aucun message. Commencez la conversation !</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {chatMessages.map((msg: any) => {
                  const isMe = msg.senderId === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`} data-testid={`msg-${msg.id}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs leading-relaxed ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/20">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) { e.preventDefault(); sendChatMutation.mutate(); }}}
              placeholder="Écrire un message…"
              className="h-8 text-xs flex-1"
              data-testid={`input-chat-${match.id}`}
            />
            <Button
              size="sm"
              className="h-8 px-2.5"
              onClick={() => sendChatMutation.mutate()}
              disabled={sendChatMutation.isPending || !chatInput.trim()}
              data-testid={`button-send-chat-${match.id}`}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Proof image dialog */}
      {match.proofUrl && (
        <Dialog open={showProof} onOpenChange={setShowProof}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Preuve du score {match.proposedScore1} - {match.proposedScore2}</DialogTitle>
            </DialogHeader>
            <img src={match.proofUrl} alt="Preuve" className="w-full rounded-md border border-border" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function StandingsTable({ rows, userId }: { rows: any[]; userId?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left py-2 px-2 sm:p-3 font-medium text-muted-foreground w-7">#</th>
            <th className="text-left py-2 px-2 sm:p-3 font-medium text-muted-foreground">Joueur</th>
            <th className="text-center py-2 px-1.5 sm:p-3 font-medium text-muted-foreground">J</th>
            <th className="text-center py-2 px-1.5 sm:p-3 font-medium text-muted-foreground text-green-600">V</th>
            <th className="hidden sm:table-cell text-center py-2 px-1.5 sm:p-3 font-medium text-muted-foreground">N</th>
            <th className="text-center py-2 px-1.5 sm:p-3 font-medium text-muted-foreground text-red-500">D</th>
            <th className="hidden sm:table-cell text-center py-2 px-1.5 sm:p-3 font-medium text-muted-foreground">BP</th>
            <th className="hidden sm:table-cell text-center py-2 px-1.5 sm:p-3 font-medium text-muted-foreground">BC</th>
            <th className="text-center py-2 px-1.5 sm:p-3 font-semibold text-primary">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isMe = row.userId === userId;
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
            return (
              <tr
                key={row.userId}
                className={`border-b border-border last:border-0 transition-colors ${isMe ? "bg-primary/5" : "hover:bg-muted/30"}`}
                data-testid={`standing-${row.userId}`}
              >
                <td className="py-2 px-2 sm:p-3 text-muted-foreground font-medium text-center w-7">
                  {medal ? <span>{medal}</span> : <span>{idx + 1}</span>}
                </td>
                <td className="py-2 px-2 sm:p-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0">
                      {row.avatarUrl && <AvatarImage src={row.avatarUrl} />}
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{row.pseudo.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className={`truncate max-w-[90px] sm:max-w-none ${isMe ? "font-semibold text-primary" : ""}`}>{row.pseudo}</span>
                  </div>
                </td>
                <td className="py-2 px-1.5 sm:p-3 text-center text-muted-foreground">{row.played}</td>
                <td className="py-2 px-1.5 sm:p-3 text-center text-green-600 font-medium">{row.wins}</td>
                <td className="hidden sm:table-cell py-2 px-1.5 sm:p-3 text-center text-muted-foreground">{row.draws}</td>
                <td className="py-2 px-1.5 sm:p-3 text-center text-red-500">{row.losses}</td>
                <td className="hidden sm:table-cell py-2 px-1.5 sm:p-3 text-center">{row.goalsFor}</td>
                <td className="hidden sm:table-cell py-2 px-1.5 sm:p-3 text-center text-muted-foreground">{row.goalsAgainst}</td>
                <td className="py-2 px-1.5 sm:p-3 text-center font-bold text-primary">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TournamentChat({ tournamentId, messages, userId }: { tournamentId: string; messages: any[]; userId?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tournaments/${tournamentId}/chat`, { content: message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId, "chat"] });
      setMessage("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) sendMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-96 border border-border rounded-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Aucun message. Soyez le premier à écrire !
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.userId === userId;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`} data-testid={`chat-msg-${msg.id}`}>
                <Avatar className="w-7 h-7 flex-shrink-0">
                  {msg.user?.avatarUrl && <AvatarImage src={msg.user.avatarUrl} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{msg.user?.pseudo?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={`max-w-xs ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                  {!isMe && <span className="text-xs text-muted-foreground mb-1">{msg.user?.pseudo}</span>}
                  <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-border bg-background flex gap-2">
        <Input
          placeholder="Écrire un message..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="input-chat-message"
          className="flex-1"
        />
        <Button size="icon" onClick={() => message.trim() && sendMutation.mutate()} disabled={sendMutation.isPending || !message.trim()} data-testid="button-send-chat">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface TournamentDetailsPanelProps {
  tournament: any;
  participants: any[] | undefined;
  limit: number | null;
  gameTypeLabels: Record<string, string>;
  formLabels: Record<string, string>;
}

function TournamentDetailsPanel({ tournament, participants, limit, gameTypeLabels, formLabels }: TournamentDetailsPanelProps) {
  const [open, setOpen] = useState(tournament.status === "waiting");

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        data-testid="button-toggle-details"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold">Détails du championnat</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{gameTypeLabels[tournament.gameType] || tournament.gameType}</span>
            <span>·</span>
            <span>{participants?.length ?? 0}{limit ? `/${limit}` : ""} joueurs</span>
            <span>·</span>
            <span>{tournament.gameTime} min</span>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="p-4 flex flex-col gap-4 border-t border-border bg-background">
          {/* Info chips row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1.5 bg-muted/40 rounded-xl p-3 text-center">
              <Gamepad2 className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Plateforme</span>
              <span className="text-sm font-bold leading-tight">{gameTypeLabels[tournament.gameType] || tournament.gameType}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 bg-muted/40 rounded-xl p-3 text-center">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Durée</span>
              <span className="text-sm font-bold">{tournament.gameTime} min</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 bg-muted/40 rounded-xl p-3 text-center">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Joueurs</span>
              <span className="text-sm font-bold">{participants?.length ?? 0}{limit ? `/${limit}` : ""}</span>
            </div>
          </div>

          {/* Rules grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col gap-0.5 bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Type</span>
              <span className="font-semibold">{tournament.championshipType === "pool" ? "Poules" : "Ligue"}</span>
            </div>
            <div className="flex flex-col gap-0.5 bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Forme</span>
              <span className="font-semibold">{formLabels[tournament.gameForm] || tournament.gameForm}</span>
            </div>
            <div className="flex flex-col gap-0.5 bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Prolongations</span>
              <span className={`font-semibold ${tournament.extraTime ? "text-primary" : "text-muted-foreground"}`}>{tournament.extraTime ? "Oui" : "Non"}</span>
            </div>
            <div className="flex flex-col gap-0.5 bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Penaltys</span>
              <span className={`font-semibold ${tournament.penalties ? "text-primary" : "text-muted-foreground"}`}>{tournament.penalties ? "Oui" : "Non"}</span>
            </div>
            {tournament.numPools && (
              <div className="flex flex-col gap-0.5 bg-muted/30 rounded-lg px-3 py-2">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Nb. poules</span>
                <span className="font-semibold">{tournament.numPools}</span>
              </div>
            )}
            {tournament.playersPerPool && (
              <div className="flex flex-col gap-0.5 bg-muted/30 rounded-lg px-3 py-2">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Joueurs/poule</span>
                <span className="font-semibold">{tournament.playersPerPool}</span>
              </div>
            )}
          </div>

          {tournament.otherRules && (
            <div className="bg-muted/30 rounded-lg px-3 py-2.5">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Règles supplémentaires</p>
              <p className="text-sm">{tournament.otherRules}</p>
            </div>
          )}

          {(tournament.startDate || tournament.endDate) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {tournament.startDate && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5 text-primary" />
                  <span>Début : <strong className="text-foreground">{new Date(tournament.startDate).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
                </span>
              )}
              {tournament.endDate && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5 text-destructive" />
                  <span>Fin : <strong className="text-foreground">{new Date(tournament.endDate).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

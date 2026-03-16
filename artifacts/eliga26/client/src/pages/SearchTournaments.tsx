import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Search, Lock, Globe, Users, Gamepad2, Clock, Trophy, CheckCircle2, LogIn, Sparkles, Star, Shield, Coins, Sword, ScanLine, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import jsQR from "jsqr";
import { useLocale } from "@/lib/locale";

function QrScannerModal({ open, onClose, onDetected }: { open: boolean; onClose: () => void; onDetected: (code: string) => void }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<"loading" | "scanning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setStatus("loading");
      setErrorMsg("");
      detectedRef.current = false;
      return;
    }

    detectedRef.current = false;
    let active = true;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !active || detectedRef.current) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code) {
        const match = code.data.trim().match(/\d{6}/);
        if (match) {
          detectedRef.current = true;
          active = false;
          onDetected(match[0]);
          onClose();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(scanFrame);
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            if (active) setStatus("scanning");
            rafRef.current = requestAnimationFrame(scanFrame);
          };
        }
      } catch {
        if (active) {
          setStatus("error");
          setErrorMsg(t("search.qr_error"));
        }
      }
    };

    start();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" />
            {t("search.qr_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-3">
          {status === "error" ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center space-y-2">
              <p className="text-sm text-destructive font-medium">{errorMsg}</p>
              <p className="text-xs text-muted-foreground">{t("search.qr_manual")}</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border-2 border-primary/30 bg-black" style={{ minHeight: 300 }}>
              {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3 text-white/70">
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <p className="text-sm">{t("search.qr_starting")}</p>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                data-testid="qr-video"
                style={{ minHeight: 280 }}
              />
              <canvas ref={canvasRef} className="hidden" />
              {status === "scanning" && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-52 h-52 border-2 border-primary rounded-2xl" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                      {t("search.qr_point")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={onClose} data-testid="button-close-scanner">
            <X className="w-4 h-4" /> {t("search.qr_close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SearchTournaments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [privateCode, setPrivateCode] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [foundTournament, setFoundTournament] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const autoJoinRef = useRef(false);

  const { data: publicTournaments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/tournaments/public"],
  });

  const { data: joinedTournaments } = useQuery<any[]>({
    queryKey: ["/api/tournaments/joined"],
  });

  const { data: myStats } = useQuery<any>({
    queryKey: ["/api/stats/me"],
    enabled: !!user,
  });

  const { data: openChallenges = [] } = useQuery<any[]>({
    queryKey: ["/api/challenges/open"],
    refetchInterval: 20000,
  });

  const acceptChallengeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/challenges/${id}/accept`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/me"] });
      toast({ title: "Défi accepté !", description: "Le challenger a été notifié." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const myStars = myStats?.stars ?? 0;
  const myCoins = myStats?.coins ?? 0;

  const joinedIds = new Set((joinedTournaments ?? []).map((t: any) => t.id));

  const joinMutation = useMutation({
    mutationFn: (tournamentId: string) => apiRequest("POST", `/api/tournaments/${tournamentId}/join`, {}),
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/joined"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/public"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId, "participants"] });
      setJoiningId(null);
      toast({ title: "Inscrit !", description: "Vous participez maintenant à ce tournoi." });
      navigate(`/tournaments/${tournamentId}`);
    },
    onError: (e: any) => {
      setJoiningId(null);
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: (code: string) => apiRequest("POST", "/api/tournaments/search-private", { code }),
    onSuccess: (data: any) => {
      if (autoJoinRef.current) {
        autoJoinRef.current = false;
        const alreadyJoined = joinedTournaments?.some((t: any) => t.id === data.id);
        if (alreadyJoined) {
          navigate(`/tournaments/${data.id}`);
        } else {
          joinMutation.mutate(data.id);
        }
      } else {
        setFoundTournament(data);
      }
    },
    onError: (e: any) => {
      autoJoinRef.current = false;
      toast({ title: "Introuvable", description: e.message, variant: "destructive" });
    },
  });

  const handleJoin = (e: React.MouseEvent, tournamentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setJoiningId(tournamentId);
    joinMutation.mutate(tournamentId);
  };

  const statusColor: Record<string, string> = {
    waiting: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-primary/10 text-primary",
    finished: "bg-muted text-muted-foreground",
  };

  const statusLabel: Record<string, string> = {
    waiting: "En attente", in_progress: "En cours", finished: "Terminé",
  };

  const gameTypeLabels: Record<string, string> = { ps: "PS", xbox: "Xbox", mobile: "Mobile" };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Rechercher des tournois</h1>
          <p className="text-sm text-muted-foreground">Trouvez et rejoignez des compétitions</p>
        </div>
      </div>

      {/* Private code search */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Accéder à un tournoi privé</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Code à 6 chiffres..."
              value={privateCode}
              onChange={e => setPrivateCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              className="font-mono text-center text-lg tracking-widest"
              data-testid="input-private-code"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowScanner(true)}
              className="flex-shrink-0 border-primary/40 text-primary hover:bg-primary/10"
              data-testid="button-scan-qr"
              title="Scanner un QR code"
            >
              <ScanLine className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => searchMutation.mutate(privateCode)}
              disabled={privateCode.length !== 6 || searchMutation.isPending}
              data-testid="button-search-private"
            >
              {searchMutation.isPending ? "..." : "Chercher"}
            </Button>
          </div>
          {foundTournament && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium mb-1">{foundTournament.name}</p>
              <p className="text-xs text-muted-foreground mb-2">Par {foundTournament.creator?.pseudo} • {foundTournament.participantCount} joueurs</p>
              <Link href={`/tournaments/${foundTournament.id}`}>
                <Button size="sm" data-testid="button-view-private-tournament">Voir le tournoi</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <QrScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={(code) => {
          setShowScanner(false);
          setPrivateCode(code);
          autoJoinRef.current = true;
          searchMutation.mutate(code);
        }}
      />

      {/* Public tournaments */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Tournois publics</h2>
          <Badge variant="outline">{publicTournaments?.length ?? 0}</Badge>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
          </div>
        ) : publicTournaments?.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun tournoi public pour l'instant</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {publicTournaments?.map(t => {
              const isJoined = joinedIds.has(t.id);
              const isCreator = t.creatorId === user?.id;
              const limit = t.playerLimit || (t.numPools && t.playersPerPool ? t.numPools * t.playersPerPool : null);
              const isFull = limit ? t.participantCount >= limit : false;
              const isOfficial = !!t.creator?.isAdmin;
              const requiredStars = t.minStars ?? 0;
              const notEnoughStars = (requiredStars > 0 && myStars < requiredStars);
              const warnLowCoins = !notEnoughStars && (
                (isOfficial && myCoins === 0 && myStars === 0) ||
                (t.isPaid && myCoins === 0 && myStars === 0)
              );
              const showBuyCoinsPrompt = notEnoughStars || warnLowCoins;
              const coinsNeeded = Math.max(0, (requiredStars - myStars)) * 300;
              const canJoin = t.status === "waiting" && !isJoined && !isCreator && !isFull && !user?.isAdmin && !notEnoughStars;
              const isThisJoining = joiningId === t.id;

              return (
                <div key={t.id} className={`rounded-lg border hover-elevate overflow-hidden ${isOfficial ? "border-primary/60 shadow-md shadow-primary/10 bg-gradient-to-br from-primary/5 to-indigo-50/30 dark:from-primary/10 dark:to-indigo-950/20 dark:border-primary/40" : t.isSponsored ? "border-amber-300 bg-amber-50/20 dark:bg-amber-900/10 dark:border-amber-700" : t.isElite ? "border-yellow-300 bg-yellow-50/20 dark:bg-yellow-900/10 dark:border-yellow-700" : "border-border"}`} data-testid={`public-tournament-${t.id}`}>
                  {/* Official admin banner — full-width strip */}
                  {isOfficial && (
                    <div className="bg-primary px-3 py-1.5 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-primary-foreground flex-shrink-0" />
                      <span className="text-[11px] font-bold text-primary-foreground tracking-wide uppercase">Officiel eLIGA</span>
                      <span className="ml-auto text-[10px] text-primary-foreground/70">✓ Certifié</span>
                    </div>
                  )}
                  <Link href={`/tournaments/${t.id}`}>
                    <div className="p-4 cursor-pointer">
                      {t.isSponsored && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {t.sponsorLogo && <img src={t.sponsorLogo} alt={t.sponsorName} className="h-4 object-contain rounded" onError={e => (e.currentTarget.style.display="none")} />}
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {t.sponsorName ? `Sponsorisé par ${t.sponsorName}` : "Tournoi sponsorisé"}
                          </span>
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" />
                            4★ – 5★
                          </span>
                          {t.prizeInfo && <span className="ml-auto text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">🏆 {t.prizeInfo}</span>}
                        </div>
                      )}
                      {t.isElite && !t.isSponsored && (
                        <div className="flex items-center gap-1 mb-2">
                          {[1,2,3,4,5].map((s: number) => <Star key={s} className={`w-3 h-3 ${s <= (t.minStars ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />)}
                          <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 ml-1">Élite · {t.minStars}★ min</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className={`font-semibold text-sm leading-tight ${isOfficial ? "text-primary" : ""}`}>{t.name}</h3>
                        <Badge className={`text-xs flex-shrink-0 ${statusColor[t.status]}`}>
                          {statusLabel[t.status] || t.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Avatar className="w-5 h-5 flex-shrink-0">
                          {t.creator?.avatarUrl && <AvatarImage src={t.creator.avatarUrl} alt={t.creator.pseudo} />}
                          <AvatarFallback className="text-[9px] font-bold">{t.creator?.pseudo?.charAt(0) ?? "?"}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-muted-foreground truncate">
                          Par <span className={`font-medium ${isOfficial ? "text-primary" : "text-foreground"}`}>{t.creator?.pseudo}</span>
                          {isOfficial && <Shield className="w-3 h-3 text-primary inline ml-1 mb-0.5" />}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {t.participantCount}{limit ? `/${limit}` : ""} joueurs
                        </span>
                        <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> {gameTypeLabels[t.gameType] || t.gameType}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.gameTime} min</span>
                        <span className="flex items-center gap-1">{t.championshipType === "pool" ? "Poules" : "Ligue"}</span>
                      </div>

                      {/* Prize pool mini-card — paid tournaments only */}
                      {t.isPaid && t.entryFee > 0 && (() => {
                        const pool = t.entryFee * t.participantCount;
                        const winner = pool - Math.floor(pool * 0.30) - Math.floor(pool * 0.20);
                        const projPool = limit ? t.entryFee * limit : null;
                        const projWinner = projPool ? projPool - Math.floor(projPool * 0.30) - Math.floor(projPool * 0.20) : null;
                        return (
                          <div className="mt-3 rounded-lg border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2" data-testid={`prize-pool-mini-${t.id}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Trophy className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Cagnotte</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black text-amber-700 dark:text-amber-300">{pool.toLocaleString()} XAF</span>
                                {projPool && projPool !== pool && (
                                  <span className="text-[10px] text-amber-500/70 dark:text-amber-400/50 ml-1">/ {projPool.toLocaleString()} XAF</span>
                                )}
                              </div>
                            </div>
                            {limit && (
                              <div className="w-full bg-amber-200/50 dark:bg-amber-800/30 rounded-full h-1 mb-1.5 overflow-hidden">
                                <div
                                  className="bg-amber-500 dark:bg-amber-400 h-1 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (t.participantCount / limit) * 100)}%` }}
                                />
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-amber-600/80 dark:text-amber-400/70">{t.participantCount} × {t.entryFee.toLocaleString()} XAF</span>
                              <div className="flex items-center gap-2">
                                <span className="text-amber-700 dark:text-amber-300 font-semibold">🥇 {winner.toLocaleString()} XAF</span>
                                {projWinner && projWinner !== winner && (
                                  <span className="text-amber-500/60">→ {projWinner.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Link>

                  {/* Action row */}
                  {notEnoughStars && t.status === "waiting" && !isJoined && !isCreator && !user?.isAdmin ? (
                    /* BLOCKED: not enough stars — must buy coins to unlock */
                    <div className="px-4 pb-3" data-testid={`not-enough-stars-${t.id}`}>
                      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2 mb-2">
                        <Coins className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex-1 leading-tight">
                          Il vous faut <strong>{requiredStars}★</strong> pour participer (vous avez <strong>{myStars}★</strong>).{" "}
                          {myCoins >= coinsNeeded && coinsNeeded > 0
                            ? <>Vous avez assez de pièces pour convertir en étoile.</>
                            : <>Achetez des pièces pour obtenir des étoiles.</>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href="/market?tab=coins" className="flex-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button size="sm" className="w-full gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" data-testid={`button-buy-coins-${t.id}`}>
                            <Coins className="w-3.5 h-3.5" />
                            {myCoins >= coinsNeeded && coinsNeeded > 0 ? `Convertir ${coinsNeeded}p → étoile` : `Acheter des pièces`}
                          </Button>
                        </Link>
                        <Link href={`/tournaments/${t.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${t.id}`}>Voir</Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 pb-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {canJoin ? (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => handleJoin(e, t.id)}
                            disabled={isThisJoining}
                            data-testid={`button-join-${t.id}`}
                          >
                            <LogIn className="w-3.5 h-3.5 mr-1.5" />
                            {isThisJoining ? "Inscription..." : "Participer"}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-medium flex-1">
                            {(isJoined || isCreator) ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                <span className="text-green-600">{isCreator ? "Organisateur" : "Inscrit"}</span>
                              </>
                            ) : isFull ? (
                              <span className="flex items-center gap-1 text-destructive font-semibold">
                                <span>🚫</span> Limite atteinte ({t.participantCount}/{limit})
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {t.status === "in_progress" ? "En cours" : "Terminé"}
                              </span>
                            )}
                          </div>
                        )}
                        <Link href={`/tournaments/${t.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" data-testid={`button-view-${t.id}`}>Voir</Button>
                        </Link>
                      </div>

                      {/* Soft suggestion: buy coins to boost profile */}
                      {warnLowCoins && t.status === "waiting" && !isJoined && !isCreator && !user?.isAdmin && (
                        <Link href="/market?tab=coins" onClick={(e: React.MouseEvent) => e.stopPropagation()} data-testid={`link-boost-coins-${t.id}`}>
                          <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-1.5 hover:border-yellow-400 transition-colors cursor-pointer">
                            <Coins className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                            <p className="text-[11px] text-yellow-700 dark:text-yellow-400 font-medium flex-1 leading-tight">
                              {t.isPaid
                                ? <>Boostez votre profil avec des <strong>pièces</strong> pour mieux vous démarquer dans ce tournoi.</>
                                : <>Achetez des <strong>pièces</strong> pour débloquer des étoiles et accéder aux tournois premium.</>
                              }
                            </p>
                            <span className="text-[10px] font-bold text-yellow-600 whitespace-nowrap">Acheter →</span>
                          </div>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Public Challenges Section */}
      {openChallenges.filter((c: any) => c.challengerId !== user?.id).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-green-600" />
            <h2 className="font-semibold">Défis publics</h2>
            <Badge variant="outline">{openChallenges.filter((c: any) => c.challengerId !== user?.id).length}</Badge>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {openChallenges.filter((c: any) => c.challengerId !== user?.id).map((c: any) => {
              const isDirected = !!c.opponentId;
              const isDesignatedOpponent = c.opponentId === user?.id;
              const canAccept = !isDirected || isDesignatedOpponent;
              return (
                <div key={c.id} className="border rounded-xl bg-card p-4 space-y-3" data-testid={`card-search-challenge-${c.id}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      {c.challengerAvatar && <AvatarImage src={c.challengerAvatar} className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {(c.challengerPseudo ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{c.challengerPseudo}</p>
                        {isDirected && (
                          <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium flex-shrink-0">
                            → {c.opponentPseudo ?? "joueur ciblé"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {c.proposedDate} à {c.proposedTime}
                      </p>
                    </div>
                    {c.coinBet > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5 flex-shrink-0">
                        <Coins className="w-3 h-3" /> {c.coinBet}
                      </span>
                    )}
                  </div>
                  {c.message && (
                    <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-2 py-1.5">"{c.message}"</p>
                  )}
                  {c.teamPhotoUrl && (
                    <img src={c.teamPhotoUrl} alt="Équipe" className="rounded-lg w-full max-h-24 object-cover border" />
                  )}
                  {canAccept ? (
                    <button
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      onClick={() => acceptChallengeMutation.mutate(c.id)}
                      disabled={acceptChallengeMutation.isPending}
                      data-testid={`button-accept-search-challenge-${c.id}`}
                    >
                      <Sword className="w-4 h-4" /> {isDesignatedOpponent ? "Accepter ce défi" : "Relever le défi"}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg py-2">
                      <Lock className="w-3 h-3" />
                      Réservé à <strong className="ml-0.5">{c.opponentPseudo}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

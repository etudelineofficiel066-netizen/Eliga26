import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Trophy, Swords, Target, TrendingUp, Shield, Minus, Star,
  Lock, CheckCircle2, Sparkles, Banknote, ChevronRight, Flame, Zap, Medal
} from "lucide-react";

const TIERS = [
  {
    stars: 0, level: "Débutant", color: "text-muted-foreground", bg: "bg-muted",
    borderColor: "border-muted-foreground/20",
    matches: 0, winRate: 0,
    unlocks: "Tournois standards uniquement",
    unlocksIcon: null,
    description: "Jouez vos premiers matchs pour progresser",
  },
  {
    stars: 1, level: "Participant", color: "text-blue-600", bg: "bg-blue-500/10",
    borderColor: "border-blue-300",
    matches: 5, winRate: 0,
    unlocks: "Tournois avec cotisation (payants)",
    unlocksIcon: <Banknote className="w-3.5 h-3.5" />,
    description: "5 matchs joués",
  },
  {
    stars: 2, level: "Amateur", color: "text-green-600", bg: "bg-green-500/10",
    borderColor: "border-green-300",
    matches: 12, winRate: 30,
    unlocks: "Tournois sponsorisés",
    unlocksIcon: <Sparkles className="w-3.5 h-3.5" />,
    description: "12 matchs · 30%+ victoires",
  },
  {
    stars: 3, level: "Compétiteur", color: "text-orange-600", bg: "bg-orange-500/10",
    borderColor: "border-orange-300",
    matches: 25, winRate: 45,
    unlocks: "Tournois Élite ★★★",
    unlocksIcon: <Star className="w-3.5 h-3.5" />,
    description: "25 matchs · 45%+ victoires",
  },
  {
    stars: 4, level: "Pro", color: "text-purple-600", bg: "bg-purple-500/10",
    borderColor: "border-purple-300",
    matches: 40, winRate: 60,
    unlocks: "Tournois Élite ★★★★",
    unlocksIcon: <Star className="w-3.5 h-3.5" />,
    description: "40 matchs · 60%+ victoires",
  },
  {
    stars: 5, level: "Élite", color: "text-yellow-600", bg: "bg-yellow-400/10",
    borderColor: "border-yellow-400",
    matches: 60, winRate: 70,
    unlocks: "Accès à TOUS les tournois",
    unlocksIcon: <Zap className="w-3.5 h-3.5" />,
    description: "60 matchs · 70%+ victoires",
  },
];

const LEVEL_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  standard:   { label: "Standard",    color: "text-gray-600",    bg: "bg-gray-100 dark:bg-gray-800",    border: "border-gray-300" },
  cotisation: { label: "Cotisation",  color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950",     border: "border-blue-300" },
  sponsored:  { label: "Sponsorisé",  color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-950", border: "border-purple-300" },
  elite:      { label: "Élite",       color: "text-yellow-700",  bg: "bg-yellow-50 dark:bg-yellow-950", border: "border-yellow-400" },
};

const BADGE_STYLES: Record<string, { icon: string; ring: string; glow: string; label: string }> = {
  gold:   { icon: "🥇", ring: "ring-yellow-400",  glow: "shadow-yellow-300/60",  label: "Or" },
  silver: { icon: "🥈", ring: "ring-gray-400",    glow: "shadow-gray-300/60",    label: "Argent" },
  bronze: { icon: "🥉", ring: "ring-amber-600",   glow: "shadow-amber-400/60",   label: "Bronze" },
};

function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      color: string; alpha: number; size: number;
    }

    const particles: Particle[] = [];
    const colors = ["#FFD700","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98FB98"];

    function launch(x: number, y: number) {
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          size: 3 + Math.random() * 3,
        });
      }
    }

    let frame = 0;
    const launches = [
      { x: 0.2, y: 0.35, t: 10 },
      { x: 0.5, y: 0.25, t: 40 },
      { x: 0.8, y: 0.35, t: 70 },
      { x: 0.35, y: 0.5,  t: 100 },
      { x: 0.65, y: 0.45, t: 120 },
      { x: 0.15, y: 0.55, t: 150 },
      { x: 0.85, y: 0.55, t: 170 },
    ];

    let animId: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      frame++;

      for (const l of launches) {
        if (frame === l.t) launch(canvas!.width * l.x, canvas!.height * l.y);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy + 0.06;
        p.vy *= 0.98;
        p.vx *= 0.98;
        p.alpha -= 0.012;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx!.globalAlpha = p.alpha;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      if (frame < 250) animId = requestAnimationFrame(animate);
    }
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}

function StatCard({ icon, label, value, color, testId }: any) {
  const colorMap: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    green: "text-green-600 bg-green-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    red: "text-red-500 bg-red-500/10",
    gray: "text-muted-foreground bg-muted",
  };
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colorMap[color]}`}>
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function TrophyCard({ reward }: { reward: any }) {
  const bs = BADGE_STYLES[reward.badge] ?? BADGE_STYLES.gold;
  const ll = LEVEL_LABELS[reward.tournamentLevel] ?? LEVEL_LABELS.standard;
  const date = reward.createdAt ? new Date(reward.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div
      data-testid={`trophy-card-${reward.id}`}
      className={`flex items-center gap-3 p-3 rounded-xl border ${ll.border} ${ll.bg} transition-all`}
    >
      <div className={`text-4xl flex-shrink-0 ring-2 ${bs.ring} rounded-full p-1 shadow-lg ${bs.glow}`}>
        {bs.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className={`text-sm font-bold ${ll.color}`}>{reward.rewardLabel}</span>
          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${ll.color} ${ll.border}`}>{ll.label}</Badge>
        </div>
        <p className="text-xs font-medium truncate">{reward.tournamentName}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {reward.participantsCount} participants · {date}
        </p>
      </div>
    </div>
  );
}

export default function Stats() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/stats/me"],
  });

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery<any[]>({
    queryKey: ["/api/rewards/me"],
  });

  const stars = stats?.stars ?? 0;
  const played = stats?.played ?? 0;
  const winRatePct = stats?.winRatePct ?? 0;
  const diff = stats ? stats.goalsFor - stats.goalsAgainst : 0;
  const goalAvg = played > 0 ? (stats.goalsFor / played).toFixed(1) : "0.0";

  const currentTier = TIERS[stars];
  const nextTier = stars < 5 ? TIERS[stars + 1] : null;

  const matchProgress = nextTier ? Math.min(100, Math.round((played / nextTier.matches) * 100)) : 100;
  const winProgress = nextTier && nextTier.winRate > 0
    ? Math.min(100, Math.round((winRatePct / nextTier.winRate) * 100))
    : 100;

  // Check for recent gold trophy (within 7 days)
  const hasRecentGold = rewards.some(r => {
    if (r.badge !== "gold") return false;
    const d = new Date(r.createdAt);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });

  // Summary counts
  const goldCount = rewards.filter(r => r.badge === "gold").length;
  const silverCount = rewards.filter(r => r.badge === "silver").length;
  const bronzeCount = rewards.filter(r => r.badge === "bronze").length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes statistiques</h1>
          <p className="text-sm text-muted-foreground">Votre progression sur eLIGA</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Fireworks overlay when recent gold trophy */}
          {hasRecentGold && (
            <div className="relative rounded-2xl overflow-hidden">
              <div className="relative z-20 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border-2 border-yellow-400 rounded-2xl p-5 text-center">
                <p className="text-3xl mb-1">🏆</p>
                <p className="text-xl font-black text-yellow-700 dark:text-yellow-400">Champion !</p>
                <p className="text-sm text-muted-foreground mt-1">Vous avez remporté un tournoi récemment. Félicitations !</p>
              </div>
              <Fireworks />
            </div>
          )}

          {/* Trophy showcase */}
          <Card data-testid="trophy-showcase">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Medal className="w-4 h-4 text-yellow-500" />
                Mes trophées
                {rewards.length > 0 && (
                  <Badge className="ml-auto text-xs">{rewards.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rewardsLoading ? (
                <div className="space-y-2">
                  {[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-6">
                  <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun trophée pour l'instant</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Terminez dans le top 3 d'un tournoi (6+ joueurs) pour en gagner un !</p>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div className="flex items-center gap-4 mb-4 px-1">
                    <div className="flex items-center gap-1.5" data-testid="trophy-count-gold">
                      <span className="text-xl">🥇</span>
                      <span className="text-lg font-black text-yellow-600">{goldCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5" data-testid="trophy-count-silver">
                      <span className="text-xl">🥈</span>
                      <span className="text-lg font-black text-gray-500">{silverCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5" data-testid="trophy-count-bronze">
                      <span className="text-xl">🥉</span>
                      <span className="text-lg font-black text-amber-700">{bronzeCount}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {rewards.length} récompense{rewards.length > 1 ? "s" : ""} au total
                    </span>
                  </div>

                  {/* Recent trophies */}
                  <div className="space-y-2">
                    {rewards.slice(0, 10).map((reward: any) => (
                      <TrophyCard key={reward.id} reward={reward} />
                    ))}
                    {rewards.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        + {rewards.length - 10} trophée{rewards.length - 10 > 1 ? "s" : ""} plus anciens
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Level card — hero section */}
          <Card className={`border-2 ${currentTier.borderColor} overflow-hidden`} data-testid="stat-level-card">
            <div className={`px-5 py-4 ${currentTier.bg}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Votre niveau</p>
                  <p className={`text-3xl font-black ${currentTier.color}`}>{currentTier.level}</p>
                  <div className="flex gap-0.5 mt-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-5 h-5 ${s <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Points eLIGA</p>
                  <p className="text-4xl font-black text-primary">{stats?.points ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Victoires ×3 + Nuls ×1</p>
                </div>
              </div>
            </div>

            {/* Progress to next level */}
            {nextTier && (
              <CardContent className="p-4 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prochain niveau</p>
                  <Badge variant="outline" className={`text-xs ${nextTier.color}`}>
                    {"★".repeat(nextTier.stars)} {nextTier.level}
                  </Badge>
                </div>

                {/* Matches progress */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Swords className="w-3 h-3" /> Matchs joués
                    </span>
                    <span className={`font-semibold ${played >= nextTier.matches ? "text-green-600" : ""}`}>
                      {played} / {nextTier.matches}
                      {played >= nextTier.matches && " ✓"}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${played >= nextTier.matches ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${matchProgress}%` }}
                    />
                  </div>
                </div>

                {/* Win rate progress */}
                {nextTier.winRate > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Taux victoires
                      </span>
                      <span className={`font-semibold ${winRatePct >= nextTier.winRate ? "text-green-600" : ""}`}>
                        {winRatePct}% / {nextTier.winRate}%
                        {winRatePct >= nextTier.winRate && " ✓"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${winRatePct >= nextTier.winRate ? "bg-green-500" : "bg-amber-500"}`}
                        style={{ width: `${winProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* What next level unlocks */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${nextTier.bg} text-xs font-medium ${nextTier.color}`}>
                  {nextTier.unlocksIcon}
                  <span>Débloque : {nextTier.unlocks}</span>
                </div>
              </CardContent>
            )}

            {stars === 5 && (
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400/10 text-xs font-semibold text-yellow-700">
                  <Zap className="w-3.5 h-3.5" />
                  Niveau maximum atteint — Accès à tous les tournois !
                </div>
              </CardContent>
            )}
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Swords className="w-5 h-5 text-primary" />} label="Matchs joués" value={played} color="primary" testId="stat-played" />
            <StatCard icon={<Trophy className="w-5 h-5 text-green-500" />} label="Victoires" value={stats?.wins ?? 0} color="green" testId="stat-wins" />
            <StatCard icon={<Minus className="w-5 h-5 text-amber-500" />} label="Nuls" value={stats?.draws ?? 0} color="amber" testId="stat-draws" />
            <StatCard icon={<Shield className="w-5 h-5 text-red-500" />} label="Défaites" value={stats?.losses ?? 0} color="red" testId="stat-losses" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Target className="w-5 h-5 text-primary" />} label="Buts marqués" value={stats?.goalsFor ?? 0} color="primary" testId="stat-goals-for" />
            <StatCard icon={<Shield className="w-5 h-5 text-muted-foreground" />} label="Buts encaissés" value={stats?.goalsAgainst ?? 0} color="gray" testId="stat-goals-against" />
            <StatCard icon={<TrendingUp className={`w-5 h-5 ${diff >= 0 ? "text-green-500" : "text-red-500"}`} />} label="Diff. buts" value={diff >= 0 ? `+${diff}` : diff} color={diff >= 0 ? "green" : "red"} testId="stat-diff" />
            <StatCard icon={<BarChart3 className="w-5 h-5 text-primary" />} label="Buts/match" value={goalAvg} color="primary" testId="stat-goal-avg" />
          </div>

          {/* Taux de victoire */}
          <Card data-testid="stat-winrate">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">Taux de victoire</p>
                <span className="text-2xl font-black text-primary">{winRatePct}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${winRatePct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span><span>Amateur 30%</span><span>Compétiteur 45%</span><span>Pro 60%</span><span>Élite 70%</span>
              </div>
            </CardContent>
          </Card>

          {/* Hiérarchie complète des niveaux */}
          <Card data-testid="stat-hierarchy">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Hiérarchie des niveaux
              </CardTitle>
              <p className="text-xs text-muted-foreground">Progressez pour débloquer des tournois exclusifs</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {TIERS.map(tier => {
                const reached = stars >= tier.stars;
                const isCurrent = stars === tier.stars;
                return (
                  <div
                    key={tier.stars}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? `${tier.bg} ${tier.borderColor} border-2`
                        : reached
                          ? "bg-muted/30 border-border"
                          : "border-dashed border-muted-foreground/20 opacity-60"
                    }`}
                    data-testid={`tier-${tier.stars}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${tier.bg}`}>
                      {reached
                        ? <CheckCircle2 className={`w-4 h-4 ${tier.color}`} />
                        : <Lock className="w-4 h-4 text-muted-foreground/50" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-bold ${isCurrent ? tier.color : reached ? "" : "text-muted-foreground"}`}>
                          {tier.level}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{"★".repeat(tier.stars) || "☆"}</span>
                        {isCurrent && <Badge className="text-[9px] h-4 px-1.5">Actuel</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{tier.description}</p>
                      <div className={`flex items-center gap-1 text-[10px] font-medium mt-0.5 ${reached ? tier.color : "text-muted-foreground"}`}>
                        {tier.unlocksIcon}
                        <span>{tier.unlocks}</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isCurrent ? tier.color : "text-muted-foreground/30"}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {played === 0 && (
            <div className="text-center py-8">
              <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">Aucun match joué pour l'instant</p>
              <p className="text-sm text-muted-foreground mt-1">Rejoignez un tournoi pour commencer votre progression !</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

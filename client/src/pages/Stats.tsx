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
import { useLocale } from "@/lib/locale";

function getTiers(t: (key: string) => string) {
  return [
    {
      stars: 0, levelKey: "stats.tier_beginner", color: "text-muted-foreground", bg: "bg-muted",
      borderColor: "border-muted-foreground/20",
      matches: 0, winRate: 0,
      unlocksKey: "stats.unlock_standard",
      unlocksIcon: null,
      descKey: "stats.desc_beginner",
    },
    {
      stars: 1, levelKey: "stats.tier_participant", color: "text-blue-600", bg: "bg-blue-500/10",
      borderColor: "border-blue-300",
      matches: 5, winRate: 0,
      unlocksKey: "stats.unlock_cotisation",
      unlocksIcon: <Banknote className="w-3.5 h-3.5" />,
      descKey: "stats.desc_participant",
    },
    {
      stars: 2, levelKey: "stats.tier_amateur", color: "text-green-600", bg: "bg-green-500/10",
      borderColor: "border-green-300",
      matches: 12, winRate: 30,
      unlocksKey: "stats.unlock_sponsored",
      unlocksIcon: <Sparkles className="w-3.5 h-3.5" />,
      descKey: "stats.desc_amateur",
    },
    {
      stars: 3, levelKey: "stats.tier_competitor", color: "text-orange-600", bg: "bg-orange-500/10",
      borderColor: "border-orange-300",
      matches: 25, winRate: 45,
      unlocksKey: "stats.unlock_elite3",
      unlocksIcon: <Star className="w-3.5 h-3.5" />,
      descKey: "stats.desc_competitor",
    },
    {
      stars: 4, levelKey: "stats.tier_pro", color: "text-purple-600", bg: "bg-purple-500/10",
      borderColor: "border-purple-300",
      matches: 40, winRate: 60,
      unlocksKey: "stats.unlock_elite4",
      unlocksIcon: <Star className="w-3.5 h-3.5" />,
      descKey: "stats.desc_pro",
    },
    {
      stars: 5, levelKey: "stats.tier_elite", color: "text-yellow-600", bg: "bg-yellow-400/10",
      borderColor: "border-yellow-400",
      matches: 60, winRate: 70,
      unlocksKey: "stats.unlock_all",
      unlocksIcon: <Zap className="w-3.5 h-3.5" />,
      descKey: "stats.desc_elite",
    },
  ];
}

function getLevelLabels(t: (key: string) => string): Record<string, { label: string; color: string; bg: string; border: string }> {
  return {
    standard:   { label: t("stats.level_standard"),   color: "text-gray-600",    bg: "bg-gray-100 dark:bg-gray-800",    border: "border-gray-300" },
    cotisation: { label: t("stats.level_cotisation"),  color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950",     border: "border-blue-300" },
    sponsored:  { label: t("stats.level_sponsored"),   color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-950", border: "border-purple-300" },
    elite:      { label: t("stats.level_elite"),       color: "text-yellow-700",  bg: "bg-yellow-50 dark:bg-yellow-950", border: "border-yellow-400" },
  };
}

function getBadgeStyles(t: (key: string) => string): Record<string, { icon: string; ring: string; glow: string; label: string }> {
  return {
    gold:   { icon: "🥇", ring: "ring-yellow-400",  glow: "shadow-yellow-300/60",  label: t("stats.badge_gold") },
    silver: { icon: "🥈", ring: "ring-gray-400",    glow: "shadow-gray-300/60",    label: t("stats.badge_silver") },
    bronze: { icon: "🥉", ring: "ring-amber-600",   glow: "shadow-amber-400/60",   label: t("stats.badge_bronze") },
  };
}

function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let timerId: ReturnType<typeof setTimeout>;

    const start = () => {
      // Get dimensions from parent container once it's laid out
      const parent = canvas.parentElement;
      const w = parent?.offsetWidth || 400;
      const h = parent?.offsetHeight || 180;

      // If still not laid out, retry after one frame
      if (w === 0 || h === 0) {
        timerId = setTimeout(start, 30);
        return;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const particles: any[] = [];
      const colors = ["#FFD700","#FFA500","#FF6347","#00CED1","#7B68EE","#32CD32","#FF69B4"];

      function launch(x: number, y: number) {
        for (let i = 0; i < 50; i++) {
          const angle = Math.random() * Math.PI * 2;
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
    };

    // Small delay so the DOM is fully painted before measuring dimensions
    timerId = setTimeout(start, 50);

    return () => {
      clearTimeout(timerId);
      cancelAnimationFrame(animId);
    };
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

function TrophyCard({ reward, t }: { reward: any; t: (key: string) => string }) {
  const BADGE_STYLES = getBadgeStyles(t);
  const LEVEL_LABELS = getLevelLabels(t);
  const bs = BADGE_STYLES[reward.badge] ?? BADGE_STYLES.gold;
  const ll = LEVEL_LABELS[reward.tournamentLevel] ?? LEVEL_LABELS.standard;
  const date = reward.createdAt ? new Date(reward.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

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
          {reward.participantsCount} {t("stats.participants")} · {date}
        </p>
      </div>
    </div>
  );
}

export default function Stats() {
  const { user } = useAuth();
  const { t } = useLocale();

  const TIERS = getTiers(t);

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

  const hasRecentGold = rewards.some(r => {
    if (r.badge !== "gold") return false;
    const d = new Date(r.createdAt);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });

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
          <h1 className="text-2xl font-bold">{t("stats.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("stats.subtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          {hasRecentGold && (
            <div className="relative rounded-2xl overflow-hidden">
              <div className="relative z-20 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border-2 border-yellow-400 rounded-2xl p-5 text-center">
                <p className="text-3xl mb-1">🏆</p>
                <p className="text-xl font-black text-yellow-700 dark:text-yellow-400">{t("stats.champion")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("stats.champion_msg")}</p>
              </div>
              <Fireworks />
            </div>
          )}

          {/* Trophy showcase */}
          <Card data-testid="trophy-showcase">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Medal className="w-4 h-4 text-yellow-500" />
                {t("stats.trophies")}
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
                  <p className="text-sm text-muted-foreground">{t("stats.no_trophies")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("stats.no_trophies_hint")}</p>
                </div>
              ) : (
                <>
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
                      {rewards.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {rewards.slice(0, 10).map((reward: any) => (
                      <TrophyCard key={reward.id} reward={reward} t={t} />
                    ))}
                    {rewards.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        + {rewards.length - 10}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Level card */}
          <Card className={`border-2 ${currentTier.borderColor} overflow-hidden`} data-testid="stat-level-card">
            <div className={`px-5 py-4 ${currentTier.bg}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{t("stats.your_level")}</p>
                  <p className={`text-3xl font-black ${currentTier.color}`}>{t(currentTier.levelKey)}</p>
                  <div className="flex gap-0.5 mt-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-5 h-5 ${s <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Points eLIGA</p>
                  <p className="text-4xl font-black text-primary">{stats?.points ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Wins ×3 + Draws ×1</p>
                </div>
              </div>
            </div>

            {nextTier && (
              <CardContent className="p-4 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("stats.next_level")}</p>
                  <Badge variant="outline" className={`text-xs ${nextTier.color}`}>
                    {"★".repeat(nextTier.stars)} {t(nextTier.levelKey)}
                  </Badge>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Swords className="w-3 h-3" /> {t("stats.played")}
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

                {nextTier.winRate > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {t("stats.win_rate")}
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

                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${nextTier.bg} text-xs font-medium ${nextTier.color}`}>
                  {nextTier.unlocksIcon}
                  <span>{t("stats.unlocks")}: {t(nextTier.unlocksKey)}</span>
                </div>
              </CardContent>
            )}

            {stars === 5 && (
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400/10 text-xs font-semibold text-yellow-700">
                  <Zap className="w-3.5 h-3.5" />
                  {t("stats.unlock_all")}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Swords className="w-5 h-5 text-primary" />} label={t("stats.played")} value={played} color="primary" testId="stat-played" />
            <StatCard icon={<Trophy className="w-5 h-5 text-green-500" />} label={t("stats.wins")} value={stats?.wins ?? 0} color="green" testId="stat-wins" />
            <StatCard icon={<Minus className="w-5 h-5 text-amber-500" />} label={t("stats.draws")} value={stats?.draws ?? 0} color="amber" testId="stat-draws" />
            <StatCard icon={<Shield className="w-5 h-5 text-red-500" />} label={t("stats.losses")} value={stats?.losses ?? 0} color="red" testId="stat-losses" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Target className="w-5 h-5 text-primary" />} label={t("stats.goals_for")} value={stats?.goalsFor ?? 0} color="primary" testId="stat-goals-for" />
            <StatCard icon={<Shield className="w-5 h-5 text-muted-foreground" />} label={t("stats.goals_against")} value={stats?.goalsAgainst ?? 0} color="gray" testId="stat-goals-against" />
            <StatCard icon={<TrendingUp className={`w-5 h-5 ${diff >= 0 ? "text-green-500" : "text-red-500"}`} />} label={t("stats.goal_diff")} value={diff >= 0 ? `+${diff}` : diff} color={diff >= 0 ? "green" : "red"} testId="stat-diff" />
            <StatCard icon={<BarChart3 className="w-5 h-5 text-primary" />} label={t("stats.goals_avg")} value={goalAvg} color="primary" testId="stat-goal-avg" />
          </div>

          {/* Win rate bar */}
          <Card data-testid="stat-winrate">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm">{t("stats.win_rate")}</p>
                <span className="text-2xl font-black text-primary">{winRatePct}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${winRatePct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span>{t("stats.tier_amateur")} 30%</span>
                <span>{t("stats.tier_competitor")} 45%</span>
                <span>{t("stats.tier_pro")} 60%</span>
                <span>{t("stats.tier_elite")} 70%</span>
              </div>
            </CardContent>
          </Card>

          {/* Level hierarchy */}
          <Card data-testid="stat-hierarchy">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                {t("stats.all_levels")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("stats.progression")}</p>
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
                          {t(tier.levelKey)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{"★".repeat(tier.stars) || "☆"}</span>
                        {isCurrent && <Badge className="text-[9px] h-4 px-1.5">{t("stats.current_level")}</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{t(tier.descKey)}</p>
                      <div className={`flex items-center gap-1 text-[10px] font-medium mt-0.5 ${reached ? tier.color : "text-muted-foreground"}`}>
                        {tier.unlocksIcon}
                        <span>{t(tier.unlocksKey)}</span>
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
              <p className="font-semibold">{t("stats.no_trophies")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("stats.no_trophies_hint")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Swords, Bell, Coins, Star, ChevronRight, Trash2, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

const RANK_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-600"];
const RANK_BG = ["bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/40", "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/40", "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40"];

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLocale();

  const { data: notifications, isLoading: loadingN } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: leaderboard, isLoading: loadingL } = useQuery<any[]>({
    queryKey: ["/api/leaderboard"],
  });

  const { data: coinBalance } = useQuery<{ coins: number; bonusStars: number }>({
    queryKey: ["/api/coins/me"],
    enabled: !!user && !user.isAdmin,
  });

  const deleteNotifMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteAllNotifMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/notifications"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unreadNotifs = notifications?.filter(n => !n.isRead) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-6">

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-none sm:rounded-2xl mx-0 sm:mx-4 sm:mt-4">
        <div className="h-44 sm:h-52 bg-gradient-to-br from-emerald-900 via-green-800 to-teal-700 flex flex-col justify-end p-5">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(ellipse at 70% 30%, #4ade80 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, #059669 0%, transparent 50%)"}} />
          <div className="absolute top-4 right-4 w-20 h-20 opacity-10">
            <Trophy className="w-full h-full text-white" />
          </div>
          <div className="relative">
            <p className="text-white text-2xl font-extrabold tracking-tight leading-none mb-1">e<span className="text-emerald-300">LIGA</span></p>
            <p className="text-emerald-300 text-xs font-semibold tracking-widest uppercase mb-1">{t("dashboard.platform_tagline")}</p>
            <h1 className="text-white text-2xl font-bold leading-tight">
              {t("dashboard.greeting")}, <span className="text-emerald-300">{user?.pseudo}</span> 👋
            </h1>
            <p className="text-white/60 text-xs mt-1">{user?.country}{user?.region ? ` · ${user.region}` : ""}</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* Coin balance chip */}
        {!user?.isAdmin && coinBalance && (
          <Link href="/market">
            <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800/40 rounded-xl px-4 py-3 cursor-pointer hover:border-yellow-400 transition-colors" data-testid="banner-coins-promo">
              <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {coinBalance.coins} {t("dashboard.coins_title")}
                  {coinBalance.bonusStars > 0 && <span className="ml-2 text-amber-500">· {coinBalance.bonusStars} ⭐</span>}
                </p>
                <p className="text-xs text-muted-foreground">{t("dashboard.coins_buy")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            </div>
          </Link>
        )}

        {/* Game Modes */}
        <div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">{t("dashboard.game_modes")}</h2>
          <div className="grid grid-cols-2 gap-3">

            {/* Tournaments */}
            <Link href="/tournaments">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 p-5 cursor-pointer hover:from-emerald-400 hover:to-green-600 transition-all active:scale-95" data-testid="button-go-tournaments">
                <div className="absolute -bottom-3 -right-3 opacity-20">
                  <Trophy className="w-20 h-20 text-white" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <p className="text-white font-bold text-base leading-tight">{t("dashboard.tournaments")}</p>
                <p className="text-white/70 text-xs mt-0.5">{t("dashboard.tournaments_sub")}</p>
              </div>
            </Link>

            {/* Challenges */}
            <Link href="/challenges">
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 cursor-pointer hover:bg-accent transition-all active:scale-95" data-testid="button-go-challenges">
                <div className="absolute -bottom-3 -right-3 opacity-10">
                  <Swords className="w-20 h-20 text-primary" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Swords className="w-5 h-5 text-primary" />
                </div>
                <p className="text-foreground font-bold text-base leading-tight">{t("dashboard.challenges")}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{t("dashboard.challenges_sub")}</p>
              </div>
            </Link>

          </div>

          {/* Secondary tiles */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Link href="/matches">
              <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors" data-testid="button-go-matches">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("dashboard.matches")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.matches_sub")}</p>
                </div>
              </div>
            </Link>
            <Link href="/market">
              <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors" data-testid="button-go-market">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("dashboard.market")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.market_sub")}</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Leaderboards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{t("dashboard.leaderboards")}</h2>
            <Link href="/stats">
              <span className="text-xs text-primary font-medium cursor-pointer">{t("dashboard.see_all")}</span>
            </Link>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loadingL ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="w-7 h-5 rounded" />
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : !leaderboard?.length ? (
              <div className="text-center py-8">
                <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("dashboard.no_players")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {leaderboard.slice(0, 10).map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < 3 ? RANK_BG[idx] : ""}`}
                    data-testid={`leaderboard-row-${player.id}`}
                  >
                    <div className={`w-6 text-center font-bold text-sm flex-shrink-0 ${idx < 3 ? RANK_COLORS[idx] : "text-muted-foreground"}`}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : player.rank}
                    </div>

                    <Avatar className="w-9 h-9 flex-shrink-0">
                      {player.avatarUrl && <AvatarImage src={player.avatarUrl} className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {(player.pseudo ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{player.pseudo}</p>
                      <p className="text-xs text-muted-foreground">
                        {player.totalWins}{t("dashboard.wins")} · {player.played} {t("dashboard.matches_count")}
                        {player.bonusStars > 0 && <span className="ml-1 text-amber-500">{'★'.repeat(Math.min(player.bonusStars, 5))}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm font-bold text-foreground">{Math.round(player.coins)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        {(notifications?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Bell className="w-4 h-4" />
                {t("dashboard.notifications")}
                {unreadNotifs.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {unreadNotifs.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => deleteAllNotifMutation.mutate()}
                disabled={deleteAllNotifMutation.isPending}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                data-testid="button-delete-all-notifs"
              >
                <Trash2 className="w-3 h-3" />
                {t("dashboard.delete_all")}
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {loadingN ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))
              ) : (
                notifications?.slice(0, 8).map(n => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 group ${!n.isRead ? "bg-primary/5" : ""}`}
                    data-testid={`notif-${n.id}`}
                  >
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed text-foreground">{n.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNotifMutation.mutate(n.id)}
                      disabled={deleteNotifMutation.isPending}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded"
                      data-testid={`button-delete-notif-${n.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

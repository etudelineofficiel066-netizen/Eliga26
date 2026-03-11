import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Gamepad2, Clock, Plus, Trash2, Sparkles, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/lib/locale";

export default function Tournaments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const { data: myTournaments, isLoading: lt } = useQuery<any[]>({ queryKey: ["/api/tournaments/mine"] });
  const { data: joinedTournaments, isLoading: lj } = useQuery<any[]>({ queryKey: ["/api/tournaments/joined"] });

  const statusColor: Record<string, string> = {
    waiting: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-primary/10 text-primary",
    finished: "bg-muted text-muted-foreground",
  };

  const gameTypeLabels: Record<string, string> = {
    ps: t("tournaments.game.ps"),
    xbox: t("tournaments.game.xbox"),
    mobile: t("tournaments.game.mobile"),
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tournaments/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/mine"] });
      toast({ title: t("tournaments.deleted") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const TournamentList = ({ data, loading, canDelete }: { data?: any[]; loading: boolean; canDelete?: boolean }) => {
    if (loading) return (
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
      </div>
    );
    if (!data || data.length === 0) return (
      <div className="text-center py-8">
        <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t("tournaments.empty")}</p>
      </div>
    );
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {data.map(tour => (
          <div key={tour.id} className="relative group" data-testid={`tournament-${tour.id}`}>
            <Link href={`/tournaments/${tour.id}`}>
              <div className={`p-4 rounded-lg border cursor-pointer hover-elevate transition-all ${tour.isSponsored ? "border-amber-300 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-700" : tour.isElite ? "border-yellow-300 bg-yellow-50/30 dark:bg-yellow-900/10 dark:border-yellow-700" : "border-border"}`}>
                {tour.isSponsored && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {tour.sponsorLogo && <img src={tour.sponsorLogo} alt={tour.sponsorName} className="h-5 object-contain rounded" onError={e => (e.currentTarget.style.display="none")} />}
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {tour.sponsorName ? `${t("tournaments.sponsored_by")} ${tour.sponsorName}` : t("tournaments.sponsored")}
                    </span>
                    {tour.prizeInfo && <span className="ml-auto text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">🏆 {tour.prizeInfo}</span>}
                  </div>
                )}
                {tour.isElite && !tour.isSponsored && (
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= (tour.minStars ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />)}
                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 ml-1">{t("tournaments.elite_badge")}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-sm">{tour.name}</h3>
                  <Badge className={`text-xs flex-shrink-0 ${statusColor[tour.status]}`}>
                    {tour.status === "waiting" ? t("tournaments.status.waiting") : tour.status === "in_progress" ? t("tournaments.status.in_progress") : t("tournaments.status.finished")}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Avatar className="w-5 h-5 flex-shrink-0">
                    {tour.creator?.avatarUrl && <AvatarImage src={tour.creator.avatarUrl} alt={tour.creator.pseudo} />}
                    <AvatarFallback className="text-[9px] font-bold">{tour.creator?.pseudo?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-muted-foreground truncate">{t("tournaments.by")} <span className="text-foreground font-medium">{tour.creator?.pseudo}</span></p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {tour.participantCount} {t("tournaments.players")}</span>
                  <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> {gameTypeLabels[tour.gameType] || tour.gameType}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tour.gameTime} {t("common.min")}</span>
                  <span>{tour.championshipType === "pool" ? t("tournaments.type.pool") : t("tournaments.type.league")}</span>
                  {tour.isElite && tour.minStars > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600 font-semibold">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {tour.minStars}★ {t("stats.min_stars")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            {canDelete && (
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const warning = tour.status === "in_progress"
                    ? `${t("tournaments.delete_confirm_active")} "${tour.name}" ?`
                    : tour.status === "finished"
                    ? `${t("tournaments.delete_confirm_finished")} "${tour.name}" ?`
                    : `${t("tournaments.delete_confirm")} "${tour.name}" ?`;
                  if (window.confirm(warning)) {
                    deleteMutation.mutate(tour.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-destructive/70 hover:text-destructive active:bg-destructive/10 bg-background shadow-sm border border-border"
                title={t("common.delete")}
                data-testid={`button-delete-tournament-${tour.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("tournaments.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tournaments.subtitle")}</p>
          </div>
        </div>
        <Link href="/create-tournament">
          <Button data-testid="button-create-new">
            <Plus className="w-4 h-4 mr-2" />
            {t("tournaments.new")}
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-primary">{t("tournaments.mine")}</h2>
          {(myTournaments?.length ?? 0) > 0 && (
            <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {myTournaments!.length}
            </span>
          )}
        </div>
        <TournamentList data={myTournaments} loading={lt} canDelete />
      </div>

      {((joinedTournaments?.length ?? 0) > 0 || lj) && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("tournaments.other")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {((joinedTournaments?.length ?? 0) > 0 || lj) && (
        <div>
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">{t("tournaments.joined")}</h2>
          <TournamentList data={joinedTournaments} loading={lj} />
        </div>
      )}
    </div>
  );
}

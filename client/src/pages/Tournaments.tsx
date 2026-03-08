import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Gamepad2, Clock, Plus, Trash2, Sparkles, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Tournaments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: myTournaments, isLoading: lt } = useQuery<any[]>({ queryKey: ["/api/tournaments/mine"] });
  const { data: joinedTournaments, isLoading: lj } = useQuery<any[]>({ queryKey: ["/api/tournaments/joined"] });

  const statusColor: Record<string, string> = {
    waiting: "bg-amber-500/10 text-amber-600",
    in_progress: "bg-primary/10 text-primary",
    finished: "bg-muted text-muted-foreground",
  };
  const statusLabel: Record<string, string> = {
    waiting: "En attente", in_progress: "En cours", finished: "Terminé",
  };
  const gameTypeLabels: Record<string, string> = { ps: "PS", xbox: "Xbox", mobile: "Mobile" };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tournaments/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments/mine"] });
      toast({ title: "Tournoi supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
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
        <p className="text-sm text-muted-foreground">Aucun tournoi</p>
      </div>
    );
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {data.map(t => (
          <div key={t.id} className="relative group" data-testid={`tournament-${t.id}`}>
            <Link href={`/tournaments/${t.id}`}>
              <div className={`p-4 rounded-lg border cursor-pointer hover-elevate transition-all ${t.isSponsored ? "border-amber-300 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-700" : t.isElite ? "border-yellow-300 bg-yellow-50/30 dark:bg-yellow-900/10 dark:border-yellow-700" : "border-border"}`}>
                {/* Sponsor / Elite banners */}
                {t.isSponsored && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {t.sponsorLogo && <img src={t.sponsorLogo} alt={t.sponsorName} className="h-5 object-contain rounded" onError={e => (e.currentTarget.style.display="none")} />}
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {t.sponsorName ? `Sponsorisé par ${t.sponsorName}` : "Tournoi sponsorisé"}
                    </span>
                    {t.prizeInfo && <span className="ml-auto text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">🏆 {t.prizeInfo}</span>}
                  </div>
                )}
                {t.isElite && !t.isSponsored && (
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= (t.minStars ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />)}
                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 ml-1">Championnat Élite</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-sm">{t.name}</h3>
                  <Badge className={`text-xs flex-shrink-0 ${statusColor[t.status]}`}>
                    {statusLabel[t.status] || t.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Avatar className="w-5 h-5 flex-shrink-0">
                    {t.creator?.avatarUrl && <AvatarImage src={t.creator.avatarUrl} alt={t.creator.pseudo} />}
                    <AvatarFallback className="text-[9px] font-bold">{t.creator?.pseudo?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-muted-foreground truncate">Par <span className="text-foreground font-medium">{t.creator?.pseudo}</span></p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t.participantCount} joueurs</span>
                  <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> {gameTypeLabels[t.gameType] || t.gameType}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.gameTime} min</span>
                  <span>{t.championshipType === "pool" ? "Poules" : "Ligue"}</span>
                  {t.isElite && t.minStars > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600 font-semibold">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {t.minStars}★ min
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
                  const warning = t.status !== "waiting"
                    ? `⚠️ Ce tournoi est ${t.status === "in_progress" ? "en cours" : "terminé"}. Tous les scores seront perdus.\n\nSupprimer "${t.name}" ?`
                    : `Supprimer le tournoi "${t.name}" ?`;
                  if (window.confirm(warning)) {
                    deleteMutation.mutate(t.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-destructive/70 hover:text-destructive active:bg-destructive/10 bg-background shadow-sm border border-border"
                title="Supprimer"
                data-testid={`button-delete-tournament-${t.id}`}
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
            <h1 className="text-2xl font-bold">Mes tournois</h1>
            <p className="text-sm text-muted-foreground">Créés et rejoints</p>
          </div>
        </div>
        <Link href="/create-tournament">
          <Button data-testid="button-create-new">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau tournoi
          </Button>
        </Link>
      </div>

      {/* My tournaments — always on top with strong visual separation */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-primary">Mes tournois créés</h2>
          {(myTournaments?.length ?? 0) > 0 && (
            <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
              {myTournaments!.length}
            </span>
          )}
        </div>
        <TournamentList data={myTournaments} loading={lt} canDelete />
      </div>

      {/* Separator */}
      {((joinedTournaments?.length ?? 0) > 0 || lj) && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Autres tournois</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {((joinedTournaments?.length ?? 0) > 0 || lj) && (
        <div>
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Tournois rejoints</h2>
          <TournamentList data={joinedTournaments} loading={lj} />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { User, Pencil, Save, X, Trophy, Camera, ImageOff, Loader2, MapPin, Phone, BookOpen, Download, CheckCircle2, Smartphone, Share, Bell, BellOff, BellRing, Coins, Star, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useResetOnboarding } from "@/components/OnboardingTutorial";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useNotificationPoller } from "@/hooks/use-notification-poller";
import { playNotificationSound } from "@/lib/notification-sound";
import { useLocale } from "@/lib/locale";

function compressImage(file: File, maxPx = 300, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const side = Math.min(img.width, img.height);
      canvas.width = Math.min(side, maxPx);
      canvas.height = Math.min(side, maxPx);
      const scale = canvas.width / side;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height
      );
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  const [editing, setEditing] = useState(false);
  const [pseudo, setPseudo] = useState(user?.pseudo ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/stats/me"],
  });

  const { data: coinBalance } = useQuery<{ coins: number; bonusStars: number }>({
    queryKey: ["/api/coins/me"],
    enabled: !!user && !user.isAdmin,
  });

  const { data: tournaments } = useQuery<any[]>({
    queryKey: ["/api/tournaments/mine"],
  });

  const { data: meData } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const fullUser = meData?.user ?? user;

  useEffect(() => {
    if (meData?.user) {
      setPseudo(meData.user.pseudo);
      setAvatarUrl(meData.user.avatarUrl ?? "");
      setBio(meData.user.bio ?? "");
    }
  }, [meData]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/auth/profile", {
        pseudo,
        avatarUrl: avatarUrl || null,
        bio: bio || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditing(false);
      toast({ title: t("profile.updated") });
    },
    onError: (e: any) =>
      toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("profile.invalid_file"), description: t("profile.invalid_file_msg"), variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      setAvatarUrl(compressed);
    } catch {
      toast({ title: t("common.error"), description: t("profile.image_error"), variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentAvatar = editing ? avatarUrl : (fullUser?.avatarUrl ?? "");
  const winRate = stats?.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </div>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Avatar + upload */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative group">
                <Avatar className="w-24 h-24 sm:w-20 sm:h-20">
                  {currentAvatar && <AvatarImage src={currentAvatar} className="object-cover" />}
                  <AvatarFallback className="text-3xl sm:text-2xl font-bold bg-primary/10 text-primary">
                    {(fullUser?.pseudo ?? user?.pseudo ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {editing && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity cursor-pointer"
                    data-testid="button-upload-avatar"
                  >
                    {uploadingPhoto
                      ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                      : <Camera className="w-6 h-6 text-white" />
                    }
                  </button>
                )}
              </div>

              {editing && (
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="text-xs text-primary hover:underline flex items-center gap-1 py-1 px-2 rounded-md bg-primary/5"
                    data-testid="button-choose-photo"
                  >
                    <Camera className="w-3 h-3" />
                    {uploadingPhoto ? t("profile.loading_photo") : t("profile.change_photo")}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs text-destructive hover:underline flex items-center gap-1 py-1 px-2 rounded-md bg-destructive/5"
                      data-testid="button-remove-photo"
                    >
                      <ImageOff className="w-3 h-3" />
                      {t("profile.remove_photo")}
                    </button>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file-avatar"
              />
            </div>

            {/* Fields */}
            <div className="flex-1 min-w-0 w-full">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t("profile.pseudo_label")}</label>
                    <Input
                      value={pseudo}
                      onChange={e => setPseudo(e.target.value)}
                      placeholder={t("profile.pseudo_placeholder")}
                      data-testid="input-pseudo"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t("profile.bio_label")}</label>
                    <Textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder={t("profile.bio_placeholder")}
                      rows={3}
                      data-testid="input-bio"
                    />
                  </div>
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate()}
                      disabled={updateMutation.isPending || uploadingPhoto}
                      className="flex-1 sm:flex-none"
                      data-testid="button-save-profile"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {updateMutation.isPending ? t("profile.saving") : t("profile.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        setPseudo(fullUser?.pseudo ?? "");
                        setAvatarUrl(fullUser?.avatarUrl ?? "");
                        setBio(fullUser?.bio ?? "");
                      }}
                      className="flex-1 sm:flex-none"
                      data-testid="button-cancel-edit"
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      {t("profile.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                    <h2 className="text-xl font-bold">{fullUser?.pseudo ?? user?.pseudo}</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setEditing(true)}
                      data-testid="button-edit-profile"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 text-center sm:text-left">@{fullUser?.username ?? user?.username}</p>
                  {fullUser?.bio && (
                    <p className="text-sm text-foreground mb-3 text-center sm:text-left">{fullUser.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground justify-center sm:justify-start">
                    {fullUser?.country && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {fullUser.country}{fullUser.region ? `, ${fullUser.region}` : ""}
                      </div>
                    )}
                    {fullUser?.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {fullUser.phone}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coins widget — only for players */}
      {!user?.isAdmin && (
        <Link href="/market">
          <div
            className="w-full bg-gradient-to-r from-yellow-500/20 via-amber-400/15 to-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 flex items-center gap-4 hover:border-yellow-500/70 transition-all cursor-pointer"
            data-testid="profile-banner-coins"
          >
            <div className="w-11 h-11 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Coins className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm">{t("profile.coins_title")}</p>
                <span className="text-sm font-bold text-yellow-500" data-testid="profile-coin-balance">
                  {coinBalance?.coins ?? 0} 🪙
                </span>
                {(coinBalance?.bonusStars ?? 0) > 0 && (
                  <span className="text-sm font-bold text-amber-500">
                    · {coinBalance?.bonusStars} ⭐ {t("profile.bonus_stars")}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("profile.coins_subtitle")}
              </p>
              {(coinBalance?.coins ?? 0) >= 300 && (
                <p className="text-xs font-semibold text-green-600 mt-1">
                  {t("profile.coins_eligible")}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Stats summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("profile.stats_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="profile-stat-played">
                  <div className="text-xl font-bold">{stats?.played ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.stat_played")}</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg" data-testid="profile-stat-wins">
                  <div className="text-xl font-bold text-green-600">{stats?.wins ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.stat_wins")}</div>
                </div>
                <div className="text-center p-3 bg-amber-500/10 rounded-lg" data-testid="profile-stat-draws">
                  <div className="text-xl font-bold text-amber-600">{stats?.draws ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.stat_draws")}</div>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg" data-testid="profile-stat-losses">
                  <div className="text-xl font-bold text-red-500">{stats?.losses ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{t("profile.stat_losses")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${winRate}%` }} />
                </div>
                <span className="text-sm font-medium text-green-600">{winRate}{t("profile.win_rate")}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tournaments */}
      {tournaments && tournaments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("profile.my_tournaments")} ({tournaments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tournaments.slice(0, 5).map(t2 => (
                <div
                  key={t2.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  data-testid={`profile-tournament-${t2.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t2.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {t2.status === "waiting" ? t("profile.tournament_waiting") : t2.status === "in_progress" ? t("profile.tournament_in_progress") : t("profile.tournament_finished")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Push Notifications */}
      <PushNotificationsCard />
      {/* PWA Install */}
      <PWAInstallCard />
      {/* Tutorial replay */}
      <TutorialReplayCard />
    </div>
  );
}

function getIOSInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    ("standalone" in navigator && (navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  return { isIOS, isStandalone };
}

function PushNotificationsCard() {
  const { isSupported, permission, isEnabled, isRequesting, requestPermission, disable } = useNotificationPoller();
  const { toast } = useToast();
  const { t } = useLocale();
  const { isIOS, isStandalone } = getIOSInfo();

  const handleToggle = async () => {
    if (isEnabled) {
      disable();
      toast({ title: t("profile.notif_disabled") });
    } else if (permission === "denied") {
      toast({
        title: t("profile.notif_blocked_title"),
        description: t("profile.notif_blocked_desc"),
        variant: "destructive",
      });
    } else {
      const ok = await requestPermission();
      if (ok) {
        toast({
          title: t("profile.notif_enabled_title"),
          description: t("profile.notif_enabled_desc"),
        });
      } else {
        toast({
          title: t("profile.notif_denied"),
          description: t("profile.notif_denied_desc"),
          variant: "destructive",
        });
      }
    }
  };

  if (isIOS && !isStandalone) {
    return (
      <Card data-testid="push-notifications-card-ios">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("profile.notif_iphone_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("profile.notif_iphone_desc")}
              </p>
            </div>
          </div>
          <div className="bg-muted/60 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">{t("profile.notif_ios_how")}</p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-none">
              {[
                t("profile.notif_ios_step1"),
                t("profile.notif_ios_step2"),
                t("profile.notif_ios_step3"),
                t("profile.notif_ios_step4"),
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">{t("profile.notif_ios_req")}</p>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) return null;

  return (
    <Card data-testid="push-notifications-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isEnabled ? "bg-green-500/10" : "bg-muted/50"}`}>
            {isEnabled ? <BellRing className="w-5 h-5 text-green-600" /> : <Bell className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t("profile.notif_title")}</p>
            <p className="text-xs text-muted-foreground">
              {permission === "denied"
                ? t("profile.notif_blocked")
                : isEnabled
                ? t("profile.notif_active")
                : t("profile.notif_inactive")}
            </p>
          </div>
          <Button
            variant={isEnabled ? "outline" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={isRequesting}
            className={isEnabled ? "text-destructive border-destructive/30 hover:bg-destructive/10" : ""}
            data-testid="button-toggle-push"
          >
            {isRequesting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isEnabled
              ? <><BellOff className="w-4 h-4 mr-1.5" />{t("profile.notif_disable")}</>
              : <><Bell className="w-4 h-4 mr-1.5" />{t("profile.notif_enable")}</>}
          </Button>
        </div>
        {isEnabled && (
          <button
            onClick={() => playNotificationSound()}
            className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded-lg py-2 transition-colors flex items-center justify-center gap-2"
            data-testid="button-test-sound"
          >
            <BellRing className="w-3.5 h-3.5" />
            {t("profile.notif_test_sound")}
          </button>
        )}
        {isIOS && isStandalone && (
          <p className="text-[10px] text-muted-foreground text-center">
            {t("profile.notif_ios_req2")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const PWA_DISMISSED_KEY = "eliga-pwa-prompt-dismissed";

function PWAInstallCard() {
  const { canInstall, isInstalled, isIOS, isInstalling, install } = usePWAInstall();
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLocale();

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSSteps(true);
      return;
    }
    localStorage.removeItem(PWA_DISMISSED_KEY);
    if (canInstall) {
      await install();
    }
  };

  if (isInstalled || dismissed) return null;

  return (
    <Card className="overflow-hidden" data-testid="pwa-install-card">
      <div className="bg-gradient-to-r from-primary to-blue-600 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{t("profile.pwa_title")}</p>
          <p className="text-xs text-white/70">{t("profile.pwa_subtitle")}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white/70 transition-colors flex-shrink-0"
          data-testid="button-pwa-card-dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <CardContent className="p-4">
        {!showIOSSteps ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              {[
                { icon: "⚡", label: t("profile.pwa_fast") },
                { icon: "📴", label: t("profile.pwa_offline") },
                { icon: "🔔", label: t("profile.pwa_notif") },
              ].map((f, i) => (
                <div key={i} className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-2">
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-muted-foreground font-medium leading-tight">{f.label}</span>
                </div>
              ))}
            </div>

            {canInstall ? (
              <Button
                className="w-full gap-2 font-semibold"
                onClick={handleInstall}
                disabled={isInstalling}
                data-testid="button-pwa-profile-install"
              >
                <Download className="w-4 h-4" />
                {isInstalling ? t("profile.pwa_installing") : t("profile.pwa_install")}
              </Button>
            ) : isIOS ? (
              <Button
                className="w-full gap-2 font-semibold"
                onClick={() => setShowIOSSteps(true)}
                data-testid="button-pwa-ios-guide"
              >
                <Share className="w-4 h-4" />
                {t("profile.pwa_ios_guide")}
              </Button>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <p className="font-semibold mb-1">{t("profile.pwa_not_available_title")}</p>
                <p>{t("profile.pwa_not_available_desc")}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">{t("profile.pwa_ios_steps_title")}</p>
            <ol className="space-y-2.5 text-sm text-muted-foreground">
              {[
                t("profile.pwa_ios_s1"),
                t("profile.pwa_ios_s2"),
                t("profile.pwa_ios_s3"),
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Button variant="outline" size="sm" onClick={() => setShowIOSSteps(false)} data-testid="button-pwa-ios-back">
              {t("profile.pwa_back")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TutorialReplayCard() {
  const resetOnboarding = useResetOnboarding();
  const [replaying, setReplaying] = useState(false);
  const { t } = useLocale();

  const handleReplay = () => {
    resetOnboarding();
    setReplaying(true);
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t("profile.tutorial_title")}</p>
          <p className="text-xs text-muted-foreground">{t("profile.tutorial_subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReplay}
          disabled={replaying}
          data-testid="button-replay-tutorial"
        >
          {replaying ? "…" : t("profile.tutorial_replay")}
        </Button>
      </CardContent>
    </Card>
  );
}

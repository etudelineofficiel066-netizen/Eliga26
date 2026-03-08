import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Play, Eye, Plus, Upload, Trash2, Loader2, Film, UserPlus, UserCheck, Trophy, Coins, Star, BarChart2, Clapperboard, MessageCircle, Send, X } from "lucide-react";

const TAG_LABELS: Record<string, string> = {
  technique: "Technique", match: "Match", highlight: "Highlight",
  tutorial: "Tutoriel", funny: "Fun",
};
const TAG_COLORS: Record<string, string> = {
  technique: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  match: "bg-green-500/20 text-green-400 border-green-500/30",
  highlight: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  tutorial: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  funny: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const MILESTONES = [
  { type: "views",   value: 100,   coins: 2,   label: "100 vues",      icon: "👁️" },
  { type: "views",   value: 500,   coins: 5,   label: "500 vues",      icon: "👁️" },
  { type: "views",   value: 1000,  coins: 10,  label: "1 000 vues",    icon: "👁️" },
  { type: "views",   value: 5000,  coins: 25,  label: "5 000 vues",    icon: "🔥" },
  { type: "views",   value: 10000, coins: 50,  label: "10 000 vues",   icon: "⭐" },
  { type: "likes",   value: 50,    coins: 2,   label: "50 likes",      icon: "❤️" },
  { type: "likes",   value: 200,   coins: 8,   label: "200 likes",     icon: "❤️" },
  { type: "likes",   value: 1000,  coins: 20,  label: "1 000 likes",   icon: "💖" },
  { type: "likes",   value: 5000,  coins: 75,  label: "5 000 likes",   icon: "🏆" },
  { type: "follows", value: 10,    coins: 5,   label: "10 abonnés",    icon: "👥" },
  { type: "follows", value: 50,    coins: 15,  label: "50 abonnés",    icon: "👥" },
  { type: "follows", value: 100,   coins: 30,  label: "100 abonnés",   icon: "🌟" },
  { type: "follows", value: 500,   coins: 100, label: "500 abonnés",   icon: "💎" },
  { type: "follows", value: 1000,  coins: 200, label: "1 000 abonnés", icon: "👑" },
];

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function RewardsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/clips/stats/me"],
    enabled: open,
  });

  const stats = data?.stats ?? { totalViews: 0, totalLikes: 0, totalFollowers: 0, clips: 0 };
  const awardedKeys = new Set((data?.milestones ?? []).map((m: any) => m.milestone_key));

  const groups = [
    { label: "Vues", type: "views", current: stats.totalViews, color: "text-blue-400" },
    { label: "Likes", type: "likes", current: stats.totalLikes, color: "text-red-400" },
    { label: "Abonnés", type: "follows", current: stats.totalFollowers, color: "text-green-400" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Récompenses Clips
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold text-blue-500">{formatCount(stats.totalViews)}</p>
                <p className="text-[10px] text-muted-foreground">Vues</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold text-red-500">{formatCount(stats.totalLikes)}</p>
                <p className="text-[10px] text-muted-foreground">Likes</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold text-green-500">{formatCount(stats.totalFollowers)}</p>
                <p className="text-[10px] text-muted-foreground">Abonnés</p>
              </div>
            </div>

            {groups.map((group) => (
              <div key={group.type}>
                <p className={`text-xs font-semibold mb-2 ${group.color}`}>{group.label} — {formatCount(group.current)} actuels</p>
                <div className="space-y-1.5">
                  {MILESTONES.filter((m) => m.type === group.type).map((m) => {
                    const key = `${m.type}_${m.value}`;
                    const done = awardedKeys.has(key);
                    const pct = Math.min(100, Math.round((group.current / m.value) * 100));
                    return (
                      <div key={key} className={`rounded-lg p-2.5 border ${done ? "bg-primary/10 border-primary/30" : "bg-muted border-border"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium flex items-center gap-1">
                            <span>{m.icon}</span> {m.label}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                            +{m.coins} <Coins className="w-3 h-3" />
                            {done && <span className="text-primary ml-1">✓</span>}
                          </span>
                        </div>
                        {!done && (
                          <div className="w-full bg-background rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClipCard({
  clip,
  isActive,
  onLike,
  onFollow,
  onDelete,
  onOpenComments,
  currentUserId,
}: {
  clip: any;
  isActive: boolean;
  onLike: (id: string) => void;
  onFollow: (userId: string) => void;
  onDelete: (id: string) => void;
  onOpenComments: (clipId: string) => void;
  currentUserId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(!!clip.liked);
  const [likesCount, setLikesCount] = useState(parseInt(clip.likes_count) || 0);
  const [following, setFollowing] = useState(!!clip.is_following);
  const [followersCount, setFollowersCount] = useState(parseInt(clip.followers_count) || 0);
  const [playing, setPlaying] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const isOwn = clip.user_id === currentUserId;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, [isActive]);

  const handleTap = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    if (newLiked) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 600); }
    onLike(clip.id);
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFollowing = !following;
    setFollowing(newFollowing);
    setFollowersCount((c) => c + (newFollowing ? 1 : -1));
    onFollow(clip.user_id);
  };

  return (
    <div className="relative w-full h-full flex-shrink-0 bg-black snap-start snap-always" data-testid={`clip-card-${clip.id}`}>
      <video
        ref={videoRef}
        src={clip.video_url}
        className="absolute inset-0 w-full h-full object-contain"
        loop playsInline muted={false} preload="metadata"
        onClick={handleTap}
        data-testid={`video-${clip.id}`}
      />

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">
        <button onClick={handleLike} className="flex flex-col items-center gap-1" data-testid={`button-like-${clip.id}`}>
          <div className={`w-11 h-11 rounded-full bg-black/40 flex items-center justify-center transition-transform ${heartAnim ? "scale-125" : ""}`}>
            <Heart className={`w-6 h-6 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{formatCount(likesCount)}</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onOpenComments(clip.id); }}
          className="flex flex-col items-center gap-1"
          data-testid={`button-comments-${clip.id}`}
        >
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{formatCount(parseInt(clip.comments_count) || 0)}</span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{formatCount(parseInt(clip.views_count) || 0)}</span>
        </div>

        {isOwn ? (
          <button
            onClick={() => onDelete(clip.id)}
            className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center"
            data-testid={`button-delete-clip-${clip.id}`}
          >
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
        ) : (
          <button
            onClick={handleFollow}
            className="flex flex-col items-center gap-1"
            data-testid={`button-follow-${clip.user_id}`}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${following ? "bg-primary/70" : "bg-black/40"}`}>
              {following
                ? <UserCheck className="w-5 h-5 text-white" />
                : <UserPlus className="w-5 h-5 text-white" />
              }
            </div>
            <span className="text-white text-xs font-semibold drop-shadow">{formatCount(followersCount)}</span>
          </button>
        )}
      </div>

      <div className="absolute left-3 bottom-6 right-16 z-10">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Avatar className="w-9 h-9 border-2 border-white/60 flex-shrink-0">
            {clip.avatar_url && <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{clip.pseudo?.charAt(0).toUpperCase()}</AvatarFallback>}
            {clip.avatar_url && <img src={clip.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />}
          </Avatar>
          <span className="text-white font-semibold text-sm drop-shadow">{clip.pseudo}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TAG_COLORS[clip.tag] ?? TAG_COLORS.technique}`}>
            {TAG_LABELS[clip.tag] ?? clip.tag}
          </span>
          {!isOwn && (
            <button
              onClick={handleFollow}
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-colors ${
                following
                  ? "bg-primary/30 border-primary/50 text-white"
                  : "bg-white/20 border-white/40 text-white"
              }`}
              data-testid={`button-follow-text-${clip.user_id}`}
            >
              {following ? "Abonné" : "+ Suivre"}
            </button>
          )}
        </div>
        <p className="text-white font-semibold text-sm drop-shadow leading-tight">{clip.title}</p>
        {clip.description && (
          <p className="text-white/80 text-xs mt-0.5 drop-shadow leading-tight line-clamp-2">{clip.description}</p>
        )}
      </div>
    </div>
  );
}

function UploadModal({ open, onClose, onUploaded }: { open: boolean; onClose: () => void; onUploaded: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("technique");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setTitle(""); setDescription(""); setTag("technique"); setFile(null); setPreview(null); setProgress(0); setUploading(false); };
  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast({ title: "Fichier invalide", description: "Sélectionnez une vidéo.", variant: "destructive" }); return; }
    if (f.size > 200 * 1024 * 1024) { toast({ title: "Fichier trop volumineux", description: "Limite : 200 Mo.", variant: "destructive" }); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) { toast({ title: "Champs manquants", description: "Vidéo et titre requis.", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      formData.append("tag", tag);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/clips/upload");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
      const result: any = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200) resolve(data);
          else reject(new Error(data.error || "Échec de l'upload"));
        };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(formData);
      });

      if (!result?.id) throw new Error("Réponse invalide du serveur");
      toast({ title: "Clip publié !", description: "Votre vidéo est maintenant visible." });
      onUploaded();
      handleClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Film className="w-5 h-5 text-primary" />Publier un clip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? "border-primary bg-primary/5" : "border-orange-400 bg-orange-50 hover:bg-orange-100"}`}
            onClick={() => fileInputRef.current?.click()}
            data-testid="input-video-upload"
          >
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="space-y-1">
                <video src={preview!} className="w-full max-h-40 rounded-lg object-contain mx-auto" controls />
                <p className="text-xs text-muted-foreground mt-2 truncate">{file.name}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-orange-400 mx-auto" />
                <p className="text-sm font-medium text-orange-700">Sélectionner une vidéo</p>
                <p className="text-xs text-muted-foreground">MP4, MOV, AVI · max 200 Mo</p>
              </div>
            )}
          </div>
          <Input placeholder="Titre du clip *" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} data-testid="input-clip-title" />
          <Textarea placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} data-testid="input-clip-description" />
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-center text-muted-foreground">{progress < 100 ? `Upload : ${progress}%` : "Finalisation..."}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={uploading} data-testid="button-cancel-upload">Annuler</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={uploading || !file || !title.trim()} data-testid="button-submit-clip">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publication...</> : "Publier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentsPanel({
  clipId,
  currentUserId,
  isAdmin,
  onClose,
  onCommentAdded,
}: {
  clipId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onCommentAdded: (clipId: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  const { data: comments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/clips/comments", clipId],
    queryFn: () => fetch(`/api/clips/${clipId}/comments`).then((r) => r.json()),
    enabled: !!clipId,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (clipId) {
      setText("");
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 200);
    }
  }, [clipId]);

  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }, [comments.length]);

  const postMutation = useMutation({
    mutationFn: (t: string) => apiRequest("POST", `/api/clips/${clipId}/comments`, { text: t }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clips/comments", clipId] });
      if (clipId) onCommentAdded(clipId);
      setText("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest("DELETE", `/api/clips/comments/${commentId}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clips/comments", clipId] }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const t = text.trim();
    if (!t || t.length > 300 || postMutation.isPending) return;
    postMutation.mutate(t);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "maintenant";
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}j`;
  }

  const open = !!clipId;

  return (
    <>
      {/* backdrop */}
      <div
        className={`absolute inset-0 z-30 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      />
      {/* panel */}
      <div
        className={`absolute left-0 right-0 bottom-0 z-40 flex flex-col rounded-t-2xl bg-white transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{ height: "72%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* handle + header */}
        <div className="flex-shrink-0 pt-2 pb-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-base text-gray-900">
              Commentaires {comments.length > 0 && <span className="text-sm font-normal text-gray-500">({comments.length})</span>}
            </h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100" data-testid="button-close-comments">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* comments list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <MessageCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-400">Aucun commentaire pour l'instant</p>
              <p className="text-xs text-gray-300">Soyez le premier à commenter !</p>
            </div>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex gap-3 items-start group" data-testid={`comment-${c.id}`}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold text-primary">{c.pseudo?.charAt(0).toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-xs text-gray-800">{c.pseudo}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 leading-snug break-words">{c.text}</p>
                </div>
                {(c.user_id === currentUserId || isAdmin) && (
                  <button
                    onClick={() => deleteMutation.mutate(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    data-testid={`button-delete-comment-${c.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* input bar */}
        <div className="flex-shrink-0 border-t border-gray-100 px-3 py-3 flex items-center gap-2 bg-white">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ajouter un commentaire..."
            maxLength={300}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-gray-800 placeholder:text-gray-400"
            data-testid="input-comment"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || postMutation.isPending}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${text.trim() ? "bg-primary text-white" : "bg-gray-200 text-gray-400"}`}
            data-testid="button-send-comment"
          >
            {postMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function MyClipsModal({
  open,
  onClose,
  userId,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onDelete: (id: string) => void;
}) {
  const { data: myClips = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/clips/user", userId],
    queryFn: () => fetch(`/api/clips/user/${userId}`).then((r) => r.json()),
    enabled: open,
  });

  const { data: statsData } = useQuery<any>({
    queryKey: ["/api/clips/stats/me"],
    enabled: open,
  });

  const stats = statsData?.stats ?? { totalViews: 0, totalLikes: 0, totalFollowers: 0, clips: 0 };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-auto max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-primary" />
            Mes vidéos
          </DialogTitle>
        </DialogHeader>

        {/* Global stats banner */}
        <div className="grid grid-cols-4 gap-2 px-4 pb-3">
          <div className="bg-muted rounded-lg p-2 text-center">
            <p className="text-base font-bold text-primary">{formatCount(stats.clips ?? myClips.length)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Clips</p>
          </div>
          <div className="bg-muted rounded-lg p-2 text-center">
            <p className="text-base font-bold text-blue-500">{formatCount(stats.totalViews)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Vues</p>
          </div>
          <div className="bg-muted rounded-lg p-2 text-center">
            <p className="text-base font-bold text-red-500">{formatCount(stats.totalLikes)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Likes</p>
          </div>
          <div className="bg-muted rounded-lg p-2 text-center">
            <p className="text-base font-bold text-green-500">{formatCount(stats.totalFollowers)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Abonnés</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : myClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <Film className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Vous n'avez pas encore publié de clip</p>
            </div>
          ) : (
            myClips.map((clip: any) => {
              const views = parseInt(clip.views_count) || 0;
              const likes = parseInt(clip.likes_count) || 0;
              return (
                <div
                  key={clip.id}
                  className={`rounded-xl border p-3 flex gap-3 items-start ${clip.is_featured ? "border-yellow-300 bg-yellow-50" : "border-border bg-card"}`}
                  data-testid={`my-clip-${clip.id}`}
                >
                  {/* Thumbnail / icon */}
                  <div className="w-14 h-14 rounded-lg bg-black flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                    {clip.thumbnail_url ? (
                      <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-6 h-6 text-white/50" />
                    )}
                    {clip.is_featured && (
                      <div className="absolute top-0.5 right-0.5">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{clip.title}</p>
                      <button
                        onClick={() => onDelete(clip.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                        data-testid={`button-my-delete-${clip.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-medium mt-1 ${TAG_COLORS[clip.tag] ?? TAG_COLORS.technique}`}>
                      {TAG_LABELS[clip.tag] ?? clip.tag}
                    </span>

                    {clip.is_featured && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-600 font-semibold ml-1.5">
                        <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" /> Mis en avant
                      </span>
                    )}

                    {/* Per-clip stats */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" /> {formatCount(views)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Heart className="w-3 h-3" /> {formatCount(likes)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BarChart2 className="w-3 h-3" />
                        {views > 0 ? `${Math.round((likes / views) * 100)}% engagement` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Clips() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showMyClips, setShowMyClips] = useState(false);
  const [commentsClipId, setCommentsClipId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [allClips, setAllClips] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const { data: clips, isLoading } = useQuery<any[]>({
    queryKey: ["/api/clips", offset],
    queryFn: () => fetch(`/api/clips?offset=${offset}`).then((r) => r.json()),
  });

  const { data: clipsGlobalSetting } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/clips-enabled"],
  });
  const clipsPublishingEnabled = clipsGlobalSetting?.enabled !== false;

  useEffect(() => {
    if (clips && Array.isArray(clips)) {
      if (offset === 0) setAllClips(shuffleArray(clips));
      else setAllClips((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...clips.filter((c) => !ids.has(c.id))];
      });
    }
  }, [clips, offset]);

  const likeMutation = useMutation({
    mutationFn: (clipId: string) => apiRequest("POST", `/api/clips/${clipId}/like`, {}),
    onSuccess: (data: any, clipId) => {
      setAllClips((prev) => prev.map((c) => c.id === clipId ? { ...c, liked: data.liked, likes_count: data.likesCount } : c));
      if (data.newMilestones?.length > 0) {
        data.newMilestones.forEach((m: any) => {
          toast({ title: `🎉 Récompense débloquée — ${m.label}`, description: `+${m.coins} pièces gagnées !` });
        });
        queryClient.invalidateQueries({ queryKey: ["/api/clips/stats/me"] });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/clips/follow/${userId}`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clips/stats/me"] });
      if (data.newMilestones?.length > 0) {
        data.newMilestones.forEach((m: any) => {
          toast({ title: `🎉 Récompense débloquée — ${m.label}`, description: `+${m.coins} pièces gagnées !` });
        });
      }
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (clipId: string) => apiRequest("DELETE", `/api/clips/${clipId}`, {}),
    onSuccess: (_d, clipId) => {
      setAllClips((prev) => prev.filter((c) => c.id !== clipId));
      queryClient.invalidateQueries({ queryKey: ["/api/clips/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clips/stats/me"] });
      toast({ title: "Clip supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    setActiveIndex(idx);
    const clip = allClips[idx];
    if (clip && !viewedRef.current.has(clip.id)) {
      viewedRef.current.add(clip.id);
      fetch(`/api/clips/${clip.id}/view`, { method: "POST" }).catch(() => {});
    }
    if (idx >= allClips.length - 3 && clips && clips.length === 10) {
      setOffset((prev) => prev + 10);
    }
  }, [allClips, clips]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (!user) return null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: "none" }}
        data-testid="clips-feed"
      >
        {isLoading && allClips.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white snap-start">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-white/60">Chargement des clips...</p>
          </div>
        ) : allClips.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white px-8 text-center snap-start">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-2">
              <Film className="w-10 h-10 text-white/50" />
            </div>
            <h3 className="text-xl font-bold">Aucun clip pour l'instant</h3>
            <p className="text-white/60 text-sm">Soyez le premier à partager une technique ou un highlight !</p>
            <Button onClick={() => setShowUpload(true)} className="mt-2" data-testid="button-first-clip">
              <Plus className="w-4 h-4 mr-2" />Publier un clip
            </Button>
          </div>
        ) : (
          allClips.map((clip, idx) => (
            <div key={clip.id} className="w-full flex-shrink-0 snap-start snap-always" style={{ height: "100%" }}>
              <ClipCard
                clip={clip}
                isActive={idx === activeIndex}
                onLike={(id) => likeMutation.mutate(id)}
                onFollow={(uid) => followMutation.mutate(uid)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onOpenComments={(id) => setCommentsClipId(id)}
                currentUserId={user.id}
              />
            </div>
          ))
        )}
      </div>

      <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg drop-shadow">eLIGA Clips</h1>
        <button
          onClick={() => setShowRewards(true)}
          className="flex items-center gap-1.5 bg-black/40 text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-yellow-500/30"
          data-testid="button-rewards"
        >
          <Trophy className="w-3.5 h-3.5" />
          Récompenses
        </button>
      </div>

      {/* Bottom action buttons */}
      <div className="absolute bottom-6 right-4 flex items-center gap-2 z-20">
        <button
          onClick={() => setShowMyClips(true)}
          className="flex items-center gap-1.5 bg-black/50 text-white text-xs font-semibold px-3 py-2.5 rounded-full border border-white/20 shadow"
          data-testid="button-my-clips"
        >
          <Clapperboard className="w-4 h-4" />
          Mes vidéos
        </button>
        {(user.isAdmin || (clipsPublishingEnabled && (user as any).canPostClips !== false)) && (
          <button
            onClick={() => setShowUpload(true)}
            className="w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center"
            data-testid="button-open-upload"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => {
          setOffset(0); setAllClips([]);
          queryClient.invalidateQueries({ queryKey: ["/api/clips"] });
          queryClient.invalidateQueries({ queryKey: ["/api/clips/user", user.id] });
          queryClient.invalidateQueries({ queryKey: ["/api/clips/stats/me"] });
        }}
      />

      <RewardsModal open={showRewards} onClose={() => setShowRewards(false)} />

      <CommentsPanel
        clipId={commentsClipId}
        currentUserId={user.id}
        isAdmin={!!user.isAdmin}
        onClose={() => setCommentsClipId(null)}
        onCommentAdded={(clipId) => {
          setAllClips((prev) =>
            prev.map((c) => c.id === clipId
              ? { ...c, comments_count: String(parseInt(c.comments_count || "0") + 1) }
              : c
            )
          );
        }}
      />

      <MyClipsModal
        open={showMyClips}
        onClose={() => setShowMyClips(false)}
        userId={user.id}
        onDelete={(id) => {
          deleteMutation.mutate(id);
          setShowMyClips(false);
        }}
      />
    </div>
  );
}

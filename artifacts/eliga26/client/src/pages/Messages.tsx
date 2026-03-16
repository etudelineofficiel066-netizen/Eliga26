import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useSearch } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket, type Reaction } from "@/hooks/use-websocket";
import { MessageSquare, Send, ArrowLeft, Check, CheckCheck, Smile, Bell, Trophy, Swords, UserPlus, BellOff, PenSquare, Search, X, Trash2, Paperclip, Mic } from "lucide-react";

const EMOJIS = ["👍", "🔥", "😂", "😮", "💪"];
const INPUT_EMOJIS = [
  "😀","😂","😍","🥰","😎","😭","😡","🥳","🤩","😴",
  "👍","👎","🙏","👏","💪","🤝","🤜","🤛","✌️","🖐️",
  "🔥","⚽","🏆","🎮","💯","✅","❌","⚡","🌟","💥",
  "❤️","💛","💚","💙","🖤","💜","🤍","🤎","💔","💕",
];

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const withUserId = new URLSearchParams(search).get("with");

  const [activeTab, setActiveTab] = useState<"messages" | "notifications">("messages");
  const hasSetTabRef = useRef(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveHeights, setWaveHeights] = useState<number[]>(Array.from({ length: 20 }, () => 30));
  const photoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>();
  const waveAnimRef = useRef<ReturnType<typeof setInterval>>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const typingSentRef = useRef(false);
  const selectedUserRef = useRef<any>(null);
  selectedUserRef.current = selectedUser;

  const { send } = useWebSocket((event) => {
    if (event.type === "message") {
      const msg = event.message;
      if (msg.sender?.id !== user?.id) {
        setLocalMessages(prev => {
          if (prev.some((m: any) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderId === selectedUserRef.current?.id) {
          send({ type: "read", senderId: msg.senderId });
        }
      }
    } else if (event.type === "typing") {
      if (event.userId === selectedUserRef.current?.id) {
        setIsPartnerTyping(event.isTyping);
        if (event.isTyping) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsPartnerTyping(false), 3500);
        }
      }
    } else if (event.type === "read") {
      setLocalMessages(prev =>
        prev.map((m: any) => m.senderId === user?.id ? { ...m, isRead: true } : m)
      );
    } else if (event.type === "message_deleted") {
      setLocalMessages(prev => prev.filter((m: any) => m.id !== event.messageId));
    } else if (event.type === "reaction") {
      setLocalMessages(prev =>
        prev.map((m: any) => {
          if (m.id !== event.messageId) return m;
          const current: Reaction[] = m.reactions || [];
          if (event.action === "add") {
            const found = current.find(r => r.emoji === event.emoji);
            if (found) {
              return {
                ...m,
                reactions: current.map(r =>
                  r.emoji === event.emoji
                    ? { ...r, count: r.count + 1, userIds: [...r.userIds, event.userId] }
                    : r
                )
              };
            }
            return { ...m, reactions: [...current, { emoji: event.emoji, count: 1, userIds: [event.userId] }] };
          } else {
            return {
              ...m,
              reactions: current
                .map(r =>
                  r.emoji === event.emoji
                    ? { ...r, count: r.count - 1, userIds: r.userIds.filter((id: string) => id !== event.userId) }
                    : r
                )
                .filter(r => r.count > 0)
            };
          }
        })
      );
    }
  }, !!user);

  useEffect(() => {
    setLocalMessages([]);
    setIsPartnerTyping(false);
    setActiveReactionPicker(null);
    typingSentRef.current = false;
  }, [selectedUser?.id]);

  const { data: conversations, isLoading: loadingConvs } = useQuery<any[]>({
    queryKey: ["/api/messages/conversations"],
    refetchInterval: 8000,
  });

  const { data: notifications, isLoading: loadingNotifs } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const { data: friends } = useQuery<any[]>({
    queryKey: ["/api/friends"],
  });

  const addFriendMutation = useMutation({
    mutationFn: (phone: string) => apiRequest("POST", "/api/friends/add", { phone }),
    onSuccess: () => {
      toast({ title: "Invitation envoyée !", description: "La demande d'ami a été envoyée." });
      setInvitePhone("");
      setShowInviteForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!withUserId || hasAutoSelectedRef.current) return;
    const trySelect = async () => {
      if (friends) {
        const friendMatch = friends.find((f: any) => f.friend?.id === withUserId);
        if (friendMatch) {
          hasAutoSelectedRef.current = true;
          setSelectedUser(friendMatch.friend);
          setActiveTab("messages");
          return;
        }
      }
      try {
        const resp = await fetch(`/api/users/${withUserId}`);
        if (resp.ok) {
          const userData = await resp.json();
          hasAutoSelectedRef.current = true;
          setSelectedUser(userData);
          setActiveTab("messages");
        }
      } catch {
        /* ignore */
      }
    };
    trySelect();
  }, [withUserId, friends]);

  const unreadNotifCount = notifications?.filter((n: any) => !n.isRead).length ?? 0;
  const unreadMsgCount = conversations?.reduce((sum: number, c: any) => sum + (c.unread || 0), 0) ?? 0;

  const filteredFriends = friends?.filter((f: any) =>
    friendSearch === "" ||
    f.friend?.pseudo?.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.friend?.username?.toLowerCase().includes(friendSearch.toLowerCase())
  ) ?? [];

  useEffect(() => {
    if (hasSetTabRef.current) return;
    if (notifications === undefined && conversations === undefined) return;
    
    // Si on vient d'un lien direct vers un utilisateur, on reste sur "messages"
    if (withUserId) {
      hasSetTabRef.current = true;
      setActiveTab("messages");
      return;
    }

    // Sinon, on n'ouvre l'onglet notifications que s'il y en a de NOUVELLES
    // et qu'il n'y a pas de conversations. 
    // Mais l'utilisateur veut qu'ils soient indépendants, donc on va par défaut sur "messages".
    hasSetTabRef.current = true;
    setActiveTab("messages");
  }, [notifications, conversations, withUserId]);

  const { data: messagesData, isLoading: loadingMsgs } = useQuery<any[]>({
    queryKey: ["/api/messages", selectedUser?.id],
    queryFn: selectedUser
      ? () => fetch(`/api/messages/${selectedUser.id}`).then(r => r.json())
      : undefined,
    enabled: !!selectedUser,
  });

  useEffect(() => {
    if (messagesData) {
      setLocalMessages(messagesData);
      if (selectedUser) send({ type: "read", senderId: selectedUser.id });
    }
  }, [messagesData, selectedUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isPartnerTyping]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", "/api/messages", { receiverId: selectedUser.id, content }),
    onSuccess: (data: any) => {
      const newMsg = {
        ...data,
        reactions: [],
        sender: { id: user?.id, username: user?.username, pseudo: user?.pseudo, avatarUrl: user?.avatarUrl ?? null }
      };
      setLocalMessages(prev => {
        if (prev.some((m: any) => m.id === data.id)) return prev;
        return [...prev, newMsg];
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      setMessage("");
      setPendingPhoto(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      typingSentRef.current = false;
      send({ type: "typing", receiverId: selectedUser.id, isTyping: false });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast({ title: "Fichier trop grand", description: "Maximum 20 Mo", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 900;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { setPendingPhoto(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.70);
          setPendingPhoto(compressed.length > 100 ? compressed : dataUrl);
        } catch { setPendingPhoto(dataUrl); }
      };
      img.onerror = () => setPendingPhoto(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => toast({ title: "Erreur de lecture", variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiRequest("POST", `/api/messages/${messageId}/react`, { emoji }),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => apiRequest("DELETE", `/api/messages/${messageId}`, {}),
    onSuccess: (_, messageId) => {
      setLocalMessages(prev => prev.filter((m: any) => m.id !== messageId));
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleReact = (messageId: string, emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveReactionPicker(null);
    reactMutation.mutate({ messageId, emoji });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (selectedUser) {
      const typing = e.target.value.length > 0;
      if (typing !== typingSentRef.current) {
        typingSentRef.current = typing;
        send({ type: "typing", receiverId: selectedUser.id, isTyping: typing });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && message.trim()) {
      e.preventDefault();
      sendMutation.mutate(message);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const stopWaveAnim = () => {
    clearInterval(waveAnimRef.current);
    setWaveHeights(Array.from({ length: 20 }, () => 30));
  };

  const startWaveAnim = () => {
    clearInterval(waveAnimRef.current);
    waveAnimRef.current = setInterval(() => {
      setWaveHeights(Array.from({ length: 20 }, () => Math.floor(Math.random() * 60) + 10));
    }, 120);
  };

  const startRecording = async () => {
    if (!selectedUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recordingTimerRef.current);
        stopWaveAnim();
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => sendMutation.mutate(reader.result as string);
        reader.readAsDataURL(blob);
        setRecordingTime(0);
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      startWaveAnim();
    } catch {
      toast({ title: "Microphone inaccessible", description: "Autorisez l'accès au microphone pour envoyer des messages vocaux.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.onstop = null;
      if (mr.state !== "inactive") mr.stop();
      (mr as any).stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    }
    clearInterval(recordingTimerRef.current);
    stopWaveAnim();
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      clearInterval(recordingTimerRef.current);
      clearInterval(waveAnimRef.current);
      setWaveHeights(h => h.map(() => 20));
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      startWaveAnim();
      setIsPaused(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleReactionPicker = (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveReactionPicker(prev => (prev === msgId ? null : msgId));
  };

  return (
    <div className="flex h-full" onClick={() => setActiveReactionPicker(null)}>
      {/* ── Left panel ─────────────────────────────────────── */}
      <div className={`${selectedUser ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-border`}>
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "messages"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-messages"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Messages
            {unreadMsgCount > 0 && (
              <span className="min-w-[1rem] h-4 px-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadMsgCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "notifications"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications
            {unreadNotifCount > 0 && (
              <span className="min-w-[1rem] h-4 px-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "messages" ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* New conversation button row */}
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Conversations</span>
              <button
                onClick={() => { setShowFriendPicker(p => !p); setFriendSearch(""); setShowInviteForm(false); setInvitePhone(""); }}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                data-testid="button-new-conversation"
              >
                <PenSquare className="w-3.5 h-3.5" />
                Nouveau
              </button>
            </div>

            {/* Friend picker panel */}
            {showFriendPicker && (
              <div className="border-b border-border bg-muted/30">
                <div className="px-3 py-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      autoFocus
                      value={friendSearch}
                      onChange={e => setFriendSearch(e.target.value)}
                      placeholder="Chercher un ami..."
                      className="w-full pl-8 pr-8 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      data-testid="input-friend-search"
                    />
                    {friendSearch && (
                      <button onClick={() => setFriendSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {!friends?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-3 px-4">Aucun ami. Invitez quelqu'un ci-dessous.</p>
                  ) : filteredFriends.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Aucun résultat</p>
                  ) : (
                    filteredFriends.map((f: any) => (
                      <button
                        key={f.friend.id}
                        onClick={() => { setSelectedUser(f.friend); setShowFriendPicker(false); setFriendSearch(""); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                        data-testid={`friend-pick-${f.friend.id}`}
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          {f.friend.avatarUrl && <AvatarImage src={f.friend.avatarUrl} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {(f.friend.pseudo || f.friend.username || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{f.friend.pseudo}</p>
                          <p className="text-xs text-muted-foreground truncate">@{f.friend.username}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Invite a friend */}
                <div className="border-t border-border/60">
                  <button
                    onClick={() => setShowInviteForm(p => !p)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                    data-testid="button-invite-friend"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Inviter un ami
                  </button>
                  {showInviteForm && (
                    <div className="px-3 pb-3 flex gap-2">
                      <input
                        type="tel"
                        value={invitePhone}
                        onChange={e => setInvitePhone(e.target.value)}
                        placeholder="Numéro de téléphone..."
                        className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        data-testid="input-invite-phone"
                        onKeyDown={e => { if (e.key === "Enter" && invitePhone.trim()) addFriendMutation.mutate(invitePhone.trim()); }}
                      />
                      <button
                        onClick={() => { if (invitePhone.trim()) addFriendMutation.mutate(invitePhone.trim()); }}
                        disabled={!invitePhone.trim() || addFriendMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
                        data-testid="button-send-invite"
                      >
                        {addFriendMutation.isPending ? "…" : "Envoyer"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <ScrollArea className="flex-1">
              {loadingConvs ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !conversations?.length ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune conversation</p>
                  <p className="text-xs text-muted-foreground mt-1">Cliquez sur "Nouveau" pour écrire à un ami</p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conv: any) => (
                    <button
                      key={conv.user.id}
                      onClick={() => { setSelectedUser(conv.user); setShowFriendPicker(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors overflow-hidden ${selectedUser?.id === conv.user.id ? "bg-primary/10" : "hover:bg-muted/60"}`}
                      data-testid={`conv-${conv.user.id}`}
                    >
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        {conv.user.avatarUrl && <AvatarImage src={conv.user.avatarUrl} />}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                          {conv.user.pseudo?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-semibold truncate min-w-0 flex-1 text-foreground">
                            {conv.user.pseudo || conv.user.phone}
                          </p>
                          <span className={`text-[10px] flex-shrink-0 ml-1 ${conv.unread > 0 ? "text-green-500 font-bold" : "text-muted-foreground"}`}>
                            {(() => {
                              const d = new Date(conv.lastMessage.createdAt);
                              const now = new Date();
                              const isToday = d.toDateString() === now.toDateString();
                              const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                              const isYesterday = d.toDateString() === yesterday.toDateString();
                              if (isToday) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                              if (isYesterday) return "Hier";
                              return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className={`text-xs truncate min-w-0 flex-1 ${conv.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {conv.lastMessage.content.startsWith("data:image/") ? "📷 Photo" : 
                             conv.lastMessage.content.startsWith("data:audio/") ? "🎤 Vocal" : 
                             conv.lastMessage.content}
                          </p>
                          {conv.unread > 0 && (
                            <span
                              data-testid={`badge-unread-${conv.user.id}`}
                              className="w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                            >
                              {conv.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            {loadingNotifs ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !notifications?.length ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <BellOff className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((notif: any) => {
                  const icon = notif.tournamentId
                    ? <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    : notif.matchId
                      ? <Swords className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      : <UserPlus className="w-4 h-4 text-green-500 flex-shrink-0" />;
                  return (
                    <button
                      key={notif.id}
                      onClick={() => { if (!notif.isRead) markReadMutation.mutate(notif.id); }}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted/60 ${!notif.isRead ? "bg-primary/5" : ""}`}
                      data-testid={`notif-${notif.id}`}
                    >
                      <div className="mt-0.5">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${!notif.isRead ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {notif.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(notif.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <span className="w-2 h-2 bg-primary rounded-full mt-1 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      {/* ── Chat area ────────────────────────────────────── */}
      {selectedUser ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <button className="md:hidden" onClick={() => setSelectedUser(null)} data-testid="button-back-messages">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar className="w-9 h-9">
              {selectedUser.avatarUrl && <AvatarImage src={selectedUser.avatarUrl} />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {selectedUser.pseudo.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{selectedUser.pseudo}</p>
              <p className="text-xs text-muted-foreground">@{selectedUser.username}</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 p-4">
            {loadingMsgs ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <Skeleton className="h-10 w-48 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : !localMessages.length ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucun message encore</p>
                <p className="text-xs text-muted-foreground mt-1">Envoyez le premier message !</p>
              </div>
            ) : (
              <div className="space-y-1">
                {localMessages.map((msg: any) => {
                  const isMe = msg.senderId === user?.id;
                  const reactions: Reaction[] = msg.reactions || [];
                  const showPicker = activeReactionPicker === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-1`}
                      data-testid={`msg-${msg.id}`}
                    >
                      <div className="group relative flex items-end gap-1 max-w-[80%] sm:max-w-xs">
                        {/* Avatar for received messages */}
                        {!isMe && (
                          <Avatar className="w-7 h-7 flex-shrink-0 self-end" data-testid={`avatar-msg-${msg.id}`}>
                            {selectedUser?.avatarUrl && <AvatarImage src={selectedUser.avatarUrl} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {(selectedUser?.pseudo || selectedUser?.username || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        {/* Reaction picker trigger (opposite side for sender) */}
                        {!isMe && (
                          <button
                            onClick={e => toggleReactionPicker(msg.id, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity mb-1 flex-shrink-0 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
                            data-testid={`button-react-${msg.id}`}
                          >
                            <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}

                        {/* Bubble */}
                        <div
                          className={`relative rounded-2xl text-sm shadow-sm overflow-hidden ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          } ${msg.content?.startsWith("data:image") ? "p-1" : "px-3 py-2"}`}
                        >
                          {msg.content?.startsWith("data:image") ? (
                            <img
                              src={msg.content}
                              alt="Photo"
                              className="max-w-[220px] max-h-[260px] object-contain rounded-xl block"
                              data-testid={`img-msg-${msg.id}`}
                            />
                          ) : msg.content?.startsWith("data:audio") ? (
                            <audio
                              controls
                              src={msg.content}
                              data-testid={`audio-msg-${msg.id}`}
                              className="max-w-[240px] h-10 rounded-lg"
                              style={{ colorScheme: "normal" }}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                            <span className={`text-xs ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMe && (
                              msg.isRead
                                ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" data-testid={`status-read-${msg.id}`} />
                                : <Check className="w-3.5 h-3.5 text-primary-foreground/60" data-testid={`status-sent-${msg.id}`} />
                            )}
                          </div>
                        </div>

                        {isMe && (
                          <div className="flex flex-col gap-0.5 mb-1">
                            <button
                              onClick={e => toggleReactionPicker(msg.id, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
                              data-testid={`button-react-${msg.id}`}
                            >
                              <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); if (window.confirm("Supprimer ce message ?")) deleteMessageMutation.mutate(msg.id); }}
                              className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-destructive/10 active:bg-destructive/20 flex items-center justify-center"
                              data-testid={`button-delete-msg-${msg.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive/50" />
                            </button>
                          </div>
                        )}

                        {/* Emoji picker */}
                        {showPicker && (
                          <div
                            className={`absolute bottom-full mb-1 z-50 bg-popover border border-border rounded-full px-2 py-1 flex gap-1 shadow-lg ${isMe ? "right-8" : "left-8"}`}
                            onClick={e => e.stopPropagation()}
                          >
                            {EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={e => handleReact(msg.id, emoji, e)}
                                className="text-lg hover:scale-125 transition-transform"
                                data-testid={`emoji-${emoji}-${msg.id}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                          {reactions.map(r => {
                            const iMeReacted = r.userIds.includes(user?.id ?? "");
                            return (
                              <button
                                key={r.emoji}
                                onClick={e => handleReact(msg.id, r.emoji, e)}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                  iMeReacted
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                                }`}
                                data-testid={`reaction-${r.emoji}-${msg.id}`}
                              >
                                <span>{r.emoji}</span>
                                {r.count > 1 && <span>{r.count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isPartnerTyping && (
                  <div className="flex items-end gap-2" data-testid="typing-indicator">
                    <Avatar className="w-7 h-7 flex-shrink-0 self-end">
                      {selectedUser?.avatarUrl && <AvatarImage src={selectedUser.avatarUrl} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {(selectedUser?.pseudo || selectedUser?.username || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
                      <span className="animate-bounce inline-block" style={{ animationDelay: "0ms" }}>•</span>
                      <span className="animate-bounce inline-block" style={{ animationDelay: "150ms" }}>•</span>
                      <span className="animate-bounce inline-block" style={{ animationDelay: "300ms" }}>•</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* WhatsApp-style input bar */}
          <div
            className="border-t border-border bg-background"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Hidden file input for photos */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*,image/heic,image/heif"
              className="hidden"
              onChange={handlePhotoSelect}
              id="chat-photo-input"
            />

            {/* Emoji panel — hidden while recording */}
            {showInputEmoji && !isRecording && (
              <div className="px-3 pt-2 pb-1 grid grid-cols-10 gap-0.5 border-b border-border bg-muted/30">
                {INPUT_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setMessage(prev => prev + emoji)}
                    className="text-xl h-9 flex items-center justify-center hover:bg-muted rounded transition-colors active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Pending photo preview — hidden while recording */}
            {pendingPhoto && !isRecording && (
              <div className="px-3 pt-2 pb-1 border-b border-border flex items-start gap-2">
                <div className="relative">
                  <img src={pendingPhoto} alt="Aperçu" className="h-20 max-w-[140px] object-contain rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => { setPendingPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-[10px] shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Photo prête à envoyer</p>
              </div>
            )}

            {isRecording ? (
              /* ── Recording UI (WhatsApp style full panel) ── */
              <div className="px-3 py-3 flex flex-col gap-2">
                {/* Top row: timer + waveform */}
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono text-sm font-bold text-red-500 tabular-nums w-10 flex-shrink-0"
                    data-testid="text-recording-timer"
                  >
                    {formatRecordingTime(recordingTime)}
                  </span>
                  {/* Waveform bars */}
                  <div className="flex-1 flex items-center justify-center gap-[2px] h-10">
                    {waveHeights.map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${isPaused ? 20 : h}%`, transition: "height 100ms ease" }}
                        className={`w-[3px] rounded-full flex-shrink-0 ${isPaused ? "bg-muted-foreground/40" : "bg-primary"}`}
                      />
                    ))}
                  </div>
                </div>
                {/* Bottom row: delete | pause/resume | send */}
                <div className="flex items-center justify-between">
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid="button-cancel-recording"
                    title="Supprimer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  {/* Pause / Resume */}
                  <button
                    type="button"
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    data-testid="button-pause-recording"
                    title={isPaused ? "Reprendre" : "Pause"}
                  >
                    {isPaused ? (
                      <Mic className="w-5 h-5" />
                    ) : (
                      /* Two bars like WhatsApp pause icon */
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <rect x="5" y="4" width="4" height="16" rx="1" />
                        <rect x="15" y="4" width="4" height="16" rx="1" />
                      </svg>
                    )}
                  </button>

                  {/* Send */}
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={sendMutation.isPending}
                    className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg active:scale-95 transition-transform disabled:opacity-60"
                    data-testid="button-send-voice"
                    title="Envoyer"
                  >
                    {sendMutation.isPending
                      ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal input bar ── */
              <div className="flex items-center gap-1.5 px-2 py-2 min-h-[56px] w-full">
                {/* Left: emoji toggle */}
                <button
                  type="button"
                  onClick={() => setShowInputEmoji(p => !p)}
                  className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${showInputEmoji ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  data-testid="button-emoji-picker"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Center: text input pill */}
                <div className="flex-1 min-w-0 flex items-center bg-muted dark:bg-muted/60 rounded-full px-4 min-h-[40px]">
                  <input
                    value={message}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowInputEmoji(false)}
                    placeholder={pendingPhoto ? "Ajouter une légende…" : "Message"}
                    data-testid="input-message"
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-muted-foreground py-2"
                  />
                </div>

                {/* Right: send OR paperclip+mic */}
                {(message.trim() || pendingPhoto) ? (
                  <button
                    type="button"
                    onClick={() => sendMutation.mutate(pendingPhoto ?? message)}
                    disabled={sendMutation.isPending}
                    data-testid="button-send-message"
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md active:scale-95 transition-transform disabled:opacity-60"
                  >
                    {sendMutation.isPending
                      ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <label
                      htmlFor="chat-photo-input"
                      className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      data-testid="button-attach"
                      title="Pièce jointe"
                    >
                      <Paperclip className="w-5 h-5" />
                    </label>
                    <button
                      type="button"
                      onClick={handleMicClick}
                      className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform"
                      data-testid="button-mic"
                      title="Enregistrer un message vocal"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center flex-col text-center gap-2">
          <MessageSquare className="w-12 h-12 text-muted-foreground" />
          <h3 className="font-semibold">Sélectionnez une conversation</h3>
          <p className="text-sm text-muted-foreground">Choisissez un ami pour commencer à discuter</p>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Check, Plus, MessageSquare, FolderPlus, UserCheck, UserMinus, Sword } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/lib/locale";

export default function Friends() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const [phone, setPhone] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const { data: friends, isLoading: loadingF } = useQuery<any[]>({ queryKey: ["/api/friends"] });
  const { data: requests, isLoading: loadingR } = useQuery<any[]>({ queryKey: ["/api/friends/requests"] });
  const { data: groups, isLoading: loadingG } = useQuery<any[]>({ queryKey: ["/api/groups"] });

  const addFriendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/friends/add", { phone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      setPhone("");
      toast({ title: t("friends.invited") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/friends/accept/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests/count"] });
      toast({ title: t("friends.accepted") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const createGroupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/groups", { name: groupName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setGroupName("");
      setGroupDialogOpen(false);
      toast({ title: t("friends.group_created") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const addToGroupMutation = useMutation({
    mutationFn: ({ groupId, friendId }: { groupId: string; friendId: string }) =>
      apiRequest("POST", `/api/groups/${groupId}/members`, { friendId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: t("friends.added_to_group") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendId: string) => apiRequest("DELETE", `/api/friends/${friendId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: t("friends.removed") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("friends.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("friends.subtitle")}</p>
        </div>
      </div>

      {/* Add Friend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            {t("friends.add_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t("friends.phone_placeholder")}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              data-testid="input-friend-phone"
              className="flex-1"
            />
            <Button
              onClick={() => addFriendMutation.mutate()}
              disabled={!phone.trim() || addFriendMutation.isPending}
              data-testid="button-add-friend"
            >
              {addFriendMutation.isPending ? "..." : t("friends.invite")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("friends.invite_note")}</p>
        </CardContent>
      </Card>

      {/* Friend Requests */}
      {requests && requests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              {t("friends.requests")}
              <Badge className="text-xs">{requests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-200" data-testid={`request-${req.id}`}>
                <Avatar className="w-9 h-9 flex-shrink-0">
                  {req.user.avatarUrl && <AvatarImage src={req.user.avatarUrl} alt={req.user.pseudo} />}
                  <AvatarFallback className="bg-amber-500/10 text-amber-600 font-bold">
                    {req.user.pseudo.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{req.user.pseudo}</p>
                  <p className="text-xs text-muted-foreground">@{req.user.username}</p>
                </div>
                <Button size="sm" onClick={() => acceptMutation.mutate(req.id)} disabled={acceptMutation.isPending} data-testid={`button-accept-${req.id}`}>
                  <Check className="w-4 h-4 mr-1" />
                  {t("friends.accept")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Friends List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {t("friends.my_friends")} ({friends?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingF ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : friends?.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("friends.no_friends")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends?.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg" data-testid={`friend-${f.id}`}>
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      {f.friend.avatarUrl && <AvatarImage src={f.friend.avatarUrl} alt={f.friend.pseudo} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {f.friend.pseudo.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.friend.pseudo}</p>
                      <p className="text-xs text-muted-foreground">{f.friend.country}</p>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/challenges?challenge=${f.friend.id}&pseudo=${encodeURIComponent(f.friend.pseudo)}`}>
                        <Button size="icon" variant="ghost" data-testid={`button-challenge-${f.friend.id}`}>
                          <Sword className="w-4 h-4 text-primary" />
                        </Button>
                      </Link>
                      <Link href={`/messages?with=${f.friend.id}`}>
                        <Button size="icon" variant="ghost" data-testid={`button-message-${f.friend.id}`}>
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`${t("friends.remove_confirm")} ${f.friend.pseudo} ${t("friends.from_friends")}`)) {
                            removeFriendMutation.mutate(f.id);
                          }
                        }}
                        disabled={removeFriendMutation.isPending}
                        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20"
                        data-testid={`button-remove-friend-${f.friend.id}`}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Friend Groups */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-primary" />
              {t("friends.groups")}
            </CardTitle>
            <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-create-group">
                  <Plus className="w-3 h-3 mr-1" />
                  {t("friends.create_group")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("friends.group_dialog_title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder={t("friends.group_name_placeholder")}
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    data-testid="input-group-name"
                  />
                  <Button
                    onClick={() => createGroupMutation.mutate()}
                    disabled={!groupName.trim() || createGroupMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-group"
                  >
                    {createGroupMutation.isPending ? t("friends.group_creating") : t("friends.group_create")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingG ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : groups?.length === 0 ? (
              <div className="text-center py-6">
                <FolderPlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("friends.no_groups")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups?.map(g => (
                  <div key={g.id} className="p-3 rounded-lg border border-border" data-testid={`group-${g.id}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-medium">{g.name}</p>
                      <Badge variant="outline" className="text-xs">{g.members.length} {t("friends.members")}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {g.members.slice(0, 5).map((m: any) => (
                        <Avatar key={m.id} className="w-6 h-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{m.pseudo.charAt(0)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {friends && friends.length > 0 && (
                      <select
                        className="w-full text-xs border border-border rounded-md px-2 py-1 bg-background"
                        onChange={e => {
                          if (e.target.value) addToGroupMutation.mutate({ groupId: g.id, friendId: e.target.value });
                          e.target.value = "";
                        }}
                        data-testid={`select-group-member-${g.id}`}
                      >
                        <option value="">{t("friends.add_to_group")}</option>
                        {friends.filter(f => !g.members.some((m: any) => m.id === f.friend.id)).map(f => (
                          <option key={f.friend.id} value={f.friend.id}>{f.friend.pseudo}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

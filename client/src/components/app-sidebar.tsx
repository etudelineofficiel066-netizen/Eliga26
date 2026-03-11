import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, LayoutDashboard, MessageSquare, Users, Search, Plus, LogOut, Swords, BarChart3, User, Store, Sword, Clapperboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/locale";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { t } = useLocale();

  const navItems = [
    { key: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard },
    { key: "nav.profile", url: "/profile", icon: User },
    { key: "nav.tournaments", url: "/tournaments", icon: Trophy },
    { key: "nav.search", url: "/search", icon: Search },
    { key: "nav.create_tournament", url: "/create-tournament", icon: Plus },
    { key: "nav.clips", url: "/clips", icon: Clapperboard },
    { key: "nav.messages", url: "/messages", icon: MessageSquare },
    { key: "nav.friends", url: "/friends", icon: Users },
    { key: "nav.matches", url: "/matches", icon: Swords },
    { key: "nav.stats", url: "/stats", icon: BarChart3 },
    { key: "nav.market", url: "/market", icon: Store },
    { key: "nav.challenges", url: "/challenges", icon: Sword },
  ];

  const { data: friendReqData } = useQuery<{ count: number }>({
    queryKey: ["/api/friends/requests/count"],
    refetchInterval: 30000,
  });

  const { data: notifData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 8000,
  });

  const { data: meData } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const fullUser = meData?.user ?? user;

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Trophy className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground">eLIGA</h1>
            <p className="text-[10px] text-muted-foreground">eFootball Tournaments</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <SidebarGroup className="py-0">
          <SidebarGroupContent className="py-0">
            <SidebarMenu className="gap-0">
              {navItems.map((item) => {
                const title = t(item.key);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={location === item.url} className="py-1">
                      <Link href={item.url} data-testid={`nav-${item.url.replace("/", "").replace("-", "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{title}</span>
                        {item.key === "nav.friends" && friendReqData?.count != null && friendReqData.count > 0 && (
                          <Badge className="ml-auto text-xs">{friendReqData.count}</Badge>
                        )}
                        {item.key === "nav.messages" && notifData?.count != null && notifData.count > 0 && (
                          <Badge className="ml-auto text-xs">{notifData.count}</Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-2 space-y-2">
        {user && (
          <div className="flex items-center gap-3">
            <Link href="/profile" data-testid="link-profile">
              <Avatar className="w-9 h-9 cursor-pointer">
                {fullUser?.avatarUrl && <AvatarImage src={fullUser.avatarUrl} className="object-cover" />}
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {(fullUser?.pseudo ?? user.pseudo).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href="/profile">
                <p className="text-sm font-medium text-sidebar-foreground truncate hover:text-primary cursor-pointer">{fullUser?.pseudo ?? user.pseudo}</p>
              </Link>
              <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
            </div>
            <button onClick={logout} className="text-muted-foreground hover-elevate rounded-md p-1" data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center leading-tight">
          © {new Date().getFullYear()} eLIGA · <span className="font-medium">Maodo ka</span>
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

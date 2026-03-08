import { Link, useLocation } from "wouter";
import { LayoutDashboard, Trophy, MessageSquare, Swords, Clapperboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const items = [
  { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tournois", href: "/tournaments", icon: Trophy },
  { label: "Clips", href: "/clips", icon: Clapperboard },
  { label: "Matchs", href: "/matches", icon: Swords },
  { label: "Messages", href: "/messages", icon: MessageSquare },
];

export function BottomNav() {
  const [location] = useLocation();

  const { data: notifData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 8000,
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-card/95 backdrop-blur-md border-t border-border safe-area-pb"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-16">
        {items.map(({ label, href, icon: Icon }) => {
          const isActive =
            location === href ||
            (href === "/dashboard" && (location === "/" || location === ""));
          const hasNotif =
            href === "/messages" &&
            notifData?.count != null &&
            notifData.count > 0;
          return (
            <Link key={href} href={href}>
              <div
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-150 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:scale-90"
                }`}
                data-testid={`bottom-nav-${label.toLowerCase()}`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  {hasNotif && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {notifData!.count > 9 ? "9+" : notifData!.count}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium leading-none ${isActive ? "font-semibold" : ""}`}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import { Link, useLocation } from "wouter";
import { LayoutDashboard, Trophy, MessageSquare, Swords, Clapperboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/lib/locale";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useLocale();

  const items = [
    { key: "nav.home", href: "/dashboard", icon: LayoutDashboard },
    { key: "nav.tournaments", href: "/tournaments", icon: Trophy },
    { key: "nav.clips", href: "/clips", icon: Clapperboard },
    { key: "nav.matches", href: "/matches", icon: Swords },
    { key: "nav.messages", href: "/messages", icon: MessageSquare },
  ];

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
        {items.map(({ key, href, icon: Icon }) => {
          const label = t(key);
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
                data-testid={`bottom-nav-${href.replace("/", "")}`}
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

import { Switch, Route, useLocation } from "wouter";
import { Component, type ReactNode, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/BottomNav";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import { useNotificationPoller } from "@/hooks/use-notification-poller";

// Runs the notification poller + handles SW navigation messages globally
function GlobalNotificationPoller() {
  useNotificationPoller();

  // When user taps a notification banner, the SW sends NAVIGATE — redirect the app
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "NAVIGATE" && event.data.url) {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "sans-serif", background: "#f9fafb" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#111" }}>Une erreur est survenue</h1>
          <p style={{ color: "#666", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
            L'application a rencontré un problème. Rafraîchissez la page pour réessayer.
          </p>
          <pre style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem", fontSize: 12, color: "#dc2626", maxWidth: 500, overflow: "auto", marginBottom: 24 }}>
            {(this.state.error as Error).message}
          </pre>
          <button onClick={() => window.location.reload()} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "0.75rem 2rem", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>
            Rafraîchir
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import CreateTournament from "@/pages/CreateTournament";
import SearchTournaments from "@/pages/SearchTournaments";
import Messages from "@/pages/Messages";
import Friends from "@/pages/Friends";
import Matches from "@/pages/Matches";
import Stats from "@/pages/Stats";
import Profile from "@/pages/Profile";
import Market from "@/pages/Market";
import Challenges from "@/pages/Challenges";
import AdminDashboard from "@/pages/AdminDashboard";
import Clips from "@/pages/Clips";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_TITLES: Record<string, string> = {
  "/": "Tableau de bord",
  "/dashboard": "Tableau de bord",
  "/tournaments": "Mes tournois",
  "/create-tournament": "Créer un tournoi",
  "/search": "Rechercher",
  "/messages": "Messages",
  "/friends": "Amis",
  "/matches": "Mes matchs",
  "/stats": "Statistiques",
  "/profile": "Mon profil",
  "/market": "Marché",
  "/challenges": "Défis",
  "/clips": "eLIGA Clips",
};

function AppHeader() {
  const [location] = useLocation();
  const pageTitle =
    PAGE_TITLES[location] ??
    (location.startsWith("/tournaments/") ? "Tournoi" : "eLIGA");

  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-border flex-shrink-0 bg-card sticky top-0 z-40">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-6 h-6 rounded-md bg-primary flex-shrink-0 items-center justify-center hidden sm:flex">
          <span className="text-[10px] font-bold text-primary-foreground">E</span>
        </span>
        <span className="text-sm font-semibold text-primary hidden sm:block">eLIGA</span>
        <span className="text-muted-foreground text-xs hidden sm:block">·</span>
        <span className="text-sm font-semibold truncate">{pageTitle}</span>
      </div>
      <PWAInstallButton variant="header" />
    </header>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 w-64 text-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary">E</span>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-3/4 rounded-full mx-auto" />
          <Skeleton className="h-3 w-1/2 rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) return <Home />;

  if (user.isAdmin) {
    return (
      <Switch>
        <Route path="/tournaments/:id">
          {() => (
            <div className="min-h-screen bg-background">
              <div className="sticky top-0 z-50 border-b bg-card px-4 py-2 flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  ← Retour admin
                </button>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs font-semibold text-primary">eLIGA Admin</span>
              </div>
              <TournamentDetail />
            </div>
          )}
        </Route>
        <Route component={AdminDashboard} />
      </Switch>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />
          <main className={`flex-1 min-h-0 ${location === "/messages" || location === "/clips" ? "overflow-hidden" : "overflow-y-auto"}`}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/tournaments" component={Tournaments} />
              <Route path="/tournaments/:id" component={TournamentDetail} />
              <Route path="/create-tournament" component={CreateTournament} />
              <Route path="/search" component={SearchTournaments} />
              <Route path="/messages" component={Messages} />
              <Route path="/friends" component={Friends} />
              <Route path="/matches" component={Matches} />
              <Route path="/stats" component={Stats} />
              <Route path="/profile" component={Profile} />
              <Route path="/market" component={Market} />
              <Route path="/challenges" component={Challenges} />
              <Route path="/clips" component={Clips} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <div className="h-16 sm:hidden flex-shrink-0" aria-hidden="true" />
        </div>
      </div>
      <BottomNav />
      <OnboardingTutorial />
    </SidebarProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <GlobalNotificationPoller />
            <AppContent />
            <PWAInstallPrompt />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

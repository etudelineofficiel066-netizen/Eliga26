import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props {
  variant?: "header" | "banner" | "hero";
}

export function PWAInstallButton({ variant = "header" }: Props) {
  const { canInstall, isInstalling, install } = usePWAInstall();

  if (!canInstall) return null;

  if (variant === "banner") {
    return (
      <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Download className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium truncate">Installez eLIGA sur votre appareil</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={install}
          disabled={isInstalling}
          className="flex-shrink-0 font-semibold"
          data-testid="button-pwa-install-banner"
        >
          {isInstalling ? "…" : "Installer"}
        </Button>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <Button
        onClick={install}
        disabled={isInstalling}
        className="mt-4 gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
        data-testid="button-pwa-install-hero"
      >
        <Download className="w-4 h-4" />
        {isInstalling ? "Installation…" : "Installer l'application"}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={install}
      disabled={isInstalling}
      className="gap-1.5 hidden sm:flex"
      data-testid="button-pwa-install-header"
    >
      <Download className="w-4 h-4" />
      {isInstalling ? "…" : "Installer"}
    </Button>
  );
}

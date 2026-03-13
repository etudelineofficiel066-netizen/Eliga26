import { useState, useEffect, useRef } from "react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";
import { Trophy } from "lucide-react";

const DISMISSED_AT_KEY = "eliga-pwa-dismissed-at";
const DISMISS_COUNT_KEY = "eliga-pwa-dismiss-count";
const SNOOZE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_MODAL_DISMISSALS = 5; // after 5 dismissals, stop showing the modal

function shouldShowModal(): boolean {
  const count = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || "0", 10);
  if (count >= MAX_MODAL_DISMISSALS) return false;
  const dismissedAt = parseInt(localStorage.getItem(DISMISSED_AT_KEY) || "0", 10);
  if (!dismissedAt) return true;
  return Date.now() - dismissedAt > SNOOZE_MS;
}

export function PWAInstallPrompt() {
  const { canInstall, isInstalling, isIOS, install, isInstalled } = usePWAInstall();
  const [modalVisible, setModalVisible] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const shownRef = useRef(false);

  const showCondition = (canInstall || isIOS) && !isInstalled;

  useEffect(() => {
    if (!showCondition) return;

    // Always show the persistent bottom banner
    setBannerVisible(true);

    // Show modal based on snooze/count logic
    if (shownRef.current) return;
    if (!shouldShowModal()) return;

    shownRef.current = true;
    const timer = setTimeout(() => setModalVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [showCondition]);

  // Re-check every minute if snooze expired → re-show modal
  useEffect(() => {
    if (!showCondition) return;
    const interval = setInterval(() => {
      if (!modalVisible && shouldShowModal()) {
        setModalVisible(true);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [showCondition, modalVisible]);

  const dismissModal = () => {
    setModalVisible(false);
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    const count = parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || "0", 10);
    localStorage.setItem(DISMISS_COUNT_KEY, String(count + 1));
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSSteps(true);
      return;
    }
    await install();
    setModalVisible(false);
    setBannerVisible(false);
  };

  const handleBannerInstall = async () => {
    if (isIOS) {
      setModalVisible(true);
      setShowIOSSteps(true);
      return;
    }
    await install();
    setBannerVisible(false);
  };

  if (!showCondition) return null;

  return (
    <>
      {/* ── Persistent bottom banner ───────────────────────── */}
      {bannerVisible && !modalVisible && (
        <div
          className="fixed bottom-16 sm:bottom-4 left-0 right-0 z-40 px-3 pb-1"
          data-testid="pwa-install-banner"
          style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-md mx-auto bg-primary text-primary-foreground rounded-2xl shadow-2xl flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Installer eLIGA</p>
              <p className="text-xs text-primary-foreground/80 leading-tight">Accès rapide depuis l'écran d'accueil</p>
            </div>
            <button
              onClick={handleBannerInstall}
              disabled={isInstalling}
              className="flex-shrink-0 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-white/90 transition-colors"
              data-testid="button-pwa-banner-install"
            >
              Installer
            </button>
            <button
              onClick={() => setModalVisible(true)}
              className="flex-shrink-0 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              data-testid="button-pwa-banner-info"
              aria-label="En savoir plus"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal overlay ──────────────────────────────────── */}
      {modalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          data-testid="pwa-install-prompt"
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-primary px-6 pt-6 pb-8 text-primary-foreground text-center relative">
              <button
                onClick={dismissModal}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                data-testid="button-pwa-dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold">Installer eLIGA</h2>
              <p className="text-sm text-primary-foreground/80 mt-1">
                Accédez à vos tournois en un clic, même hors ligne
              </p>
            </div>

            <div className="px-6 py-5">
              {!showIOSSteps ? (
                <>
                  <ul className="space-y-2.5 mb-5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                      Lancement instantané depuis l'écran d'accueil
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                      Notifications pour vos matchs et tournois
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                      Expérience plein écran sans barre de navigation
                    </li>
                  </ul>

                  <Button
                    className="w-full gap-2 text-sm font-semibold mb-2"
                    onClick={handleInstall}
                    disabled={isInstalling}
                    data-testid="button-pwa-install"
                  >
                    <Download className="w-4 h-4" />
                    {isInstalling ? "Installation…" : "Installer maintenant"}
                  </Button>
                  <button
                    className="w-full text-xs text-muted-foreground py-1.5 hover:text-foreground transition-colors"
                    onClick={dismissModal}
                    data-testid="button-pwa-later"
                  >
                    Me rappeler dans 2h
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground mb-3">
                    Pour installer sur iOS :
                  </p>
                  <ol className="space-y-3 mb-5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <span>Appuyez sur le bouton <Share className="w-4 h-4 inline mx-0.5 text-blue-500" /> <strong>Partager</strong> en bas de Safari</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <span>Faites défiler et appuyez sur <strong>"Sur l'écran d'accueil"</strong> <Plus className="w-4 h-4 inline mx-0.5" /></span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <span>Confirmez en appuyant sur <strong>"Ajouter"</strong> en haut à droite</span>
                    </li>
                  </ol>
                  <Button
                    className="w-full mb-2"
                    onClick={dismissModal}
                    data-testid="button-pwa-ios-done"
                  >
                    J'ai compris
                  </Button>
                  <button
                    className="w-full text-xs text-muted-foreground py-1 hover:text-foreground transition-colors"
                    onClick={dismissModal}
                    data-testid="button-pwa-ios-later"
                  >
                    Plus tard
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

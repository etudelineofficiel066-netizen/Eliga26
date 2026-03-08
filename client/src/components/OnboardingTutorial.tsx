import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Trophy, Swords, MessageSquare, User, LayoutDashboard,
  Plus, Search, Users, Star, CheckCircle, ChevronRight, ChevronLeft, X,
  BarChart3, Bell, Shield, Gamepad2, Coins, Banknote, Mic, ShieldOff
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "eliga-onboarding-done";

interface Step {
  icon: React.ReactNode;
  color: string;
  title: string;
  description: string;
  tip: string;
  visual: React.ReactNode;
}

const steps: Step[] = [
  {
    icon: <Trophy className="w-8 h-8 text-white" />,
    color: "from-primary to-blue-600",
    title: "Bienvenue sur eLIGA !",
    description: "La plateforme de tournois eFootball entre joueurs. Créez ou rejoignez des tournois, affrontez vos amis et grimpez au classement.",
    tip: "Ce guide rapide va vous montrer comment tout fonctionne en 7 étapes.",
    visual: (
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <div className="text-white/80 text-2xl font-bold">×</div>
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
          <Gamepad2 className="w-8 h-8 text-white" />
        </div>
        <div className="text-white/80 text-2xl font-bold">×</div>
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
          <Star className="w-8 h-8 text-white" />
        </div>
      </div>
    ),
  },
  {
    icon: <Star className="w-8 h-8 text-white" />,
    color: "from-amber-500 to-yellow-600",
    title: "Étoiles & Niveau",
    description: "Votre niveau va de 1★ à 5★. Plus vous jouez et gagnez, plus vous montez. Les étoiles débloquent l'accès aux tournois Élite et Sponsorisés.",
    tip: "Gagnez un tournoi avec +5 joueurs pour obtenir 1 étoile bonus automatiquement !",
    visual: (
      <div className="flex flex-col gap-2 py-2">
        {[
          { stars: 1, label: "Participant", desc: "5 matchs joués", color: "bg-gray-400/30" },
          { stars: 2, label: "Amateur", desc: "20 matchs · 35% victoires", color: "bg-blue-400/30" },
          { stars: 3, label: "Compétiteur", desc: "50 matchs · 50% victoires", color: "bg-purple-400/30" },
          { stars: 4, label: "Pro", desc: "100 matchs · 65% victoires", color: "bg-amber-400/30" },
          { stars: 5, label: "Élite", desc: "200 matchs · 75% victoires", color: "bg-yellow-300/30" },
        ].map((tier, i) => (
          <div key={i} className={`flex items-center gap-2.5 ${tier.color} rounded-xl px-3 py-1.5`}>
            <span className="text-sm font-bold text-white">{Array(tier.stars).fill("⭐").join("")}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold">{tier.label}</p>
              <p className="text-white/60 text-[10px]">{tier.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <Coins className="w-8 h-8 text-white" />,
    color: "from-yellow-500 to-amber-600",
    title: "Pièces eLIGA 🪙",
    description: "Achetez des pièces via Orange Money ou Wave pour booster votre progression. 300 pièces = 1 étoile bonus instantanée !",
    tip: "Rendez-vous dans Marché → Pièces pour acheter vos packs. Solde toujours visible sur votre profil.",
    visual: (
      <div className="flex flex-col gap-2.5 py-2">
        {[
          { name: "Starter", coins: 100, price: "150 FCFA", popular: false },
          { name: "Champion", coins: 300, price: "600 FCFA", popular: true },
          { name: "Élite", coins: 600, price: "900 FCFA", popular: false },
        ].map((pack, i) => (
          <div key={i} className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 ${pack.popular ? "bg-yellow-300/30 ring-1 ring-yellow-300/50" : "bg-white/10"}`}>
            {pack.popular && (
              <span className="absolute -top-2 left-3 bg-yellow-400 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full">POPULAIRE</span>
            )}
            <Coins className="w-5 h-5 text-yellow-300 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white text-xs font-semibold">{pack.coins} pièces — {pack.name}</p>
            </div>
            <span className="text-yellow-200 text-xs font-bold">{pack.price}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 bg-red-400/20 rounded-xl px-3 py-2">
          <ShieldOff className="w-3.5 h-3.5 text-red-300 flex-shrink-0" />
          <p className="text-[10px] text-red-200">Fraude = blocage immédiat · 3 rejets = blocage auto</p>
        </div>
      </div>
    ),
  },
  {
    icon: <Trophy className="w-8 h-8 text-white" />,
    color: "from-amber-500 to-orange-600",
    title: "Types de tournois",
    description: "4 types de tournois : Gratuit, Cotisation (frais d'entrée), Sponsorisé (prix à gagner) et Élite (réservé aux joueurs 3★+).",
    tip: "Les tournois avec +5 joueurs distribuent des trophées et des étoiles bonus aux gagnants !",
    visual: (
      <div className="flex flex-col gap-2 py-2">
        {[
          { icon: <Gamepad2 className="w-4 h-4" />, label: "Gratuit", desc: "Ouvert à tous", color: "bg-blue-400/30" },
          { icon: <Banknote className="w-4 h-4" />, label: "Cotisation", desc: "Frais d'entrée · Prize pool", color: "bg-green-400/30" },
          { icon: <Star className="w-4 h-4" />, label: "Sponsorisé", desc: "Prix garantis par sponsor", color: "bg-amber-400/30" },
          { icon: <Shield className="w-4 h-4" />, label: "Élite", desc: "Réservé aux 3★ et plus", color: "bg-purple-400/30" },
        ].map((t, i) => (
          <div key={i} className={`flex items-center gap-2.5 ${t.color} rounded-xl px-3 py-2`}>
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white flex-shrink-0">{t.icon}</div>
            <div>
              <p className="text-white text-xs font-semibold">{t.label}</p>
              <p className="text-white/60 text-[10px]">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <Swords className="w-8 h-8 text-white" />,
    color: "from-red-500 to-rose-700",
    title: "Matchs & Scores",
    description: "Jouez vos matchs et saisissez le score. L'adversaire confirme le résultat. Joignez une capture d'écran comme preuve pour éviter toute contestation.",
    tip: "Vous pouvez rectifier un score au maximum 2 fois. Soyez honnête — la communauté vous observe !",
    visual: (
      <div className="bg-white/15 rounded-2xl p-4 mt-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-sm">A</div>
          <div className="flex-1 text-center">
            <p className="text-white/60 text-xs mb-1">Score final</p>
            <p className="text-white text-2xl font-black font-mono">2 — 1</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-sm">B</div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-green-400/30 rounded-lg py-2">
            <CheckCircle className="w-4 h-4 text-green-300" />
            <span className="text-green-200 text-xs font-semibold">Confirmer</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 rounded-lg py-2">
            <X className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-xs font-semibold">Rejeter</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <MessageSquare className="w-8 h-8 text-white" />,
    color: "from-emerald-500 to-teal-700",
    title: "Messages & Amis",
    description: "Discutez avec vos adversaires en messages privés, envoyez des notes vocales et planifiez vos matchs comme sur WhatsApp.",
    tip: "Appuyez sur le micro pour enregistrer un message vocal. Vos photos et avatars s'affichent dans la conversation.",
    visual: (
      <div className="flex flex-col gap-2 py-2">
        <div className="flex gap-2 items-end">
          <div className="w-7 h-7 rounded-full bg-blue-400/40 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">K</div>
          <div className="bg-white/20 rounded-2xl rounded-bl-none px-3 py-2 max-w-[75%]">
            <p className="text-white text-xs">RDV ce soir 21h ? 🎮</p>
          </div>
        </div>
        <div className="flex gap-2 items-end justify-end">
          <div className="bg-blue-400/40 rounded-2xl rounded-br-none px-3 py-2 max-w-[75%]">
            <div className="flex items-center gap-2">
              <Mic className="w-3 h-3 text-white" />
              <div className="flex items-end gap-0.5">
                {[3,5,4,6,3,5,4,3,5,6].map((h, i) => (
                  <div key={i} className="w-0.5 bg-white/70 rounded-full" style={{ height: `${h * 2}px` }} />
                ))}
              </div>
              <p className="text-white/70 text-[10px]">0:08</p>
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-purple-400/40 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">M</div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="w-7 h-7 rounded-full bg-blue-400/40 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">K</div>
          <div className="bg-white/20 rounded-2xl rounded-bl-none px-3 py-2">
            <p className="text-white text-xs">GG ! Revanche demain 👊</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-white" />,
    color: "from-primary to-indigo-700",
    title: "Vous êtes prêt !",
    description: "Complétez votre profil, rejoignez un tournoi et commencez à gagner des étoiles. Champions, des trophées vous attendent !",
    tip: "Bonne chance et que le meilleur gagne ! 🏆",
    visual: (
      <div className="flex flex-col items-center gap-3 py-3">
        <div className="flex gap-3 justify-center">
          {[
            { Icon: User, label: "Profil" },
            { Icon: Trophy, label: "Tournois" },
            { Icon: Coins, label: "Pièces" },
            { Icon: Star, label: "Étoiles" },
          ].map(({ Icon, label }, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white/80" />
              </div>
              <p className="text-white/60 text-[9px]">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 mt-1">
          <Trophy className="w-4 h-4 text-yellow-300" />
          <p className="text-white text-xs font-semibold">Champion = +1 étoile bonus 🥇</p>
        </div>
        <div className="flex items-center gap-2 bg-red-400/20 rounded-xl px-4 py-2 w-full">
          <ShieldOff className="w-3.5 h-3.5 text-red-300 flex-shrink-0" />
          <p className="text-[10px] text-red-200 leading-relaxed">Fraude ou 3 rejets de paiement = blocage définitif du compte</p>
        </div>
      </div>
    ),
  },
];

export function OnboardingTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [, navigate] = useLocation();

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const handleFinish = () => {
    finish();
    navigate("/profile");
  };

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) finish(); }}
      data-testid="onboarding-tutorial"
    >
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
        <div className={`bg-gradient-to-br ${current.color} px-6 pt-5 pb-6 relative`}>
          <button
            onClick={finish}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-white"
            data-testid="button-onboarding-close"
            aria-label="Fermer le tutoriel"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <div className="bg-white/20 rounded-full px-2.5 py-0.5 text-white text-xs font-semibold">
              {step + 1} / {steps.length}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {current.icon}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{current.title}</h2>
          </div>

          {current.visual}
        </div>

        <div className="bg-card px-6 py-5">
          <p className="text-sm text-foreground leading-relaxed mb-3">
            {current.description}
          </p>

          <div className="flex items-start gap-2.5 bg-primary/8 border border-primary/15 rounded-xl px-3 py-2.5 mb-5">
            <Bell className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary font-medium leading-snug">{current.tip}</p>
          </div>

          <div className="flex items-center justify-center gap-1.5 mb-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`transition-all duration-300 rounded-full ${
                  i === step
                    ? "w-5 h-2 bg-primary"
                    : i < step
                    ? "w-2 h-2 bg-primary/40"
                    : "w-2 h-2 bg-muted-foreground/25"
                }`}
                aria-label={`Étape ${i + 1}`}
                data-testid={`onboarding-dot-${i}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(s => s - 1)}
                className="flex-shrink-0"
                data-testid="button-onboarding-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            {isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={finish}
                className="flex-1 text-muted-foreground text-xs"
                data-testid="button-onboarding-skip"
              >
                Passer
              </Button>
            )}

            {!isLast ? (
              <Button
                className="flex-1 gap-1.5 font-semibold"
                onClick={() => setStep(s => s + 1)}
                data-testid="button-onboarding-next"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 gap-1.5 font-semibold"
                onClick={handleFinish}
                data-testid="button-onboarding-finish"
              >
                <User className="w-4 h-4" />
                Mon profil
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function useResetOnboarding() {
  return () => localStorage.removeItem(STORAGE_KEY);
}

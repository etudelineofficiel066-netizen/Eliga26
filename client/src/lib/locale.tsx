import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "fr" | "en";

interface LocaleContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, lang?: Language) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  fr: {
    "app.title": "eLIGA",
    "app.tagline": "La plateforme eFootball des champions",
    "app.description": "Organisez vos tournois, suivez vos statistiques et défiez vos amis. Compétition sérieuse, communauté passionnée.",
    "home.welcome": "Bienvenue sur eLIGA",
    "home.subtitle": "Connectez-vous ou créez votre compte joueur",
    "login.label": "Se connecter",
    "register.label": "Créer un compte",
    "login.username": "Nom d'utilisateur",
    "login.password": "Mot de passe",
    "login.button": "Se connecter",
    "login.connecting": "Connexion en cours…",
    "register.username": "Nom d'utilisateur",
    "register.pseudo": "Pseudo en jeu",
    "register.password": "Mot de passe",
    "register.phone": "Téléphone",
    "register.country": "Pays",
    "register.region": "Région",
    "register.button": "Créer mon compte",
    "register.creating": "Création en cours…",
    "validation.username_required": "Nom d'utilisateur requis",
    "validation.password_required": "Mot de passe requis",
    "validation.username_min": "Au moins 3 caractères",
    "validation.pseudo_min": "Au moins 2 caractères",
    "validation.password_min": "Au moins 6 caractères",
    "validation.phone_invalid": "Numéro invalide",
    "validation.country_required": "Pays requis",
    "validation.region_required": "Région requise",
    "common.copyright": "Tous droits réservés",
    "error.login": "Erreur de connexion",
    "error.register": "Erreur d'inscription",
    "header.dashboard": "Tableau de bord",
    "header.tournaments": "Mes tournois",
    "header.create": "Créer un tournoi",
    "header.search": "Rechercher",
    "header.messages": "Messages",
    "header.friends": "Amis",
    "header.matches": "Mes matchs",
    "header.stats": "Statistiques",
    "header.profile": "Mon profil",
    "header.market": "Marché",
    "header.challenges": "Défis",
    "header.clips": "eLIGA Clips",
  },
  en: {
    "app.title": "eLIGA",
    "app.tagline": "The eFootball platform for champions",
    "app.description": "Organize your tournaments, track your stats and challenge your friends. Serious competition, passionate community.",
    "home.welcome": "Welcome to eLIGA",
    "home.subtitle": "Sign in or create your player account",
    "login.label": "Sign in",
    "register.label": "Create account",
    "login.username": "Username",
    "login.password": "Password",
    "login.button": "Sign in",
    "login.connecting": "Signing in…",
    "register.username": "Username",
    "register.pseudo": "In-game nickname",
    "register.password": "Password",
    "register.phone": "Phone number",
    "register.country": "Country",
    "register.region": "Region",
    "register.button": "Create my account",
    "register.creating": "Creating account…",
    "validation.username_required": "Username required",
    "validation.password_required": "Password required",
    "validation.username_min": "At least 3 characters",
    "validation.pseudo_min": "At least 2 characters",
    "validation.password_min": "At least 6 characters",
    "validation.phone_invalid": "Invalid number",
    "validation.country_required": "Country required",
    "validation.region_required": "Region required",
    "common.copyright": "All rights reserved",
    "error.login": "Login error",
    "error.register": "Registration error",
    "header.dashboard": "Dashboard",
    "header.tournaments": "My tournaments",
    "header.create": "Create tournament",
    "header.search": "Search",
    "header.messages": "Messages",
    "header.friends": "Friends",
    "header.matches": "My matches",
    "header.stats": "Statistics",
    "header.profile": "My profile",
    "header.market": "Market",
    "header.challenges": "Challenges",
    "header.clips": "eLIGA Clips",
  },
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("eLIGA_language");
    return (saved as Language) || "fr";
  });

  useEffect(() => {
    localStorage.setItem("eLIGA_language", language);
  }, [language]);

  const t = (key: string, lang?: Language) => {
    const targetLang = lang || language;
    return translations[targetLang][key] || key;
  };

  return (
    <LocaleContext.Provider value={{ language, setLanguage: setLanguageState, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

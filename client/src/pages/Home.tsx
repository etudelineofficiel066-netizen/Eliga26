import { useState } from "react";
import heroImage from "@assets/generated_images/efootball_player.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trophy, ShieldOff } from "lucide-react";
import { PWAInstallButton } from "@/components/PWAInstallButton";

const loginSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Au moins 3 caractères"),
  pseudo: z.string().min(2, "Au moins 2 caractères"),
  password: z.string().min(6, "Au moins 6 caractères"),
  phone: z.string().min(8, "Numéro invalide"),
  country: z.string().min(1, "Pays requis"),
  region: z.string().min(1, "Région requise"),
});

const COUNTRIES = [
  "Algérie", "Maroc", "Tunisie", "Égypte", "Sénégal", "Côte d'Ivoire", "Cameroun",
  "Ghana", "Nigeria", "Mali", "Burkina Faso", "Guinée", "France", "Belgique",
  "Espagne", "Portugal", "Italie", "Allemagne", "Angleterre", "Autre"
];

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" }
  });
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", pseudo: "", password: "", phone: "", country: "", region: "" }
  });

  const [blockedInfo, setBlockedInfo] = useState<{ message: string } | null>(null);

  const loginMutation = useMutation({
    mutationFn: (data: z.infer<typeof loginSchema>) => apiRequest("POST", "/api/auth/login", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
    onError: (e: any) => {
      if (e.message?.toLowerCase().includes("bloqué") || e.message?.toLowerCase().includes("bloqu")) {
        setBlockedInfo({ message: e.message });
      } else {
        setBlockedInfo(null);
        toast({ title: "Erreur de connexion", description: e.message, variant: "destructive" });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: z.infer<typeof registerSchema>) => apiRequest("POST", "/api/auth/register", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
    onError: (e: any) => toast({ title: "Erreur d'inscription", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="lg:hidden">
        <PWAInstallButton variant="banner" />
      </div>
      {/* Left / Hero panel */}
      <div className="relative lg:flex-1 lg:sticky lg:top-0 lg:h-screen overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-primary/50 flex flex-col items-center justify-center px-8 py-10 lg:py-0">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative z-10 text-center max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl border border-white/20">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">eLIGA</h1>
          </div>

          <p className="text-lg text-white/90 font-medium mb-2">La plateforme eFootball des champions</p>
          <p className="text-sm text-white/70 mb-6 hidden lg:block">
            Organisez vos tournois, suivez vos statistiques et défiez vos amis. Compétition sérieuse, communauté passionnée.
          </p>

          {/* Hero image */}
          <div className="flex flex-col items-center mb-4">
            <img
              src={heroImage}
              alt="Joueur eFootball avec manette"
              className="w-36 h-36 sm:w-44 sm:h-44 lg:w-56 lg:h-56 rounded-3xl shadow-2xl object-cover border-4 border-white/20"
            />
            <PWAInstallButton variant="hero" />
          </div>

        </div>
      </div>

      {/* Right / Auth panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:max-w-lg lg:mx-auto lg:w-full">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Bienvenue sur eLIGA</h2>
            <p className="text-muted-foreground text-sm mt-1">Connectez-vous ou créez votre compte joueur</p>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="w-full mb-5">
              <TabsTrigger value="login" className="flex-1" data-testid="tab-login">Se connecter</TabsTrigger>
              <TabsTrigger value="register" className="flex-1" data-testid="tab-register">Créer un compte</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardContent className="pt-5">
                  {blockedInfo && (
                    <div className="mb-4 flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4" data-testid="alert-account-blocked">
                      <ShieldOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm text-red-700 dark:text-red-400">Compte bloqué définitivement</p>
                        <p className="text-xs text-red-600 dark:text-red-500 mt-1 leading-relaxed">
                          Votre compte a été bloqué suite à 3 rejets de paiement pour fraude présumée. Aucune réclamation ne sera acceptée.
                        </p>
                      </div>
                    </div>
                  )}
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(d => { setBlockedInfo(null); loginMutation.mutate(d); })} className="space-y-4">
                      <FormField control={loginForm.control} name="username" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom d'utilisateur</FormLabel>
                          <FormControl>
                            <Input placeholder="votre_username" data-testid="input-login-username" autoComplete="username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" data-testid="input-login-password" autoComplete="current-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                        {loginMutation.isPending ? "Connexion en cours…" : "Se connecter"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardContent className="pt-5">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(d => registerMutation.mutate(d))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={registerForm.control} name="username" render={({ field }) => (
                          <FormItem className="col-span-2 sm:col-span-1">
                            <FormLabel>Nom d'utilisateur</FormLabel>
                            <FormControl>
                              <Input placeholder="username_efootball" data-testid="input-reg-username" autoComplete="username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={registerForm.control} name="pseudo" render={({ field }) => (
                          <FormItem className="col-span-2 sm:col-span-1">
                            <FormLabel>Pseudo en jeu</FormLabel>
                            <FormControl>
                              <Input placeholder="MonPseudo" data-testid="input-reg-pseudo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={registerForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" data-testid="input-reg-password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input placeholder="+213 XXX XXX XXX" data-testid="input-reg-phone" type="tel" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={registerForm.control} name="country" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pays</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-country">
                                  <SelectValue placeholder="Pays" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={registerForm.control} name="region" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Région</FormLabel>
                            <FormControl>
                              <Input placeholder="Votre région" data-testid="input-reg-region" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-register">
                        {registerMutation.isPending ? "Création en cours…" : "Créer mon compte"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} eLIGA · Tous droits réservés<br />
            <span className="font-medium">Maodo ka</span>
          </p>
        </div>
      </div>
    </div>
  );
}

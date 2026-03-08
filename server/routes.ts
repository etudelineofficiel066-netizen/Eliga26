import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pgPool as pool } from "./db";
import webpush from "web-push";
import { videoUpload, UPLOAD_DIR } from "./upload";
import path from "path";
import fs from "fs";

// Initialize VAPID for Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@eliga.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const PgSession = connectPgSimple(session);

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "eliga_salt").digest("hex");
}

function requireAuth(req: Request, res: Response): string | null {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non authentifié" });
    return null;
  }
  return req.session.userId;
}

async function requireAuthUser(req: Request, res: Response) {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const user = await storage.getUserById(userId);
  if (!user) { res.status(401).json({ error: "Utilisateur introuvable" }); return null; }
  return user;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";

  // ── WebSocket setup ──────────────────────────────────────────────────────
  const wsServer = new WebSocketServer({ noServer: true });
  const clientsByUserId = new Map<string, WebSocket>();
  const wsTokens = new Map<string, { userId: string; expires: number }>();

  function broadcastToUser(targetUserId: string, data: object) {
    const ws = clientsByUserId.get(targetUserId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // ── SSE (Server-Sent Events) — real-time notification push ───────────────
  const sseClients = new Map<string, Set<Response>>();

  function pushSSE(userId: string, payload: object) {
    const clients = sseClients.get(userId);
    if (!clients || clients.size === 0) return;
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of [...clients]) {
      try { res.write(line); } catch { clients.delete(res); }
    }
  }

  // Thin wrapper: creates notification in DB then immediately pushes it via SSE
  // Falls back to Web Push if user has no active SSE connection
  async function notify(userId: string, content: string, tournamentId?: string, matchId?: string) {
    try {
      const notif = await storage.createNotification(userId, content, tournamentId, matchId);

      // Try SSE first (user is active in the app)
      const sseDelivered = (() => {
        const clients = sseClients.get(userId);
        if (!clients || clients.size === 0) return false;
        const line = `data: ${JSON.stringify({ type: "notification", notification: notif })}\n\n`;
        let sent = false;
        for (const res of [...clients]) {
          try { res.write(line); sent = true; } catch { clients.delete(res); }
        }
        return sent;
      })();

      // If user is not connected via SSE, send a Web Push notification
      if (!sseDelivered && process.env.VAPID_PUBLIC_KEY) {
        try {
          const subs = await pool.query(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1",
            [userId]
          );
          const payload = JSON.stringify({
            title: "eLIGA",
            body: content,
            data: { url: tournamentId ? `/tournaments/${tournamentId}` : "/" }
          });
          for (const sub of subs.rows) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
            } catch (e: any) {
              // Subscription expired/invalid — delete it
              if (e.statusCode === 410 || e.statusCode === 404) {
                await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [sub.endpoint]);
              }
            }
          }
        } catch {}
      }

      return notif;
    } catch (e) {
      console.error("[notify] error:", e);
    }
  }

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url!, `http://localhost`);
    if (url.pathname !== "/ws") return;

    const token = url.searchParams.get("token");
    const entry = token ? wsTokens.get(token) : null;

    if (!token || !entry || entry.expires < Date.now()) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wsTokens.delete(token);
    const userId = entry.userId;

    wsServer.handleUpgrade(req, socket, head, (ws) => {
      clientsByUserId.set(userId, ws);

      ws.on("message", async (data) => {
        try {
          const event = JSON.parse(data.toString());
          if (event.type === "typing" && event.receiverId) {
            broadcastToUser(event.receiverId, { type: "typing", userId, isTyping: !!event.isTyping });
          } else if (event.type === "read" && event.senderId) {
            await storage.markMessagesRead(event.senderId, userId);
            broadcastToUser(event.senderId, { type: "read", receiverId: userId });
          }
        } catch {}
      });

      ws.on("close", () => {
        if (clientsByUserId.get(userId) === ws) clientsByUserId.delete(userId);
      });
      ws.on("error", () => {
        if (clientsByUserId.get(userId) === ws) clientsByUserId.delete(userId);
      });
    });
  });
  // ─────────────────────────────────────────────────────────────────────────

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "eliga_secret_key_2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));

  // ── Visit tracking middleware ─────────────────────────────────────────────
  app.use((req, _res, next) => {
    const userId = req.session?.userId;
    if (userId && req.method === "GET" && req.path.startsWith("/api/")) {
      const today = new Date().toISOString().slice(0, 10);
      pool.query(
        `INSERT INTO daily_visits ("date", user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [today, userId]
      ).catch(() => {});
    }
    next();
  });

  // AUTH
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, pseudo, password, phone, country, region } = req.body;
      if (!username || !pseudo || !password || !phone || !country || !region) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ error: "Nom d'utilisateur déjà pris" });
      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) return res.status(400).json({ error: "Numéro de téléphone déjà utilisé" });
      const user = await storage.createUser({ username, pseudo, password: hashPassword(password), phone, country, region });
      req.session.userId = user.id;
      res.json({ user: { ...user, password: undefined } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: "Identifiants incorrects" });
      }
      if ((user as any).is_blocked) {
        return res.status(403).json({
          error: "Votre compte a été bloqué définitivement.",
          reason: (user as any).block_reason ?? "Fraude ou tentatives de paiement frauduleuses.",
          blocked: true,
        });
      }
      req.session.userId = user.id;
      res.json({ user: { ...user, password: undefined } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/users/:id", async (req, res) => {
    const myId = requireAuth(req, res); if (!myId) return;
    const user = await storage.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({ id: user.id, pseudo: user.pseudo, username: user.username, avatarUrl: user.avatarUrl });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });
    const user = await storage.getUserById(userId);
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    res.json({ user: { ...user, password: undefined } });
  });

  app.get("/api/auth/ws-token", (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const token = crypto.randomBytes(32).toString("hex");
    wsTokens.set(token, { userId, expires: Date.now() + 60_000 });
    wsTokens.forEach((v, k) => {
      if (v.expires < Date.now()) wsTokens.delete(k);
    });
    res.json({ token });
  });

  // FRIENDS
  app.get("/api/friends", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const friends = await storage.getFriends(userId);
    res.json(friends);
  });

  app.get("/api/friends/requests", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const requests = await storage.getFriendRequests(userId);
    res.json(requests);
  });

  app.get("/api/friends/requests/count", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.json({ count: 0 });
    const requests = await storage.getFriendRequests(userId);
    res.json({ count: requests.length });
  });

  app.post("/api/friends/add", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { phone } = req.body;
      const friend = await storage.searchUserByPhone(phone);
      if (!friend) return res.status(404).json({ error: "Utilisateur introuvable avec ce numéro" });
      if (friend.id === userId) return res.status(400).json({ error: "Vous ne pouvez pas vous ajouter vous-même" });
      const result = await storage.addFriend(userId, friend.id);
      await notify(friend.id, `${(await storage.getUserById(userId))?.pseudo} vous a envoyé une demande d'ami`);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/friends/accept/:id", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      await storage.acceptFriend(req.params.id, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/friends/:id", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      await storage.removeFriend(req.params.id, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // FRIEND GROUPS
  app.get("/api/groups", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const groups = await storage.getFriendGroups(userId);
    res.json(groups);
  });

  app.post("/api/groups", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Nom du groupe requis" });
      const group = await storage.createFriendGroup(userId, name);
      res.json(group);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/groups/:id/members", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { friendId } = req.body;
      await storage.addMemberToGroup(req.params.id, friendId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // TOURNAMENTS
  app.get("/api/tournaments/public", async (req, res) => {
    const tournaments = await storage.getPublicTournaments();
    res.json(tournaments);
  });

  app.get("/api/tournaments/mine", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const tournaments = await storage.getUserTournaments(userId);
    res.json(tournaments);
  });

  app.get("/api/tournaments/joined", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const tournaments = await storage.getUserParticipatedTournaments(userId);
    res.json(tournaments);
  });

  app.post("/api/tournaments/search-private", async (req, res) => {
    const { code } = req.body;
    const tournament = await storage.getTournamentByCode(code);
    if (!tournament) return res.status(404).json({ error: "Tournoi introuvable avec ce code" });
    const full = await storage.getTournamentById(tournament.id);
    res.json(full);
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    const tournament = await storage.getTournamentById(req.params.id);
    if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
    res.json(tournament);
  });

  app.post("/api/tournaments", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { name, championshipType, playersPerPool, numPools, playerLimit, visibility, gameType, gameTime, gameForm, extraTime, penalties, otherRules, startDate, endDate, isSponsored, sponsorName, sponsorLogo, prizeInfo, isElite, minStars, elitePrizeAmount, isPaid, entryFee, entryPaymentNumber } = req.body;
      if (!name || !championshipType || !gameType || !gameTime || !gameForm) {
        return res.status(400).json({ error: "Champs requis manquants" });
      }
      let code = null;
      if (visibility === "private") {
        code = Math.floor(100000 + Math.random() * 900000).toString();
      }
      const user = await storage.getUserById(userId);
      const sponsored = isSponsored && user?.isAdmin;
      const elite = isElite && user?.isAdmin;
      const tournament = await storage.createTournament({
        creatorId: userId, name, championshipType,
        playersPerPool: playersPerPool || null, numPools: numPools || null,
        playerLimit: playerLimit || null, visibility: visibility || "public",
        code, gameType, gameTime: parseInt(gameTime), gameForm,
        extraTime: !!extraTime, penalties: !!penalties,
        otherRules: otherRules || null, startDate: startDate || null,
        endDate: endDate || null, status: "waiting",
        isSponsored: !!sponsored,
        sponsorName: sponsored ? (sponsorName || null) : null,
        sponsorLogo: sponsored ? (sponsorLogo || null) : null,
        prizeInfo: sponsored ? (prizeInfo || null) : null,
        isElite: !!elite,
        minStars: elite ? (parseInt(minStars) || 1) : sponsored ? (parseInt(minStars) || 0) : 0,
        elitePrizeAmount: elite && elitePrizeAmount ? (parseInt(elitePrizeAmount) || null) : null,
        isPaid: !!isPaid,
        entryFee: isPaid ? (parseInt(entryFee) || 0) : 0,
        entryPaymentNumber: isPaid ? (entryPaymentNumber || null) : null,
      } as any);
      // Creator auto-joins (but not admin — admin organizes, doesn't play)
      const creator = await storage.getUserById(userId);
      if (!creator?.isAdmin) {
        await storage.joinTournament(tournament.id, userId);
      }
      res.json(tournament);

      // Si c'est un admin qui crée, notifier tous les utilisateurs
      if (creator?.isAdmin) {
        const typeLabel = (tournament as any).isPaid
          ? `💰 Cotisation : ${(tournament as any).entryFee?.toLocaleString()} XAF`
          : tournament.isSponsored
          ? "🏅 Sponsorisé"
          : tournament.isElite
          ? `⭐ Élite ${tournament.minStars}★+`
          : "🎮 Gratuit";
        const visLabel = (tournament as any).visibility === "private" ? " (privé)" : "";
        const notifMsg = `🏆 Nouveau tournoi : "${tournament.name}"${visLabel} — ${typeLabel}. Inscrivez-vous maintenant !`;
        const allUsers = await pool.query(
          "SELECT id FROM users WHERE is_blocked = false OR is_blocked IS NULL"
        );
        for (const u of allUsers.rows) {
          if (u.id !== userId) {
            notify(u.id, notifMsg, tournament.id).catch(() => {});
          }
        }
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tournaments/:id/join", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      const userId = reqUser.id;
      if (reqUser.isAdmin) return res.status(403).json({ error: "Les administrateurs ne peuvent pas participer à un tournoi." });
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.status !== "waiting") return res.status(400).json({ error: "Ce tournoi n'accepte plus de joueurs" });
      const t = tournament as any;
      // Check existing participation
      const participants = await storage.getTournamentParticipants(req.params.id);
      const existing = participants.find((p: any) => p.userId === userId);
      // Check if tournament is full (only for non-existing participants)
      if (!existing) {
        const limit = t.playerLimit || (t.numPools && t.playersPerPool ? t.numPools * t.playersPerPool : null);
        if (limit && participants.length >= limit) {
          return res.status(400).json({ error: `Impossible de participer — limite du tournoi atteinte (${participants.length}/${limit} joueurs).` });
        }
      }
      if (existing) {
        // Allow re-submission if payment was rejected
        if ((existing as any).paymentStatus === "rejected" && t.isPaid) {
          const { paymentProof } = req.body;
          if (!paymentProof) return res.status(400).json({ error: "Ce tournoi requiert une preuve de paiement pour s'inscrire." });
          await pool.query(
            "UPDATE tournament_participants SET payment_proof=$1, payment_status='pending' WHERE id=$2",
            [paymentProof, existing.id]
          );
          return res.json({ ...existing, paymentStatus: "pending", pending: true });
        }
        return res.status(400).json({ error: "Vous participez déjà à ce tournoi" });
      }
      const userStats = await storage.getUserStats(userId);
      const playerStars = (userStats as any).stars ?? 0;
      // Les tournois à cotisation (isPaid) sont ouverts à tous, sans restriction d'étoiles
      if (!t.isPaid) {
        if (t.isSponsored && t.minStars > 0) {
          if (playerStars < t.minStars) {
            return res.status(403).json({ error: `Ce tournoi sponsorisé requiert au moins ${t.minStars} étoile${t.minStars > 1 ? "s" : ""}. Vous avez ${playerStars} étoile${playerStars > 1 ? "s" : ""}.` });
          }
        }
        if (t.isElite && t.minStars > 0) {
          if (playerStars < t.minStars) {
            return res.status(403).json({ error: `Ce championnat élite requiert au moins ${t.minStars} étoile(s). Vous avez ${playerStars} étoile(s).` });
          }
        }
      }
      if (t.isPaid) {
        const { paymentProof } = req.body;
        if (!paymentProof) return res.status(400).json({ error: "Ce tournoi requiert une preuve de paiement pour s'inscrire." });
        const result = await storage.joinTournament(req.params.id, userId, paymentProof);
        return res.json({ ...result, pending: true });
      }
      const result = await storage.joinTournament(req.params.id, userId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin — list pending payments
  app.get("/api/admin/payments", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const payments = await storage.getPendingPayments();
      res.json(payments);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── MATCH NOTIFICATION SCHEDULER ──────────────────────────────────────────
  setInterval(async () => {
    try {
      // On cherche les matches "pending" qui ont un "scheduled_at" (format ISO ou proche)
      // On filtre en JS pour plus de simplicité avec les fuseaux/formats de date stockés en texte
      const res = await pool.query(
        `SELECT m.*, t.name as tournament_name, 
                u1.pseudo as p1_pseudo, u2.pseudo as p2_pseudo
         FROM tournament_matches m
         JOIN tournaments t ON m.tournament_id = t.id
         JOIN users u1 ON m.player1_id = u1.id
         JOIN users u2 ON m.player2_id = u2.id
         WHERE m.status = 'pending' AND m.scheduled_at IS NOT NULL 
         AND (m.notified_15m = false OR m.notified_5m = false)`
      );

      const now = new Date();
      for (const match of res.rows) {
        const scheduledTime = new Date(match.scheduled_at);
        if (isNaN(scheduledTime.getTime())) continue;

        const diffMs = scheduledTime.getTime() - now.getTime();
        const diffMin = diffMs / (1000 * 60);

        // Notification 15 minutes avant (fenêtre de 15 à 6 minutes)
        if (!match.notified_15m && diffMin <= 15 && diffMin > 5) {
          const msg = `⏳ Rappel : Vous avez un match à jouer dans 15 mn contre ${match.p2_pseudo} (Tournoi : ${match.tournament_name})`;
          const msg2 = `⏳ Rappel : Vous avez un match à jouer dans 15 mn contre ${match.p1_pseudo} (Tournoi : ${match.tournament_name})`;
          
          await notify(match.player1_id, msg, match.tournament_id, match.id);
          await notify(match.player2_id, msg2, match.tournament_id, match.id);
          
          await pool.query("UPDATE tournament_matches SET notified_15m = true WHERE id = $1", [match.id]);
        }

        // Notification 5 minutes avant (fenêtre de 5 à -1 minute)
        if (!match.notified_5m && diffMin <= 5 && diffMin > -1) {
          const msg = `🔔 Urgent : Votre match commence dans 5 mn contre ${match.p2_pseudo} ! Soyez prêt.`;
          const msg2 = `🔔 Urgent : Votre match commence dans 5 mn contre ${match.p1_pseudo} ! Soyez prêt.`;
          
          await notify(match.player1_id, msg, match.tournament_id, match.id);
          await notify(match.player2_id, msg2, match.tournament_id, match.id);
          
          await pool.query("UPDATE tournament_matches SET notified_5m = true WHERE id = $1", [match.id]);
        }
      }
    } catch (e) {
      console.error("[MatchNotifier] Error:", e);
    }
  }, 60000); // Vérification toutes les minutes
  // ──────────────────────────────────────────────────────────────────────────

  // Admin — confirm payment
  app.patch("/api/admin/payments/:participantId/confirm", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      await storage.updateParticipantPaymentStatus(req.params.participantId, "confirmed");
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin — reject payment (remove participant)
  app.patch("/api/admin/payments/:participantId/reject", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      await storage.updateParticipantPaymentStatus(req.params.participantId, "rejected");
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/tournaments/:id", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      
      // Seul l'administrateur peut supprimer des tournois
      if (!reqUser.isAdmin) {
        return res.status(403).json({ error: "Seul un administrateur peut supprimer des tournois" });
      }

      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      
      await storage.deleteTournament(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/tournaments/:id", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      const userId = reqUser.id;
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.creatorId !== userId) return res.status(403).json({ error: "Seul le créateur peut modifier ce tournoi" });
      const { name, description, startDate, endDate } = req.body;
      if (tournament.status !== "waiting" && (name !== undefined || description !== undefined)) {
        return res.status(400).json({ error: "Impossible de modifier le nom d'un tournoi déjà lancé" });
      }
      const newName = name?.trim() || tournament.name;
      await storage.updateTournament(req.params.id, {
        name: newName,
        description: description?.trim() || null,
        startDate: startDate !== undefined ? (startDate || null) : tournament.startDate,
        endDate: endDate !== undefined ? (endDate || null) : tournament.endDate,
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tournaments/:id/leave", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.status !== "waiting") return res.status(400).json({ error: "Impossible de quitter un tournoi déjà lancé" });
      await storage.removeParticipant(req.params.id, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tournaments/:id/draw", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      const userId = reqUser.id;
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.creatorId !== userId) return res.status(403).json({ error: "Seul le créateur peut lancer le tirage" });
      if (tournament.status !== "waiting") return res.status(400).json({ error: "Tirage déjà effectué" });

      const participants = await storage.getTournamentParticipants(req.params.id);
      const limit = tournament.playerLimit || (tournament.numPools && tournament.playersPerPool ? tournament.numPools * tournament.playersPerPool : null);

      // Minimum: 2 participants always required
      if (participants.length < 2) {
        return res.status(400).json({ error: `Il faut au moins 2 participants pour lancer le tournoi. Actuellement : ${participants.length}.` });
      }
      // If pool type with numPools, need at least 3 players per pool for real logic
      if (tournament.championshipType === "pool") {
        const numPools = tournament.numPools || 2;
        const minPlayers = numPools * 3;
        if (participants.length < minPlayers) {
          return res.status(400).json({ error: `Pour un tournoi en poules, il faut au moins 3 joueurs par poule (Total requis : ${minPlayers}). Actuellement : ${participants.length}.` });
        }
      }
      if (limit && participants.length < limit) {
        return res.status(400).json({ error: `Pas assez de participants. ${participants.length}/${limit} joueurs.` });
      }

      // Shuffle participants
      const shuffled = [...participants].sort(() => Math.random() - 0.5);

      if (tournament.championshipType === "league") {
        // Round robin
        for (let i = 0; i < shuffled.length; i++) {
          for (let j = i + 1; j < shuffled.length; j++) {
            const match = await storage.createMatch({
              tournamentId: tournament.id,
              player1Id: shuffled[i].userId,
              player2Id: shuffled[j].userId,
              phase: "league",
              poolNumber: null,
              score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
            });
            // Notify both players
            await notify(
              shuffled[i].userId,
              `Match tiré : ${shuffled[i].user.pseudo} vs ${shuffled[j].user.pseudo} - ${tournament.name}`,
              tournament.id, match.id
            );
            await notify(
              shuffled[j].userId,
              `Match tiré : ${shuffled[i].user.pseudo} vs ${shuffled[j].user.pseudo} - ${tournament.name}`,
              tournament.id, match.id
            );
          }
        }
      } else {
        // Pool system
        const numPools = tournament.numPools || 2;
        for (let poolIdx = 0; poolIdx < numPools; poolIdx++) {
          const poolPlayers = shuffled.filter((_, i) => i % numPools === poolIdx);
          for (let i = 0; i < poolPlayers.length; i++) {
            for (let j = i + 1; j < poolPlayers.length; j++) {
              const match = await storage.createMatch({
                tournamentId: tournament.id,
                player1Id: poolPlayers[i].userId,
                player2Id: poolPlayers[j].userId,
                phase: "pool",
                poolNumber: poolIdx + 1,
                score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
              });
              await notify(
                poolPlayers[i].userId,
                `Match tiré - Poule ${poolIdx + 1}: ${poolPlayers[i].user.pseudo} vs ${poolPlayers[j].user.pseudo} - ${tournament.name}`,
                tournament.id, match.id
              );
              await notify(
                poolPlayers[j].userId,
                `Match tiré - Poule ${poolIdx + 1}: ${poolPlayers[i].user.pseudo} vs ${poolPlayers[j].user.pseudo} - ${tournament.name}`,
                tournament.id, match.id
              );
            }
          }
        }
      }

      await storage.updateTournamentStatus(tournament.id, "in_progress");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tournaments/:id/participants", async (req, res) => {
    const participants = await storage.getTournamentParticipants(req.params.id);
    res.json(participants);
  });

  app.delete("/api/tournaments/:id/participants/:userId", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      const requesterId = reqUser.id;
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.creatorId !== requesterId) return res.status(403).json({ error: "Seul le créateur peut exclure des joueurs" });
      if (tournament.status !== "waiting") return res.status(400).json({ error: "Impossible de modifier les participants d'un tournoi en cours" });
      await storage.removeParticipant(req.params.id, req.params.userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tournaments/:id/matches", async (req, res) => {
    const matches = await storage.getTournamentMatches(req.params.id);
    res.json(matches);
  });

  app.post("/api/matches/:id/score", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { score1, score2 } = req.body;
      await storage.updateMatchScore(req.params.id, score1, score2);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/matches/mine", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      // Auto-confirmation : score proposé depuis plus de 2h sans réponse
      const AUTO_CONFIRM_MINUTES = 120;
      const expiredScores = await pool.query(`
        SELECT tm.*, t.name as tournament_name, t.creator_id
        FROM tournament_matches tm
        JOIN tournaments t ON t.id = tm.tournament_id
        WHERE tm.status='proposed'
          AND tm.proposed_at IS NOT NULL
          AND tm.proposed_at < NOW() - INTERVAL '${AUTO_CONFIRM_MINUTES} minutes'
          AND (tm.player1_id=$1 OR tm.player2_id=$1)`, [userId]);

      for (const m of expiredScores.rows) {
        await storage.confirmScore(m.id);
        const s1 = m.proposed_score1;
        const s2 = m.proposed_score2;
        const tName = m.tournament_name || "tournoi";
        const winner = s1 > s2 ? m.player1_id : s2 > s1 ? m.player2_id : null;
        const loser = s1 > s2 ? m.player2_id : s2 > s1 ? m.player1_id : null;
        if (winner && loser) {
          const coinsWon = await storage.awardMatchWinCoins(m.id, winner);
          const coinMsg = coinsWon > 0 ? ` +${coinsWon} pièces !` : "";
          await notify(winner, `⏱️ Score auto-confirmé (2h sans réponse) — Victoire ${s1}-${s2} dans ${tName}.${coinMsg}`, m.tournament_id, m.id);
          await notify(loser, `⏱️ Score auto-confirmé (2h sans réponse) — Défaite ${s1}-${s2} dans ${tName}.`, m.tournament_id, m.id);
        } else {
          await notify(m.player1_id, `⏱️ Score auto-confirmé (2h) — Nul ${s1}-${s2} dans ${tName}.`, m.tournament_id, m.id);
          await notify(m.player2_id, `⏱️ Score auto-confirmé (2h) — Nul ${s1}-${s2} dans ${tName}.`, m.tournament_id, m.id);
        }
        if (m.creator_id && m.creator_id !== m.player1_id && m.creator_id !== m.player2_id) {
          await notify(m.creator_id, `✅ Score auto-confirmé ${s1}-${s2} dans ${tName}.`, m.tournament_id, m.id);
        }
        await autoFinishIfComplete(m.tournament_id);
      }

      const matches = await storage.getUserMatches(userId);
      res.json(matches);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // MESSAGES
  app.get("/api/messages/conversations", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const convs = await storage.getConversations(userId);
    res.json(convs);
  });

  app.get("/api/messages/:userId", async (req, res) => {
    const myId = requireAuth(req, res); if (!myId) return;
    await storage.markMessagesRead(req.params.userId, myId);
    const messages = await storage.getConversation(myId, req.params.userId);
    // Marquer les notifications de message de cet expéditeur comme lues
    const sender = await storage.getUserById(req.params.userId);
    if (sender) {
      const senderPseudo = sender.pseudo ?? sender.username;
      await pool.query(
        "UPDATE notifications SET is_read=true WHERE user_id=$1 AND content LIKE $2 AND is_read=false",
        [myId, `💬 ${senderPseudo}%`]
      );
    }
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { receiverId, content } = req.body;
      if (!receiverId || !content) return res.status(400).json({ error: "Destinataire et contenu requis" });
      const msg = await storage.sendMessage(userId, receiverId, content);
      const sender = await storage.getUserById(userId);
      const fullMsg = {
        ...msg,
        reactions: [],
        sender: sender ? { id: sender.id, username: sender.username, pseudo: sender.pseudo, avatarUrl: sender.avatarUrl } : null
      };
      broadcastToUser(receiverId, { type: "message", message: fullMsg });
      broadcastToUser(userId, { type: "message_sent", message: fullMsg });
      const senderPseudo = sender?.pseudo ?? sender?.username ?? "Quelqu'un";
      await notify(receiverId, `💬 ${senderPseudo} vous a envoyé un message`);
      res.json(msg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/messages/:id/react", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const { emoji } = req.body;
      if (!emoji) return res.status(400).json({ error: "Emoji requis" });
      const result = await storage.toggleReaction(req.params.id, userId, emoji);
      const msg = await storage.getMessageById(req.params.id);
      if (msg) {
        const event = { type: "reaction", messageId: req.params.id, userId, emoji, action: result.added ? "add" : "remove" };
        broadcastToUser(msg.senderId, event);
        broadcastToUser(msg.receiverId, event);
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const userId = requireAuth(req, res); if (!userId) return;
      const msg = await storage.getMessageById(req.params.id);
      if (!msg) return res.status(404).json({ error: "Message introuvable" });
      if (msg.senderId !== userId) return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres messages" });
      await storage.deleteMessage(req.params.id);
      broadcastToUser(msg.receiverId, { type: "message_deleted", messageId: req.params.id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUSH NOTIFICATIONS
  app.get("/api/push/vapid-key", (_req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || "" });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: "Invalid subscription" });
    await storage.savePushSubscription(userId, endpoint, keys.p256dh, keys.auth);
    res.json({ success: true });
  });

  app.delete("/api/push/unsubscribe", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    await storage.deletePushSubscription(endpoint);
    res.json({ success: true });
  });

  // NOTIFICATIONS
  // SSE stream — client connects once, server pushes immediately on new notifications
  app.get("/api/notifications/stream", (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).end();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send initial heartbeat so the client knows the stream is live
    res.write(": connected\n\n");

    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId)!.add(res);

    // Heartbeat every 20s to prevent connection timeout
    const hb = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 20_000);

    req.on("close", () => {
      clearInterval(hb);
      sseClients.get(userId)?.delete(res);
      if (sseClients.get(userId)?.size === 0) sseClients.delete(userId);
    });
  });

  app.get("/api/notifications", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    const notifs = await storage.getNotifications(userId);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.json({ count: 0 });
    const count = await storage.getUnreadCount(userId);
    res.json({ count });
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    await storage.markNotificationRead(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      await pool.query("DELETE FROM notifications WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/notifications", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      await pool.query("DELETE FROM notifications WHERE user_id=$1", [userId]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── PUSH SUBSCRIPTION ROUTES ─────────────────────────────────────────────
  // Return the public VAPID key so clients can subscribe
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
  });

  // Save a push subscription for the current user
  app.post("/api/push/subscribe", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Subscription invalide" });
      }
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint) DO UPDATE SET user_id=$1, p256dh=$3, auth=$4, created_at=NOW()`,
        [userId, endpoint, keys.p256dh, keys.auth]
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Remove a push subscription
  app.post("/api/push/unsubscribe", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2", [userId, endpoint]);
      } else {
        await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1", [userId]);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── ADMIN ROUTES ─────────────────────────────────────────────────
  async function requireAdmin(req: Request, res: Response): Promise<string | null> {
    const userId = req.session?.userId;
    if (!userId) { res.status(401).json({ error: "Non authentifié" }); return null; }
    const user = await storage.getUserById(userId);
    if (!user?.isAdmin) { res.status(403).json({ error: "Accès refusé - Administrateur requis" }); return null; }
    return userId;
  }

  app.get("/api/admin/notifications", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const [pendingPaymentsRes, proposedScoresRes, disputedChallengesRes, newUsersRes, pendingCoinsRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM tournament_participants WHERE payment_status='pending'`),
        pool.query(`SELECT COUNT(*) FROM tournament_matches WHERE status='proposed'`),
        pool.query(`SELECT COUNT(*) FROM challenges WHERE score_proposed_by IS NOT NULL AND status NOT IN ('done','cancelled')`),
        pool.query(`SELECT COUNT(*) FROM users WHERE is_admin=false AND created_at >= NOW() - INTERVAL '24 hours'`),
        pool.query(`SELECT COUNT(*) FROM coin_purchases WHERE status='pending'`),
      ]);
      const pendingPayments = parseInt(pendingPaymentsRes.rows[0].count, 10);
      const proposedScores = parseInt(proposedScoresRes.rows[0].count, 10);
      const disputedChallenges = parseInt(disputedChallengesRes.rows[0].count, 10);
      const newUsers = parseInt(newUsersRes.rows[0].count, 10);
      const pendingCoins = parseInt(pendingCoinsRes.rows[0].count, 10);
      const urgent = pendingPayments + proposedScores + disputedChallenges + pendingCoins;
      const total = urgent + newUsers;
      res.json({ pendingPayments, proposedScores, disputedChallenges, newUsers, pendingCoins, urgent, total });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/stats", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const [usersRes, tournamentsRes, matchesRes, messagesRes, activeRes] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM users WHERE is_admin = false"),
        pool.query("SELECT COUNT(*) FROM tournaments"),
        pool.query("SELECT COUNT(*) FROM tournament_matches"),
        pool.query("SELECT COUNT(*) FROM messages"),
        pool.query("SELECT COUNT(*) FROM tournaments WHERE status = 'in_progress'"),
      ]);
      // Build 7-day visits array (always returns, never crashes stats)
      const visitsByDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        visitsByDay[d.toISOString().slice(0, 10)] = 0;
      }
      try {
        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
        const cutoff = sixDaysAgo.toISOString().slice(0, 10);
        const visitsRes = await pool.query(
          `SELECT "date", COUNT(*) as visitors FROM daily_visits WHERE "date" >= $1 GROUP BY "date" ORDER BY "date" ASC`,
          [cutoff]
        );
        visitsRes.rows.forEach((r: any) => { visitsByDay[r.date] = parseInt(r.visitors); });
      } catch (_) { /* table may not exist yet, skip */ }
      const dailyVisits = Object.entries(visitsByDay).map(([date, visitors]) => ({ date, visitors }));
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayVisitors = visitsByDay[todayStr] ?? 0;

      res.json({
        users: parseInt(usersRes.rows[0].count),
        tournaments: parseInt(tournamentsRes.rows[0].count),
        matches: parseInt(matchesRes.rows[0].count),
        messages: parseInt(messagesRes.rows[0].count),
        activeTournaments: parseInt(activeRes.rows[0].count),
        onlineUsers: clientsByUserId.size,
        todayVisitors,
        dailyVisits,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const result = await pool.query(
        "SELECT id, username, pseudo, phone, country, region, is_admin, avatar_url, created_at, is_blocked, block_reason, can_post_clips FROM users ORDER BY created_at DESC"
      );
      res.json(result.rows.map((r: any) => ({
        id: r.id, username: r.username, pseudo: r.pseudo, phone: r.phone,
        country: r.country, region: r.region, isAdmin: r.is_admin, avatarUrl: r.avatar_url ?? null, createdAt: r.created_at,
        isBlocked: r.is_blocked ?? false, blockReason: r.block_reason ?? null,
        canPostClips: r.can_post_clips ?? true,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const user = await storage.getUserById(req.params.id);
      if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
      if (user.isAdmin) return res.status(400).json({ error: "Impossible de supprimer un administrateur" });
      // Delete related data
      await pool.query("DELETE FROM notifications WHERE user_id=$1", [req.params.id]);
      await pool.query("DELETE FROM messages WHERE sender_id=$1 OR receiver_id=$1", [req.params.id]);
      await pool.query("DELETE FROM friend_group_members WHERE user_id=$1", [req.params.id]);
      await pool.query("DELETE FROM friends WHERE user_id=$1 OR friend_id=$1", [req.params.id]);
      await pool.query("DELETE FROM tournament_participants WHERE user_id=$1", [req.params.id]);
      await pool.query("DELETE FROM users WHERE id=$1 AND is_admin=false", [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/tournaments", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const result = await pool.query(
        `SELECT t.*, u.pseudo as creator_pseudo, u.is_admin as creator_is_admin, t.creator_id,
                (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=t.id) as participant_count
         FROM tournaments t JOIN users u ON t.creator_id=u.id
         ORDER BY t.creator_id=$1 DESC, t.created_at DESC`,
        [adminId]
      );
      res.json(result.rows.map((r: any) => ({
        id: r.id, name: r.name, championshipType: r.championship_type,
        visibility: r.visibility, code: r.code, gameType: r.game_type,
        gameTime: r.game_time, status: r.status, playerLimit: r.player_limit,
        participantCount: parseInt(r.participant_count), createdAt: r.created_at,
        isSponsored: r.is_sponsored ?? false,
        sponsorName: r.sponsor_name ?? null,
        isElite: r.is_elite ?? false,
        minStars: r.min_stars ?? 0,
        isPaid: r.is_paid ?? false,
        entryFee: r.entry_fee ?? 0,
        startDate: r.start_date ?? null,
        endDate: r.end_date ?? null,
        creatorId: r.creator_id,
        creatorIsAdmin: r.creator_is_admin ?? false,
        creator: { pseudo: r.creator_pseudo }
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/tournaments/:id/status", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const { status } = req.body;
      if (!["waiting", "in_progress", "finished"].includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }
      const t = await pool.query("SELECT id FROM tournaments WHERE id=$1", [req.params.id]);
      if (!t.rows[0]) return res.status(404).json({ error: "Tournoi introuvable" });
      await pool.query("UPDATE tournaments SET status=$1 WHERE id=$2", [status, req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/tournaments/:id", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const t = await pool.query("SELECT id FROM tournaments WHERE id=$1", [req.params.id]);
      if (!t.rows[0]) return res.status(404).json({ error: "Tournoi introuvable" });
      await pool.query("DELETE FROM notifications WHERE tournament_id=$1", [req.params.id]);
      await pool.query("DELETE FROM tournament_matches WHERE tournament_id=$1", [req.params.id]);
      await pool.query("DELETE FROM tournament_participants WHERE tournament_id=$1", [req.params.id]);
      await pool.query("DELETE FROM tournaments WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/matches", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const result = await pool.query(
        `SELECT m.*, t.name as tournament_name,
                p1.pseudo as p1_pseudo, p2.pseudo as p2_pseudo
         FROM tournament_matches m
         JOIN tournaments t ON m.tournament_id=t.id
         JOIN users p1 ON m.player1_id=p1.id
         JOIN users p2 ON m.player2_id=p2.id
         ORDER BY m.played_at DESC NULLS LAST, t.name
         LIMIT 200`
      );
      res.json(result.rows.map((r: any) => ({
        id: r.id, phase: r.phase, poolNumber: r.pool_number,
        score1: r.score1, score2: r.score2, status: r.status, playedAt: r.played_at,
        tournament: { name: r.tournament_name },
        player1: { pseudo: r.p1_pseudo },
        player2: { pseudo: r.p2_pseudo },
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/messages", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const result = await pool.query(
        `SELECT m.*, us.pseudo as sender_pseudo, ur.pseudo as receiver_pseudo
         FROM messages m
         JOIN users us ON m.sender_id=us.id
         JOIN users ur ON m.receiver_id=ur.id
         ORDER BY m.created_at DESC
         LIMIT 200`
      );
      res.json(result.rows.map((r: any) => ({
        id: r.id, content: r.content, isRead: r.is_read, createdAt: r.created_at,
        sender: { pseudo: r.sender_pseudo },
        receiver: { pseudo: r.receiver_pseudo },
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/market", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      const result = await pool.query(
        `SELECT ml.*, u.pseudo as seller_pseudo, u.country as seller_country
         FROM marketplace_listings ml
         JOIN users u ON ml.seller_id=u.id
         ORDER BY ml.created_at DESC`
      );
      res.json(result.rows.map((r: any) => ({
        id: r.id, photoUrl: r.photo_url, forceCollective: r.force_collective,
        price: r.price, paymentNumber: r.payment_number, status: r.status,
        createdAt: r.created_at,
        seller: { pseudo: r.seller_pseudo, country: r.seller_country },
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/market/:id", async (req, res) => {
    const adminId = await requireAdmin(req, res); if (!adminId) return;
    try {
      await pool.query(`DELETE FROM marketplace_listings WHERE id=$1`, [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PROFILE
  app.patch("/api/auth/profile", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const { pseudo, avatarUrl, bio } = req.body;
      if (!pseudo || pseudo.trim().length < 2) return res.status(400).json({ error: "Pseudo invalide" });
      const user = await storage.updateProfile(userId, pseudo.trim(), avatarUrl || null, bio || null);
      res.json({ user: { ...user, password: undefined } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── AUTO-FINISH HELPER ────────────────────────────────────────────────────
  // Called after every match is confirmed as "done". If ALL matches in the
  // tournament are done AND the tournament is still "in_progress", it
  // automatically finalises the tournament, distributes rewards & prizes,
  // and notifies every participant.
  async function autoKnockoutDraw(tournament: any) {
    try {
      const standings = await storage.getTournamentStandings(tournament.id);
      const numPools = tournament.numPools || 0;
      const winners: any[] = [];
      for (let p = 1; p <= numPools; p++) {
        const poolStandings = standings.filter((s: any) => s.poolNumber === p);
        winners.push(...poolStandings.slice(0, 2));
      }
      if (winners.length < 2) return;

      const createKO = async (p1: any, p2: any, label: string) => {
        const m = await storage.createMatch({
          tournamentId: tournament.id, player1Id: p1.userId, player2Id: p2.userId,
          phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
        } as any);
        await notify(p1.userId, `🏆 ${label} ! vs ${p2.pseudo} - ${tournament.name}`, tournament.id, m.id);
        await notify(p2.userId, `🏆 ${label} ! vs ${p1.pseudo} - ${tournament.name}`, tournament.id, m.id);
      };

      // Notify all participants that the knockout phase starts automatically
      const participants = await storage.getTournamentParticipants(tournament.id);
      for (const p of participants) {
        await notify(p.userId, `⚡ Phase finale démarrée automatiquement dans "${tournament.name}" — tous les matchs de poule sont terminés !`, tournament.id, undefined);
      }

      if (numPools === 8 && winners.length >= 12) {
        const pools = [1,2,3,4,5,6,7,8].map(p => standings.filter((s: any) => s.poolNumber === p).slice(0, 2));
        let count = 1;
        for (let i = 0; i < 8; i += 2) {
          const pA = pools[i], pB = pools[i+1];
          if (pA[0] && pB[1]) await createKO(pA[0], pB[1], `8ème ${count++}`);
          if (pB[0] && pA[1]) await createKO(pB[0], pA[1], `8ème ${count++}`);
        }
      } else if (numPools === 4 && winners.length >= 6) {
        const pools = [1,2,3,4].map(p => standings.filter((s: any) => s.poolNumber === p).slice(0, 2));
        if (pools[0][0] && pools[1][1]) await createKO(pools[0][0], pools[1][1], "Quart 1");
        if (pools[1][0] && pools[0][1]) await createKO(pools[1][0], pools[0][1], "Quart 2");
        if (pools[2][0] && pools[3][1]) await createKO(pools[2][0], pools[3][1], "Quart 3");
        if (pools[3][0] && pools[2][1]) await createKO(pools[3][0], pools[2][1], "Quart 4");
      } else if (numPools === 2 && winners.length >= 2) {
        const poolA = standings.filter((s: any) => s.poolNumber === 1).slice(0, 2);
        const poolB = standings.filter((s: any) => s.poolNumber === 2).slice(0, 2);
        if (poolA.length === 1 && poolB.length === 1) {
          await createKO(poolA[0], poolB[0], "FINALE");
        } else if (poolA.length === 2 && poolB.length === 2) {
          await createKO(poolA[0], poolB[1], "Demi-finale 1");
          await createKO(poolB[0], poolA[1], "Demi-finale 2");
        }
      } else if (numPools === 1 && winners.length >= 2) {
        await createKO(winners[0], winners[1], "FINALE");
      } else {
        for (let i = 0; i < winners.length - 1; i += 2) {
          if (winners[i] && winners[i+1]) await createKO(winners[i], winners[i+1], "Phase finale");
        }
      }
    } catch (err) {
      console.error("[autoKnockoutDraw] Error:", err);
    }
  }

  // Auto-advance knockout rounds: Quarts → Demi-finales → FINALE
  async function autoNextKnockoutRound(tournament: any, lastRoundMatches: any[], nextRoundNumber: number) {
    try {
      // Sort matches by id for consistent bracket ordering
      const sorted = [...lastRoundMatches].sort((a, b) => a.id < b.id ? -1 : 1);
      const winners: Array<{ userId: string; pseudo: string }> = [];
      for (const m of sorted) {
        const s1 = m.score1 ?? 0;
        const s2 = m.score2 ?? 0;
        if (s1 >= s2) {
          winners.push({ userId: m.player1Id, pseudo: m.player1.pseudo });
        } else {
          winners.push({ userId: m.player2Id, pseudo: m.player2.pseudo });
        }
      }

      const nextMatchCount = Math.floor(winners.length / 2);
      const roundName = nextMatchCount >= 8 ? "Huitièmes de finale"
        : nextMatchCount >= 4 ? "Quarts de finale"
        : nextMatchCount === 2 ? "Demi-finales"
        : "FINALE";
      const matchLabel = nextMatchCount >= 8 ? "Huitième de finale"
        : nextMatchCount >= 4 ? "Quart de finale"
        : nextMatchCount === 2 ? "Demi-finale"
        : "FINALE";

      // Notify all participants about the new round
      const participants = await storage.getTournamentParticipants(tournament.id);
      for (const p of participants) {
        await notify(p.userId, `⚡ ${roundName} dans "${tournament.name}" — les matchs viennent d'être tirés !`, tournament.id, undefined);
      }

      // Create next round matches
      for (let i = 0; i < winners.length - 1; i += 2) {
        const p1 = winners[i];
        const p2 = winners[i + 1];
        const num = Math.floor(i / 2) + 1;
        const label = nextMatchCount === 1 ? "FINALE" : `${matchLabel} ${num}`;
        const m = await storage.createMatch({
          tournamentId: tournament.id, player1Id: p1.userId, player2Id: p2.userId,
          phase: "knockout", poolNumber: null, roundNumber: nextRoundNumber,
          score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
        } as any);
        await notify(p1.userId, `🏆 ${label} ! vs ${p2.pseudo} - ${tournament.name}`, tournament.id, m.id);
        await notify(p2.userId, `🏆 ${label} ! vs ${p1.pseudo} - ${tournament.name}`, tournament.id, m.id);
      }
    } catch (err) {
      console.error("[autoNextKnockoutRound] Error:", err);
    }
  }

  async function autoFinishIfComplete(tournamentId: string) {
    try {
      const tournament = await storage.getTournamentById(tournamentId) as any;
      if (!tournament || tournament.status !== "in_progress") return;

      const matches = await storage.getTournamentMatches(tournamentId);
      if (matches.length === 0) return;

      // For pool tournaments: auto-trigger knockout then auto-advance through rounds
      if (tournament.championshipType === "pool") {
        const poolMatches = matches.filter((m: any) => m.phase === "pool");
        const knockoutMatches = matches.filter((m: any) => m.phase === "knockout");
        const allPoolDone = poolMatches.length > 0 && poolMatches.every((m: any) => m.status === "done");

        // Phase 1: all pool matches done, no knockout yet → trigger first round
        if (allPoolDone && knockoutMatches.length === 0) {
          await autoKnockoutDraw(tournament);
          return;
        }

        // Phase 2: knockout matches exist → check current round
        if (knockoutMatches.length > 0) {
          const maxRound = Math.max(...knockoutMatches.map((m: any) => m.roundNumber ?? 1));
          const currentRound = knockoutMatches.filter((m: any) => (m.roundNumber ?? 1) === maxRound);
          const pendingInRound = currentRound.filter((m: any) => m.status !== "done");

          if (pendingInRound.length > 0) return; // current round still in progress

          // Current round complete
          if (currentRound.length > 1) {
            // More than 1 match (not the final yet) → advance to next round
            await autoNextKnockoutRound(tournament, currentRound, maxRound + 1);
            return;
          }
          // Single match (FINALE) was just done → fall through to finish tournament
        }
      }

      const pending = matches.filter((m: any) => m.status !== "done");
      if (pending.length > 0) return; // still matches to play

      await storage.updateTournamentStatus(tournamentId, "finished");

      const participants = await storage.getTournamentParticipants(tournamentId);
      for (const p of participants) {
        await notify(
          p.userId,
          `🏁 Le tournoi "${tournament.name}" est terminé ! Consultez le classement final.`,
          tournamentId,
          undefined
        );
      }

      // Distribute trophies / star bonuses
      try {
        const rewards = await storage.distributeRewards(tournamentId);
        const badgeEmoji: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
        for (const r of (rewards as any[])) {
          const emoji = badgeEmoji[r.badge] ?? "🏆";
          const starBonus = r.position === 1 ? " +1 étoile bonus ajoutée à votre profil !" : "";
          const coinBonus = r.coinsAwarded > 0 ? ` +${r.coinsAwarded} pièces créditées sur votre compte !` : "";
          await notify(
            r.userId,
            `${emoji} Félicitations ! Vous avez obtenu le titre "${r.rewardLabel}" dans le tournoi "${tournament.name}". Un trophée a été ajouté à votre profil !${starBonus}${coinBonus}`,
            tournamentId,
            undefined
          );
        }
      } catch (_) {}

      // Distribute financial prizes for paid tournaments
      try {
        const prizes = await storage.distributePrizes(tournamentId);
        if (prizes) {
          const totalPool = (tournament.entryFee ?? 0) * participants.length;
          if (prizes.winner?.id) {
            await notify(
              prizes.winner.id,
              `🏆 Vous êtes champion du tournoi "${tournament.name}" ! Votre gain : ${prizes.winner.amount.toLocaleString()} FCFA (50% de la cagnotte de ${totalPool.toLocaleString()} FCFA). L'organisateur va vous contacter pour le virement.`,
              tournamentId, undefined
            );
          }
          if (prizes.runnerUp?.id) {
            await notify(
              prizes.runnerUp.id,
              `🥈 Finaliste du tournoi "${tournament.name}" ! Votre gain : ${prizes.runnerUp.amount.toLocaleString()} FCFA (20% de la cagnotte de ${totalPool.toLocaleString()} FCFA). L'organisateur va vous contacter pour le virement.`,
              tournamentId, undefined
            );
          }
        }
      } catch (_) {}
    } catch (_) {}
  }
  // ──────────────────────────────────────────────────────────────────────────

  // SCORE ENTRY
  app.patch("/api/matches/:id/score", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const { id } = req.params;
      const { score1, score2, proofUrl } = req.body;
      if (score1 === undefined || score2 === undefined || score1 < 0 || score2 < 0) {
        return res.status(400).json({ error: "Scores invalides" });
      }
      const match = await storage.getMatchById(id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      if (match.status === "done") return res.status(400).json({ error: "Score déjà enregistré" });

      const tournament = await storage.getTournamentById(match.tournamentId);
      const isCreator = userId === tournament?.creatorId;
      const isPlayer = userId === match.player1Id || userId === match.player2Id;

      if (!isPlayer && !isCreator) return res.status(403).json({ error: "Non autorisé" });

      // Pour les joueurs, la preuve photo est obligatoire
      if (!isCreator && !proofUrl) {
        return res.status(400).json({ error: "Une photo de preuve est obligatoire pour proposer un score." });
      }

      const s1 = parseInt(score1);
      const s2 = parseInt(score2);
      const tournamentName = tournament?.name || "tournoi";

      if (isCreator) {
        // Creator directly finalizes the score
        await storage.updateMatchScore(id, s1, s2);
        const winner = s1 > s2 ? match.player1Id : s2 > s1 ? match.player2Id : null;
        const loser = s1 > s2 ? match.player2Id : s2 > s1 ? match.player1Id : null;
        if (winner && loser) {
          await notify(winner, `🏆 Victoire ! Score: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, id);
          await notify(loser, `Match terminé: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, id);
        } else {
          await notify(match.player1Id, `Match nul: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, id);
          await notify(match.player2Id, `Match nul: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, id);
        }
        // Auto-finish tournament if all matches are now done
        await autoFinishIfComplete(match.tournamentId);
        return res.json({ success: true, confirmed: true });
      }

      // Player proposes score
      if (match.status === "proposed") {
        return res.status(400).json({ error: "Un score est déjà en attente de confirmation. Attendez que l'autre joueur confirme ou conteste." });
      }
      await storage.proposeScore(id, userId, s1, s2, proofUrl || null);
      const otherId = userId === match.player1Id ? match.player2Id : match.player1Id;
      const me = await storage.getUserById(userId);
      const scoreMsg = `⚽ ${me?.pseudo} a proposé le score ${s1}-${s2} pour un match dans ${tournamentName}. Confirmez ou contestez !`;
      await notify(otherId, scoreMsg, match.tournamentId, id);
      // Notifier l'organisateur s'il n'est pas déjà l'un des deux joueurs
      if (tournament?.creatorId && tournament.creatorId !== userId && tournament.creatorId !== otherId) {
        await notify(tournament.creatorId, `📋 ${me?.pseudo} a proposé le score ${s1}-${s2} dans ${tournamentName} (match en attente de confirmation).`, match.tournamentId, id);
      }
      res.json({ success: true, confirmed: false });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/matches/:id/confirm-score", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const match = await storage.getMatchById(req.params.id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      if (match.status !== "proposed") return res.status(400).json({ error: "Aucun score en attente de confirmation" });

      const tournament = await storage.getTournamentById(match.tournamentId);
      const isCreator = userId === tournament?.creatorId;
      const isOtherPlayer = userId !== (match as any).proposedBy && (userId === match.player1Id || userId === match.player2Id);
      if (!isOtherPlayer && !isCreator) return res.status(403).json({ error: "Seul l'autre joueur ou le créateur peut confirmer" });

      await storage.confirmScore(req.params.id);
      const s1 = (match as any).proposedScore1;
      const s2 = (match as any).proposedScore2;
      const tournamentName = tournament?.name || "tournoi";
      const winner = s1 > s2 ? match.player1Id : s2 > s1 ? match.player2Id : null;
      const loser = s1 > s2 ? match.player2Id : s2 > s1 ? match.player1Id : null;
      if (winner && loser) {
        // ★ Récompense : +5 pièces au vainqueur (plafond 30/semaine)
        const coinsWon = await storage.awardMatchWinCoins(req.params.id, winner);
        const coinMsg = coinsWon > 0 ? ` +${coinsWon} pièces gagnées !` : " (plafond hebdomadaire atteint)";
        await notify(winner, `🏆 Victoire confirmée ! Score: ${s1}-${s2} dans ${tournamentName}.${coinMsg}`, match.tournamentId, req.params.id);
        await notify(loser, `Match confirmé: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, req.params.id);
      } else {
        await notify(match.player1Id, `Match nul confirmé: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, req.params.id);
        await notify(match.player2Id, `Match nul confirmé: ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, req.params.id);
      }
      // Notifier l'organisateur si ce n'est pas l'un des joueurs
      if (tournament?.creatorId && tournament.creatorId !== match.player1Id && tournament.creatorId !== match.player2Id) {
        await notify(tournament.creatorId, `✅ Score confirmé ${s1}-${s2} dans ${tournamentName}.`, match.tournamentId, req.params.id);
      }
      // Auto-finish tournament if all matches are now done
      await autoFinishIfComplete(match.tournamentId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/matches/:id/reject-score", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const match = await storage.getMatchById(req.params.id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      if (match.status !== "proposed") return res.status(400).json({ error: "Aucun score en attente de confirmation" });

      const tournament = await storage.getTournamentById(match.tournamentId);
      const isCreator = userId === tournament?.creatorId;
      const isOtherPlayer = userId !== (match as any).proposedBy && (userId === match.player1Id || userId === match.player2Id);
      if (!isOtherPlayer && !isCreator) return res.status(403).json({ error: "Seul l'autre joueur ou le créateur peut contester" });

      await storage.rejectScore(req.params.id);
      const me = await storage.getUserById(userId);
      const tournamentName2 = tournament?.name || "tournoi";
      await notify((match as any).proposedBy, `❌ ${me?.pseudo} a contesté votre score proposé. Rejouez ou entrez un nouveau score.`, match.tournamentId, req.params.id);
      // Notifier l'organisateur si ce n'est pas l'un des joueurs
      if (tournament?.creatorId && tournament.creatorId !== match.player1Id && tournament.creatorId !== match.player2Id) {
        await notify(tournament.creatorId, `⚠️ Score contesté dans ${tournamentName2} par ${me?.pseudo}. Le match est remis à jouer.`, match.tournamentId, req.params.id);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/matches/:id/correct-score", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const match = await storage.getMatchById(req.params.id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      if (match.status !== "done") return res.status(400).json({ error: "Le match n'est pas encore terminé" });

      const tournament = await storage.getTournamentById(match.tournamentId);
      if (userId !== tournament?.creatorId) return res.status(403).json({ error: "Seul le créateur peut rectifier un score" });

      const correctionCount = match.correctionCount ?? 0;
      if (correctionCount >= 2) return res.status(400).json({ error: "Limite de 2 rectifications atteinte pour ce match" });

      const { score1, score2 } = req.body;
      if (score1 === undefined || score2 === undefined || score1 < 0 || score2 < 0) {
        return res.status(400).json({ error: "Scores invalides" });
      }
      const s1 = parseInt(score1);
      const s2 = parseInt(score2);
      await storage.correctMatchScore(req.params.id, s1, s2);

      const winner = s1 > s2 ? match.player1Id : s2 > s1 ? match.player2Id : null;
      const tournamentName = tournament?.name || "tournoi";
      await notify(match.player1Id, `📝 L'organisateur a rectifié le score : ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, req.params.id);
      await notify(match.player2Id, `📝 L'organisateur a rectifié le score : ${s1}-${s2} dans ${tournamentName}`, match.tournamentId, req.params.id);

      // Auto-finish tournament if all matches are now done
      await autoFinishIfComplete(match.tournamentId);
      res.json({ success: true, correctionsRemaining: 2 - (correctionCount + 1) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Organizer sets the date of the match (date only, no time)
  app.patch("/api/matches/:id/schedule", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const match = await storage.getMatchById(req.params.id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      const tournament = await storage.getTournamentById(match.tournamentId);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.creatorId !== userId) return res.status(403).json({ error: "Seul le créateur peut fixer la date du match" });
      const { matchDate } = req.body;
      await storage.setMatchDate(req.params.id, matchDate || null);
      // Notify both players if date was set
      if (matchDate) {
        const m = match as any;
        const formattedDate = new Date(matchDate).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
        await notify(m.player1Id, `📅 L'organisateur a fixé la date de votre match au ${formattedDate}. Proposez votre heure disponible dans la section Matchs.`, m.tournamentId, m.id);
        await notify(m.player2Id, `📅 L'organisateur a fixé la date de votre match au ${formattedDate}. Proposez votre heure disponible dans la section Matchs.`, m.tournamentId, m.id);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Player proposes their available time for a match
  app.patch("/api/matches/:id/propose-time", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const match = await storage.getMatchById(req.params.id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "Vous n'êtes pas joueur de ce match" });
      }
      if (match.status === "done") return res.status(400).json({ error: "Match déjà terminé" });
      const { time } = req.body; // format "HH:MM"
      const result = await storage.proposeMatchTime(req.params.id, userId, time || null);

      // Notify the opponent of the proposed time
      const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
      const myPseudo = reqUser.pseudo;

      if (result.scheduled) {
        await notify(match.player1Id, `✅ Accord trouvé ! Votre match est programmé à ${time}. Les rappels automatiques sont activés.`, match.tournamentId, match.id);
        await notify(match.player2Id, `✅ Accord trouvé ! Votre match est programmé à ${time}. Les rappels automatiques sont activés.`, match.tournamentId, match.id);
      } else if (time) {
        await notify(opponentId, `🕐 ${myPseudo} propose de jouer à ${time}. Allez dans "Mes Matchs" pour répondre.`, match.tournamentId, match.id);
      }

      res.json({ success: true, scheduled: result.scheduled });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Player rejects the opponent's proposed time
  app.patch("/api/matches/:id/reject-time", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const match = await storage.getMatchById(req.params.id) as any;
      if (!match) return res.status(404).json({ error: "Match introuvable" });
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "Vous n'êtes pas joueur de ce match" });
      }
      const { proposerPseudo } = await storage.rejectMatchTime(req.params.id, userId);
      const proposerId = match.player1Id === userId ? match.player2Id : match.player1Id;
      await notify(proposerId, `❌ ${reqUser.pseudo} a refusé votre proposition d'heure. Proposez un autre créneau dans "Mes Matchs".`, match.tournamentId, match.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // STANDINGS
  app.get("/api/tournaments/:id/standings", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const standings = await storage.getTournamentStandings(req.params.id);
      res.json(standings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // LEADERBOARD
  app.get("/api/leaderboard", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const result = await pool.query(`
        SELECT
          u.id, u.pseudo, u.avatar_url, u.country,
          COALESCE(u.bonus_stars, 0) as bonus_stars,
          COALESCE(u.coins, 0) as coins,
          COUNT(m.id) FILTER (WHERE m.status='done' AND (
            (m.player1_id=u.id AND m.score1 > m.score2) OR
            (m.player2_id=u.id AND m.score2 > m.score1)
          )) as tournament_wins,
          COUNT(m.id) FILTER (WHERE m.status='done') as tournament_played,
          (
            SELECT COUNT(*) FROM challenges c
            WHERE c.winner_id = u.id AND c.status = 'done'
          ) as challenge_wins
        FROM users u
        LEFT JOIN tournament_matches m ON (m.player1_id=u.id OR m.player2_id=u.id)
        WHERE u.is_admin = false
        GROUP BY u.id, u.pseudo, u.avatar_url, u.country, u.bonus_stars, u.coins
        ORDER BY (tournament_wins + challenge_wins) DESC, bonus_stars DESC, coins DESC
        LIMIT 20
      `);
      const rows = result.rows.map((r: any, idx: number) => ({
        rank: idx + 1,
        id: r.id,
        pseudo: r.pseudo,
        avatarUrl: r.avatar_url,
        country: r.country,
        bonusStars: parseInt(r.bonus_stars ?? 0),
        coins: parseFloat(r.coins ?? 0),
        tournamentWins: parseInt(r.tournament_wins ?? 0),
        challengeWins: parseInt(r.challenge_wins ?? 0),
        totalWins: parseInt(r.tournament_wins ?? 0) + parseInt(r.challenge_wins ?? 0),
        played: parseInt(r.tournament_played ?? 0),
      }));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // USER STATS
  app.get("/api/stats/me", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/stats/:userId", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const stats = await storage.getUserStats(req.params.userId);
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // REWARDS
  app.get("/api/rewards/me", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const rewards = await storage.getUserRewards(userId);
      res.json(rewards);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // FINISH TOURNAMENT
  app.post("/api/tournaments/:id/finish", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      const userId = reqUser.id;
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.creatorId !== userId) return res.status(403).json({ error: "Seul le créateur peut terminer ce tournoi" });
      if (tournament.status !== "in_progress") return res.status(400).json({ error: "Le tournoi doit être en cours" });

      const matches = await storage.getTournamentMatches(req.params.id);
      const pending = matches.filter(m => m.status !== "done");
      if (pending.length > 0) {
        return res.status(400).json({ error: `Il reste ${pending.length} match(s) non terminé(s)` });
      }

      await storage.updateTournamentStatus(tournament.id, "finished");
      const participants = await storage.getTournamentParticipants(tournament.id);
      for (const p of participants) {
        await notify(p.userId, `🏁 Le tournoi "${tournament.name}" est terminé !`, tournament.id, undefined);
      }

      // Distribute rewards to top finalists (only if > 5 participants)
      try {
        const rewards = await storage.distributeRewards(tournament.id);
        const badgeEmoji: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
        for (const r of rewards) {
          const emoji = badgeEmoji[r.badge] ?? "🏆";
          const starBonus = r.position === 1 ? " +1 étoile bonus ajoutée à votre profil !" : "";
          await notify(
            r.userId,
            `${emoji} Félicitations ! Vous avez obtenu le titre "${r.rewardLabel}" dans le tournoi "${tournament.name}". Un trophée a été ajouté à votre profil !${starBonus}`,
            tournament.id,
            undefined
          );
        }
      } catch (_) {}

      // Distribute financial prizes for paid (cotisation) tournaments
      try {
        const prizes = await storage.distributePrizes(tournament.id);
        if (prizes) {
          const t = tournament as any;
          const participants = await storage.getTournamentParticipants(tournament.id);
          const totalPool = t.entryFee * participants.length;
          if (prizes.winner?.id) {
            await notify(
              prizes.winner.id,
              `🏆 Vous êtes champion du tournoi "${tournament.name}" ! Votre gain : ${prizes.winner.amount.toLocaleString()} FCFA (50% de la cagnotte de ${totalPool.toLocaleString()} FCFA). L'organisateur va vous contacter pour le virement.`,
              tournament.id, undefined
            );
          }
          if (prizes.runnerUp?.id) {
            await notify(
              prizes.runnerUp.id,
              `🥈 Finaliste du tournoi "${tournament.name}" ! Votre gain : ${prizes.runnerUp.amount.toLocaleString()} FCFA (20% de la cagnotte de ${totalPool.toLocaleString()} FCFA). L'organisateur va vous contacter pour le virement.`,
              tournament.id, undefined
            );
          }
        }
      } catch (_) {}

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // KNOCKOUT DRAW (phase finale for pool tournaments)
  app.post("/api/tournaments/:id/knockout-draw", async (req, res) => {
    try {
      const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
      const userId = reqUser.id;
      const tournament = await storage.getTournamentById(req.params.id);
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (tournament.creatorId !== userId) return res.status(403).json({ error: "Seul le créateur peut lancer la phase finale" });
      if (tournament.status !== "in_progress") return res.status(400).json({ error: "Le tournoi doit être en cours" });
      if (tournament.championshipType !== "pool") return res.status(400).json({ error: "Seulement pour les tournois en poules" });

      const matches = await storage.getTournamentMatches(req.params.id);
      if (matches.some(m => m.phase === "knockout")) {
        return res.status(400).json({ error: "La phase finale a déjà été tirée" });
      }
      const poolMatches = matches.filter(m => m.phase === "pool");
      const pendingPool = poolMatches.filter(m => m.status !== "done");
      if (pendingPool.length > 0) {
        return res.status(400).json({ error: `Il reste ${pendingPool.length} match(s) de poule non terminé(s)` });
      }

      // Qualification : Top 2 per pool from standings (Real football logic)
      const standings = await storage.getTournamentStandings(req.params.id);
      const winners: any[] = [];
      const numPools = tournament.numPools || 0;
      
      for (let p = 1; p <= numPools; p++) {
        const poolStandings = standings.filter(s => s.poolNumber === p);
        // Top 2 from each pool
        const top2 = poolStandings.slice(0, 2);
        winners.push(...top2);
      }

      if (winners.length < 2) {
        return res.status(400).json({ error: "Pas assez de qualifiés pour la phase finale (min 2 requis)" });
      }

      // Logic for 8 Pools -> 16 qualifiers -> Huitièmes de finale
      if (numPools === 8 && (winners.length === 16 || winners.length >= 12)) {
        const pools = [1, 2, 3, 4, 5, 6, 7, 8].map(p => standings.filter(s => s.poolNumber === p).slice(0, 2));
        const matchups = [];
        // Cross-pool matchups: 1A vs 2B, 1B vs 2A, etc.
        for (let i = 0; i < 8; i += 2) {
          const p1 = pools[i];
          const p2 = pools[i+1];
          if (p1[0] && p2[1]) matchups.push({ p1: p1[0], p2: p2[1], label: `8ème ${matchups.length + 1}` });
          if (p2[0] && p1[1]) matchups.push({ p1: p2[0], p2: p1[1], label: `8ème ${matchups.length + 1}` });
        }
        
        for (const { p1, p2, label } of matchups) {
          const m = await storage.createMatch({
            tournamentId: tournament.id, player1Id: p1.userId, player2Id: p2.userId,
            phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
          } as any);
          await notify(p1.userId, `🏆 ${label} ! vs ${p2.pseudo} - ${tournament.name}`, tournament.id, m.id);
          await notify(p2.userId, `🏆 ${label} ! vs ${p1.pseudo} - ${tournament.name}`, tournament.id, m.id);
        }
        return res.json({ success: true, qualifiedCount: matchups.length * 2, phase: "Huitièmes de finale" });
      }

      // Logic for 4 pools: Quarter-finals (Cross-pool matches)
      if (numPools === 4 && (winners.length === 8 || winners.length >= 6)) {
        const pools = [1, 2, 3, 4].map(p => standings.filter(s => s.poolNumber === p).slice(0, 2));
        const matchups = [];
        if (pools[0][0] && pools[1][1]) matchups.push({ p1: pools[0][0], p2: pools[1][1], label: "Quart 1" });
        if (pools[1][0] && pools[0][1]) matchups.push({ p1: pools[1][0], p2: pools[0][1], label: "Quart 2" });
        if (pools[2][0] && pools[3][1]) matchups.push({ p1: pools[2][0], p2: pools[3][1], label: "Quart 3" });
        if (pools[3][0] && pools[2][1]) matchups.push({ p1: pools[3][0], p2: pools[2][1], label: "Quart 4" });

        for (const { p1, p2, label } of matchups) {
          const m = await storage.createMatch({
            tournamentId: tournament.id, player1Id: p1.userId, player2Id: p2.userId,
            phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
          } as any);
          await notify(p1.userId, `🏆 ${label} ! vs ${p2.pseudo} - ${tournament.name}`, tournament.id, m.id);
          await notify(p2.userId, `🏆 ${label} ! vs ${p1.pseudo} - ${tournament.name}`, tournament.id, m.id);
        }
        return res.json({ success: true, qualifiedCount: matchups.length * 2, phase: "Quarts de finale" });
      }

      // Logic for 2 pools: Semi-finals
      if (numPools === 2 && winners.length >= 2) {
        const poolA = standings.filter(s => s.poolNumber === 1).slice(0, 2);
        const poolB = standings.filter(s => s.poolNumber === 2).slice(0, 2);
        
        // Case: 2 pools of 2 players (Total 4) -> Winners of each pool go to Final
        if (poolA.length === 1 && poolB.length === 1) {
          const m = await storage.createMatch({
            tournamentId: tournament.id, player1Id: poolA[0].userId, player2Id: poolB[0].userId,
            phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
          } as any);
          await notify(poolA[0].userId, `🏆 FINALE ! vs ${poolB[0].pseudo} - ${tournament.name}`, tournament.id, m.id);
          await notify(poolB[0].userId, `🏆 FINALE ! vs ${poolA[0].pseudo} - ${tournament.name}`, tournament.id, m.id);
          return res.json({ success: true, qualifiedCount: 2, phase: "Finale" });
        }

        if (poolA.length === 2 && poolB.length === 2) {
          const m1 = await storage.createMatch({
            tournamentId: tournament.id, player1Id: poolA[0].userId, player2Id: poolB[1].userId,
            phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
          } as any);
          const m2 = await storage.createMatch({
            tournamentId: tournament.id, player1Id: poolB[0].userId, player2Id: poolA[1].userId,
            phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
          } as any);
          
          await notify(poolA[0].userId, `🏆 Demi-finale 1 ! vs ${poolB[1].pseudo} - ${tournament.name}`, tournament.id, m1.id);
          await notify(poolB[1].userId, `🏆 Demi-finale 1 ! vs ${poolA[0].pseudo} - ${tournament.name}`, tournament.id, m1.id);
          await notify(poolB[0].userId, `🏆 Demi-finale 2 ! vs ${poolA[1].pseudo} - ${tournament.name}`, tournament.id, m2.id);
          await notify(poolA[1].userId, `🏆 Demi-finale 2 ! vs ${poolB[0].pseudo} - ${tournament.name}`, tournament.id, m2.id);
          
          return res.json({ success: true, qualifiedCount: 4, phase: "Demi-finales" });
        }
      }

      // Logic for 1 pool (Total 4, 6, 8 players): Finale directe
      if (numPools === 1 && winners.length >= 2) {
        const m = await storage.createMatch({
          tournamentId: tournament.id, player1Id: winners[0].userId, player2Id: winners[1].userId,
          phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
        } as any);
        await notify(winners[0].userId, `🏆 FINALE ! vs ${winners[1].pseudo} - ${tournament.name}`, tournament.id, m.id);
        await notify(winners[1].userId, `🏆 FINALE ! vs ${winners[0].pseudo} - ${tournament.name}`, tournament.id, m.id);
        return res.json({ success: true, qualifiedCount: 2, phase: "Finale" });
      }

      // Logic for 4 pools: Quarter-finals (Cross-pool matches)
      if (numPools === 4 && winners.length === 8) {
        const pools = [1, 2, 3, 4].map(p => standings.filter(s => s.poolNumber === p).slice(0, 2));
        
        if (pools.every(p => p.length === 2)) {
          const matchups = [
            { p1: pools[0][0], p2: pools[1][1], label: "Quart 1" }, // 1er A vs 2ème B
            { p1: pools[1][0], p2: pools[0][1], label: "Quart 2" }, // 1er B vs 2ème A
            { p1: pools[2][0], p2: pools[3][1], label: "Quart 3" }, // 1er C vs 2ème D
            { p1: pools[3][0], p2: pools[2][1], label: "Quart 4" }, // 1er D vs 2ème C
          ];

          for (const { p1, p2, label } of matchups) {
            const m = await storage.createMatch({
              tournamentId: tournament.id, player1Id: p1.userId, player2Id: p2.userId,
              phase: "knockout", poolNumber: null, roundNumber: 1, score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
            } as any);
            await notify(p1.userId, `🏆 ${label} ! vs ${p2.pseudo} - ${tournament.name}`, tournament.id, m.id);
            await notify(p2.userId, `🏆 ${label} ! vs ${p1.pseudo} - ${tournament.name}`, tournament.id, m.id);
          }
          return res.json({ success: true, qualifiedCount: 8, phase: "Quarts de finale" });
        }
      }

      // Default: Direct elimination matches
      for (let i = 0; i < winners.length; i += 2) {
        const p1 = winners[i];
        const p2 = winners[i+1];
        if (p1 && p2) {
          const match = await storage.createMatch({
            tournamentId: tournament.id,
            player1Id: p1.userId,
            player2Id: p2.userId,
            phase: "knockout",
            poolNumber: null,
            roundNumber: 1,
            score1: null, score2: null, status: "pending", playedAt: null, scheduledAt: null
          } as any);
          await notify(p1.userId, `🏆 Phase finale ! Match tiré dans ${tournament.name}`, tournament.id, match.id);
          await notify(p2.userId, `🏆 Phase finale ! Match tiré dans ${tournament.name}`, tournament.id, match.id);
        }
      }

      res.json({ success: true, qualifiedCount: winners.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // TOURNAMENT CHAT
  app.get("/api/tournaments/:id/chat", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const messages = await storage.getTournamentChat(req.params.id);
      res.json(messages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tournaments/:id/chat", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    const userId = reqUser.id;
    try {
      const { content } = req.body;
      if (!content || content.trim().length === 0) return res.status(400).json({ error: "Message vide" });
      const isParticipant = await storage.isParticipant(req.params.id, userId);
      const tournament = await storage.getTournamentById(req.params.id);
      if (!isParticipant && tournament?.creatorId !== userId) return res.status(403).json({ error: "Non autorisé" });
      const msg = await storage.sendTournamentChat(req.params.id, userId, content.trim());
      res.json(msg);

      // Notifier tous les participants + le créateur (sauf l'expéditeur)
      const senderPseudo = reqUser.pseudo ?? reqUser.username ?? "Quelqu'un";
      const tournamentName = tournament?.name ?? "tournoi";
      const notifMsg = `💬 ${senderPseudo} dans ${tournamentName} : ${content.trim().length > 60 ? content.trim().slice(0, 60) + "…" : content.trim()}`;
      const participants = await storage.getTournamentParticipants(req.params.id);
      const notifiedIds = new Set<string>();
      for (const p of participants) {
        if (p.userId !== userId && !notifiedIds.has(p.userId)) {
          notifiedIds.add(p.userId);
          notify(p.userId, notifMsg, req.params.id).catch(() => {});
        }
      }
      if (tournament?.creatorId && tournament.creatorId !== userId && !notifiedIds.has(tournament.creatorId)) {
        notify(tournament.creatorId, notifMsg, req.params.id).catch(() => {});
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── MARKETPLACE ────────────────────────────────────────────────────────────
  app.get("/api/market", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const listings = await storage.getMarketListings();
      const cartIds = (await storage.getCart(userId)).map((c: any) => c.id);
      const data = listings.map((l: any) => ({ ...l, inCart: cartIds.includes(l.id) }));
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/mine", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const listings = await storage.getMyMarketListings(userId);
      res.json(listings);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/market", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const { photoUrl, forceCollective, price, paymentNumber } = req.body;
      if (!photoUrl || !forceCollective || !price || !paymentNumber) return res.status(400).json({ error: "Champs manquants" });
      if (forceCollective < 1 || forceCollective > 3300) return res.status(400).json({ error: "Force collective invalide (1-3300)" });
      if (price < 1) return res.status(400).json({ error: "Prix invalide" });
      const listing = await storage.createMarketListing(userId, { photoUrl, forceCollective: parseInt(forceCollective), price: parseInt(price), paymentNumber });
      res.status(201).json(listing);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/market/:id", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const ok = await storage.deleteMarketListing(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Annonce introuvable ou non autorisé" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/market/:id/sold", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const ok = await storage.markListingAsSold(req.params.id, userId);
      if (!ok) return res.status(404).json({ error: "Annonce introuvable ou non autorisé" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/market/cart", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const cart = await storage.getCart(userId);
      res.json(cart);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/market/cart/:id", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      await storage.addToCart(userId, req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/market/cart/:id", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      await storage.removeFromCart(userId, req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── COINS ──────────────────────────────────────────────────────────────────

  // Progression hebdomadaire des récompenses de matchs
  app.get("/api/coins/weekly-progress", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const earned = await storage.getMatchWinCoinsThisWeek(reqUser.id);
      const cap = 30; // WEEKLY_MATCH_CAP
      const remaining = Math.max(0, cap - earned);
      res.json({ earned, cap, remaining, perWin: 5 });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/coins/me", async (req, res) => {
    const userId = requireAuth(req, res); if (!userId) return;
    try {
      const balance = await storage.getCoinBalance(userId);
      res.json(balance);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/coins/purchase", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (reqUser.isAdmin) return res.status(403).json({ error: "Les administrateurs ne peuvent pas acheter des pièces." });
    try {
      const { packName, coinsAmount, priceFcfa, proofUrl } = req.body;
      if (!packName || !coinsAmount || !priceFcfa || !proofUrl) {
        return res.status(400).json({ error: "Données manquantes." });
      }
      const purchase = await storage.createCoinPurchase(reqUser.id, packName, coinsAmount, priceFcfa, proofUrl);
      await notify(
        reqUser.id,
        `⏳ Votre demande d'achat de ${coinsAmount} pièces est en attente de validation par l'administrateur.`,
        undefined, undefined
      );
      res.json(purchase);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/coins/buy-star", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé." });
    try {
      const result = await storage.spendCoinsForStar(reqUser.id);
      await notify(
        reqUser.id,
        `⭐ Félicitations ! Vous avez acheté 1 étoile bonus avec vos pièces. Votre niveau a été mis à jour !`,
        undefined, undefined
      );
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Admin: list pending coin purchases
  app.get("/api/admin/coin-purchases", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const purchases = await storage.getPendingCoinPurchases();
      res.json(purchases);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/coin-purchases/:id/confirm", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      await storage.confirmCoinPurchase(req.params.id);
      const purchases = await storage.getPendingCoinPurchases();
      const p = (await pool.query("SELECT * FROM coin_purchases WHERE id=$1", [req.params.id])).rows[0];
      if (p) {
        await notify(
          p.user_id,
          `✅ Votre achat de ${p.coins_amount} pièces a été validé ! Elles ont été créditées sur votre compte.`,
          undefined, undefined
        );
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/coin-purchases/:id/reject", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const p = (await pool.query("SELECT * FROM coin_purchases WHERE id=$1", [req.params.id])).rows[0];
      await storage.rejectCoinPurchase(req.params.id);

      if (p) {
        // Count total rejections for this user
        const countRes = await pool.query(
          "SELECT COUNT(*) as cnt FROM coin_purchases WHERE user_id=$1 AND status='rejected'",
          [p.user_id]
        );
        const rejectCount = parseInt(countRes.rows[0].cnt);

        if (rejectCount >= 3) {
          // Auto-block the account
          await pool.query(
            "UPDATE users SET is_blocked=true, block_reason=$1 WHERE id=$2",
            ["3 demandes de paiement rejetées pour fraude présumée.", p.user_id]
          );
          await notify(
            p.user_id,
            `🚫 Votre compte a été bloqué définitivement suite à 3 rejets de paiement. Aucune réclamation ne sera acceptée.`,
            undefined, undefined
          );
        } else {
          await notify(
            p.user_id,
            `❌ Votre demande d'achat de ${p.coins_amount} pièces a été rejetée (${rejectCount}/3). Attention : 3 rejets entraînent le blocage définitif du compte.`,
            undefined, undefined
          );
        }
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: unblock a user account
  app.patch("/api/admin/users/:id/unblock", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      await pool.query("UPDATE users SET is_blocked=false, block_reason=NULL WHERE id=$1", [req.params.id]);
      // Reset rejection count by deleting rejected purchases
      await pool.query("DELETE FROM coin_purchases WHERE user_id=$1 AND status='rejected'", [req.params.id]);
      await notify(
        req.params.id,
        `✅ Votre compte a été débloqué par l'administrateur. Vous pouvez à nouveau accéder à Eliga.`,
        undefined, undefined
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: finance summary
  app.get("/api/admin/finances", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const summary = await storage.getFinanceSummary();
      res.json(summary);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: déclencher manuellement la distribution des prix d'un tournoi
  app.post("/api/admin/finances/:tournamentId/distribute", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const { tournamentId } = req.params;
      const tournament = await storage.getTournamentById(tournamentId) as any;
      if (!tournament) return res.status(404).json({ error: "Tournoi introuvable" });
      if (!tournament.isPaid) return res.status(400).json({ error: "Ce tournoi n'est pas à cotisation" });
      const prizes = await storage.distributePrizes(tournamentId, true);
      if (!prizes) return res.status(400).json({ error: "Impossible de distribuer : vérifiez que le tournoi a au moins 2 participants et une cotisation définie" });
      // Notifier les gagnants
      const tournamentName = tournament.name;
      if (prizes.winner?.id) {
        await notify(prizes.winner.id, `🏆 Vous êtes champion de "${tournamentName}" ! Votre gain : ${prizes.winner.amount.toLocaleString()} FCFA. L'organisateur va vous contacter.`, tournamentId);
      }
      if (prizes.runnerUp?.id) {
        await notify(prizes.runnerUp.id, `🥈 Finaliste de "${tournamentName}" ! Votre gain : ${prizes.runnerUp.amount.toLocaleString()} FCFA. L'organisateur va vous contacter.`, tournamentId);
      }
      res.json({ success: true, prizes });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Tournament prize distribution (public — visible to participants)
  app.get("/api/tournaments/:id/prize-distribution", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const t = await storage.getTournamentById(req.params.id) as any;
      if (!t) return res.status(404).json({ error: "Tournoi introuvable" });
      const participants = await storage.getTournamentParticipants(req.params.id);
      const entryFee = t.entryFee ?? 0;
      const playerLimit = t.playerLimit ?? null;
      const totalPool = entryFee * participants.length;
      const platformShare = Math.floor(totalPool * 0.20);
      const runnerUpShare = Math.floor(totalPool * 0.30);
      const winnerShare = totalPool - platformShare - runnerUpShare;
      // Projected at full capacity
      const projectedPool = playerLimit ? entryFee * playerLimit : null;
      const projectedWinner = projectedPool ? projectedPool - Math.floor(projectedPool * 0.20) - Math.floor(projectedPool * 0.30) : null;
      const distributions = await storage.getTournamentPrizeDistribution(req.params.id);
      res.json({
        totalPool, platformShare, runnerUpShare, winnerShare,
        participantCount: participants.length,
        entryFee,
        playerLimit,
        projectedPool,
        projectedWinner,
        distributions,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: block a user manually
  app.patch("/api/admin/users/:id/block", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const { reason } = req.body;
      await pool.query(
        "UPDATE users SET is_blocked=true, block_reason=$1 WHERE id=$2",
        [reason ?? "Décision administrative.", req.params.id]
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Public: get current coin packs with any active promos
  app.get("/api/coin-packs", async (req, res) => {
    try {
      const res2 = await pool.query(`SELECT key, value FROM app_settings WHERE key LIKE 'coin_pack_%'`);
      const settings: Record<string, string> = {};
      for (const r of res2.rows) settings[r.key] = r.value;

      const packs = [
        { name: "Starter",  coins: 100, priceFcfa: parseInt(settings["coin_pack_starter_price"]  ?? "150"),  promoFcfa: settings["coin_pack_starter_promo"]  ? parseInt(settings["coin_pack_starter_promo"])  : null, popular: false },
        { name: "Champion", coins: 300, priceFcfa: parseInt(settings["coin_pack_champion_price"] ?? "600"), promoFcfa: settings["coin_pack_champion_promo"] ? parseInt(settings["coin_pack_champion_promo"]) : null, popular: true },
        { name: "Élite",    coins: 600, priceFcfa: parseInt(settings["coin_pack_elite_price"]    ?? "900"),   promoFcfa: settings["coin_pack_elite_promo"]    ? parseInt(settings["coin_pack_elite_promo"])    : null, popular: false },
      ];
      res.json(packs);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: update coin pack promo prices
  app.post("/api/admin/coin-promos", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const { starter, champion, elite } = req.body;
      const updates: [string, string][] = [
        ["coin_pack_starter_promo",  (starter  != null && starter !== "")  ? String(starter)  : ""],
        ["coin_pack_champion_promo", (champion != null && champion !== "") ? String(champion) : ""],
        ["coin_pack_elite_promo",    (elite    != null && elite !== "")    ? String(elite)    : ""],
      ];
      for (const [key, value] of updates) {
        await pool.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [key, value]
        );
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: update base coin pack prices
  app.post("/api/admin/coin-prices", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Non autorisé" });
    try {
      const { starter, champion, elite } = req.body;
      const updates: [string, string][] = [
        ["coin_pack_starter_price",  starter  != null ? String(starter)  : "150"],
        ["coin_pack_champion_price", champion != null ? String(champion) : "600"],
        ["coin_pack_elite_price",    elite    != null ? String(elite)    : "900"],
      ];
      for (const [key, value] of updates) {
        await pool.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [key, value]
        );
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── CREATE challenges table ─────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS challenges (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      challenger_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opponent_id text REFERENCES users(id) ON DELETE SET NULL,
      proposed_date text NOT NULL,
      proposed_time text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      message text,
      coin_bet integer NOT NULL DEFAULT 0,
      team_photo_url text,
      counter_date text,
      counter_time text,
      is_private boolean NOT NULL DEFAULT false,
      created_at timestamp DEFAULT now()
    )
  `);
  // Migrations challenges
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS prop_score_c integer`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS prop_score_o integer`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS score_proposed_by text`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS winner_id text`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS coins_escrowed integer NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_disputed boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS score_proof_url text`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS win_coins_awarded boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS win_coins_awarded_at timestamp`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS score_submitted_at timestamp`);
  // Colonne pour traquer les récompenses coins sur les matchs de tournoi
  await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS coins_awarded boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proposed_at timestamp`);
  await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_friendly boolean NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE users ALTER COLUMN coins TYPE numeric(10,1) USING coins::numeric(10,1)`);

  // ─── CHALLENGES ROUTES ────────────────────────────────────────────

  // Créer un défi
  app.post("/api/challenges", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const { opponentId, proposedDate, proposedTime, message, coinBet, teamPhotoUrl, isPrivate, isFriendly } = req.body;
      if (!proposedDate || !proposedTime) return res.status(400).json({ error: "Date et heure requises" });
      if (opponentId && opponentId === reqUser.id) return res.status(400).json({ error: "Vous ne pouvez pas vous défier vous-même" });
      const betAmount = isFriendly ? 0 : (parseInt(coinBet) || 0);
      if (betAmount < 0) return res.status(400).json({ error: "La mise ne peut pas être négative" });
      if (betAmount > 50) return res.status(400).json({ error: "La mise maximale est de 50 pièces" });
      // Vérifier que le créateur a assez de pièces pour couvrir sa mise
      if (betAmount > 0) {
        const balance = await storage.getCoinBalance(reqUser.id);
        if (balance.coins < betAmount) {
          return res.status(400).json({ error: `Solde insuffisant : vous avez ${balance.coins} pièce${balance.coins > 1 ? "s" : ""} mais la mise est de ${betAmount}` });
        }
      }
      const challenge = await storage.createChallenge({
        challengerId: reqUser.id, opponentId: opponentId || null,
        proposedDate, proposedTime, message: message || null,
        coinBet: betAmount, teamPhotoUrl: teamPhotoUrl || null,
        isPrivate: !!isPrivate, isFriendly: !!isFriendly,
      });
      // Notifier l'adversaire si ciblé
      if (opponentId) {
        const opponent = await storage.getUserById(opponentId);
        if (opponent) {
          const visibilite = isPrivate ? "🔒 Défi privé" : "🌍 Défi public";
          const typeLabel = isFriendly ? " · Amical (+1.5 🪙 au gagnant)" : (coinBet > 0 ? ` · Mise : ${coinBet} coins` : "");
          await notify(opponentId, `⚔️ ${reqUser.pseudo} vous défie ! ${visibilite} · Match le ${proposedDate} à ${proposedTime}${typeLabel}. Répondez sur la page Défis.`);
        }
      }
      res.json(challenge);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Mes défis (envoyés + reçus)
  app.get("/api/challenges/me", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      // Auto-confirmation : confirmer les scores soumis depuis plus de 24h sans réponse
      const AUTO_CONFIRM_HOURS = 24;
      const pending = await pool.query(`
        SELECT * FROM challenges
        WHERE status='accepted'
          AND score_proposed_by IS NOT NULL
          AND is_disputed=false
          AND score_submitted_at IS NOT NULL
          AND score_submitted_at < NOW() - INTERVAL '${AUTO_CONFIRM_HOURS} hours'
          AND (challenger_id=$1 OR opponent_id=$1)`, [reqUser.id]);
      for (const ch of pending.rows) {
        const winnerId = parseInt(ch.prop_score_c) > parseInt(ch.prop_score_o)
          ? ch.challenger_id : ch.opponent_id;
        const pot = parseInt(ch.coins_escrowed ?? 0);
        const isFriendlyCh = ch.is_friendly === true || ch.is_friendly === "true";
        if (pot > 0) {
          await storage.distributeChallengeReward(ch.id, winnerId);
        } else {
          await storage.updateChallenge(ch.id, { status: "completed", winnerId });
        }
        const winCoins = isFriendlyCh
          ? await storage.awardFriendlyWinCoins(ch.id, winnerId)
          : await storage.awardChallengeWinCoins(ch.id, winnerId);
        const winner = await storage.getUserById(winnerId);
        const betWinAmount = pot > 0 ? Math.floor(pot * 0.85) : 0;
        const loserId = winnerId === ch.challenger_id ? ch.opponent_id : ch.challenger_id;
        const winParts = [`🏆 Score auto-confirmé (24h écoulées) — vous avez gagné !`];
        if (winCoins > 0) winParts.push(`+${winCoins} pièces${isFriendlyCh ? " (amical)" : " (victoire)"}`);
        if (betWinAmount > 0) winParts.push(`+${betWinAmount} pièces (mise)`);
        await notify(winnerId, winParts.join(" · "));
        if (loserId) await notify(loserId, `⏱️ Score auto-confirmé — 24h sans réponse. Victoire de ${winner?.pseudo}.${pot > 0 ? ` Vous avez perdu ${ch.coin_bet} pièces.` : ""}`);
      }

      const rows = await storage.getChallengesByUser(reqUser.id);
      res.json(rows.map((r: any) => ({
        id: r.id, challengerId: r.challenger_id, opponentId: r.opponent_id,
        proposedDate: r.proposed_date, proposedTime: r.proposed_time,
        status: r.status, message: r.message, coinBet: r.coin_bet,
        teamPhotoUrl: r.team_photo_url, counterDate: r.counter_date, counterTime: r.counter_time,
        createdAt: r.created_at, isPrivate: r.is_private ?? false,
        propScoreC: r.prop_score_c, propScoreO: r.prop_score_o,
        scoreProposedBy: r.score_proposed_by, winnerId: r.winner_id,
        scoreSubmittedAt: r.score_submitted_at ?? null,
        coinsEscrowed: r.coins_escrowed ?? 0, isDisputed: r.is_disputed ?? false,
        scoreProofUrl: r.score_proof_url ?? null,
        isFriendly: r.is_friendly ?? false,
        challengerPseudo: r.challenger_pseudo, challengerPhone: r.challenger_phone,
        challengerAvatar: r.challenger_avatar,
        challengerBonusStars: parseInt(r.challenger_bonus_stars ?? 0),
        challengerPlayed: parseInt(r.challenger_played ?? 0),
        challengerWins: parseInt(r.challenger_wins ?? 0),
        challengerLosses: parseInt(r.challenger_losses ?? 0),
        opponentPseudo: r.opponent_pseudo,
        opponentAvatar: r.opponent_avatar, opponentPhone: r.opponent_phone,
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Défis publics (visibles par tous dans la recherche)
  app.get("/api/challenges/open", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const rows = await storage.getOpenChallenges();
      res.json(rows.map((r: any) => ({
        id: r.id, challengerId: r.challenger_id, opponentId: r.opponent_id,
        proposedDate: r.proposed_date, proposedTime: r.proposed_time,
        status: r.status, message: r.message, coinBet: r.coin_bet,
        teamPhotoUrl: r.team_photo_url, createdAt: r.created_at,
        isPrivate: r.is_private ?? false,
        isFriendly: r.is_friendly ?? false,
        challengerPseudo: r.challenger_pseudo, challengerAvatar: r.challenger_avatar,
        challengerBonusStars: parseInt(r.challenger_bonus_stars ?? 0),
        challengerPlayed: parseInt(r.challenger_played ?? 0),
        challengerWins: parseInt(r.challenger_wins ?? 0),
        challengerLosses: parseInt(r.challenger_losses ?? 0),
        opponentPseudo: r.opponent_pseudo, opponentAvatar: r.opponent_avatar,
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Accepter un défi
  app.post("/api/challenges/:id/accept", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.challenger_id === reqUser.id) return res.status(400).json({ error: "Vous ne pouvez pas accepter votre propre défi" });
      if (challenge.status !== "pending" && challenge.status !== "rescheduled") return res.status(400).json({ error: "Ce défi ne peut plus être accepté" });
      if (challenge.opponent_id && challenge.opponent_id !== reqUser.id) {
        return res.status(403).json({ error: "Ce défi est réservé à un joueur spécifique" });
      }
      const opponentId = challenge.opponent_id ?? reqUser.id;
      // Anti-farming : max 25 défis avec mise par semaine
      if (parseInt(challenge.coin_bet) > 0) {
        const weeklyCount = await storage.countChallengeMatchesThisWeek(reqUser.id);
        if (weeklyCount >= 25) {
          return res.status(400).json({ error: "Limite hebdomadaire atteinte : maximum 25 défis avec mise par semaine" });
        }
        // Escrow des pièces des deux joueurs
        await storage.escrowChallengeCoins(req.params.id, challenge.challenger_id, opponentId, parseInt(challenge.coin_bet));
      }
      await storage.updateChallenge(req.params.id, { status: "accepted", opponentId });
      await notify(challenge.challenger_id, `✅ ${reqUser.pseudo} a accepté votre défi ! Match le ${challenge.proposed_date} à ${challenge.proposed_time}.${parseInt(challenge.coin_bet) > 0 ? ` ${challenge.coin_bet * 2} pièces en jeu !` : ""}`);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Supprimer un défi (uniquement les défis passés/annulés)
  app.delete("/api/challenges/:id", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      const isParticipant = challenge.challenger_id === reqUser.id || challenge.opponent_id === reqUser.id;
      if (!isParticipant) return res.status(403).json({ error: "Non autorisé" });
      const deletableStatuses = ["completed", "refused", "pending", "cancelled"];
      if (!deletableStatuses.includes(challenge.status)) {
        return res.status(400).json({ error: "Impossible de supprimer un défi en cours ou avec des pièces en jeu" });
      }
      if (parseInt(challenge.coins_escrowed ?? 0) > 0) {
        return res.status(400).json({ error: "Impossible de supprimer un défi avec des pièces en escrow" });
      }
      await pool.query("DELETE FROM challenges WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Refuser un défi
  app.post("/api/challenges/:id/refuse", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.challenger_id === reqUser.id) return res.status(400).json({ error: "Action non autorisée" });
      if (challenge.status !== "pending" && challenge.status !== "rescheduled") return res.status(400).json({ error: "Ce défi ne peut plus être refusé" });
      // Si ciblé, seul l'adversaire désigné peut refuser
      if (challenge.opponent_id && challenge.opponent_id !== reqUser.id) {
        return res.status(403).json({ error: "Ce défi est réservé à un joueur spécifique" });
      }
      await storage.updateChallenge(req.params.id, { status: "refused" });
      await notify(challenge.challenger_id, `❌ ${reqUser.pseudo} a refusé votre défi.`);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Proposer une autre heure
  app.post("/api/challenges/:id/counter", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.challenger_id === reqUser.id) return res.status(400).json({ error: "Action non autorisée" });
      if (challenge.status !== "pending") return res.status(400).json({ error: "Ce défi ne peut pas être reprogrammé" });
      // Si ciblé, seul l'adversaire désigné peut contre-proposer
      if (challenge.opponent_id && challenge.opponent_id !== reqUser.id) {
        return res.status(403).json({ error: "Ce défi est réservé à un joueur spécifique" });
      }
      const { counterDate, counterTime } = req.body;
      if (!counterDate || !counterTime) return res.status(400).json({ error: "Date et heure requises" });
      await storage.updateChallenge(req.params.id, {
        status: "rescheduled", counterDate, counterTime, opponentId: challenge.opponent_id ?? reqUser.id,
      });
      await notify(challenge.challenger_id, `🔄 ${reqUser.pseudo} propose de reprogrammer votre défi au ${counterDate} à ${counterTime}. Acceptez ou refusez sur la page Défis.`);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Marquer comme terminé (sans mise — défi libre)
  app.post("/api/challenges/:id/complete", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.challenger_id !== reqUser.id && challenge.opponent_id !== reqUser.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      if (parseInt(challenge.coin_bet) > 0) {
        return res.status(400).json({ error: "Ce défi a une mise — vous devez soumettre un score" });
      }
      await storage.updateChallenge(req.params.id, { status: "completed" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Soumettre le score d'un défi
  app.post("/api/challenges/:id/score", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.status !== "accepted") return res.status(400).json({ error: "Le défi n'est pas en cours" });
      if (challenge.challenger_id !== reqUser.id && challenge.opponent_id !== reqUser.id) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      if (challenge.score_proposed_by) {
        return res.status(400).json({ error: "Un score a déjà été soumis — confirmez ou contestez le score de l'adversaire" });
      }
      const { scoreMe, scoreOpponent, proofUrl } = req.body;
      const sMe = parseInt(scoreMe);
      const sOpp = parseInt(scoreOpponent);
      if (isNaN(sMe) || isNaN(sOpp) || sMe < 0 || sOpp < 0) {
        return res.status(400).json({ error: "Scores invalides" });
      }
      // Normaliser : toujours stocker du point de vue du challenger
      const isChallenger = challenge.challenger_id === reqUser.id;
      const propC = isChallenger ? sMe : sOpp;
      const propO = isChallenger ? sOpp : sMe;
      await storage.updateChallenge(req.params.id, {
        propScoreC: propC, propScoreO: propO, scoreProposedBy: reqUser.id,
        scoreProofUrl: proofUrl || null, scoreSubmittedAt: new Date(),
      });
      const otherPlayerId = isChallenger ? challenge.opponent_id : challenge.challenger_id;
      const isChallWinner = propC > propO;
      const winnerDesc = isChallWinner ? challenge.challenger_pseudo : challenge.opponent_pseudo;
      await notify(otherPlayerId, `⚽ ${reqUser.pseudo} a soumis le score : ${propC}-${propO} (victoire ${winnerDesc}). Confirmez ou contestez sur Mes matchs.`);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Confirmer le score soumis par l'adversaire
  app.post("/api/challenges/:id/confirm-score", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.status !== "accepted") return res.status(400).json({ error: "Le défi n'est pas en cours" });
      if (!challenge.score_proposed_by) return res.status(400).json({ error: "Aucun score soumis pour l'instant" });
      if (challenge.score_proposed_by === reqUser.id) return res.status(400).json({ error: "Vous ne pouvez pas confirmer votre propre score" });
      // Déterminer le gagnant (prop_score_c = score du challenger)
      const winnerId = parseInt(challenge.prop_score_c) > parseInt(challenge.prop_score_o)
        ? challenge.challenger_id : challenge.opponent_id;
      const pot = parseInt(challenge.coins_escrowed ?? 0);
      const isFriendlyChallenge = challenge.is_friendly === true || challenge.is_friendly === "true";
      // Distribuer les récompenses si mise en jeu
      if (pot > 0) {
        await storage.distributeChallengeReward(req.params.id, winnerId);
      } else {
        await storage.updateChallenge(req.params.id, { status: "completed", winnerId });
      }
      // Récompense victoire
      let winCoins: number;
      if (isFriendlyChallenge) {
        winCoins = await storage.awardFriendlyWinCoins(req.params.id, winnerId);
      } else {
        winCoins = await storage.awardChallengeWinCoins(req.params.id, winnerId);
      }

      const winner = await storage.getUserById(winnerId);
      const betWinAmount = pot > 0 ? Math.floor(pot * 0.85) : 0;

      // Notification au gagnant
      const winnerMsgParts = [`🏆 Vous avez gagné le défi !`];
      if (winCoins > 0) winnerMsgParts.push(`+${winCoins} pièces${isFriendlyChallenge ? " (amical)" : " (victoire)"}`);
      if (betWinAmount > 0) winnerMsgParts.push(`+${betWinAmount} pièces (mise)`);
      if (winCoins === 0 && betWinAmount === 0) winnerMsgParts.push(`Plafond hebdomadaire atteint, aucune pièce gagnée cette fois.`);
      await notify(winnerId, winnerMsgParts.join(" · "));

      // Notification au perdant
      const loserId = winnerId === challenge.challenger_id ? challenge.opponent_id : challenge.challenger_id;
      if (loserId) {
        const loserMsgParts = [`❌ Défi terminé — victoire de ${winner?.pseudo}`];
        if (pot > 0) loserMsgParts.push(`Vous avez perdu ${challenge.coin_bet} pièces`);
        await notify(loserId, loserMsgParts.join(". "));
      }
      res.json({ success: true, winnerId, winCoins, betWinAmount });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Contester le score soumis
  app.post("/api/challenges/:id/dispute-score", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.status !== "accepted") return res.status(400).json({ error: "Le défi n'est pas en cours" });
      if (!challenge.score_proposed_by) return res.status(400).json({ error: "Aucun score soumis" });
      if (challenge.score_proposed_by === reqUser.id) return res.status(400).json({ error: "Vous ne pouvez pas contester votre propre score" });
      await storage.updateChallenge(req.params.id, { status: "dispute", isDisputed: true });
      await notify(challenge.score_proposed_by, `⚠️ ${reqUser.pseudo} a contesté le score que vous avez soumis. Un admin va trancher.`);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin : lister les défis en litige
  app.get("/api/admin/challenges/disputes", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Accès admin requis" });
    try {
      const r = await pool.query(`
        SELECT c.*,
          u1.pseudo AS challenger_pseudo, u1.avatar_url AS challenger_avatar,
          u2.pseudo AS opponent_pseudo, u2.avatar_url AS opponent_avatar
        FROM challenges c
        LEFT JOIN users u1 ON u1.id=c.challenger_id
        LEFT JOIN users u2 ON u2.id=c.opponent_id
        WHERE c.status='dispute'
        ORDER BY c.created_at DESC`);
      res.json(r.rows.map(row => ({
        id: row.id, challengerId: row.challenger_id, opponentId: row.opponent_id,
        challengerPseudo: row.challenger_pseudo, opponentPseudo: row.opponent_pseudo,
        propScoreC: row.prop_score_c, propScoreO: row.prop_score_o,
        coinsEscrowed: row.coins_escrowed ?? 0, coinBet: row.coin_bet,
        proposedDate: row.proposed_date, proposedTime: row.proposed_time,
        message: row.message, createdAt: row.created_at,
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin : résoudre un litige de défi
  app.post("/api/admin/challenges/:id/resolve", async (req, res) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Accès admin requis" });
    try {
      const challenge = await storage.getChallengeById(req.params.id);
      if (!challenge) return res.status(404).json({ error: "Défi introuvable" });
      if (challenge.status !== "dispute") return res.status(400).json({ error: "Ce défi n'est pas en litige" });
      const { winnerId } = req.body;
      if (!winnerId || (winnerId !== challenge.challenger_id && winnerId !== challenge.opponent_id)) {
        return res.status(400).json({ error: "winnerId invalide" });
      }
      const pot = parseInt(challenge.coins_escrowed ?? 0);
      if (pot > 0) {
        await storage.distributeChallengeReward(req.params.id, winnerId);
      } else {
        await storage.updateChallenge(req.params.id, { status: "completed", winnerId });
      }
      // Récompense victoire +5 pièces
      const winCoins = await storage.awardChallengeWinCoins(req.params.id, winnerId);
      const winner = await storage.getUserById(winnerId);
      const betWinAmount = pot > 0 ? Math.floor(pot * 0.85) : 0;
      const loserId = winnerId === challenge.challenger_id ? challenge.opponent_id : challenge.challenger_id;

      // Notification gagnant
      const winParts = [`⚖️ Litige tranché — vous avez gagné !`];
      if (winCoins > 0) winParts.push(`+${winCoins} pièces (victoire)`);
      if (betWinAmount > 0) winParts.push(`+${betWinAmount} pièces (mise)`);
      await notify(winnerId, winParts.join(" · "));

      // Notification perdant
      const loseParts = [`⚖️ Litige tranché par l'admin — victoire de ${winner?.pseudo}`];
      if (pot > 0) loseParts.push(`Vous avez perdu ${challenge.coin_bet} pièces`);
      if (loserId) await notify(loserId, loseParts.join(". "));

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── CLIPS ────────────────────────────────────────────────────────────
  app.get("/api/clips/video/:filename", (req: Request, res: Response) => {
    const filename = path.basename(String(req.params.filename));
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Vidéo introuvable" });
    res.sendFile(filePath);
  });

  app.get("/api/settings/clips-enabled", async (_req: Request, res: Response) => {
    const r = await pool.query("SELECT value FROM app_settings WHERE key='clips_publishing_enabled'");
    const enabled = r.rows.length === 0 || r.rows[0].value !== "false";
    res.json({ enabled });
  });

  app.patch("/api/admin/settings/clips-enabled", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    const admin = await storage.getUserById(String(req.session.userId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Accès refusé" });
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ error: "Paramètre invalide" });
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('clips_publishing_enabled', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [enabled ? "true" : "false"]
    );
    res.json({ enabled });
  });

  app.post("/api/clips/upload", (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    const userId = String(req.session.userId);
    videoUpload.single("video")(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "Aucune vidéo reçue" });
      const publisher = await storage.getUserById(userId);
      if (!publisher?.isAdmin) {
        const globalSetting = await pool.query("SELECT value FROM app_settings WHERE key='clips_publishing_enabled'");
        const globallyEnabled = globalSetting.rows.length === 0 || globalSetting.rows[0].value !== "false";
        if (!globallyEnabled) {
          fs.unlink(req.file.path, () => {});
          return res.status(403).json({ error: "La publication de clips est désactivée pour tous les utilisateurs" });
        }
        if (!publisher?.canPostClips) {
          fs.unlink(req.file.path, () => {});
          return res.status(403).json({ error: "Publication de clips désactivée pour votre compte" });
        }
      }
      const title = String(req.body.title ?? "");
      const description = req.body.description ? String(req.body.description) : undefined;
      const tag = String(req.body.tag ?? "technique");
      const isFeatured = publisher?.isAdmin && req.body.isFeatured === "true";
      if (!title || !tag) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "Titre et catégorie requis" });
      }
      try {
        const videoUrl = `/api/clips/video/${req.file.filename}`;
        const clip = await storage.createClip(userId, { title, description, videoUrl, tag });
        if (isFeatured) {
          await pool.query("UPDATE clips SET is_featured=true WHERE id=$1", [clip.id]);
        }
        res.json({ ...clip, is_featured: isFeatured });
      } catch (e: any) {
        fs.unlink(req.file!.path, () => {});
        res.status(500).json({ error: e.message });
      }
    });
  });

  // ─── ADMIN CLIPS ────────────────────────────────────────────────────────
  app.get("/api/admin/clips", async (req: Request, res: Response) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Accès admin requis" });
    try {
      const clips = await storage.getAdminAllClips();
      res.json(clips);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/clips/:id/feature", async (req: Request, res: Response) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Accès admin requis" });
    try {
      const isFeatured = await storage.toggleClipFeatured(String(req.params.id));
      res.json({ isFeatured });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/users/:id/clips-permission", async (req: Request, res: Response) => {
    const reqUser = await requireAuthUser(req, res); if (!reqUser) return;
    if (!reqUser.isAdmin) return res.status(403).json({ error: "Accès admin requis" });
    try {
      const canPost = await storage.toggleUserClipsPermission(String(req.params.id));
      res.json({ canPostClips: canPost });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/clips", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const clips = await storage.getClipsFeed(String(req.session.userId), offset, 10);
      res.json(clips);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/clips/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    const userId = String(req.session.userId);
    const clipId = String(req.params.id);
    try {
      const requester = await storage.getUserById(userId);
      const clipRow = await pool.query("SELECT user_id, video_url FROM clips WHERE id=$1", [clipId]);
      if (clipRow.rows.length === 0) return res.status(404).json({ error: "Clip introuvable" });
      const clip = clipRow.rows[0];
      if (!requester?.isAdmin && clip.user_id !== userId) {
        return res.status(403).json({ error: "Non autorisé" });
      }
      if (clip.video_url) {
        const filename = path.basename(String(clip.video_url));
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      }
      if (requester?.isAdmin) {
        await storage.deleteClipAdmin(clipId);
      } else {
        await storage.deleteClip(clipId, userId);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/clips/:id/like", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const result = await storage.toggleClipLike(String(req.params.id), String(req.session.userId));
      if (result.liked) {
        const clipRes = await pool.query("SELECT user_id FROM clips WHERE id=$1", [String(req.params.id)]);
        if (clipRes.rows[0]?.user_id) {
          const newMilestones = await storage.checkAndAwardClipMilestones(clipRes.rows[0].user_id);
          return res.json({ ...result, newMilestones });
        }
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/clips/:id/view", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      await storage.incrementClipViews(String(req.params.id));
      const clipRes = await pool.query("SELECT user_id FROM clips WHERE id=$1", [String(req.params.id)]);
      if (clipRes.rows[0]?.user_id) {
        storage.checkAndAwardClipMilestones(clipRes.rows[0].user_id).catch(() => {});
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/clips/user/:userId", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const clips = await storage.getUserClips(String(req.params.userId), String(req.session.userId));
      res.json(clips);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/clips/follow/:userId", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    const followerId = String(req.session.userId);
    const followingId = String(req.params.userId);
    if (followerId === followingId) return res.status(400).json({ error: "Vous ne pouvez pas vous abonner à vous-même" });
    try {
      const result = await storage.toggleClipFollow(followerId, followingId);
      if (result.following) {
        const newMilestones = await storage.checkAndAwardClipMilestones(followingId);
        return res.json({ ...result, newMilestones });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/clips/stats/me", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const [stats, milestones] = await Promise.all([
        storage.getClipStats(String(req.session.userId)),
        storage.getClipMilestonesAwarded(String(req.session.userId)),
      ]);
      res.json({ stats, milestones });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/clips/:id/comments", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const comments = await storage.getClipComments(String(req.params.id));
      res.json(comments);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/clips/:id/comments", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    const text = String(req.body.text ?? "").trim();
    if (!text || text.length > 300) return res.status(400).json({ error: "Commentaire invalide (1–300 caractères)" });
    try {
      const comment = await storage.addClipComment(String(req.params.id), String(req.session.userId), text);
      res.json(comment);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/clips/comments/:id", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const user = await storage.getUserById(String(req.session.userId));
      let deleted: boolean;
      if (user?.isAdmin) {
        deleted = await storage.deleteClipCommentAdmin(String(req.params.id));
      } else {
        deleted = await storage.deleteClipComment(String(req.params.id), String(req.session.userId));
      }
      if (!deleted) return res.status(403).json({ error: "Commentaire introuvable ou non autorisé" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/clips/is-following/:userId", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Non authentifié" });
    try {
      const r = await pool.query(
        "SELECT id FROM clip_follows WHERE follower_id=$1 AND following_id=$2",
        [String(req.session.userId), String(req.params.userId)]
      );
      res.json({ following: r.rows.length > 0 });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}

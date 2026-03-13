import { randomUUID } from "crypto";
import {
  User, InsertUser, Friend, FriendGroup, FriendGroupMember,
  Tournament, TournamentParticipant, TournamentMatch, TournamentChat, Message, Notification
} from "@shared/schema";
import { pgPool as pool } from "./db";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@eliga.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export type Reaction = { emoji: string; count: number; userIds: string[] };
export type MessageWithReactions = Message & { sender: User; reactions: Reaction[] };

export interface PlayerStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  tournamentsPlayed: number;
  performanceStars: number;
  bonusStars: number;
  stars: number; // effective = min(performance + bonus, 5)
  coins: number;
  level: string;
  winRatePct: number;
  nextStarMatchesNeeded: number;
  nextStarWinRateNeeded: number;
}

export interface StandingEntry {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  poolNumber?: number | null;
}

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  searchUserByPhone(phone: string): Promise<User | undefined>;
  updateProfile(userId: string, pseudo: string, avatarUrl: string | null, bio: string | null): Promise<User>;

  // Friends
  addFriend(userId: string, friendId: string): Promise<Friend>;
  getFriends(userId: string): Promise<(Friend & { friend: User })[]>;
  getFriendRequests(userId: string): Promise<(Friend & { user: User })[]>;
  acceptFriend(friendId: string, userId: string): Promise<void>;

  removeFriend(friendId: string, userId: string): Promise<void>;

  // Friend Groups
  createFriendGroup(userId: string, name: string): Promise<FriendGroup>;
  getFriendGroups(userId: string): Promise<(FriendGroup & { members: User[] })[]>;
  addMemberToGroup(groupId: string, userId: string): Promise<void>;

  // Tournaments
  createTournament(data: Omit<Tournament, "id" | "createdAt">): Promise<Tournament>;
  getTournamentById(id: string): Promise<(Tournament & { creator: User; participantCount: number }) | undefined>;
  getTournamentByCode(code: string): Promise<Tournament | undefined>;
  getPublicTournaments(): Promise<(Tournament & { creator: User; participantCount: number })[]>;
  getUserTournaments(userId: string): Promise<(Tournament & { creator: User; participantCount: number })[]>;
  getUserParticipatedTournaments(userId: string): Promise<(Tournament & { creator: User; participantCount: number })[]>;
  updateTournamentStatus(id: string, status: string): Promise<void>;

  // Tournament CRUD
  deleteTournament(id: string): Promise<void>;
  updateTournament(id: string, data: { name: string; description?: string | null; startDate?: string | null; endDate?: string | null }): Promise<void>;

  // Participants
  joinTournament(tournamentId: string, userId: string, paymentProof?: string | null): Promise<TournamentParticipant>;
  getTournamentParticipants(tournamentId: string): Promise<(TournamentParticipant & { user: User })[]>;
  updateParticipantPaymentStatus(participantId: string, status: string): Promise<void>;
  getPendingPayments(): Promise<any[]>;
  isParticipant(tournamentId: string, userId: string): Promise<boolean>;
  removeParticipant(tournamentId: string, userId: string): Promise<void>;

  // Matches
  createMatch(data: Omit<TournamentMatch, "id">): Promise<TournamentMatch>;
  getTournamentMatches(tournamentId: string): Promise<(TournamentMatch & { player1: User; player2: User })[]>;
  updateMatchScore(matchId: string, score1: number, score2: number): Promise<void>;
  scheduleMatch(matchId: string, scheduledAt: string | null): Promise<void>;
  setMatchDate(matchId: string, matchDate: string | null): Promise<void>;
  proposeMatchTime(matchId: string, playerId: string, time: string | null): Promise<{ scheduled: boolean }>;
  rejectMatchTime(matchId: string, rejectingPlayerId: string): Promise<{ proposerPseudo: string }>;


  proposeScore(matchId: string, proposedBy: string, score1: number, score2: number, proofUrl?: string | null): Promise<void>;
  confirmScore(matchId: string): Promise<void>;
  rejectScore(matchId: string): Promise<void>;
  getUserMatches(userId: string): Promise<(TournamentMatch & { player1: User; player2: User; tournament: Tournament })[]>;
  getMatchById(matchId: string): Promise<TournamentMatch | undefined>;

  // Standings & Stats
  getTournamentStandings(tournamentId: string): Promise<StandingEntry[]>;
  getUserStats(userId: string): Promise<PlayerStats>;

  // Tournament Chat
  sendTournamentChat(tournamentId: string, userId: string, content: string): Promise<TournamentChat>;
  getTournamentChat(tournamentId: string): Promise<(TournamentChat & { user: User })[]>;

  // Messages
  sendMessage(senderId: string, receiverId: string, content: string): Promise<Message>;
  getConversation(userId1: string, userId2: string): Promise<MessageWithReactions[]>;
  getConversations(userId: string): Promise<{ user: User; lastMessage: Message; unread: number }[]>;
  markMessagesRead(senderId: string, receiverId: string): Promise<void>;
  toggleReaction(messageId: string, userId: string, emoji: string): Promise<{ added: boolean }>;
  getReactions(messageIds: string[]): Promise<Record<string, Reaction[]>>;
  getMessageById(messageId: string): Promise<Message | undefined>;
  deleteMessage(messageId: string): Promise<void>;

  // Notifications
  createNotification(userId: string, content: string, tournamentId?: string, matchId?: string): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(notifId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;

  // Rewards
  distributeRewards(tournamentId: string): Promise<{ userId: string; position: number; badge: string; rewardLabel: string; coinsAwarded?: number }[]>;
  getUserRewards(userId: string): Promise<any[]>;

  // Prize distributions (financial)
  distributePrizes(tournamentId: string, force?: boolean): Promise<{ winner: any; runnerUp: any; platformShare: number; totalPool: number } | null>;
  getTournamentPrizeDistribution(tournamentId: string): Promise<any[]>;
  getFinanceSummary(): Promise<{ totalRevenue: number; coinRevenue: number; cotisationRevenue: number; distributions: any[] }>;

  // Coins
  getCoinBalance(userId: string): Promise<{ coins: number; bonusStars: number }>;
  createCoinPurchase(userId: string, packName: string, coinsAmount: number, priceFcfa: number, proofUrl: string): Promise<any>;
  getPendingCoinPurchases(): Promise<any[]>;
  confirmCoinPurchase(purchaseId: string): Promise<void>;
  rejectCoinPurchase(purchaseId: string): Promise<void>;
  spendCoinsForStar(userId: string): Promise<{ newCoins: number; newBonusStars: number }>;
}

export class PgStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO users (id, username, pseudo, password, phone, country, region)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, user.username, user.pseudo, user.password, user.phone, user.country, user.region]
    );
    return this.mapUser(res.rows[0]);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const res = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    return res.rows[0] ? this.mapUser(res.rows[0]) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const res = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    return res.rows[0] ? this.mapUser(res.rows[0]) : undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const res = await pool.query("SELECT * FROM users WHERE phone=$1", [phone]);
    return res.rows[0] ? this.mapUser(res.rows[0]) : undefined;
  }

  async searchUserByPhone(phone: string): Promise<User | undefined> {
    const res = await pool.query("SELECT * FROM users WHERE phone=$1", [phone]);
    return res.rows[0] ? this.mapUser(res.rows[0]) : undefined;
  }

  async updateProfile(userId: string, pseudo: string, avatarUrl: string | null, bio: string | null): Promise<User> {
    const res = await pool.query(
      `UPDATE users SET pseudo=$1, avatar_url=$2, bio=$3 WHERE id=$4 RETURNING *`,
      [pseudo, avatarUrl, bio, userId]
    );
    return this.mapUser(res.rows[0]);
  }

  async addFriend(userId: string, friendId: string): Promise<Friend> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO friends (id, user_id, friend_id, status) VALUES ($1,$2,$3,'pending') RETURNING *`,
      [id, userId, friendId]
    );
    return this.mapFriend(res.rows[0]);
  }

  async getFriends(userId: string): Promise<(Friend & { friend: User })[]> {
    const res = await pool.query(
      `SELECT f.*, u.id as fu_id, u.username as fu_username, u.pseudo as fu_pseudo,
              u.phone as fu_phone, u.country as fu_country, u.region as fu_region,
              u.avatar_url as fu_avatar_url, u.bio as fu_bio, u.created_at as fu_created_at
       FROM friends f
       JOIN users u ON (CASE WHEN f.user_id=$1 THEN f.friend_id ELSE f.user_id END) = u.id
       WHERE (f.user_id=$1 OR f.friend_id=$1) AND f.status='accepted'`,
      [userId]
    );
    return res.rows.map(r => ({
      ...this.mapFriend(r),
      friend: { id: r.fu_id, username: r.fu_username, pseudo: r.fu_pseudo, password: "", phone: r.fu_phone, country: r.fu_country, region: r.fu_region, avatarUrl: r.fu_avatar_url, bio: r.fu_bio, isAdmin: false, canPostClips: true, createdAt: r.fu_created_at }
    }));
  }

  async getFriendRequests(userId: string): Promise<(Friend & { user: User })[]> {
    const res = await pool.query(
      `SELECT f.*, u.id as ru_id, u.username as ru_username, u.pseudo as ru_pseudo,
              u.phone as ru_phone, u.country as ru_country, u.region as ru_region,
              u.avatar_url as ru_avatar_url, u.bio as ru_bio, u.created_at as ru_created_at
       FROM friends f
       JOIN users u ON f.user_id = u.id
       WHERE f.friend_id=$1 AND f.status='pending'`,
      [userId]
    );
    return res.rows.map(r => ({
      ...this.mapFriend(r),
      user: { id: r.ru_id, username: r.ru_username, pseudo: r.ru_pseudo, password: "", phone: r.ru_phone, country: r.ru_country, region: r.ru_region, avatarUrl: r.ru_avatar_url, bio: r.ru_bio, isAdmin: false, canPostClips: true, createdAt: r.ru_created_at }
    }));
  }

  async acceptFriend(friendId: string, userId: string): Promise<void> {
    await pool.query(
      "UPDATE friends SET status='accepted' WHERE id=$1 AND friend_id=$2",
      [friendId, userId]
    );
  }

  async removeFriend(friendId: string, userId: string): Promise<void> {
    await pool.query(
      "DELETE FROM friends WHERE id=$1 AND (user_id=$2 OR friend_id=$2)",
      [friendId, userId]
    );
  }

  async createFriendGroup(userId: string, name: string): Promise<FriendGroup> {
    const id = randomUUID();
    const res = await pool.query(
      "INSERT INTO friend_groups (id, user_id, name) VALUES ($1,$2,$3) RETURNING *",
      [id, userId, name]
    );
    return this.mapFriendGroup(res.rows[0]);
  }

  async getFriendGroups(userId: string): Promise<(FriendGroup & { members: User[] })[]> {
    const groups = await pool.query("SELECT * FROM friend_groups WHERE user_id=$1", [userId]);
    const result = [];
    for (const g of groups.rows) {
      const members = await pool.query(
        `SELECT u.* FROM friend_group_members fgm
         JOIN users u ON fgm.user_id = u.id
         WHERE fgm.group_id=$1`,
        [g.id]
      );
      result.push({
        ...this.mapFriendGroup(g),
        members: members.rows.map(this.mapUser)
      });
    }
    return result;
  }

  async addMemberToGroup(groupId: string, userId: string): Promise<void> {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO friend_group_members (id, group_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [id, groupId, userId]
    );
  }

  async createTournament(data: Omit<Tournament, "id" | "createdAt">): Promise<Tournament> {
    const id = randomUUID();
    const d = data as any;
    const res = await pool.query(
      `INSERT INTO tournaments (id, creator_id, name, championship_type, players_per_pool, num_pools, player_limit, visibility, code, game_type, game_time, game_form, extra_time, penalties, other_rules, status, start_date, end_date, is_sponsored, sponsor_name, sponsor_logo, prize_info, is_elite, min_stars, elite_prize_amount, is_paid, entry_fee, entry_payment_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
      [id, data.creatorId, data.name, data.championshipType, data.playersPerPool, data.numPools, data.playerLimit, data.visibility, data.code, data.gameType, data.gameTime, data.gameForm, data.extraTime, data.penalties, data.otherRules, data.status || "waiting", d.startDate ?? null, d.endDate ?? null, d.isSponsored ?? false, d.sponsorName ?? null, d.sponsorLogo ?? null, d.prizeInfo ?? null, d.isElite ?? false, d.minStars ?? 0, d.elitePrizeAmount ?? null, d.isPaid ?? false, d.entryFee ?? 0, d.entryPaymentNumber ?? null]
    );
    return this.mapTournament(res.rows[0]);
  }

  async getTournamentById(id: string): Promise<(Tournament & { creator: User; participantCount: number }) | undefined> {
    const res = await pool.query(
      `SELECT t.*, u.username as creator_username, u.pseudo as creator_pseudo, u.is_admin as creator_is_admin, u.avatar_url as creator_avatar,
              (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=t.id) as participant_count
       FROM tournaments t JOIN users u ON t.creator_id=u.id
       WHERE t.id=$1`,
      [id]
    );
    if (!res.rows[0]) return undefined;
    const r = res.rows[0];
    return {
      ...this.mapTournament(r),
      creator: { id: r.creator_id, username: r.creator_username, pseudo: r.creator_pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.creator_avatar ?? null, bio: null, isAdmin: !!r.creator_is_admin, canPostClips: true, createdAt: null },
      participantCount: parseInt(r.participant_count)
    };
  }

  async getTournamentByCode(code: string): Promise<Tournament | undefined> {
    const res = await pool.query("SELECT * FROM tournaments WHERE code=$1", [code]);
    return res.rows[0] ? this.mapTournament(res.rows[0]) : undefined;
  }

  async getPublicTournaments(): Promise<(Tournament & { creator: User; participantCount: number })[]> {
    const res = await pool.query(
      `SELECT t.*, u.username as creator_username, u.pseudo as creator_pseudo, u.is_admin as creator_is_admin, u.avatar_url as creator_avatar,
              (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=t.id) as participant_count
       FROM tournaments t JOIN users u ON t.creator_id=u.id
       WHERE t.visibility='public'
       ORDER BY
         u.is_admin DESC,
         t.is_sponsored DESC,
         t.is_elite DESC,
         t.created_at DESC`
    );
    return res.rows.map(r => ({
      ...this.mapTournament(r),
      creator: { id: r.creator_id, username: r.creator_username, pseudo: r.creator_pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.creator_avatar ?? null, bio: null, isAdmin: !!r.creator_is_admin, canPostClips: true, createdAt: null },
      participantCount: parseInt(r.participant_count)
    }));
  }

  async getUserTournaments(userId: string): Promise<(Tournament & { creator: User; participantCount: number })[]> {
    const res = await pool.query(
      `SELECT t.*, u.username as creator_username, u.pseudo as creator_pseudo, u.avatar_url as creator_avatar,
              (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=t.id) as participant_count
       FROM tournaments t JOIN users u ON t.creator_id=u.id
       WHERE t.creator_id=$1 ORDER BY t.created_at DESC`,
      [userId]
    );
    return res.rows.map(r => ({
      ...this.mapTournament(r),
      creator: { id: r.creator_id, username: r.creator_username, pseudo: r.creator_pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.creator_avatar ?? null, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      participantCount: parseInt(r.participant_count)
    }));
  }

  async getUserParticipatedTournaments(userId: string): Promise<(Tournament & { creator: User; participantCount: number })[]> {
    const res = await pool.query(
      `SELECT t.*, u.username as creator_username, u.pseudo as creator_pseudo, u.avatar_url as creator_avatar,
              (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=t.id) as participant_count
       FROM tournaments t
       JOIN users u ON t.creator_id=u.id
       JOIN tournament_participants tp ON tp.tournament_id=t.id
       WHERE tp.user_id=$1 AND t.creator_id != $1 ORDER BY t.created_at DESC`,
      [userId]
    );
    return res.rows.map(r => ({
      ...this.mapTournament(r),
      creator: { id: r.creator_id, username: r.creator_username, pseudo: r.creator_pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.creator_avatar ?? null, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      participantCount: parseInt(r.participant_count)
    }));
  }

  async updateTournamentStatus(id: string, status: string): Promise<void> {
    await pool.query("UPDATE tournaments SET status=$1 WHERE id=$2", [status, id]);
  }

  async deleteTournament(id: string): Promise<void> {
    await pool.query("DELETE FROM tournament_participants WHERE tournament_id=$1", [id]);
    await pool.query("DELETE FROM tournament_matches WHERE tournament_id=$1", [id]);
    await pool.query("DELETE FROM tournament_chats WHERE tournament_id=$1", [id]);
    await pool.query("DELETE FROM notifications WHERE tournament_id=$1", [id]);
    // Les récompenses (tournament_rewards) sont conservées même après suppression du tournoi
    await pool.query("DELETE FROM tournaments WHERE id=$1", [id]);
  }

  async updateTournament(id: string, data: { name: string; description?: string | null; startDate?: string | null; endDate?: string | null }): Promise<void> {
    await pool.query(
      "UPDATE tournaments SET name=$1, start_date=$2, end_date=$3 WHERE id=$4",
      [data.name, data.startDate ?? null, data.endDate ?? null, id]
    );
  }

  async scheduleMatch(matchId: string, scheduledAt: string | null): Promise<void> {
    await pool.query(
      "UPDATE tournament_matches SET scheduled_at=$1 WHERE id=$2",
      [scheduledAt, matchId]
    );
  }

  async setMatchDate(matchId: string, matchDate: string | null): Promise<void> {
    await pool.query(
      "UPDATE tournament_matches SET match_date=$1 WHERE id=$2",
      [matchDate, matchId]
    );
    // If both players already have a time, recompute scheduled_at
    const res = await pool.query(
      "SELECT proposed_time_p1, proposed_time_p2 FROM tournament_matches WHERE id=$1",
      [matchId]
    );
    if (res.rows.length > 0 && matchDate) {
      const { proposed_time_p1, proposed_time_p2 } = res.rows[0];
      if (proposed_time_p1 && proposed_time_p2 && proposed_time_p1 === proposed_time_p2) {
        const scheduledAt = `${matchDate}T${proposed_time_p1}`;
        await pool.query("UPDATE tournament_matches SET scheduled_at=$1 WHERE id=$2", [scheduledAt, matchId]);
      }
    }
  }

  async proposeMatchTime(matchId: string, playerId: string, time: string | null): Promise<{ scheduled: boolean }> {
    const res = await pool.query(
      "SELECT player1_id, player2_id, match_date, proposed_time_p1, proposed_time_p2 FROM tournament_matches WHERE id=$1",
      [matchId]
    );
    if (res.rows.length === 0) throw new Error("Match introuvable");
    const m = res.rows[0];

    if (m.player1_id === playerId) {
      await pool.query("UPDATE tournament_matches SET proposed_time_p1=$1 WHERE id=$2", [time, matchId]);
    } else if (m.player2_id === playerId) {
      await pool.query("UPDATE tournament_matches SET proposed_time_p2=$1 WHERE id=$2", [time, matchId]);
    } else {
      throw new Error("Vous n'êtes pas joueur de ce match");
    }

    const t1 = m.player1_id === playerId ? time : m.proposed_time_p1;
    const t2 = m.player2_id === playerId ? time : m.proposed_time_p2;
    const matchDate = m.match_date;

    // Auto-schedule only when both agree on the same time AND the organizer set a date
    if (t1 && t2 && t1 === t2 && matchDate) {
      const scheduledAt = `${matchDate}T${t1}`;
      await pool.query("UPDATE tournament_matches SET scheduled_at=$1, notified_15m=false, notified_5m=false WHERE id=$2", [scheduledAt, matchId]);
      return { scheduled: true };
    }

    return { scheduled: false };
  }

  async rejectMatchTime(matchId: string, rejectingPlayerId: string): Promise<{ proposerPseudo: string }> {
    const res = await pool.query(
      `SELECT m.player1_id, m.player2_id, m.proposed_time_p1, m.proposed_time_p2,
              u1.pseudo as p1_pseudo, u2.pseudo as p2_pseudo
       FROM tournament_matches m
       JOIN users u1 ON m.player1_id = u1.id
       JOIN users u2 ON m.player2_id = u2.id
       WHERE m.id=$1`,
      [matchId]
    );
    if (res.rows.length === 0) throw new Error("Match introuvable");
    const m = res.rows[0];

    // The "proposer" is the opponent — clear their proposed time
    if (m.player1_id === rejectingPlayerId) {
      await pool.query("UPDATE tournament_matches SET proposed_time_p2=NULL WHERE id=$1", [matchId]);
      return { proposerPseudo: m.p2_pseudo };
    } else if (m.player2_id === rejectingPlayerId) {
      await pool.query("UPDATE tournament_matches SET proposed_time_p1=NULL WHERE id=$1", [matchId]);
      return { proposerPseudo: m.p1_pseudo };
    } else {
      throw new Error("Vous n'êtes pas joueur de ce match");
    }
  }

  async removeParticipant(tournamentId: string, userId: string): Promise<void> {
    await pool.query(
      "DELETE FROM tournament_participants WHERE tournament_id=$1 AND user_id=$2",
      [tournamentId, userId]
    );
  }

  async joinTournament(tournamentId: string, userId: string, paymentProof?: string | null): Promise<TournamentParticipant> {
    const id = randomUUID();
    const paymentStatus = paymentProof ? "pending" : "free";
    const res = await pool.query(
      "INSERT INTO tournament_participants (id, tournament_id, user_id, payment_proof, payment_status) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [id, tournamentId, userId, paymentProof ?? null, paymentStatus]
    );
    return { id: res.rows[0].id, tournamentId: res.rows[0].tournament_id, userId: res.rows[0].user_id, joinedAt: res.rows[0].joined_at, paymentProof: res.rows[0].payment_proof ?? null, paymentStatus: res.rows[0].payment_status ?? "free" } as any;
  }

  async getTournamentParticipants(tournamentId: string): Promise<(TournamentParticipant & { user: User })[]> {
    const res = await pool.query(
      `SELECT tp.*, u.id as u_id, u.username, u.pseudo, u.phone, u.country, u.region,
              u.avatar_url, u.bio, u.created_at as u_created_at
       FROM tournament_participants tp JOIN users u ON tp.user_id=u.id
       WHERE tp.tournament_id=$1`,
      [tournamentId]
    );
    return res.rows.map(r => ({
      id: r.id, tournamentId: r.tournament_id, userId: r.user_id, joinedAt: r.joined_at,
      paymentProof: r.payment_proof ?? null,
      paymentStatus: r.payment_status ?? "free",
      user: { id: r.u_id, username: r.username, pseudo: r.pseudo, password: "", phone: r.phone, country: r.country, region: r.region, avatarUrl: r.avatar_url, bio: r.bio, isAdmin: false, canPostClips: true, createdAt: r.u_created_at }
    }));
  }

  async updateParticipantPaymentStatus(participantId: string, status: string): Promise<void> {
    await pool.query(
      "UPDATE tournament_participants SET payment_status=$1 WHERE id=$2",
      [status, participantId]
    );
  }

  async getPendingPayments(): Promise<any[]> {
    const res = await pool.query(
      `SELECT tp.id as participant_id, tp.tournament_id, tp.user_id, tp.payment_proof, tp.payment_status, tp.joined_at,
              u.pseudo, u.username, u.avatar_url,
              t.name as tournament_name, t.entry_fee, t.entry_payment_number
       FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       JOIN tournaments t ON tp.tournament_id = t.id
       WHERE tp.payment_status = 'pending'
       ORDER BY tp.joined_at DESC`
    );
    return res.rows.map(r => ({
      participantId: r.participant_id,
      tournamentId: r.tournament_id,
      userId: r.user_id,
      paymentProof: r.payment_proof,
      paymentStatus: r.payment_status,
      joinedAt: r.joined_at,
      userPseudo: r.pseudo,
      userUsername: r.username,
      userAvatarUrl: r.avatar_url ?? null,
      tournamentName: r.tournament_name,
      entryFee: r.entry_fee,
      entryPaymentNumber: r.entry_payment_number,
    }));
  }

  async isParticipant(tournamentId: string, userId: string): Promise<boolean> {
    const res = await pool.query(
      "SELECT 1 FROM tournament_participants WHERE tournament_id=$1 AND user_id=$2",
      [tournamentId, userId]
    );
    return res.rows.length > 0;
  }

  async createMatch(data: Omit<TournamentMatch, "id">): Promise<TournamentMatch> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO tournament_matches (id, tournament_id, player1_id, player2_id, phase, pool_number, round_number, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [id, data.tournamentId, data.player1Id, data.player2Id, data.phase, data.poolNumber ?? null, (data as any).roundNumber ?? null]
    );
    return this.mapMatch(res.rows[0]);
  }

  async getTournamentMatches(tournamentId: string): Promise<(TournamentMatch & { player1: User; player2: User })[]> {
    const res = await pool.query(
      `SELECT m.*,
              p1.id as p1_id, p1.username as p1_username, p1.pseudo as p1_pseudo, p1.phone as p1_phone, p1.country as p1_country, p1.region as p1_region, p1.avatar_url as p1_avatar,
              p2.id as p2_id, p2.username as p2_username, p2.pseudo as p2_pseudo, p2.phone as p2_phone, p2.country as p2_country, p2.region as p2_region, p2.avatar_url as p2_avatar
       FROM tournament_matches m
       JOIN users p1 ON m.player1_id=p1.id
       JOIN users p2 ON m.player2_id=p2.id
       WHERE m.tournament_id=$1 ORDER BY m.pool_number, m.phase`,
      [tournamentId]
    );
    return res.rows.map(r => ({
      ...this.mapMatch(r),
      player1: { id: r.p1_id, username: r.p1_username, pseudo: r.p1_pseudo, password: "", phone: r.p1_phone, country: r.p1_country, region: r.p1_region, avatarUrl: r.p1_avatar, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      player2: { id: r.p2_id, username: r.p2_username, pseudo: r.p2_pseudo, password: "", phone: r.p2_phone, country: r.p2_country, region: r.p2_region, avatarUrl: r.p2_avatar, bio: null, isAdmin: false, canPostClips: true, createdAt: null }
    }));
  }

  async updateMatchScore(matchId: string, score1: number, score2: number): Promise<void> {
    await pool.query(
      "UPDATE tournament_matches SET score1=$1, score2=$2, status='done', played_at=NOW() WHERE id=$3",
      [score1, score2, matchId]
    );
  }

  async correctMatchScore(matchId: string, score1: number, score2: number): Promise<void> {
    await pool.query(
      "UPDATE tournament_matches SET score1=$1, score2=$2, correction_count=correction_count+1 WHERE id=$3",
      [score1, score2, matchId]
    );
  }

  async proposeScore(matchId: string, proposedBy: string, score1: number, score2: number, proofUrl?: string | null): Promise<void> {
    await pool.query(
      "UPDATE tournament_matches SET proposed_score1=$1, proposed_score2=$2, proposed_by=$3, proof_url=$4, status='proposed', proposed_at=NOW() WHERE id=$5",
      [score1, score2, proposedBy, proofUrl ?? null, matchId]
    );
  }

  async confirmScore(matchId: string): Promise<void> {
    await pool.query(
      `UPDATE tournament_matches
       SET score1=proposed_score1, score2=proposed_score2, status='done', played_at=NOW(),
           proposed_score1=NULL, proposed_score2=NULL, proposed_by=NULL, proposed_at=NULL
       WHERE id=$1`,
      [matchId]
    );
  }

  async rejectScore(matchId: string): Promise<void> {
    await pool.query(
      `UPDATE tournament_matches
       SET proposed_score1=NULL, proposed_score2=NULL, proposed_by=NULL, proof_url=NULL, status='pending', proposed_at=NULL
       WHERE id=$1`,
      [matchId]
    );
  }

  async getMatchById(matchId: string): Promise<TournamentMatch | undefined> {
    const res = await pool.query("SELECT * FROM tournament_matches WHERE id=$1", [matchId]);
    return res.rows[0] ? this.mapMatch(res.rows[0]) : undefined;
  }

  async getUserMatches(userId: string): Promise<(TournamentMatch & { player1: User; player2: User; tournament: Tournament })[]> {
    const res = await pool.query(
      `SELECT m.*, t.name as t_name, t.status as t_status,
              p1.id as p1_id, p1.username as p1_username, p1.pseudo as p1_pseudo, p1.phone as p1_phone, p1.avatar_url as p1_avatar,
              p2.id as p2_id, p2.username as p2_username, p2.pseudo as p2_pseudo, p2.phone as p2_phone, p2.avatar_url as p2_avatar
       FROM tournament_matches m
       JOIN tournaments t ON m.tournament_id=t.id
       JOIN users p1 ON m.player1_id=p1.id
       JOIN users p2 ON m.player2_id=p2.id
       WHERE m.player1_id=$1 OR m.player2_id=$1
       ORDER BY m.played_at DESC NULLS LAST`,
      [userId]
    );
    return res.rows.map(r => ({
      ...this.mapMatch(r),
      player1: { id: r.p1_id, username: r.p1_username, pseudo: r.p1_pseudo, password: "", phone: r.p1_phone, country: "", region: "", avatarUrl: r.p1_avatar ?? null, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      player2: { id: r.p2_id, username: r.p2_username, pseudo: r.p2_pseudo, password: "", phone: r.p2_phone, country: "", region: "", avatarUrl: r.p2_avatar ?? null, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      tournament: { ...this.mapTournament(r), id: r.tournament_id, name: r.t_name, status: r.t_status } as Tournament
    }));
  }

  async getTournamentStandings(tournamentId: string): Promise<StandingEntry[]> {
    const res = await pool.query(
      `SELECT
         u.id as user_id, u.pseudo, u.avatar_url,
         -- pool_number from any non-knockout match (pending or done) — ensures correct pool even before matches are played
         MAX(m.pool_number) FILTER (WHERE m.phase != 'knockout') as pool_number,
         COUNT(m.id) FILTER (WHERE m.status='done' AND m.phase != 'knockout') as played,
         COUNT(m.id) FILTER (WHERE m.status='done' AND m.phase != 'knockout' AND (
           (m.player1_id=u.id AND m.score1 > m.score2) OR
           (m.player2_id=u.id AND m.score2 > m.score1)
         )) as wins,
         COUNT(m.id) FILTER (WHERE m.status='done' AND m.phase != 'knockout' AND m.score1=m.score2) as draws,
         COUNT(m.id) FILTER (WHERE m.status='done' AND m.phase != 'knockout' AND (
           (m.player1_id=u.id AND m.score1 < m.score2) OR
           (m.player2_id=u.id AND m.score2 < m.score1)
         )) as losses,
         COALESCE(SUM(CASE WHEN m.player1_id=u.id THEN m.score1 ELSE m.score2 END) FILTER (WHERE m.status='done' AND m.phase != 'knockout'), 0) as goals_for,
         COALESCE(SUM(CASE WHEN m.player1_id=u.id THEN m.score2 ELSE m.score1 END) FILTER (WHERE m.status='done' AND m.phase != 'knockout'), 0) as goals_against
       FROM tournament_participants tp
       JOIN users u ON tp.user_id=u.id
       LEFT JOIN tournament_matches m ON m.tournament_id=tp.tournament_id
         AND (m.player1_id=u.id OR m.player2_id=u.id)
       WHERE tp.tournament_id=$1
       GROUP BY u.id, u.pseudo, u.avatar_url
       ORDER BY MAX(m.pool_number) FILTER (WHERE m.phase != 'knockout') NULLS FIRST,
         (COUNT(m.id) FILTER (WHERE m.status='done' AND m.phase != 'knockout' AND (
           (m.player1_id=u.id AND m.score1 > m.score2) OR
           (m.player2_id=u.id AND m.score2 > m.score1)
         ))*3 + COUNT(m.id) FILTER (WHERE m.status='done' AND m.phase != 'knockout' AND m.score1=m.score2)) DESC,
         (COALESCE(SUM(CASE WHEN m.player1_id=u.id THEN m.score1 ELSE m.score2 END) FILTER (WHERE m.status='done' AND m.phase != 'knockout'), 0) -
          COALESCE(SUM(CASE WHEN m.player1_id=u.id THEN m.score2 ELSE m.score1 END) FILTER (WHERE m.status='done' AND m.phase != 'knockout'), 0)) DESC,
         COALESCE(SUM(CASE WHEN m.player1_id=u.id THEN m.score1 ELSE m.score2 END) FILTER (WHERE m.status='done' AND m.phase != 'knockout'), 0) DESC`,
      [tournamentId]
    );
    return res.rows.map(r => ({
      userId: r.user_id,
      pseudo: r.pseudo,
      avatarUrl: r.avatar_url,
      poolNumber: r.pool_number,
      played: parseInt(r.played) || 0,
      wins: parseInt(r.wins) || 0,
      draws: parseInt(r.draws) || 0,
      losses: parseInt(r.losses) || 0,
      goalsFor: parseInt(r.goals_for) || 0,
      goalsAgainst: parseInt(r.goals_against) || 0,
      points: (parseInt(r.wins) || 0) * 3 + (parseInt(r.draws) || 0),
    }));
  }

  async getUserStats(userId: string): Promise<PlayerStats> {
    const res = await pool.query(
      `SELECT
         COUNT(m.id) FILTER (WHERE m.status='done') as played,
         COUNT(m.id) FILTER (WHERE m.status='done' AND (
           (m.player1_id=$1 AND m.score1 > m.score2) OR
           (m.player2_id=$1 AND m.score2 > m.score1)
         )) as wins,
         COUNT(m.id) FILTER (WHERE m.status='done' AND m.score1=m.score2) as draws,
         COUNT(m.id) FILTER (WHERE m.status='done' AND (
           (m.player1_id=$1 AND m.score1 < m.score2) OR
           (m.player2_id=$1 AND m.score2 < m.score1)
         )) as losses,
         COALESCE(SUM(CASE WHEN m.player1_id=$1 THEN m.score1 ELSE m.score2 END) FILTER (WHERE m.status='done'), 0) as goals_for,
         COALESCE(SUM(CASE WHEN m.player1_id=$1 THEN m.score2 ELSE m.score1 END) FILTER (WHERE m.status='done'), 0) as goals_against
       FROM tournament_matches m
       WHERE m.player1_id=$1 OR m.player2_id=$1`,
      [userId]
    );

    const tournamentsRes = await pool.query(
      "SELECT COUNT(*) FROM tournament_participants WHERE user_id=$1",
      [userId]
    );

    const r = res.rows[0];
    const played = parseInt(r.played) || 0;
    const wins = parseInt(r.wins) || 0;
    const draws = parseInt(r.draws) || 0;
    const losses = parseInt(r.losses) || 0;

    const goalsFor = parseInt(r.goals_for) || 0;
    const goalsAgainst = parseInt(r.goals_against) || 0;
    const winRate = played > 0 ? wins / played : 0;
    const winRatePct = Math.round(winRate * 100);

    // Performance star tiers — hard thresholds; 4★ & 5★ are very difficult solo
    // Players are encouraged to win tournaments (champion bonus) or buy coins to reach 4-5★
    const TIERS = [
      { stars: 1, matches: 5,   winRate: 0,    level: "Participant" },   // unlocks Cotisation
      { stars: 2, matches: 20,  winRate: 0.35, level: "Amateur" },       // intermediate
      { stars: 3, matches: 50,  winRate: 0.50, level: "Compétiteur" },   // unlocks Élite ≥3★
      { stars: 4, matches: 100, winRate: 0.65, level: "Pro" },           // very hard — Sponsorisé + Élite ≥4★
      { stars: 5, matches: 200, winRate: 0.75, level: "Élite" },         // near-impossible pure grind
    ];

    let performanceStars = 0;
    let level = "Débutant";
    for (const tier of TIERS) {
      if (played >= tier.matches && winRate >= tier.winRate) {
        performanceStars = tier.stars;
        level = tier.level;
      }
    }

    // Fetch bonus stars (from champion wins + coin purchases)
    const bonusRes = await pool.query(
      "SELECT COALESCE(bonus_stars, 0) as bonus_stars, COALESCE(coins, 0) as coins FROM users WHERE id=$1",
      [userId]
    );
    const bonusStars = parseInt(bonusRes.rows[0]?.bonus_stars ?? 0);
    const coins = parseInt(bonusRes.rows[0]?.coins ?? 0);

    // Effective stars = performance + bonus, capped at 5
    const stars = Math.min(performanceStars + bonusStars, 5);
    // Level reflects effective stars
    const LEVEL_NAMES = ["Débutant", "Participant", "Amateur", "Compétiteur", "Pro", "Élite"];
    const effectiveLevel = LEVEL_NAMES[stars] ?? level;

    // Calculate what's needed for the next performance star
    const nextTier = TIERS.find(t => t.stars > performanceStars);
    const nextStarMatchesNeeded = nextTier ? Math.max(0, nextTier.matches - played) : 0;
    const nextStarWinRateNeeded = nextTier ? Math.max(0, Math.round(nextTier.winRate * 100) - winRatePct) : 0;

    return {
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      points: wins * 3 + draws,
      tournamentsPlayed: parseInt(tournamentsRes.rows[0].count) || 0,
      performanceStars,
      bonusStars,
      stars,
      coins,
      level: effectiveLevel,
      winRatePct,
      nextStarMatchesNeeded,
      nextStarWinRateNeeded,
    };
  }

  async sendTournamentChat(tournamentId: string, userId: string, content: string): Promise<TournamentChat> {
    const id = randomUUID();
    const res = await pool.query(
      "INSERT INTO tournament_chats (id, tournament_id, user_id, content) VALUES ($1,$2,$3,$4) RETURNING *",
      [id, tournamentId, userId, content]
    );
    return this.mapTournamentChat(res.rows[0]);
  }

  async getTournamentChat(tournamentId: string): Promise<(TournamentChat & { user: User })[]> {
    const res = await pool.query(
      `SELECT tc.*, u.id as u_id, u.username, u.pseudo, u.avatar_url
       FROM tournament_chats tc JOIN users u ON tc.user_id=u.id
       WHERE tc.tournament_id=$1 ORDER BY tc.created_at ASC LIMIT 200`,
      [tournamentId]
    );
    return res.rows.map(r => ({
      id: r.id, tournamentId: r.tournament_id, userId: r.user_id, content: r.content, createdAt: r.created_at,
      user: { id: r.u_id, username: r.username, pseudo: r.pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.avatar_url, bio: null, isAdmin: false, canPostClips: true, createdAt: null }
    }));
  }

  async sendMessage(senderId: string, receiverId: string, content: string): Promise<Message> {
    const id = randomUUID();
    const res = await pool.query(
      "INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *",
      [id, senderId, receiverId, content]
    );
    return this.mapMessage(res.rows[0]);
  }

  async getConversation(userId1: string, userId2: string): Promise<MessageWithReactions[]> {
    const res = await pool.query(
      `SELECT m.*, u.id as s_id, u.username as s_username, u.pseudo as s_pseudo, u.avatar_url as s_avatar_url
       FROM messages m JOIN users u ON m.sender_id=u.id
       WHERE (m.sender_id=$1 AND m.receiver_id=$2) OR (m.sender_id=$2 AND m.receiver_id=$1)
       ORDER BY m.created_at ASC`,
      [userId1, userId2]
    );
    const messageIds = res.rows.map((r: any) => r.id);
    const reactions = await this.getReactions(messageIds);
    return res.rows.map((r: any) => ({
      ...this.mapMessage(r),
      sender: { id: r.s_id, username: r.s_username, pseudo: r.s_pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.s_avatar_url ?? null, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      reactions: reactions[r.id] || []
    }));
  }

  async getConversations(userId: string): Promise<{ user: User; lastMessage: Message; unread: number }[]> {
    const res = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (partner_id)
           partner_id,
           u.username as partner_username, u.pseudo as partner_pseudo, u.avatar_url as partner_avatar_url,
           m.id as msg_id, m.content as msg_content, m.sender_id as msg_sender_id,
           m.receiver_id as msg_receiver_id, m.is_read as msg_is_read, m.created_at as msg_created_at,
           (SELECT COUNT(*) FROM messages WHERE sender_id=partner_id AND receiver_id=$1 AND is_read=false) as unread_count
         FROM (
           SELECT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END as partner_id, *
           FROM messages WHERE (sender_id=$1 OR receiver_id=$1)
         ) m
         JOIN users u ON u.id=partner_id
         ORDER BY partner_id, m.created_at DESC
       ) sub
       ORDER BY msg_created_at DESC`,
      [userId]
    );
    return res.rows.map(r => ({
      user: { id: r.partner_id, username: r.partner_username, pseudo: r.partner_pseudo, password: "", phone: "", country: "", region: "", avatarUrl: r.partner_avatar_url, bio: null, isAdmin: false, canPostClips: true, createdAt: null },
      lastMessage: { id: r.msg_id, senderId: r.msg_sender_id, receiverId: r.msg_receiver_id, content: r.msg_content, isRead: r.msg_is_read, createdAt: r.msg_created_at },
      unread: parseInt(r.unread_count)
    }));
  }

  async markMessagesRead(senderId: string, receiverId: string): Promise<void> {
    await pool.query(
      "UPDATE messages SET is_read=true WHERE sender_id=$1 AND receiver_id=$2",
      [senderId, receiverId]
    );
  }

  async getMessageById(messageId: string): Promise<Message | undefined> {
    const res = await pool.query("SELECT * FROM messages WHERE id=$1", [messageId]);
    return res.rows[0] ? this.mapMessage(res.rows[0]) : undefined;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await pool.query("DELETE FROM message_reactions WHERE message_id=$1", [messageId]);
    await pool.query("DELETE FROM messages WHERE id=$1", [messageId]);
  }

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<{ added: boolean }> {
    const existing = await pool.query(
      "SELECT id FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3",
      [messageId, userId, emoji]
    );
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM message_reactions WHERE id=$1", [existing.rows[0].id]);
      return { added: false };
    } else {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES ($1,$2,$3,$4)",
        [id, messageId, userId, emoji]
      );
      return { added: true };
    }
  }

  async getReactions(messageIds: string[]): Promise<Record<string, Reaction[]>> {
    if (messageIds.length === 0) return {};
    const res = await pool.query(
      "SELECT * FROM message_reactions WHERE message_id = ANY($1::text[])",
      [messageIds]
    );
    const result: Record<string, Reaction[]> = {};
    for (const row of res.rows) {
      if (!result[row.message_id]) result[row.message_id] = [];
      const existing = result[row.message_id].find((r: Reaction) => r.emoji === row.emoji);
      if (existing) {
        existing.count++;
        existing.userIds.push(row.user_id);
      } else {
        result[row.message_id].push({ emoji: row.emoji, count: 1, userIds: [row.user_id] });
      }
    }
    return result;
  }

  async createNotification(userId: string, content: string, tournamentId?: string, matchId?: string): Promise<Notification> {
    const id = randomUUID();
    const res = await pool.query(
      "INSERT INTO notifications (id, user_id, content, tournament_id, match_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [id, userId, content, tournamentId || null, matchId || null]
    );
    // Send web push to all this user's devices
    this.sendPushToUser(userId, { title: "eLIGA", body: content, tournamentId, matchId }).catch(() => {});
    return this.mapNotification(res.rows[0]);
  }

  async savePushSubscription(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await pool.query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id=$2, p256dh=$4, auth=$5`,
      [randomUUID(), userId, endpoint, p256dh, auth]
    );
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [endpoint]);
  }

  async getPushSubscriptions(userId: string): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
    const res = await pool.query(
      "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1",
      [userId]
    );
    return res.rows;
  }

  async getUnreadCountForBadge(userId: string): Promise<number> {
    const res = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false",
      [userId]
    );
    return parseInt(res.rows[0].count);
  }

  private async sendPushToUser(userId: string, payload: { title: string; body: string; tournamentId?: string; matchId?: string }): Promise<void> {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
    const subs = await this.getPushSubscriptions(userId);
    const unreadCount = await this.getUnreadCountForBadge(userId);
    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      tag: payload.matchId || payload.tournamentId || "eliga",
      data: {
        url: payload.matchId ? `/matches` : payload.tournamentId ? `/tournaments/${payload.tournamentId}` : "/",
        unreadCount: unreadCount + 1
      }
    });
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification
        ).catch(async (err: any) => {
          // 410 Gone = subscription expired, delete it
          if (err.statusCode === 410) {
            await this.deletePushSubscription(sub.endpoint);
          }
        })
      )
    );
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const res = await pool.query(
      "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
      [userId]
    );
    return res.rows.map(this.mapNotification);
  }

  async markNotificationRead(notifId: string): Promise<void> {
    await pool.query("UPDATE notifications SET is_read=true WHERE id=$1", [notifId]);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const res = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false",
      [userId]
    );
    return parseInt(res.rows[0].count);
  }

  async getMarketListings(): Promise<any[]> {
    const res = await pool.query(`
      SELECT ml.*, u.pseudo as seller_pseudo, u.country as seller_country, u.avatar_url as seller_avatar
      FROM marketplace_listings ml
      JOIN users u ON u.id = ml.seller_id
      WHERE ml.status = 'available'
      ORDER BY ml.created_at DESC
    `);
    return res.rows.map(r => ({
      id: r.id, sellerId: r.seller_id, sellerPseudo: r.seller_pseudo, sellerCountry: r.seller_country, sellerAvatarUrl: r.seller_avatar ?? null,
      photoUrl: r.photo_url, forceCollective: r.force_collective, price: r.price,
      paymentNumber: r.payment_number, status: r.status, createdAt: r.created_at,
    }));
  }

  async getMyMarketListings(sellerId: string): Promise<any[]> {
    const res = await pool.query(`
      SELECT ml.*, u.pseudo as seller_pseudo, u.country as seller_country, u.avatar_url as seller_avatar
      FROM marketplace_listings ml
      JOIN users u ON u.id = ml.seller_id
      WHERE ml.seller_id = $1
      ORDER BY ml.created_at DESC
    `, [sellerId]);
    return res.rows.map(r => ({
      id: r.id, sellerId: r.seller_id, sellerPseudo: r.seller_pseudo, sellerCountry: r.seller_country, sellerAvatarUrl: r.seller_avatar ?? null,
      photoUrl: r.photo_url, forceCollective: r.force_collective, price: r.price,
      paymentNumber: r.payment_number, status: r.status, createdAt: r.created_at,
    }));
  }

  async createMarketListing(sellerId: string, data: { photoUrl: string; forceCollective: number; price: number; paymentNumber: string }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO marketplace_listings (seller_id, photo_url, force_collective, price, payment_number) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [sellerId, data.photoUrl, data.forceCollective, data.price, data.paymentNumber]
    );
    return res.rows[0];
  }

  async deleteMarketListing(id: string, sellerId: string): Promise<boolean> {
    const res = await pool.query(`DELETE FROM marketplace_listings WHERE id=$1 AND seller_id=$2`, [id, sellerId]);
    return (res.rowCount ?? 0) > 0;
  }

  async markListingAsSold(id: string, sellerId: string): Promise<boolean> {
    const res = await pool.query(`UPDATE marketplace_listings SET status='sold' WHERE id=$1 AND seller_id=$2`, [id, sellerId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getCart(userId: string): Promise<any[]> {
    const res = await pool.query(`
      SELECT mc.id as cart_id, ml.*, u.pseudo as seller_pseudo, u.country as seller_country, u.avatar_url as seller_avatar
      FROM marketplace_cart mc
      JOIN marketplace_listings ml ON ml.id = mc.listing_id
      JOIN users u ON u.id = ml.seller_id
      WHERE mc.user_id = $1
      ORDER BY mc.created_at DESC
    `, [userId]);
    return res.rows.map(r => ({
      cartId: r.cart_id, id: r.id, sellerId: r.seller_id, sellerPseudo: r.seller_pseudo, sellerCountry: r.seller_country, sellerAvatarUrl: r.seller_avatar ?? null,
      photoUrl: r.photo_url, forceCollective: r.force_collective, price: r.price,
      paymentNumber: r.payment_number, status: r.status, createdAt: r.created_at,
    }));
  }

  async addToCart(userId: string, listingId: string): Promise<void> {
    await pool.query(
      `INSERT INTO marketplace_cart (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, listingId]
    );
  }

  async removeFromCart(userId: string, listingId: string): Promise<void> {
    await pool.query(`DELETE FROM marketplace_cart WHERE user_id=$1 AND listing_id=$2`, [userId, listingId]);
  }

  async isInCart(userId: string, listingId: string): Promise<boolean> {
    const res = await pool.query(`SELECT id FROM marketplace_cart WHERE user_id=$1 AND listing_id=$2`, [userId, listingId]);
    return res.rows.length > 0;
  }

  private mapUser(r: any): User {
    return { id: r.id, username: r.username, pseudo: r.pseudo, password: r.password, phone: r.phone, country: r.country, region: r.region, avatarUrl: r.avatar_url ?? null, bio: r.bio ?? null, isAdmin: r.is_admin ?? false, canPostClips: r.can_post_clips ?? true, createdAt: r.created_at };
  }

  private mapFriend(r: any): Friend {
    return { id: r.id, userId: r.user_id, friendId: r.friend_id, status: r.status, createdAt: r.created_at };
  }

  private mapFriendGroup(r: any): FriendGroup {
    return { id: r.id, userId: r.user_id, name: r.name, createdAt: r.created_at };
  }

  private mapTournament(r: any): Tournament {
    return {
      id: r.id, creatorId: r.creator_id, name: r.name, championshipType: r.championship_type,
      playersPerPool: r.players_per_pool, numPools: r.num_pools, playerLimit: r.player_limit,
      visibility: r.visibility, code: r.code, gameType: r.game_type, gameTime: r.game_time,
      gameForm: r.game_form, extraTime: r.extra_time, penalties: r.penalties,
      otherRules: r.other_rules, status: r.status,
      startDate: r.start_date ?? null, endDate: r.end_date ?? null,
      isSponsored: r.is_sponsored ?? false,
      sponsorName: r.sponsor_name ?? null,
      sponsorLogo: r.sponsor_logo ?? null,
      prizeInfo: r.prize_info ?? null,
      isElite: r.is_elite ?? false,
      minStars: r.min_stars ?? 0,
      elitePrizeAmount: r.elite_prize_amount ?? null,
      isPaid: r.is_paid ?? false,
      entryFee: r.entry_fee ?? 0,
      entryPaymentNumber: r.entry_payment_number ?? null,
      createdAt: r.created_at
    } as any;
  }

  private mapMatch(r: any): TournamentMatch {
    return {
      id: r.id, tournamentId: r.tournament_id, player1Id: r.player1_id, player2Id: r.player2_id,
      phase: r.phase, poolNumber: r.pool_number, roundNumber: r.round_number ?? null, score1: r.score1, score2: r.score2,
      status: r.status, scheduledAt: r.scheduled_at ?? null, playedAt: r.played_at,
      proposedScore1: r.proposed_score1 ?? null,
      proposedScore2: r.proposed_score2 ?? null,
      proposedBy: r.proposed_by ?? null,
      proofUrl: r.proof_url ?? null,
      proposedAt: r.proposed_at ?? null,
      correctionCount: r.correction_count ?? 0,
      matchDate: r.match_date ?? null,
      proposedTimeP1: r.proposed_time_p1 ?? null,
      proposedTimeP2: r.proposed_time_p2 ?? null,
      notified15m: r.notified_15m ?? false,
      notified5m: r.notified_5m ?? false,
    } as any;
  }

  private mapTournamentChat(r: any): TournamentChat {
    return { id: r.id, tournamentId: r.tournament_id, userId: r.user_id, content: r.content, createdAt: r.created_at };
  }

  private mapMessage(r: any): Message {
    return { id: r.id, senderId: r.sender_id, receiverId: r.receiver_id, content: r.content, isRead: r.is_read, createdAt: r.created_at };
  }

  private mapNotification(r: any): Notification {
    return { id: r.id, userId: r.user_id, content: r.content, isRead: r.is_read, tournamentId: r.tournament_id, matchId: r.match_id, createdAt: r.created_at };
  }

  async distributeRewards(tournamentId: string): Promise<{ userId: string; position: number; badge: string; rewardLabel: string; coinsAwarded?: number }[]> {
    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament) return [];

    const participants = await this.getTournamentParticipants(tournamentId);
    const count = participants.length;
    if (count <= 5) return [];

    let level = "standard";
    const t = tournament as any;
    if (t.isElite) level = "elite";
    else if (t.isSponsored) level = "sponsored";
    else if (t.isPaid) level = "cotisation";

    const standings = await this.getTournamentStandings(tournamentId);

    const globalStandings = [...standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      return gdB - gdA;
    });

    const topCount = count >= 8 ? 3 : 2;
    const top = globalStandings.slice(0, topCount);

    const badges = ["gold", "silver", "bronze"];
    const labels = ["Champion 🥇", "Finaliste 🥈", "3ème place 🥉"];
    const results: { userId: string; position: number; badge: string; rewardLabel: string; coinsAwarded?: number }[] = [];

    for (let i = 0; i < top.length; i++) {
      const entry = top[i];
      const existing = await pool.query(
        `SELECT id FROM tournament_rewards WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, entry.userId]
      );
      if (existing.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO tournament_rewards (id, user_id, tournament_id, position, badge, reward_label, participants_count, tournament_level, tournament_name, created_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [entry.userId, tournamentId, i + 1, badges[i], labels[i], count, level, tournament.name]
      );

      // Récompenses coins selon le classement (difficile : ≥6 joueurs requis)
      // Champion : +100 pièces + 1 étoile bonus | Vice-champion : +30 pièces | 3e : +10 pièces
      const coinRewards = [100, 30, 10];
      const coinsToAward = coinRewards[i] ?? 0;
      if (coinsToAward > 0) {
        await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [coinsToAward, entry.userId]);
      }
      // Champion (1st place) receives +1 bonus star (capped at 5 effective stars)
      if (i === 0) {
        await pool.query(
          `UPDATE users SET bonus_stars = LEAST(bonus_stars + 1, 5) WHERE id = $1`,
          [entry.userId]
        );
      }

      results.push({ userId: entry.userId, position: i + 1, badge: badges[i], rewardLabel: labels[i], coinsAwarded: coinsToAward });
    }

    return results;
  }

  async getCoinBalance(userId: string): Promise<{ coins: number; bonusStars: number }> {
    const res = await pool.query(
      "SELECT COALESCE(coins,0) as coins, COALESCE(bonus_stars,0) as bonus_stars FROM users WHERE id=$1",
      [userId]
    );
    return { coins: parseFloat(res.rows[0]?.coins ?? 0), bonusStars: parseInt(res.rows[0]?.bonus_stars ?? 0) };
  }

  async createCoinPurchase(userId: string, packName: string, coinsAmount: number, priceFcfa: number, proofUrl: string): Promise<any> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO coin_purchases (id, user_id, pack_name, coins_amount, price_fcfa, proof_url, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW()) RETURNING *`,
      [id, userId, packName, coinsAmount, priceFcfa, proofUrl]
    );
    return res.rows[0];
  }

  async getPendingCoinPurchases(): Promise<any[]> {
    const res = await pool.query(
      `SELECT cp.*, u.pseudo, u.username, u.avatar_url
       FROM coin_purchases cp JOIN users u ON cp.user_id=u.id
       WHERE cp.status='pending' ORDER BY cp.created_at ASC`
    );
    return res.rows.map(r => ({
      id: r.id, userId: r.user_id, packName: r.pack_name,
      coinsAmount: r.coins_amount, priceFcfa: r.price_fcfa,
      proofUrl: r.proof_url, status: r.status, createdAt: r.created_at,
      userPseudo: r.pseudo, userUsername: r.username, userAvatarUrl: r.avatar_url,
    }));
  }

  async confirmCoinPurchase(purchaseId: string): Promise<void> {
    const res = await pool.query("SELECT * FROM coin_purchases WHERE id=$1", [purchaseId]);
    const p = res.rows[0];
    if (!p || p.status !== "pending") return;
    await pool.query("UPDATE coin_purchases SET status='confirmed' WHERE id=$1", [purchaseId]);
    await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [p.coins_amount, p.user_id]);
  }

  async rejectCoinPurchase(purchaseId: string): Promise<void> {
    await pool.query("UPDATE coin_purchases SET status='rejected' WHERE id=$1", [purchaseId]);
  }

  async spendCoinsForStar(userId: string): Promise<{ newCoins: number; newBonusStars: number }> {
    const COST = 300;
    const res = await pool.query("SELECT coins, bonus_stars FROM users WHERE id=$1", [userId]);
    const coins = parseInt(res.rows[0]?.coins ?? 0);
    const bonusStars = parseInt(res.rows[0]?.bonus_stars ?? 0);
    if (coins < COST) throw new Error("Solde insuffisant. Il faut 300 pièces pour acheter 1 étoile.");
    if (bonusStars >= 5) throw new Error("Vous avez déjà atteint le maximum d'étoiles bonus.");
    await pool.query(
      "UPDATE users SET coins = coins - $1, bonus_stars = LEAST(bonus_stars + 1, 5) WHERE id=$2",
      [COST, userId]
    );
    const upd = await pool.query("SELECT coins, bonus_stars FROM users WHERE id=$1", [userId]);
    return { newCoins: parseInt(upd.rows[0].coins), newBonusStars: parseInt(upd.rows[0].bonus_stars) };
  }

  async getUserRewards(userId: string): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM tournament_rewards WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      tournamentId: r.tournament_id,
      position: r.position,
      badge: r.badge,
      rewardLabel: r.reward_label,
      participantsCount: r.participants_count,
      tournamentLevel: r.tournament_level,
      tournamentName: r.tournament_name,
      createdAt: r.created_at,
    }));
  }

  async distributePrizes(tournamentId: string, force = false): Promise<{ winner: any; runnerUp: any; platformShare: number; totalPool: number } | null> {
    const t = await this.getTournamentById(tournamentId) as any;
    if (!t || !t.isPaid || !t.entryFee) return null;

    const participants = await this.getTournamentParticipants(tournamentId);
    if (participants.length < 2) return null;

    const already = await pool.query(`SELECT id FROM prize_distributions WHERE tournament_id=$1`, [tournamentId]);
    if (already.rows.length > 0 && !force) return null;
    // Si force, on supprime les anciennes distributions
    if (already.rows.length > 0 && force) {
      await pool.query(`DELETE FROM prize_distributions WHERE tournament_id=$1`, [tournamentId]);
    }

    const totalPool = t.entryFee * participants.length;
    const platformShare = Math.floor(totalPool * 0.20);
    const runnerUpShare = Math.floor(totalPool * 0.30);
    const winnerShare = totalPool - platformShare - runnerUpShare;

    const getUser = async (userId: string) => {
      const r = await pool.query(`SELECT id, pseudo FROM users WHERE id=$1`, [userId]);
      return r.rows[0] ?? null;
    };

    let winner: any = null;
    let runnerUp: any = null;

    // Essayer d'abord de trouver le gagnant via le match final (élimination directe)
    const knockoutFinal = await pool.query(
      `SELECT * FROM tournament_matches WHERE tournament_id=$1 AND phase='knockout' AND status='done'
       ORDER BY created_at DESC LIMIT 1`,
      [tournamentId]
    );
    if (knockoutFinal.rows.length > 0) {
      const finalMatch = knockoutFinal.rows[0];
      const winnerId = finalMatch.score1 > finalMatch.score2 ? finalMatch.player1_id : finalMatch.player2_id;
      const loserId  = finalMatch.score1 > finalMatch.score2 ? finalMatch.player2_id : finalMatch.player1_id;
      winner   = await getUser(winnerId);
      runnerUp = await getUser(loserId);
    } else {
      // Fallback : classement de poule
      const standings = await this.getTournamentStandings(tournamentId);
      const sorted = [...standings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
      });
      winner   = sorted[0] ? await getUser(sorted[0].userId) : null;
      runnerUp = sorted[1] ? await getUser(sorted[1].userId) : null;
    }

    await pool.query(
      `INSERT INTO prize_distributions (id, tournament_id, user_id, role, amount_fcfa, total_pool) VALUES (gen_random_uuid()::text, $1, $2, 'winner', $3, $4)`,
      [tournamentId, winner?.id ?? null, winnerShare, totalPool]
    );
    await pool.query(
      `INSERT INTO prize_distributions (id, tournament_id, user_id, role, amount_fcfa, total_pool) VALUES (gen_random_uuid()::text, $1, $2, 'runner_up', $3, $4)`,
      [tournamentId, runnerUp?.id ?? null, runnerUpShare, totalPool]
    );
    await pool.query(
      `INSERT INTO prize_distributions (id, tournament_id, user_id, role, amount_fcfa, total_pool) VALUES (gen_random_uuid()::text, $1, NULL, 'platform', $3, $4)`,
      [tournamentId, platformShare, totalPool]
    );

    return { winner: winner ? { ...winner, amount: winnerShare } : null, runnerUp: runnerUp ? { ...runnerUp, amount: runnerUpShare } : null, platformShare, totalPool };
  }

  async getTournamentPrizeDistribution(tournamentId: string): Promise<any[]> {
    const res = await pool.query(
      `SELECT pd.*, u.pseudo FROM prize_distributions pd LEFT JOIN users u ON pd.user_id = u.id WHERE pd.tournament_id=$1 ORDER BY pd.created_at`,
      [tournamentId]
    );
    return res.rows.map(r => ({
      id: r.id,
      tournamentId: r.tournament_id,
      userId: r.user_id,
      pseudo: r.pseudo,
      role: r.role,
      amountFcfa: r.amount_fcfa,
      totalPool: r.total_pool,
      createdAt: r.created_at,
    }));
  }

  async getFinanceSummary(): Promise<{ totalRevenue: number; coinRevenue: number; cotisationRevenue: number; distributions: any[] }> {
    const coinRes = await pool.query(
      `SELECT COALESCE(SUM(price_fcfa), 0) as total FROM coin_purchases WHERE status='validated'`
    );
    const coinRevenue = parseInt(coinRes.rows[0]?.total ?? 0);

    const distRes = await pool.query(
      `SELECT pd.*, t.name as tournament_name, t.entry_fee, u.pseudo,
              (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id=t.id) as participant_count
       FROM prize_distributions pd
       JOIN tournaments t ON pd.tournament_id = t.id
       LEFT JOIN users u ON pd.user_id = u.id
       ORDER BY pd.created_at DESC`
    );

    const cotisationRevenue = distRes.rows
      .filter((r: any) => r.role === 'platform')
      .reduce((sum: number, r: any) => sum + parseInt(r.amount_fcfa), 0);

    const distributions = distRes.rows.map((r: any) => ({
      id: r.id,
      tournamentId: r.tournament_id,
      tournamentName: r.tournament_name,
      entryFee: r.entry_fee,
      participantCount: parseInt(r.participant_count),
      userId: r.user_id,
      pseudo: r.pseudo,
      role: r.role,
      amountFcfa: parseInt(r.amount_fcfa),
      totalPool: parseInt(r.total_pool),
      createdAt: r.created_at,
    }));

    return { totalRevenue: coinRevenue + cotisationRevenue, coinRevenue, cotisationRevenue, distributions };
  }

  // ─── CHALLENGES ─────────────────────────────────────────────────
  async createChallenge(data: {
    challengerId: string; opponentId?: string | null; proposedDate: string;
    proposedTime: string; message?: string | null; coinBet?: number; teamPhotoUrl?: string | null;
    isPrivate?: boolean; isFriendly?: boolean;
  }) {
    const id = (await pool.query("SELECT gen_random_uuid()::text AS id")).rows[0].id;
    await pool.query(
      `INSERT INTO challenges (id,challenger_id,opponent_id,proposed_date,proposed_time,status,message,coin_bet,team_photo_url,is_private,is_friendly)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10)`,
      [id, data.challengerId, data.opponentId ?? null, data.proposedDate, data.proposedTime,
       data.message ?? null, data.coinBet ?? 0, data.teamPhotoUrl ?? null, data.isPrivate ?? false, data.isFriendly ?? false]
    );
    return (await pool.query("SELECT * FROM challenges WHERE id=$1", [id])).rows[0];
  }

  async getChallengeById(id: string) {
    const r = await pool.query(`
      SELECT c.*,
        u1.pseudo AS challenger_pseudo, u1.avatar_url AS challenger_avatar,
        u2.pseudo AS opponent_pseudo, u2.avatar_url AS opponent_avatar
      FROM challenges c
      LEFT JOIN users u1 ON u1.id=c.challenger_id
      LEFT JOIN users u2 ON u2.id=c.opponent_id
      WHERE c.id=$1`, [id]);
    return r.rows[0] ?? null;
  }

  async getChallengesByUser(userId: string) {
    const r = await pool.query(`
      SELECT c.*,
        u1.pseudo AS challenger_pseudo, u1.avatar_url AS challenger_avatar, u1.phone AS challenger_phone,
        COALESCE(u1.bonus_stars, 0) AS challenger_bonus_stars,
        (SELECT COUNT(*) FROM tournament_matches tm
          WHERE (tm.player1_id=u1.id OR tm.player2_id=u1.id)
            AND tm.score1 IS NOT NULL AND tm.score2 IS NOT NULL) AS challenger_played,
        (SELECT COUNT(*) FROM tournament_matches tm
          WHERE ((tm.player1_id=u1.id AND tm.score1 > tm.score2)
              OR (tm.player2_id=u1.id AND tm.score2 > tm.score1))
            AND tm.score1 IS NOT NULL AND tm.score2 IS NOT NULL) AS challenger_wins,
        (SELECT COUNT(*) FROM tournament_matches tm
          WHERE ((tm.player1_id=u1.id AND tm.score1 < tm.score2)
              OR (tm.player2_id=u1.id AND tm.score2 < tm.score1))
            AND tm.score1 IS NOT NULL AND tm.score2 IS NOT NULL) AS challenger_losses,
        u2.pseudo AS opponent_pseudo, u2.avatar_url AS opponent_avatar, u2.phone AS opponent_phone
      FROM challenges c
      LEFT JOIN users u1 ON u1.id=c.challenger_id
      LEFT JOIN users u2 ON u2.id=c.opponent_id
      WHERE c.challenger_id=$1 OR c.opponent_id=$1
      ORDER BY c.created_at DESC`, [userId]);
    return r.rows;
  }

  async getOpenChallenges() {
    const r = await pool.query(`
      SELECT c.*,
        u1.pseudo AS challenger_pseudo, u1.avatar_url AS challenger_avatar, u1.phone AS challenger_phone,
        COALESCE(u1.bonus_stars, 0) AS challenger_bonus_stars,
        (SELECT COUNT(*) FROM tournament_matches tm
          WHERE (tm.player1_id=u1.id OR tm.player2_id=u1.id)
            AND tm.score1 IS NOT NULL AND tm.score2 IS NOT NULL) AS challenger_played,
        (SELECT COUNT(*) FROM tournament_matches tm
          WHERE ((tm.player1_id=u1.id AND tm.score1 > tm.score2)
              OR (tm.player2_id=u1.id AND tm.score2 > tm.score1))
            AND tm.score1 IS NOT NULL AND tm.score2 IS NOT NULL) AS challenger_wins,
        (SELECT COUNT(*) FROM tournament_matches tm
          WHERE ((tm.player1_id=u1.id AND tm.score1 < tm.score2)
              OR (tm.player2_id=u1.id AND tm.score2 < tm.score1))
            AND tm.score1 IS NOT NULL AND tm.score2 IS NOT NULL) AS challenger_losses,
        u2.pseudo AS opponent_pseudo, u2.avatar_url AS opponent_avatar, u2.phone AS opponent_phone
      FROM challenges c
      LEFT JOIN users u1 ON u1.id=c.challenger_id
      LEFT JOIN users u2 ON u2.id=c.opponent_id
      WHERE c.is_private=false AND c.status='pending'
      ORDER BY c.created_at DESC`);
    return r.rows;
  }

  async updateChallenge(id: string, fields: {
    status?: string; counterDate?: string | null; counterTime?: string | null;
    opponentId?: string | null; winnerId?: string | null;
    propScoreC?: number | null; propScoreO?: number | null;
    scoreProposedBy?: string | null; coinsEscrowed?: number;
    isDisputed?: boolean; scoreProofUrl?: string | null; scoreSubmittedAt?: Date | null;
  }) {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (fields.status !== undefined) { sets.push(`status=$${i++}`); vals.push(fields.status); }
    if (fields.counterDate !== undefined) { sets.push(`counter_date=$${i++}`); vals.push(fields.counterDate); }
    if (fields.counterTime !== undefined) { sets.push(`counter_time=$${i++}`); vals.push(fields.counterTime); }
    if (fields.opponentId !== undefined) { sets.push(`opponent_id=$${i++}`); vals.push(fields.opponentId); }
    if (fields.winnerId !== undefined) { sets.push(`winner_id=$${i++}`); vals.push(fields.winnerId); }
    if (fields.propScoreC !== undefined) { sets.push(`prop_score_c=$${i++}`); vals.push(fields.propScoreC); }
    if (fields.propScoreO !== undefined) { sets.push(`prop_score_o=$${i++}`); vals.push(fields.propScoreO); }
    if (fields.scoreProposedBy !== undefined) { sets.push(`score_proposed_by=$${i++}`); vals.push(fields.scoreProposedBy); }
    if (fields.coinsEscrowed !== undefined) { sets.push(`coins_escrowed=$${i++}`); vals.push(fields.coinsEscrowed); }
    if (fields.isDisputed !== undefined) { sets.push(`is_disputed=$${i++}`); vals.push(fields.isDisputed); }
    if (fields.scoreProofUrl !== undefined) { sets.push(`score_proof_url=$${i++}`); vals.push(fields.scoreProofUrl); }
    if (fields.scoreSubmittedAt !== undefined) { sets.push(`score_submitted_at=$${i++}`); vals.push(fields.scoreSubmittedAt); }
    if (!sets.length) return;
    vals.push(id);
    await pool.query(`UPDATE challenges SET ${sets.join(",")} WHERE id=$${i}`, vals);
  }

  // ─── RÉCOMPENSES MATCHS DE TOURNOI ──────────────────────────────────
  // Pièces gagnées par victoire : +5 par match, plafond 30/semaine
  static readonly MATCH_WIN_COINS = 5;
  static readonly WEEKLY_MATCH_CAP = 30;

  async getMatchWinCoinsThisWeek(userId: string): Promise<number> {
    const [tmR, chR] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as wins FROM tournament_matches
        WHERE (player1_id=$1 OR player2_id=$1)
          AND coins_awarded=true
          AND played_at > NOW() - INTERVAL '7 days'`, [userId]),
      pool.query(`
        SELECT COUNT(*) as wins FROM challenges
        WHERE winner_id=$1
          AND win_coins_awarded=true
          AND win_coins_awarded_at > NOW() - INTERVAL '7 days'`, [userId]),
    ]);
    const tmWins = parseInt(tmR.rows[0]?.wins ?? 0);
    const chWins = parseInt(chR.rows[0]?.wins ?? 0);
    return (tmWins + chWins) * PgStorage.MATCH_WIN_COINS;
  }

  async awardMatchWinCoins(matchId: string, winnerId: string): Promise<number> {
    // Vérifier que ce match n'a pas déjà été récompensé
    const check = await pool.query("SELECT coins_awarded FROM tournament_matches WHERE id=$1", [matchId]);
    if (check.rows[0]?.coins_awarded) return 0;

    const weeklyTotal = await this.getMatchWinCoinsThisWeek(winnerId);
    const remaining = PgStorage.WEEKLY_MATCH_CAP - weeklyTotal;
    if (remaining <= 0) return 0;

    const amount = Math.min(PgStorage.MATCH_WIN_COINS, remaining);
    await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [amount, winnerId]);
    await pool.query("UPDATE tournament_matches SET coins_awarded=true WHERE id=$1", [matchId]);
    return amount;
  }

  async awardChallengeWinCoins(challengeId: string, winnerId: string): Promise<number> {
    const check = await pool.query("SELECT win_coins_awarded FROM challenges WHERE id=$1", [challengeId]);
    if (check.rows[0]?.win_coins_awarded) return 0;

    const weeklyTotal = await this.getMatchWinCoinsThisWeek(winnerId);
    const remaining = PgStorage.WEEKLY_MATCH_CAP - weeklyTotal;
    if (remaining <= 0) return 0;

    const amount = Math.min(PgStorage.MATCH_WIN_COINS, remaining);
    await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [amount, winnerId]);
    await pool.query("UPDATE challenges SET win_coins_awarded=true, win_coins_awarded_at=NOW() WHERE id=$1", [challengeId]);
    return amount;
  }

  async awardFriendlyWinCoins(challengeId: string, winnerId: string): Promise<number> {
    const check = await pool.query("SELECT win_coins_awarded FROM challenges WHERE id=$1", [challengeId]);
    if (check.rows[0]?.win_coins_awarded) return 0;
    const FRIENDLY_WIN = 1.5;
    await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [FRIENDLY_WIN, winnerId]);
    await pool.query("UPDATE challenges SET win_coins_awarded=true, win_coins_awarded_at=NOW() WHERE id=$1", [challengeId]);
    return FRIENDLY_WIN;
  }

  // ─── ESCROW & REWARD ────────────────────────────────────────────────
  async escrowChallengeCoins(challengeId: string, challengerId: string, opponentId: string, bet: number) {
    const [cBal, oBal] = await Promise.all([
      pool.query("SELECT COALESCE(coins,0) as coins FROM users WHERE id=$1", [challengerId]),
      pool.query("SELECT COALESCE(coins,0) as coins FROM users WHERE id=$1", [opponentId]),
    ]);
    const cCoins = parseFloat(cBal.rows[0]?.coins ?? 0);
    const oCoins = parseFloat(oBal.rows[0]?.coins ?? 0);
    if (cCoins < bet) throw new Error(`Le challenger n'a pas assez de pièces (${cCoins} / ${bet} requis)`);
    if (oCoins < bet) throw new Error(`L'adversaire n'a pas assez de pièces (${oCoins} / ${bet} requis)`);
    await pool.query("UPDATE users SET coins = coins - $1 WHERE id=$2", [bet, challengerId]);
    await pool.query("UPDATE users SET coins = coins - $1 WHERE id=$2", [bet, opponentId]);
    await this.updateChallenge(challengeId, { coinsEscrowed: bet * 2 });
  }

  async distributeChallengeReward(challengeId: string, winnerId: string) {
    const r = await pool.query("SELECT * FROM challenges WHERE id=$1", [challengeId]);
    const challenge = r.rows[0];
    if (!challenge) return;
    const pot = parseInt(challenge.coins_escrowed ?? 0);
    if (pot > 0) {
      const PLATFORM_FEE = 0.15;
      const winnerAmount = Math.floor(pot * (1 - PLATFORM_FEE));
      await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [winnerAmount, winnerId]);
    }
    // Conserver coins_escrowed comme montant historique du pot (ne pas effacer à 0)
    await this.updateChallenge(challengeId, { winnerId, status: "completed" });
  }

  async countChallengeMatchesThisWeek(userId: string): Promise<number> {
    const r = await pool.query(`
      SELECT COUNT(*) as cnt FROM challenges
      WHERE (challenger_id=$1 OR opponent_id=$1)
        AND coin_bet > 0
        AND status IN ('accepted','completed','dispute')
        AND created_at > NOW() - INTERVAL '7 days'`, [userId]);
    return parseInt(r.rows[0]?.cnt ?? 0);
  }

  // ─── CLIPS ────────────────────────────────────────────────────────────
  async getClipsFeed(viewerId: string, offset = 0, limit = 10) {
    const r = await pool.query(`
      SELECT c.*, u.pseudo, u.avatar_url,
        EXISTS(SELECT 1 FROM clip_likes cl WHERE cl.clip_id=c.id AND cl.user_id=$1) AS liked,
        EXISTS(SELECT 1 FROM clip_follows cf WHERE cf.follower_id=$1 AND cf.following_id=c.user_id) AS is_following,
        (SELECT COUNT(*) FROM clip_follows WHERE following_id=c.user_id) AS followers_count,
        (SELECT COUNT(*) FROM clip_comments cc WHERE cc.clip_id=c.id) AS comments_count
      FROM clips c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.is_featured DESC, c.created_at DESC
      LIMIT $2 OFFSET $3`, [viewerId, limit, offset]);
    return r.rows;
  }

  // ─── CLIP COMMENTS ────────────────────────────────────────────────────
  async getClipComments(clipId: string) {
    const r = await pool.query(`
      SELECT cc.*, u.pseudo, u.avatar_url
      FROM clip_comments cc
      JOIN users u ON u.id = cc.user_id
      WHERE cc.clip_id = $1
      ORDER BY cc.created_at ASC`, [clipId]);
    return r.rows;
  }

  async addClipComment(clipId: string, userId: string, text: string) {
    const id = randomUUID();
    const r = await pool.query(`
      INSERT INTO clip_comments (id, clip_id, user_id, text)
      VALUES ($1, $2, $3, $4)
      RETURNING *`, [id, clipId, userId, text.trim()]);
    const comment = r.rows[0];
    const user = await pool.query("SELECT pseudo, avatar_url FROM users WHERE id=$1", [userId]);
    return { ...comment, pseudo: user.rows[0]?.pseudo, avatar_url: user.rows[0]?.avatar_url };
  }

  async deleteClipComment(commentId: string, userId: string): Promise<boolean> {
    const r = await pool.query(
      "DELETE FROM clip_comments WHERE id=$1 AND user_id=$2 RETURNING id",
      [commentId, userId]
    );
    return r.rows.length > 0;
  }

  async deleteClipCommentAdmin(commentId: string): Promise<boolean> {
    const r = await pool.query("DELETE FROM clip_comments WHERE id=$1 RETURNING id", [commentId]);
    return r.rows.length > 0;
  }

  async getAdminAllClips() {
    const r = await pool.query(`
      SELECT c.*, u.pseudo, u.avatar_url
      FROM clips c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.is_featured DESC, c.created_at DESC`);
    return r.rows;
  }

  async toggleClipFeatured(clipId: string): Promise<boolean> {
    const r = await pool.query("UPDATE clips SET is_featured = NOT is_featured WHERE id=$1 RETURNING is_featured", [clipId]);
    return r.rows[0]?.is_featured ?? false;
  }

  async toggleUserClipsPermission(userId: string): Promise<boolean> {
    const r = await pool.query("UPDATE users SET can_post_clips = NOT can_post_clips WHERE id=$1 RETURNING can_post_clips", [userId]);
    return r.rows[0]?.can_post_clips ?? true;
  }

  async createClip(userId: string, data: { title: string; description?: string; videoUrl: string; thumbnailUrl?: string; tag: string }) {
    const id = randomUUID();
    const r = await pool.query(
      `INSERT INTO clips (id, user_id, title, description, video_url, thumbnail_url, tag)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, userId, data.title, data.description ?? null, data.videoUrl, data.thumbnailUrl ?? null, data.tag]
    );
    return r.rows[0];
  }

  async deleteClip(clipId: string, userId: string) {
    await pool.query("DELETE FROM clips WHERE id=$1 AND user_id=$2", [clipId, userId]);
  }

  async deleteClipAdmin(clipId: string) {
    await pool.query("DELETE FROM clips WHERE id=$1", [clipId]);
  }

  async incrementClipViews(clipId: string) {
    await pool.query("UPDATE clips SET views_count = views_count + 1 WHERE id=$1", [clipId]);
  }

  async toggleClipLike(clipId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const existing = await pool.query("SELECT id FROM clip_likes WHERE clip_id=$1 AND user_id=$2", [clipId, userId]);
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM clip_likes WHERE clip_id=$1 AND user_id=$2", [clipId, userId]);
      const r = await pool.query("UPDATE clips SET likes_count = GREATEST(0, likes_count - 1) WHERE id=$1 RETURNING likes_count", [clipId]);
      return { liked: false, likesCount: r.rows[0].likes_count };
    } else {
      await pool.query("INSERT INTO clip_likes (id, clip_id, user_id) VALUES ($1,$2,$3)", [randomUUID(), clipId, userId]);
      const r = await pool.query("UPDATE clips SET likes_count = likes_count + 1 WHERE id=$1 RETURNING likes_count", [clipId]);
      return { liked: true, likesCount: r.rows[0].likes_count };
    }
  }

  async getUserClips(userId: string, viewerId: string) {
    const r = await pool.query(`
      SELECT c.*, u.pseudo, u.avatar_url,
        EXISTS(SELECT 1 FROM clip_likes cl WHERE cl.clip_id=c.id AND cl.user_id=$2) AS liked
      FROM clips c
      JOIN users u ON u.id = c.user_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC`, [userId, viewerId]);
    return r.rows;
  }

  // ─── CLIP FOLLOWS ─────────────────────────────────────────────────────
  async toggleClipFollow(followerId: string, followingId: string): Promise<{ following: boolean; followersCount: number }> {
    const existing = await pool.query("SELECT id FROM clip_follows WHERE follower_id=$1 AND following_id=$2", [followerId, followingId]);
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM clip_follows WHERE follower_id=$1 AND following_id=$2", [followerId, followingId]);
    } else {
      await pool.query("INSERT INTO clip_follows (id, follower_id, following_id) VALUES (gen_random_uuid(),$1,$2) ON CONFLICT DO NOTHING", [followerId, followingId]);
    }
    const cnt = await pool.query("SELECT COUNT(*) as cnt FROM clip_follows WHERE following_id=$1", [followingId]);
    return { following: existing.rows.length === 0, followersCount: parseInt(cnt.rows[0].cnt) };
  }

  async getClipFollowersCount(userId: string): Promise<number> {
    const r = await pool.query("SELECT COUNT(*) as cnt FROM clip_follows WHERE following_id=$1", [userId]);
    return parseInt(r.rows[0].cnt);
  }

  async getClipStats(userId: string): Promise<{ totalViews: number; totalLikes: number; totalFollowers: number; clips: number }> {
    const r = await pool.query(`
      SELECT
        COALESCE(SUM(views_count),0) as total_views,
        COALESCE(SUM(likes_count),0) as total_likes,
        COUNT(*) as clips_count
      FROM clips WHERE user_id=$1`, [userId]);
    const follows = await pool.query("SELECT COUNT(*) as cnt FROM clip_follows WHERE following_id=$1", [userId]);
    return {
      totalViews: parseInt(r.rows[0].total_views),
      totalLikes: parseInt(r.rows[0].total_likes),
      totalFollowers: parseInt(follows.rows[0].cnt),
      clips: parseInt(r.rows[0].clips_count),
    };
  }

  async getClipMilestonesAwarded(userId: string) {
    const r = await pool.query("SELECT * FROM clip_milestones_awarded WHERE user_id=$1 ORDER BY awarded_at DESC", [userId]);
    return r.rows;
  }

  async checkAndAwardClipMilestones(userId: string): Promise<{ key: string; coins: number; label: string }[]> {
    const stats = await this.getClipStats(userId);
    const awarded: { key: string; coins: number; label: string }[] = [];

    const MILESTONES = [
      { type: "views", value: 100,   coins: 2,   label: "100 vues" },
      { type: "views", value: 500,   coins: 5,   label: "500 vues" },
      { type: "views", value: 1000,  coins: 10,  label: "1 000 vues" },
      { type: "views", value: 5000,  coins: 25,  label: "5 000 vues" },
      { type: "views", value: 10000, coins: 50,  label: "10 000 vues" },
      { type: "likes", value: 50,    coins: 2,   label: "50 likes" },
      { type: "likes", value: 200,   coins: 8,   label: "200 likes" },
      { type: "likes", value: 1000,  coins: 20,  label: "1 000 likes" },
      { type: "likes", value: 5000,  coins: 75,  label: "5 000 likes" },
      { type: "follows", value: 10,   coins: 5,   label: "10 abonnés" },
      { type: "follows", value: 50,   coins: 15,  label: "50 abonnés" },
      { type: "follows", value: 100,  coins: 30,  label: "100 abonnés" },
      { type: "follows", value: 500,  coins: 100, label: "500 abonnés" },
      { type: "follows", value: 1000, coins: 200, label: "1 000 abonnés" },
    ];

    for (const m of MILESTONES) {
      const current = m.type === "views" ? stats.totalViews : m.type === "likes" ? stats.totalLikes : stats.totalFollowers;
      if (current < m.value) continue;
      const key = `${m.type}_${m.value}`;
      try {
        await pool.query(
          "INSERT INTO clip_milestones_awarded (id, user_id, milestone_key, coins_awarded) VALUES (gen_random_uuid(),$1,$2,$3)",
          [userId, key, m.coins]
        );
        await pool.query("UPDATE users SET coins = coins + $1 WHERE id=$2", [m.coins, userId]);
        awarded.push({ key, coins: m.coins, label: m.label });
      } catch {
        // UNIQUE constraint hit = already awarded, skip
      }
    }
    return awarded;
  }
}

export const storage = new PgStorage();

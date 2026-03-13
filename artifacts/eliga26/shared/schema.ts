import { pgTable, text, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  username: text("username").notNull().unique(),
  pseudo: text("pseudo").notNull(),
  password: text("password").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isAdmin: boolean("is_admin").notNull().default(false),
  canPostClips: boolean("can_post_clips").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friends = pgTable("friends", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  friendId: text("friend_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friendGroups = pgTable("friend_groups", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friendGroupMembers = pgTable("friend_group_members", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  groupId: text("group_id").notNull().references(() => friendGroups.id),
  userId: text("user_id").notNull().references(() => users.id),
});

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  creatorId: text("creator_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  championshipType: text("championship_type").notNull(),
  playersPerPool: integer("players_per_pool"),
  numPools: integer("num_pools"),
  playerLimit: integer("player_limit"),
  visibility: text("visibility").notNull().default("public"),
  code: text("code"),
  gameType: text("game_type").notNull(),
  gameTime: integer("game_time").notNull(),
  gameForm: text("game_form").notNull(),
  extraTime: boolean("extra_time").notNull().default(false),
  penalties: boolean("penalties").notNull().default(false),
  otherRules: text("other_rules"),
  status: text("status").notNull().default("waiting"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  sponsorName: text("sponsor_name"),
  sponsorLogo: text("sponsor_logo"),
  prizeInfo: text("prize_info"),
  isElite: boolean("is_elite").notNull().default(false),
  minStars: integer("min_stars").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournamentParticipants = pgTable("tournament_participants", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  userId: text("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const tournamentMatches = pgTable("tournament_matches", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  player1Id: text("player1_id").notNull().references(() => users.id),
  player2Id: text("player2_id").notNull().references(() => users.id),
  phase: text("phase").notNull(),
  poolNumber: integer("pool_number"),
  roundNumber: integer("round_number"),
  score1: integer("score1"),
  score2: integer("score2"),
  status: text("status").notNull().default("pending"),
  scheduledAt: text("scheduled_at"),
  playedAt: timestamp("played_at"),
});

export const tournamentChats = pgTable("tournament_chats", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  senderId: text("sender_id").notNull().references(() => users.id),
  receiverId: text("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReactions = pgTable("message_reactions", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  messageId: text("message_id").notNull().references(() => messages.id),
  userId: text("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  tournamentId: text("tournament_id"),
  matchId: text("match_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournamentRewards = pgTable("tournament_rewards", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  position: integer("position").notNull(),
  badge: text("badge").notNull(),
  rewardLabel: text("reward_label").notNull(),
  participantsCount: integer("participants_count").notNull(),
  tournamentLevel: text("tournament_level").notNull(),
  tournamentName: text("tournament_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TournamentReward = typeof tournamentRewards.$inferSelect;

export const challenges = pgTable("challenges", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  challengerId: text("challenger_id").notNull().references(() => users.id),
  opponentId: text("opponent_id").references(() => users.id),
  proposedDate: text("proposed_date").notNull(),
  proposedTime: text("proposed_time").notNull(),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  coinBet: integer("coin_bet").notNull().default(0),
  teamPhotoUrl: text("team_photo_url"),
  counterDate: text("counter_date"),
  counterTime: text("counter_time"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Challenge = typeof challenges.$inferSelect;
export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true, createdAt: true, status: true });
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true, status: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, isRead: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export const marketplaceListings = pgTable("marketplace_listings", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  sellerId: text("seller_id").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  forceCollective: integer("force_collective").notNull(),
  price: integer("price").notNull(),
  paymentNumber: text("payment_number").notNull(),
  status: text("status").notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coinPurchases = pgTable("coin_purchases", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  packName: text("pack_name").notNull(),
  coinsAmount: integer("coins_amount").notNull(),
  priceFcfa: integer("price_fcfa").notNull(),
  proofUrl: text("proof_url").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CoinPurchase = typeof coinPurchases.$inferSelect;

export const dailyVisits = pgTable("daily_visits", {
  date: text("date").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
});

export const marketplaceCart = pgTable("marketplace_cart", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  listingId: text("listing_id").notNull().references(() => marketplaceListings.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({ id: true, sellerId: true, status: true, createdAt: true });
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type MarketplaceCart = typeof marketplaceCart.$inferSelect;

export const clips = pgTable("clips", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  tag: text("tag").notNull().default("technique"),
  likesCount: integer("likes_count").notNull().default(0),
  viewsCount: integer("views_count").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clipLikes = pgTable("clip_likes", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  clipId: text("clip_id").notNull().references(() => clips.id),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clipComments = pgTable("clip_comments", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  clipId: text("clip_id").notNull().references(() => clips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clipFollows = pgTable("clip_follows", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  followerId: text("follower_id").notNull().references(() => users.id),
  followingId: text("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clipMilestonesAwarded = pgTable("clip_milestones_awarded", {
  id: text("id").primaryKey().default("gen_random_uuid()"),
  userId: text("user_id").notNull().references(() => users.id),
  milestoneKey: text("milestone_key").notNull(),
  coinsAwarded: integer("coins_awarded").notNull(),
  awardedAt: timestamp("awarded_at").defaultNow(),
});

export const insertClipSchema = createInsertSchema(clips).omit({ id: true, userId: true, likesCount: true, viewsCount: true, createdAt: true });
export type InsertClip = z.infer<typeof insertClipSchema>;
export type Clip = typeof clips.$inferSelect;
export type ClipLike = typeof clipLikes.$inferSelect;
export type ClipFollow = typeof clipFollows.$inferSelect;

export type User = typeof users.$inferSelect;
export type Friend = typeof friends.$inferSelect;
export type FriendGroup = typeof friendGroups.$inferSelect;
export type FriendGroupMember = typeof friendGroupMembers.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type TournamentChat = typeof tournamentChats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type DailyVisit = typeof dailyVisits.$inferSelect;

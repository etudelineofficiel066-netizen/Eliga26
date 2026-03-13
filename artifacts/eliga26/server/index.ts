import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { Pool } from "pg";
import crypto from "crypto";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function initDb() {
  const isProduction = process.env.NODE_ENV === "production";
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });
  try {
    // 1. Session table (required by connect-pg-simple)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);

    // 2. Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        username text NOT NULL UNIQUE,
        pseudo text NOT NULL,
        password text NOT NULL,
        phone text NOT NULL,
        country text NOT NULL,
        region text NOT NULL,
        avatar_url text,
        bio text,
        is_admin boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now()
      )
    `);

    // 3. Friends
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id),
        friend_id text NOT NULL REFERENCES users(id),
        status text NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now()
      )
    `);

    // 4. Friend groups
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friend_groups (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id),
        name text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);

    // 5. Friend group members
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friend_group_members (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id text NOT NULL REFERENCES friend_groups(id),
        user_id text NOT NULL REFERENCES users(id)
      )
    `);

    // 6. Tournaments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id text NOT NULL REFERENCES users(id),
        name text NOT NULL,
        championship_type text NOT NULL,
        players_per_pool integer,
        num_pools integer,
        player_limit integer,
        visibility text NOT NULL DEFAULT 'public',
        code text,
        game_type text NOT NULL,
        game_time integer NOT NULL,
        game_form text NOT NULL,
        extra_time boolean NOT NULL DEFAULT false,
        penalties boolean NOT NULL DEFAULT false,
        other_rules text,
        status text NOT NULL DEFAULT 'waiting',
        created_at timestamp DEFAULT now()
      )
    `);

    // 7. Tournament participants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournament_participants (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id text NOT NULL REFERENCES tournaments(id),
        user_id text NOT NULL REFERENCES users(id),
        joined_at timestamp DEFAULT now()
      )
    `);

    // 8. Tournament matches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournament_matches (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id text NOT NULL REFERENCES tournaments(id),
        player1_id text NOT NULL REFERENCES users(id),
        player2_id text NOT NULL REFERENCES users(id),
        phase text NOT NULL,
        pool_number integer,
        score1 integer,
        score2 integer,
        status text NOT NULL DEFAULT 'pending',
        played_at timestamp
      )
    `);

    // 9. Tournament chats
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournament_chats (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id text NOT NULL REFERENCES tournaments(id),
        user_id text NOT NULL REFERENCES users(id),
        content text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);

    // 10. Messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id text NOT NULL REFERENCES users(id),
        receiver_id text NOT NULL REFERENCES users(id),
        content text NOT NULL,
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now()
      )
    `);

    // 11. Message reactions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users(id),
        emoji text NOT NULL,
        created_at timestamp DEFAULT now(),
        UNIQUE(message_id, user_id, emoji)
      )
    `);

    // 12. Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id),
        content text NOT NULL,
        is_read boolean NOT NULL DEFAULT false,
        tournament_id text,
        match_id text,
        created_at timestamp DEFAULT now()
      )
    `);

    // 13. Marketplace listings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id text NOT NULL REFERENCES users(id),
        photo_url text NOT NULL,
        force_collective integer NOT NULL,
        price integer NOT NULL,
        payment_number text NOT NULL,
        status text NOT NULL DEFAULT 'available',
        created_at timestamp DEFAULT now()
      )
    `);

    // 14. Marketplace cart
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_cart (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id),
        listing_id text NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now(),
        UNIQUE(user_id, listing_id)
      )
    `);

    // 15. Daily visits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_visits (
        date text NOT NULL,
        user_id text NOT NULL REFERENCES users(id),
        PRIMARY KEY (date, user_id)
      )
    `);

    // 16. Push subscriptions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint text NOT NULL UNIQUE,
        p256dh text NOT NULL,
        auth text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);

    // Migrations: add score proposal columns if missing
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proposed_score1 integer`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proposed_score2 integer`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proposed_by text`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proof_url text`);

    // Migrations: add date/schedule columns
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS start_date text`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS end_date text`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS scheduled_at text`);

    // Migrations: sponsored & elite tournament columns
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_name text`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_logo text`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_info text`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_elite boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_stars integer NOT NULL DEFAULT 0`);

    // Migrations: paid (cotisation) tournament columns
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee integer NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_payment_number text`);

    // Migrations: payment proof on participants
    await pool.query(`ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS payment_proof text`);
    await pool.query(`ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'free'`);

    // Migrations: score correction count (max 2 corrections per match)
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS correction_count integer NOT NULL DEFAULT 0`);

    // Migrations: match notification flags
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_15m boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_5m boolean NOT NULL DEFAULT false`);

    // Migrations: match date/time proposal columns (organizer sets date, players set their preferred time)
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS match_date text`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proposed_time_p1 text`);
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS proposed_time_p2 text`);

    // Migrations: knockout round number for multi-round advancement (Quarts → Demi-finales → Finale)
    await pool.query(`ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS round_number integer`);

    // Migrations: tournament rewards
    await pool.query(`CREATE TABLE IF NOT EXISTS tournament_rewards (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL REFERENCES users(id),
      tournament_id text NOT NULL REFERENCES tournaments(id),
      position integer NOT NULL,
      badge text NOT NULL,
      reward_label text NOT NULL,
      participants_count integer NOT NULL,
      tournament_level text NOT NULL,
      tournament_name text NOT NULL,
      created_at timestamp DEFAULT NOW() NOT NULL
    )`);

    // Migrations: virtual coins + bonus stars + account blocking
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_stars integer NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason text`);

    // Elite prize amount: fixed winner reward for elite tournaments
    await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS elite_prize_amount integer`);

    // App settings table (key-value store for admin-controlled settings)
    await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamp DEFAULT NOW() NOT NULL
    )`);

    // Initialize default coin pack prices if not set
    await pool.query(`INSERT INTO app_settings (key, value) VALUES
      ('coin_pack_starter_price', '150'),
      ('coin_pack_champion_price', '600'),
      ('coin_pack_elite_price', '900'),
      ('coin_pack_starter_promo', ''),
      ('coin_pack_champion_promo', ''),
      ('coin_pack_elite_promo', ''),
      ('clips_publishing_enabled', 'true')
    ON CONFLICT (key) DO NOTHING`);

    // Prize distributions table (financial prizes for paid tournaments)
    await pool.query(`CREATE TABLE IF NOT EXISTS prize_distributions (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tournament_id text NOT NULL REFERENCES tournaments(id),
      user_id text,
      role text NOT NULL,
      amount_fcfa integer NOT NULL,
      total_pool integer NOT NULL,
      created_at timestamp DEFAULT NOW() NOT NULL
    )`);

    // Coin purchases table
    await pool.query(`CREATE TABLE IF NOT EXISTS coin_purchases (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id text NOT NULL REFERENCES users(id),
      pack_name text NOT NULL,
      coins_amount integer NOT NULL,
      price_fcfa integer NOT NULL,
      proof_url text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamp DEFAULT NOW() NOT NULL
    )`);

    // Clips (eLIGA Clips — short video feed)
    await pool.query(`CREATE TABLE IF NOT EXISTS clips (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id),
      title text NOT NULL,
      description text,
      video_url text NOT NULL,
      thumbnail_url text,
      tag text NOT NULL DEFAULT 'technique',
      likes_count integer NOT NULL DEFAULT 0,
      views_count integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS clip_likes (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_id text NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS clip_likes_unique ON clip_likes(clip_id, user_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS clip_follows (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now()
    )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS clip_follows_unique ON clip_follows(follower_id, following_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS clip_milestones_awarded (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      milestone_key text NOT NULL,
      coins_awarded integer NOT NULL,
      awarded_at timestamp DEFAULT now(),
      UNIQUE(user_id, milestone_key)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS clip_comments (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_id text NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text text NOT NULL,
      created_at timestamp DEFAULT now()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS clip_comments_clip_idx ON clip_comments(clip_id)`);

    // Add new columns via ALTER TABLE (idempotent - safe to run every start)
    await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_clips boolean NOT NULL DEFAULT true`);

    // Migration: rendre tournament_id nullable dans tournament_rewards pour conserver les récompenses après suppression d'un tournoi
    await pool.query(`ALTER TABLE tournament_rewards ALTER COLUMN tournament_id DROP NOT NULL`);
    // Supprimer l'ancienne contrainte FK et en ajouter une nouvelle avec ON DELETE SET NULL
    await pool.query(`
      DO $$
      BEGIN
        -- Supprimer l'ancienne contrainte si elle existe (sans ON DELETE SET NULL)
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='tournament_rewards' AND constraint_type='FOREIGN KEY'
          AND constraint_name='tournament_rewards_tournament_id_fkey'
        ) THEN
          ALTER TABLE tournament_rewards DROP CONSTRAINT tournament_rewards_tournament_id_fkey;
        END IF;
        -- Ajouter la nouvelle contrainte avec ON DELETE SET NULL
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='tournament_rewards' AND constraint_type='FOREIGN KEY'
          AND constraint_name='tournament_rewards_tournament_id_fkey_setnull'
        ) THEN
          ALTER TABLE tournament_rewards ADD CONSTRAINT tournament_rewards_tournament_id_fkey_setnull
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    // Seed admin account
    const ADMIN_AVATAR = "/eliga-admin-avatar.png";
    const adminCheck = await pool.query("SELECT id FROM users WHERE username=$1", ["Maodoka65"]);
    if (adminCheck.rows.length === 0) {
      const { randomUUID } = await import("crypto");
      const id = randomUUID();
      const passwordHash = crypto.createHash("sha256").update("782662435" + "eliga_salt").digest("hex");
      await pool.query(
        `INSERT INTO users (id, username, pseudo, password, phone, country, region, is_admin, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)`,
        [id, "Maodoka65", "Admin eLIGA", passwordHash, "0000000000", "Admin", "Admin", ADMIN_AVATAR]
      );
      console.log("[init] Admin account created");
    } else {
      await pool.query(
        "UPDATE users SET is_admin=true, avatar_url=$1, pseudo='Admin eLIGA' WHERE username=$2",
        [ADMIN_AVATAR, "Maodoka65"]
      );
    }

    console.log("[init] Database initialized successfully");
  } catch (err) {
    console.error("[init] Database init error:", err);
  } finally {
    await pool.end();
  }
}

(async () => {
  await initDb();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

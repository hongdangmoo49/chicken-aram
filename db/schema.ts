import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nickname: text("nickname").notNull().unique(),
  tier: integer("tier").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
});

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scheduledAt: text("scheduled_at").notNull(),
  map: text("map").notNull(),
  status: text("status", { enum: ["scheduled", "completed"] }).notNull(),
  teamRed: text("team_red").notNull(),
  teamBlue: text("team_blue").notNull(),
  redScore: integer("red_score"),
  blueScore: integer("blue_score"),
  mvp: text("mvp"),
  createdBy: text("created_by").notNull(),
});

export const playerProfiles = sqliteTable("player_profiles", {
  playerId: integer("player_id").primaryKey().references(() => players.id),
  email: text("email").notNull().unique(),
  thumbnailKey: text("thumbnail_key"),
});

export const matchPlayers = sqliteTable("match_players", {
  matchId: integer("match_id").notNull().references(() => matches.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  team: text("team", { enum: ["A", "B"] }).notNull(),
  separatedGroup: integer("separated_group"),
}, (table) => [primaryKey({ columns: [table.matchId, table.playerId] })]);

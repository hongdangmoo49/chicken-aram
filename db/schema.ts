import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

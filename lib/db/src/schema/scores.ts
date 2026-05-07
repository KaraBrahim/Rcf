import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scoresTable = pgTable("scores", {
  id: serial("id").primaryKey(),
  nickname: text("nickname").notNull(),
  score: integer("score").notNull(),
  round: integer("round").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScoreSchema = createInsertSchema(scoresTable).omit({ id: true, createdAt: true });
export const selectScoreSchema = createSelectSchema(scoresTable);

export type InsertScore = z.infer<typeof insertScoreSchema>;
export type Score = typeof scoresTable.$inferSelect;

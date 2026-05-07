import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { scoresTable, insertScoreSchema } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/scores", async (req, res) => {
  const limitParam = parseInt(String(req.query["limit"] ?? "10"), 10);
  const limit = isNaN(limitParam) || limitParam < 1 ? 10 : Math.min(limitParam, 100);
  const rows = await db
    .select()
    .from(scoresTable)
    .orderBy(desc(scoresTable.score))
    .limit(limit);
  res.json(rows);
});

router.post("/scores", async (req, res) => {
  const parsed = insertScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [inserted] = await db.insert(scoresTable).values(parsed.data).returning();
  res.status(201).json(inserted);
});

export default router;

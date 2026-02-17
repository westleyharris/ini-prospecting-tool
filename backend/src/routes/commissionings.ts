import { Router } from "express";
import { db } from "../db.js";

export const commissioningsRouter = Router();

commissioningsRouter.get("/", (req, res) => {
  try {
    const plantId = req.query.plant_id as string | undefined;
    let sql = `SELECT c.*, p.pr_number, p.plant_id, p.status as project_status, pl.name as plant_name
               FROM commissionings c
               JOIN projects p ON c.project_id = p.id
               LEFT JOIN plants pl ON p.plant_id = pl.id
               WHERE 1=1`;
    const params: string[] = [];

    if (plantId) {
      sql += " AND p.plant_id = ?";
      params.push(plantId);
    }

    sql += " ORDER BY c.created_at DESC";
    const commissionings =
      params.length > 0
        ? db.prepare(sql).all(...params)
        : db.prepare(sql).all();
    res.json(commissionings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch commissionings" });
  }
});

import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import MatchController from "../controllers/match.controller";
import { listMatchesValidator } from "../validators";

const router = Router();
const controller: MatchController = container.resolve(MatchController);

// GET /matches
router.get(
  "match/get-all-matches",
  listMatchesValidator(),
  validateRequest,
  async (req: Request, res: Response) => controller.getAll(req, res)
);

// GET /get-match/:match_key
router.get("match/get-match/:match_key", async (req: Request, res: Response) =>
  controller.getById(req, res)
);

export default router;

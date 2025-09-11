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
  "/matches",
  listMatchesValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.getAllMatches(req, res);
    return result;
  }
);

export default router;

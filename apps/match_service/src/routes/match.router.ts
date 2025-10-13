import { validateRequest } from "@repo/common";
import { Request, Response, Router } from "express";
import "reflect-metadata";
import { container } from "tsyringe";
import zlib from "zlib";
import MatchController from "../controllers/match.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { listMatchesValidator } from "../validators";

const router = Router();
const controller: MatchController = container.resolve(MatchController);

// GET /matches
router.get(
  "/matches",
  requireAuth,
  listMatchesValidator(),
  validateRequest,
  async (req: Request, res: Response) => {
    return controller.getAllMatches(req, res);
  }
);

// PATCH /matches/:id
router.patch(
  "/matches/:id",
  validateRequest,
  async (req: Request, res: Response) => {
    const result = await controller.updateMatch(req, res);
    return result;
  }
);

// POST /livematch webhook
router.post("/matches/livematch", async (req: Request, res: Response) => {
  let chunks: any = [];

  // Collect raw binary data
  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const buffer = Buffer.concat(chunks);

    // Decompress gzip data
    zlib.gunzip(buffer, (err, decoded) => {
      if (err) {
        console.error("Error decompressing gzip:", err);
        return res.status(400).send("Invalid gzip data");
      }

      try {
        const jsonStr = decoded.toString("utf8");
        const data = JSON.parse(jsonStr);

        console.log("Received");
        console.log(data);
        console.log("____");

        res.send(`Hello, World!`);
      } catch (parseErr) {
        console.error("Error parsing JSON:", parseErr);
        res.status(400).send("Invalid JSON");
      }
    });
  });
});

router.post("/matches/subscribe/:id", async (req: Request, res: Response) => {
  const result = await controller.subscribeMatch(req, res);
  return result;
});

router.post("/matches/unsubscribe/:id", async (req: Request, res: Response) => {
  const result = await controller.unsubscribeMatch(req, res);
  return result;
});

export default router;

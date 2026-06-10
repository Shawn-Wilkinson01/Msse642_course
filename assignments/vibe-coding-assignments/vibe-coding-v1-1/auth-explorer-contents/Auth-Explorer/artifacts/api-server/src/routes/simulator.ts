import { Router, type IRouter } from "express";
import { simulatorDb } from "../lib/simulator-db";
import {
  VulnerableLoginBody,
  SecureLoginBody,
  VulnerableLoginResponse,
  SecureLoginResponse,
  GetSimulatorUsersResponse,
  GetSimulatorLogsResponse,
  ResetSimulatorResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/simulator/login/vulnerable", async (req, res): Promise<void> => {
  const parsed = VulnerableLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const result = simulatorDb.vulnerableLogin(username, password);

  res.json(
    VulnerableLoginResponse.parse({
      ...result,
      endpoint: "vulnerable",
      rateLimited: null,
      attemptsRemaining: null,
    })
  );
});

router.post("/simulator/login/secure", async (req, res): Promise<void> => {
  const parsed = SecureLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const result = simulatorDb.secureLogin(ip, username, password);

  const statusCode = result.rateLimited ? 429 : 200;
  res
    .status(statusCode)
    .json(SecureLoginResponse.parse({ ...result, endpoint: "secure" }));
});

router.get("/simulator/users", async (_req, res): Promise<void> => {
  const users = simulatorDb.getUsers();
  res.json(GetSimulatorUsersResponse.parse(users));
});

router.get("/simulator/logs", async (_req, res): Promise<void> => {
  const logs = simulatorDb.getLogs();
  res.json(GetSimulatorLogsResponse.parse(logs));
});

router.post("/simulator/reset", async (_req, res): Promise<void> => {
  simulatorDb.reset();
  res.json(ResetSimulatorResponse.parse({ success: true, message: "Simulator reset: logs cleared, rate limits reset" }));
});

export default router;

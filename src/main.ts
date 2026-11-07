import { bootstrapDB } from "./DB/connection.db";
import { ORIGINS, PORT, RATE_LIMIT_MAX } from "./config";
import { globalErrorHandling, notFoundHandling, rateLimit, securityHeaders } from "./middleware";
import express from "express";
import { authenticationController, userController } from "./modules";
import cors from 'cors'
const app: express.Application = express();

app.use(securityHeaders, cors(ORIGINS.length ? { origin: ORIGINS } : {}), express.json());
app.use("/assets", express.static("./assets"));

app.all(
  "/",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<express.Response> => {
    return res.status(200).json({ message: "done request" });
  },
);
// auth endpoints are the ones worth brute-forcing, so they get a tighter limit
app.use("/auth", rateLimit({ max: RATE_LIMIT_MAX }), authenticationController);
app.use("/user", userController);

app.use(notFoundHandling);
app.use(globalErrorHandling);

bootstrapDB(app, PORT);

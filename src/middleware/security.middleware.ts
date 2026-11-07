import { NextFunction, Request, Response } from "express";
import { TooManyRequestException } from "./../Common/exception/domain.exception";

// basic security headers (the useful subset of what helmet sets)
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
};

// fixed-window limiter per ip, kept in memory (no extra package needed)
export const rateLimit = ({ windowMs = 60_000, max = 100 }: { windowMs?: number; max?: number } = {}) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip ?? "unknown";
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      throw new TooManyRequestException("too many requests, try again later");
    }
    next();
  };
};

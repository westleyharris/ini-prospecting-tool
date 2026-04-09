import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { v4 as uuidv4 } from "uuid";

export const authRouter = Router();

const ALLOWED_DOMAINS = ["ini-automation.com", "ime-us.com", "integratec.hn"];
const COOKIE_NAME = "ini_session";
const SALT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return secret;
}

function issueToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getJwtSecret(), { expiresIn: "30d" });
}

function setCookie(res: import("express").Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  });
}

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const emailLower = email.trim().toLowerCase();
    const domain = emailLower.split("@")[1];

    if (!ALLOWED_DOMAINS.includes(domain)) {
      return res.status(403).json({
        error: `Registration is restricted to @ini-automation.com, @ime-us.com, and @integratec.hn email addresses.`,
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(emailLower);

    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = uuidv4();

    db.prepare(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)"
    ).run(id, emailLower, passwordHash);

    const token = issueToken(id, emailLower);
    setCookie(res, token);

    return res.status(201).json({ id, email: emailLower });
  } catch (err) {
    console.error("[auth/register]", err);
    return res.status(500).json({ error: "Registration failed." });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const emailLower = email.trim().toLowerCase();

    const user = db
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(emailLower) as { id: string; email: string; password_hash: string } | undefined;

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = issueToken(user.id, user.email);
    setCookie(res, token);

    return res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("[auth/login]", err);
    return res.status(500).json({ error: "Login failed." });
  }
});

// POST /api/auth/logout
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

// GET /api/auth/me
authRouter.get("/me", (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Not authenticated." });

    const payload = jwt.verify(token, getJwtSecret()) as { sub: string; email: string };
    return res.json({ id: payload.sub, email: payload.email });
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
});

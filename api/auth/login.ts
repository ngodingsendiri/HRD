import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db.js";
import { createSession } from "../_lib/session.js";

/**
 * POST /api/auth/login
 * Body: { "email": string, "password": string }
 *
 * Verifies credentials against the `users` table (bcrypt-hashed passwords) and
 * creates a DB-backed session. Returns the public user object and sets the
 * session cookie (httpOnly) automatically.
 *
 * Responses:
 *   200 { user: { id, email, name, image } }
 *   400 { error: "Email dan password wajib diisi" }
 *   401 { error: "Email atau password salah" }
 *   500 { error: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Use a dummy hash compare to keep timing roughly constant when the user
    // does not exist, so attackers cannot enumerate accounts via timing.
    const dummyHash = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.5gQJ0m3Nk2oQ8q5r6o1m2n3o4p5q";
    const passwordHash = user?.password ?? dummyHash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !user.password || !isValid) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    await createSession(res, user.id);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
}

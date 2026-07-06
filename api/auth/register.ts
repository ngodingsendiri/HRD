import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../src/lib/db";
import bcrypt from "bcryptjs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    return res.status(200).json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error: any) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

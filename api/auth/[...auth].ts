import type { VercelRequest, VercelResponse } from "@vercel/node";

let authConfigModule: any = null;
let initError: any = null;

/**
 * Auth.js catch-all route handler for Vercel Node.js serverless.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!authConfigModule && !initError) {
    try {
      authConfigModule = await import("../_lib/auth-config.js");
    } catch (e: any) {
      initError = e;
    }
  }

  if (initError) {
    return res.status(500).json({ 
      error: "Module Init Error", 
      message: initError.message, 
      stack: initError.stack 
    });
  }

  if (req.method === "GET") {
    return authConfigModule.authGet(req, res);
  }
  if (req.method === "POST") {
    return authConfigModule.authPost(req, res);
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}

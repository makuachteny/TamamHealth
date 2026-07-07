import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const CONTACT_TO = "support.tamam@gmail.com";

// Naive per-IP throttle; state resets on container restart, which is fine
// for a marketing-site contact form.
const lastSentByIp = new Map<string, number>();
const MIN_INTERVAL_MS = 30_000;

export async function POST(req: Request) {
  const user = process.env.CONTACT_EMAIL_USER;
  const pass = process.env.CONTACT_EMAIL_PASS;
  if (!user || !pass) {
    return NextResponse.json(
      { error: "Email sending is not configured on the server." },
      { status: 503 }
    );
  }

  let body: { name?: string; email?: string; facility?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim().slice(0, 200);
  const email = (body.email ?? "").toString().trim().slice(0, 200);
  const facility = (body.facility ?? "").toString().trim().slice(0, 200);
  const message = (body.message ?? "").toString().trim().slice(0, 5000);

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const last = lastSentByIp.get(ip);
  if (last && Date.now() - last < MIN_INTERVAL_MS) {
    return NextResponse.json(
      { error: "Please wait a moment before sending another message." },
      { status: 429 }
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"TamamHealth Website" <${user}>`,
      to: CONTACT_TO,
      replyTo: email || undefined,
      subject: `TamamHealth — Get involved${facility ? ` (${facility})` : ""}`,
      text: `${message}\n\n— ${name || "Anonymous"}${email ? ` · ${email}` : ""}`,
    });
  } catch (err) {
    console.error("contact form send failed:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please email us directly." },
      { status: 502 }
    );
  }

  lastSentByIp.set(ip, Date.now());
  return NextResponse.json({ ok: true });
}

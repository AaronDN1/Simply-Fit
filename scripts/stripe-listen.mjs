import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.log("listen-missing-key");
  process.exit(1);
}

const events = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
].join(",");

const child = spawn(
  "npx",
  ["--yes", "@stripe/cli", "listen", "--forward-to", "http://127.0.0.1:3000/api/billing/webhook", "--events", events],
  {
    shell: true,
    windowsHide: true,
    env: { ...process.env, STRIPE_API_KEY: key },
  }
);

let saved = false;
let announced = false;
let buffer = "";

function accept(chunk) {
  buffer += chunk.toString();
  if (buffer.length > 8000) buffer = buffer.slice(-4000);
  const secret = buffer.match(/whsec_[A-Za-z0-9]+/);
  if (secret && !saved) {
    saved = true;
    const path = ".env.local";
    const env = readFileSync(path, "utf8");
    const line = `STRIPE_WEBHOOK_SECRET_LOCAL=${secret[0]}`;
    const next = /STRIPE_WEBHOOK_SECRET_LOCAL=/.test(env)
      ? env.replace(/STRIPE_WEBHOOK_SECRET_LOCAL=.*/g, line)
      : `${env.trimEnd()}\n${line}\n`;
    writeFileSync(path, next);
    console.log("listen-secret-saved");
  }
  if (!announced && buffer.includes("Ready!")) {
    announced = true;
    console.log("listen-ready");
  }
}

child.stdout.on("data", accept);
child.stderr.on("data", accept);
child.on("exit", (code) => {
  console.log(`listen-exit ${code ?? 1}`);
  process.exit(code ?? 1);
});

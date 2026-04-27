// Provision a bcrypt-hashed password for a single `team_members` row.
//
// Usage (preferred — no plaintext on the command line):
//
//   ALAMUT_USER_EMAIL=alice@alamut-im.com \
//   ALAMUT_USER_PASSWORD='<the password>' \
//   SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   npx tsx script/setTeamMemberPassword.ts
//
// In dry-run / SQL-print mode (no Supabase env vars), the script writes the
// UPDATE statement to stdout so it can be pasted into the Supabase SQL
// editor by an operator. The bcrypt hash is the only material persisted —
// the plaintext password is never logged, never committed, and never
// printed back to the terminal.
//
// Email shorthand: an input of `alice@alamut-im` (or just `alice`) is
// expanded to `alice@alamut-im.com`, mirroring the login form's
// normalisation so the row written here always matches what the user
// types at sign-in.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const ALAMUT_DOMAIN = "alamut-im.com";

function normaliseEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return trimmed;
  if (!trimmed.includes("@")) return `${trimmed}@${ALAMUT_DOMAIN}`;
  const [local, host] = trimmed.split("@");
  if (host === "alamut-im") return `${local}@${ALAMUT_DOMAIN}`;
  return trimmed;
}

async function main() {
  const rawEmail = process.env.ALAMUT_USER_EMAIL ?? process.argv[2] ?? "";
  const password = process.env.ALAMUT_USER_PASSWORD ?? "";

  if (!rawEmail) {
    console.error(
      "Missing email. Set ALAMUT_USER_EMAIL=<address> (or pass the email as the first argv).",
    );
    process.exit(2);
  }
  if (!password) {
    console.error(
      "Missing password. Set ALAMUT_USER_PASSWORD='<password>' (env-only — never pass it as argv).",
    );
    process.exit(2);
  }
  if (password.length < 8) {
    console.error("Refusing to hash a password shorter than 8 characters.");
    process.exit(2);
  }

  const email = normaliseEmail(rawEmail);
  const hash = bcrypt.hashSync(password, 12);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // SQL-print mode. Operator pastes this into the Supabase SQL editor.
    console.log(`-- target email: ${email}`);
    console.log(`-- bcrypt hash generated locally; plaintext is not logged.`);
    console.log(
      `update public.team_members set password_hash = '${hash}' where lower(email) = '${email}';`,
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from("team_members")
    .update({ password_hash: hash })
    .ilike("email", email)
    .select("id, email, role")
    .maybeSingle();

  if (error) {
    console.error(`Supabase update failed: ${error.message}`);
    process.exit(1);
  }
  if (!data) {
    console.error(
      `No team_members row matched email=${email}. Insert the row first, then re-run this script.`,
    );
    process.exit(1);
  }

  console.log(
    `Updated password_hash for id=${data.id} email=${data.email} role=${data.role}.`,
  );
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

/**
 * Erzeugt den bcrypt-Hash für den Notfall-Login.
 *   npm run hash-password            → fragt das Passwort ab (unsichtbar)
 *   npm run hash-password -- "pw"    → nimmt das Argument
 * Den ausgegebenen Hash als EMERGENCY_PASSWORD_HASH auf Vercel eintragen.
 */
import bcrypt from "bcryptjs";
import { stdin, stdout } from "node:process";

async function readHidden(prompt: string): Promise<string> {
  stdout.write(prompt);
  return new Promise((resolve) => {
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const password = process.argv[2] ?? (await readHidden("Notfall-Passwort: "));
  if (password.length < 12) {
    console.error("Bitte mindestens 12 Zeichen verwenden.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log("\nEMERGENCY_PASSWORD_HASH (auf Vercel genau so eintragen):\n");
  console.log(hash);
  console.log("\nIn einer lokalen .env-Datei jedes $ als \\$ schreiben:\n");
  console.log(hash.replace(/\$/g, "\\$"));
}

void main();

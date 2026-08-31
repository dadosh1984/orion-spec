import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";

const MAGIC = "SAFEENV1";
const ITERATIONS = 210_000;
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 32;

function resolveInsideCwd(input: string): string {
  const cwd = resolve(process.cwd());
  const target = resolve(cwd, input);
  if (target !== cwd && !target.startsWith(cwd + sep)) {
    throw new Error("Path outside current working directory");
  }
  return target;
}

function password(): string {
  const p = process.env.SAFE_ENV_KEY?.trim();
  if (!p) throw new Error("SAFE_ENV_KEY missing");
  return p;
}

function deriveKey(pass: string, salt: Buffer): Buffer {
  return pbkdf2Sync(pass, salt, ITERATIONS, KEY_LEN, "sha256");
}

function encrypt(text: string, pass: string): string {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(pass, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    MAGIC,
    salt.toString("hex"),
    iv.toString("hex"),
    tag.toString("hex"),
    ciphertext.toString("base64"),
  ].join("\n");
}

function decrypt(payload: string, pass: string): string {
  const [magic, saltHex, ivHex, tagHex, data] = payload.split("\n");
  if (magic !== MAGIC || !saltHex || !ivHex || !tagHex || !data)
    throw new Error("bad");
  const key = deriveKey(pass, Buffer.from(saltHex, "hex"));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("bad");
  }
}

function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function parseLines(text: string): string[] {
  return text ? text.split(/\r?\n/) : [];
}

export function main(argv: string[]): number {
  try {
    const [cmd, fileArg = ".env", ...rest] = argv;
    const pass = password();
    const src = resolveInsideCwd(fileArg);
    const enc = resolveInsideCwd(
      fileArg.endsWith(".enc") ? fileArg : `${fileArg}.enc`,
    );

    if (cmd === "encrypt") {
      writeFileSync(enc, encrypt(readText(src), pass), "utf8");
      return 0;
    }

    if (cmd === "decrypt") {
      const output = fileArg.endsWith(".enc") ? src.slice(0, -4) : src;
      writeFileSync(output, decrypt(readText(enc), pass), "utf8");
      return 0;
    }

    if (cmd === "add") {
      const key = fileArg;
      const value = rest.join(" ");
      if (!key) throw new Error("missing key");
      const current = decrypt(readText(enc), pass);
      const next = parseLines(current).filter(
        (line) => !line.startsWith(`${key}=`),
      );
      next.push(`${key}=${value}`);
      writeFileSync(enc, encrypt(next.join("\n"), pass), "utf8");
      return 0;
    }

    if (cmd === "list") {
      const current = decrypt(readText(enc), pass);
      for (const line of parseLines(current)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("="))
          continue;
        console.log(trimmed.slice(0, trimmed.indexOf("=")));
      }
      return 0;
    }

    console.error("Usage: safe-env <encrypt|decrypt|add|list>");
    return 1;
  } catch {
    console.error("Неверный мастер-пароль или поврежденный файл");
    return 1;
  }
}

export const safeEnvHandler = async (args: string[]) => main(args);

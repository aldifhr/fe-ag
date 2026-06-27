const COOKIE_NAME = "site_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export { COOKIE_NAME, COOKIE_MAX_AGE };

export async function computeAuthHash(
  password: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(password)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAuthHash(
  password: string,
  secret: string,
  hash: string
): Promise<boolean> {
  const computed = await computeAuthHash(password, secret);
  return computed === hash;
}

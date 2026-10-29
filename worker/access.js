let jwksCache = { at: 0, keys: null };

function rejectAccess(reason) {
  console.warn("Cloudflare Access rechazó la solicitud:", reason);
  return null;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getKeys(teamDomain) {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("No se pudieron obtener las llaves de Cloudflare Access");
  const { keys } = await response.json();
  jwksCache = { at: Date.now(), keys };
  return keys;
}

export async function verifyAccess(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return rejectAccess("JWT ausente en la solicitud");
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) {
    return rejectAccess("Falta configuración de Access en el Worker");
  }

  const parts = token.split(".");
  if (parts.length !== 3) return rejectAccess("JWT con formato inválido");

  try {
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
      return rejectAccess("Algoritmo o identificador de llave inválido");
    }

    const jwk = (await getKeys(env.ACCESS_TEAM_DOMAIN)).find((key) => key.kid === header.kid);
    if (!jwk) return rejectAccess("La llave del JWT no está en las llaves JWKS de este Team domain");

    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return rejectAccess("La firma del JWT no es válida");

    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(env.ACCESS_AUD)) return rejectAccess("AUD no coincide");
    if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return rejectAccess("Issuer no coincide");
    if (!Number.isFinite(payload.exp) || payload.exp < now) return rejectAccess("JWT vencido o sin exp válido");
    if (payload.nbf && payload.nbf > now) return rejectAccess("JWT aún no es válido (nbf)");

    const allowedEmails = env.ADMIN_EMAILS.split(",")
      .map((email) => email.trim().toLowerCase()).filter(Boolean);
    const email = String(payload.email || "").toLowerCase();
    if (!email) return rejectAccess("JWT no contiene correo");
    if (!allowedEmails.includes(email)) return rejectAccess("Correo del JWT no está en ADMIN_EMAILS");
    return { email };
  } catch (error) {
    console.error("No se pudo verificar el JWT de Cloudflare Access:", error);
    return null;
  }
}

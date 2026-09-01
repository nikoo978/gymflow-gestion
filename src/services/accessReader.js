import { supabase } from "./supabase";

const credentialKey = "gymflow-reader-credential-v1";

const randomBytes = (length = 32) => crypto.getRandomValues(new Uint8Array(length));
const toBase64Url = (value) => btoa(String.fromCharCode(...new Uint8Array(value)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};

export const readerChannelName = (userId) => `gymflow-reader-${userId}`;

export function createReaderChannel(userId) {
  if (!supabase || !userId) return null;
  return supabase.channel(readerChannelName(userId), {
    config: { broadcast: { self: false, ack: true } },
  });
}

export function hasReaderCredential() {
  try { return Boolean(localStorage.getItem(credentialKey)); } catch { return false; }
}

export async function platformBiometricsAvailable() {
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false;
}

export async function enrollReaderBiometrics(user) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(),
      rp: { name: "GymFlow" },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.email || "lector@gymflow.local",
        displayName: "Lector biométrico GymFlow",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!credential) throw new Error("No se creó la credencial biométrica.");
  localStorage.setItem(credentialKey, toBase64Url(credential.rawId));
  return true;
}

export async function verifyReaderBiometrics() {
  const stored = localStorage.getItem(credentialKey);
  if (!stored) throw new Error("Primero configurá la huella en este dispositivo.");
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(),
      allowCredentials: [{ type: "public-key", id: fromBase64Url(stored), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) throw new Error("La huella no pudo validarse.");
  return true;
}


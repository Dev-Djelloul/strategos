/** Envoi de notifications Web Push, sans dépendance externe (l'API `web-push`
 * npm classique repose sur le module `crypto` de Node, incompatible avec le
 * runtime Workers ; tout ici passe par WebCrypto, disponible nativement).
 *
 * Implémente :
 *  - la signature VAPID (RFC 8292) : un JWT ES256 prouvant l'identité du
 *    serveur auprès du service de push (FCM, Mozilla autopush...) ;
 *  - le chiffrement du message (RFC 8291, content-encoding aes128gcm/RFC 8188)
 *    avec la clé publique et le secret d'authentification de l'abonnement.
 */

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const b64urlEncode = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const b64urlDecode = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "="));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const textToBytes = (s: string): Uint8Array => new TextEncoder().encode(s);

/** JWT ES256 signé avec la clé privée VAPID (PKCS8, importée à chaque appel :
 * pas de cache d'isolate à invalider si la clé change). */
export async function buildVapidJwt(privateKeyPkcs8B64url: string, audience: string, subjectMailto: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64urlDecode(privateKeyPkcs8B64url),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subjectMailto };
  const signingInput = `${b64urlEncode(textToBytes(JSON.stringify(header)))}.${b64urlEncode(textToBytes(JSON.stringify(payload)))}`;
  // WebCrypto rend la signature ECDSA au format IEEE P1363 (r || s concaténés),
  // exactement le format attendu par un JWS ES256 — pas de ré-encodage DER nécessaire.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, textToBytes(signingInput));
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Chiffre `payload` pour une souscription donnée (RFC 8291). Renvoie le
 * corps binaire prêt à poster (en-tête aes128gcm + texte chiffré). */
export async function encryptPayload(sub: PushSubscription, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublicRaw = b64urlDecode(sub.keys.p256dh); // 65 octets, point non compressé
  const authSecret = b64urlDecode(sub.keys.auth); // 16 octets

  const uaPublicKey = await crypto.subtle.importKey("raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ephemeral = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublicRaw = new Uint8Array((await crypto.subtle.exportKey("raw", ephemeral.publicKey)) as ArrayBuffer);

  // @cloudflare/workers-types nomme ce champ "$public" (mot réservé dans leur
  // générateur de types), mais le runtime workerd suit le standard WebCrypto
  // ("public") — confirmé par le test de bout en bout qui déchiffre avec le
  // vrai crypto Node. On passe par `any` pour ne pas trahir le nom réel.
  const deriveAlgo = { name: "ECDH", public: uaPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(deriveAlgo, ephemeral.privateKey, 256));

  const hkdf = async (ikmBytes: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> => {
    const key = await crypto.subtle.importKey("raw", ikmBytes, "HKDF", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
    return new Uint8Array(bits);
  };

  // "PRK combiné" : dérive l'IKM final à partir du secret ECDH et du secret
  // d'authentification de l'abonné (empêche un tiers qui aurait le secret ECDH
  // seul de forger des messages).
  const keyInfo = new Uint8Array([...textToBytes("WebPush: info\0"), ...uaPublicRaw, ...asPublicRaw]);
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, textToBytes("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, textToBytes("Content-Encoding: nonce\0"), 12);

  // Délimiteur de fin d'enregistrement (RFC 8188, un seul enregistrement ici).
  const padded = new Uint8Array([...payload, 0x02]);
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded));

  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + asPublicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = asPublicRaw.length;
  header.set(asPublicRaw, 21);

  return new Uint8Array([...header, ...ciphertext]);
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** true si l'abonné a révoqué la permission ou n'existe plus (410/404) :
   * l'appelant doit alors supprimer la souscription enregistrée. */
  gone: boolean;
  detail?: string;
}

/** Envoie une notification à une souscription. `vapidSubject` doit être un
 * "mailto:" ou une URL https identifiant l'opérateur (exigé par les services
 * de push pour pouvoir contacter le responsable en cas d'abus). */
export async function sendWebPush(
  sub: PushSubscription,
  payloadObj: unknown,
  vapidPublicKeyB64url: string,
  vapidPrivateKeyPkcs8B64url: string,
  vapidSubject: string,
): Promise<SendResult> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await buildVapidJwt(vapidPrivateKeyPkcs8B64url, audience, vapidSubject);
  const body = await encryptPayload(sub, textToBytes(JSON.stringify(payloadObj)));

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: String(24 * 3600),
      Authorization: `vapid t=${jwt}, k=${vapidPublicKeyB64url}`,
    },
    body,
  });
  const gone = res.status === 404 || res.status === 410;
  return { ok: res.ok, status: res.status, gone, detail: res.ok ? undefined : (await res.text()).slice(0, 200) };
}

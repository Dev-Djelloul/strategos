import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVapidJwt, encryptPayload, b64urlDecode, b64urlEncode } from "../src/webpush.ts";

test("encryptPayload produit un message que le destinataire peut déchiffrer (RFC 8291)", async () => {
  const kp = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const uaPublicRaw = new Uint8Array((await crypto.subtle.exportKey("raw", kp.publicKey)) as ArrayBuffer);
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: "https://push.example/ep", keys: { p256dh: b64urlEncode(uaPublicRaw), auth: b64urlEncode(authSecret) } };

  const plaintext = new TextEncoder().encode(JSON.stringify({ title: "Strategos", body: "3 nouveaux événements" }));
  const body = await encryptPayload(sub, plaintext);

  // ── Déchiffrement côté "navigateur", en suivant RFC 8291 pas à pas ──
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublicRaw = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);

  const asPublicKey = await crypto.subtle.importKey("raw", asPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const deriveAlgo = { name: "ECDH", public: asPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(deriveAlgo, kp.privateKey, 256));

  const hkdf = async (ikm: Uint8Array, hkdfSalt: Uint8Array, info: Uint8Array, length: number) => {
    const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: hkdfSalt, info }, key, length * 8));
  };
  const enc = (s: string) => new TextEncoder().encode(s);
  const keyInfo = new Uint8Array([...enc("WebPush: info\0"), ...uaPublicRaw, ...asPublicRaw]);
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);
  const cek = await hkdf(ikm, salt, enc("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, enc("Content-Encoding: nonce\0"), 12);

  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, cekKey, ciphertext));
  assert.equal(decrypted[decrypted.length - 1], 0x02); // délimiteur de fin d'enregistrement
  const recovered = new TextDecoder().decode(decrypted.slice(0, -1));
  assert.equal(recovered, new TextDecoder().decode(plaintext));
});

test("buildVapidJwt produit un JWT ES256 valide, vérifiable avec la clé publique VAPID", async () => {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", kp.privateKey)) as ArrayBuffer);
  const jwt = await buildVapidJwt(b64urlEncode(pkcs8), "https://push.example", "mailto:test@example.com");

  const [headerB64, payloadB64, sigB64] = jwt.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  assert.deepEqual(header, { typ: "JWT", alg: "ES256" });
  assert.equal(payload.aud, "https://push.example");
  assert.equal(payload.sub, "mailto:test@example.com");

  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    kp.publicKey,
    b64urlDecode(sigB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  assert.equal(ok, true);
});

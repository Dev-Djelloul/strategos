/** Lecture minimale d'une archive ZIP à fichier unique (fichiers GDELT).
 * On passe par le répertoire central (fin d'archive) car la taille peut
 * être absente de l'en-tête local (data descriptor). */

const u16 = (b: DataView, o: number) => b.getUint16(o, true);
const u32 = (b: DataView, o: number) => b.getUint32(o, true);

export async function unzipFirstFile(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("archive ZIP invalide (fin introuvable)");

  const cd = u32(view, eocd + 16);
  if (u32(view, cd) !== 0x02014b50) throw new Error("archive ZIP invalide (répertoire central)");
  const method = u16(view, cd + 10);
  const compSize = u32(view, cd + 20);
  const local = u32(view, cd + 42);

  if (u32(view, local) !== 0x04034b50) throw new Error("archive ZIP invalide (en-tête local)");
  const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
  const data = bytes.subarray(start, start + compSize);

  if (method === 0) return new TextDecoder().decode(data);
  if (method !== 8) throw new Error(`méthode de compression ZIP non gérée (${method})`);

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

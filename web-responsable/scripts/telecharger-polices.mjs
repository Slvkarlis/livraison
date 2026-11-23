import { mkdir, writeFile } from 'node:fs/promises';
const dossier = new URL('../public/fonts/', import.meta.url);
await mkdir(dossier, { recursive: true });
for (const [famille, fichier] of [['plusjakartasans','PlusJakartaSans[wght].ttf'],['jetbrainsmono','JetBrainsMono[wght].ttf']]) {
  for (const [source, destination] of [[fichier,fichier.replace('[wght]','-variable')],['OFL.txt',`${famille}-OFL.txt`]]) {
    const reponse = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${famille}/${encodeURIComponent(source)}`, { signal: AbortSignal.timeout(20000) });
    if (!reponse.ok) throw new Error(`${famille} : HTTP ${reponse.status}`);
    await writeFile(new URL(destination, dossier), Buffer.from(await reponse.arrayBuffer()));
    console.log(destination);
  }
}

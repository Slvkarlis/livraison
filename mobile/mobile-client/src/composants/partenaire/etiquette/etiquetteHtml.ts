import type { EtiquetteColis } from '@fleetpulse/shared';

/** Echappe le texte libre (prenom, nom du commerce...) avant de l'inserer dans le HTML imprime. */
export function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Page HTML de l'etiquette a coller sur le colis : QR de collecte, code a saisir en secours,
 * code de suivi et prenom du client. Format etiquette (~10 x 10 cm).
 */
export function etiquetteHtml(etiquette: EtiquetteColis, qrSvg: string): string {
  const articles = `${etiquette.nbArticles} article${etiquette.nbArticles > 1 ? 's' : ''}`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Étiquette ${echapperHtml(etiquette.codeSuivi)}</title>
<style>
  @page { size: 100mm 100mm; margin: 6mm; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; text-align: center; color: #111; }
  .commerce { font-size: 14px; font-weight: 700; }
  .qr svg { width: 55mm; height: 55mm; }
  .code { font-size: 26px; font-weight: 800; letter-spacing: 6px; margin: 2mm 0; }
  .aide { font-size: 11px; color: #555; }
  .client { font-size: 16px; font-weight: 700; margin-top: 2mm; }
</style></head>
<body>
  <div class="commerce">${echapperHtml(etiquette.nomCommerce ?? 'FleetPulse')}</div>
  <div class="qr">${qrSvg}</div>
  <div class="code">${echapperHtml(etiquette.codeCollecte)}</div>
  <div class="aide">Code de collecte · à scanner ou saisir par le livreur</div>
  <div class="client">${echapperHtml(etiquette.clientPrenom)} · ${articles}</div>
  <div class="aide">Commande ${echapperHtml(etiquette.codeSuivi)}</div>
</body></html>`;
}

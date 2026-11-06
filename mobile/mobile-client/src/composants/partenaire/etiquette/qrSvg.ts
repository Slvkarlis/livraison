import QRCode from 'qrcode';

/**
 * Dessine le QR de collecte en SVG (texte).
 * Le meme SVG sert a l'affichage (SvgXml) et a l'impression (insere dans le HTML de l'etiquette).
 */
export function genererQrSvg(contenu: string): Promise<string> {
  return QRCode.toString(contenu, {
    type: 'svg',
    errorCorrectionLevel: 'M', // lisible meme si l'etiquette est un peu abimee
    margin: 1,
  });
}

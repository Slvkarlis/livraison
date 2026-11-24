const { execFileSync, spawnSync } = require('node:child_process');
const { networkInterfaces } = require('node:os');
const path = require('node:path');

const applications = {
  client: { dossier: 'mobile-client', port: 8081 },
  partenaire: { dossier: 'mobile-client', port: 8082 },
  livreur: { dossier: 'mobile-livreur', port: 8084 },
};
const role = process.argv[2];
const application = applications[role];
if (!application) {
  console.error('Choisir client, partenaire ou livreur.');
  process.exit(1);
}

function adresseReseau() {
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    return process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
  }
  if (process.platform === 'win32') {
    const routes = execFileSync('route.exe', ['print', '-4'], {
      encoding: 'utf8', windowsHide: true,
    });
    const defauts = [...routes.matchAll(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+\S+\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s*$/gm)];
    defauts.sort((a, b) => Number(a[2]) - Number(b[2]));
    return defauts[0]?.[1];
  }
  const adresses = Object.values(networkInterfaces()).flat()
    .filter((interfaceReseau) => interfaceReseau?.family === 'IPv4' && !interfaceReseau.internal)
    .map((interfaceReseau) => interfaceReseau.address);
  if (adresses.length === 1) return adresses[0];
  console.error('Plusieurs interfaces reseau : definir REACT_NATIVE_PACKAGER_HOSTNAME avec l\'IP du PC.');
}

const adresse = adresseReseau();
if (!adresse) {
  console.error('Aucune adresse reseau detectee. Connecter le PC au reseau du telephone.');
  process.exit(1);
}
const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: adresse,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || `http://${adresse}:8083`,
};
delete env.CI;
console.log(`FleetPulse ${role} - Expo Go - port ${application.port}`);
console.log(`Backend : ${env.EXPO_PUBLIC_API_URL}`);
console.log('Scanner le QR dans Expo Go sur le telephone connecte au meme reseau.');

const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
const resultat = spawnSync(process.execPath, [
  cli, 'start', '--go', '--port', String(application.port), '--max-workers', '1', '--offline',
  ...process.argv.slice(3),
], {
  cwd: path.resolve(__dirname, '..', application.dossier), env, stdio: 'inherit',
});
if (resultat.error) console.error(resultat.error.message);
process.exit(resultat.status ?? 1);

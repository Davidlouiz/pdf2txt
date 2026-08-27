import { initDb } from '../lib/db';
import { config } from '../lib/config';

// Initialise la base et les répertoires de stockage sans lancer le serveur.
initDb();
console.log(`Base de données prête : ${config.dbPath}`);
console.log(`Répertoire PDF : ${config.pdfDir}`);
console.log(`Répertoire TXT : ${config.txtDir}`);

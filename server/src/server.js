import 'dotenv/config';
import './db.js'; // Initialisiert Datenbank, Schema, Admin-Bootstrap.
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Probennahmejournal-Server läuft auf http://localhost:${port}`);
});

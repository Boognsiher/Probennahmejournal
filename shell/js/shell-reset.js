// Setzt die simulierten Testdaten der Schale zurück (nur diese Test-Schale
// betroffen — hat nichts mit dem echten Server zu tun). Bewusst als separates,
// nicht-module Script, damit js/api.js/app.js unverändert bleiben können.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('shell-reset');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!confirm('Alle Testdaten in diesem Browser löschen und mit den Demo-Zugängen neu starten?')) return;
    localStorage.removeItem('pnj_mock_db_v1');
    localStorage.removeItem('pnj_token');
    localStorage.removeItem('pnj_user');
    location.href = location.pathname;
  });
});

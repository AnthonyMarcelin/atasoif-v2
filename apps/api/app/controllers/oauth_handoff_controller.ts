import { nativeOAuthReturnBase } from '#services/frontend_url'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Safety net when FRONTEND_URL wrongly points at the API (TestFlight bug):
 * Safari lands on Adonis `/auth/oauth/callback#token=…` instead of the SPA.
 * Serve a tiny HTML page that deep-links back into Capacitor.
 */
export default class OauthHandoffController {
  async callback({ response }: HttpContext) {
    const deepBase = nativeOAuthReturnBase().replace(/\/$/, '')
    const deepCallback = deepBase.includes('/auth/')
      ? deepBase
      : `${deepBase}/auth/oauth/callback`
    const deepLogin = deepCallback.replace(/\/auth\/oauth\/callback\/?$/, '/auth/login')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Retour dans À ta soif</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#0E0C0A;color:#F2EDE4;font-family:system-ui,sans-serif;padding:24px;text-align:center}
    a{color:#E39A3C}
    .card{max-width:22rem}
    h1{font-size:1.25rem;margin:0 0 .75rem}
    p{margin:0 0 1rem;color:#C3B7A5;line-height:1.4}
    .btn{display:inline-block;border:1.5px solid #E39A3C;color:#E39A3C;padding:.75rem 1rem;
      text-decoration:none;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:.75rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>Retour dans l’app</h1>
    <p id="msg">On te renvoie vers À ta soif…</p>
    <p><a class="btn" id="open" href="${escapeHtml(deepCallback)}">Ouvrir À ta soif</a></p>
  </div>
  <script>
    (function () {
      var deepCallback = ${JSON.stringify(deepCallback)};
      var deepLogin = ${JSON.stringify(deepLogin)};
      var hash = window.location.hash || '';
      var query = window.location.search || '';
      var params = new URLSearchParams(hash.charAt(0) === '#' ? hash.slice(1) : hash);
      var token = params.get('token');
      var err = new URLSearchParams(query.charAt(0) === '?' ? query.slice(1) : query).get('oauthError');
      var target = null;
      if (token) {
        target = deepCallback + '#token=' + encodeURIComponent(token);
      } else if (err) {
        target = deepLogin + (deepLogin.indexOf('?') >= 0 ? '&' : '?') + 'oauthError=' + encodeURIComponent(err);
      }
      var open = document.getElementById('open');
      var msg = document.getElementById('msg');
      if (target) {
        open.setAttribute('href', target);
        msg.textContent = 'Connexion prête. Si l’app ne s’ouvre pas, tape le bouton.';
        window.location.replace(target);
      } else {
        msg.textContent = 'Session incomplète. Rouvre À ta soif et réessaie « Continuer avec Apple ».';
      }
    })();
  </script>
</body>
</html>`

    response.header('Content-Type', 'text/html; charset=utf-8')
    response.header('Cache-Control', 'no-store')
    return response.send(html)
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

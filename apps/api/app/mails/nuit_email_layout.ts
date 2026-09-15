/**
 * Shared Nuit (cave nocturne) HTML shell for transactional emails.
 * Inline styles + solid dark fallbacks for limited mail clients.
 * Radius 0, single amber accent (#E39A3C), no shadows.
 */
export const NUIT = {
  bg: '#0E0C0A',
  surface: '#17140F',
  surface2: '#1F1B15',
  border: '#3E362C',
  ink: '#F2EADC',
  inkMuted: '#9A8E7E',
  accent: '#E39A3C',
  onAccent: '#14110D',
  brand: 'À ta soif',
} as const

type NuitEmailParams = {
  previewText: string
  title: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  footerNote: string
}

export function renderNuitEmailHtml(params: NuitEmailParams): string {
  const { previewText, title, bodyHtml, ctaLabel, ctaUrl, footerNote } = params

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${NUIT.bg};color:${NUIT.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(previewText)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${NUIT.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${NUIT.surface};border:1.5px solid ${NUIT.border};">
          <tr>
            <td style="padding:28px 24px 8px;border-bottom:2.5px solid ${NUIT.accent};">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${NUIT.accent};">
                ${escapeHtml(NUIT.brand)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;letter-spacing:-0.02em;color:${NUIT.ink};font-weight:700;">
                ${escapeHtml(title)}
              </h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${NUIT.ink};">
                ${bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${NUIT.accent};">
                    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1;color:${NUIT.onAccent};text-decoration:none;">
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${NUIT.inkMuted};word-break:break-all;">
                Si le bouton ne marche pas, copie ce lien :<br />
                <a href="${escapeHtml(ctaUrl)}" style="color:${NUIT.accent};">${escapeHtml(ctaUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;background-color:${NUIT.surface2};border-top:1.5px solid ${NUIT.border};">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${NUIT.inkMuted};">
                ${escapeHtml(footerNote)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

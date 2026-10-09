# Security

JuryRoll is a static page. A voter file or a jury file is read only in the browser. The page does not upload it.

The production page sends this Content-Security-Policy response header:

`default-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'`

`connect-src 'none'` blocks network calls from the page, including same-origin fetch. Scripts and styles are loaded from the site itself, or from a hash of an inline bundle. The United States map is a same-origin script bundled with the page. The explainer video and its poster are files on this site (`media-src 'self'`, `img-src 'self'`). There is no third-party player, no analytics tag, and no third-party script.

Report a vulnerability through GitHub private vulnerability reporting on this repository: https://github.com/acornsoft/juryroll/security

There is no separate security email address.

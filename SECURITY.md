# Security Policy

## Supported Deployments

The recommended production deployment target is Vercel with Turso/libSQL and Vercel Blob. The Cloudflare Workers/OpenNext path is kept as a compatible runtime and should be verified separately before production use.

## Reporting Vulnerabilities

Please do not open public issues for suspected vulnerabilities that expose secrets, account access, or private content. Report them privately to the project maintainer first, with:

- affected route or feature
- reproduction steps
- expected impact
- any relevant logs or screenshots with secrets removed

## Security Notes

- Admin sessions use server-side random session tokens and can be revoked on logout.
- API tokens are only shown once at creation time; the database stores token hashes for new tokens.
- Password-protected posts are a sharing convenience, not a substitute for strong access control. Access is granted through a short-lived HttpOnly cookie after password verification, and generated passwords should be treated as secrets.
- Custom JavaScript is intentionally powerful and should only be edited by trusted administrators.
- AI provider base URLs are restricted to HTTPS public endpoints to reduce SSRF risk.

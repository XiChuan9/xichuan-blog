# Contributing

Thanks for helping improve XiChuan Blog.

## Development

Use Node.js 20 or newer.

```bash
npm install
npm run verify:quick
```

For runtime-specific changes, also run:

```bash
npm run verify:vercel
npm run verify
```

## Pull Requests

- Keep changes focused and avoid unrelated formatting churn.
- Add or update tests when changing route behavior, repository logic, runtime adapters, upload handling, or security-sensitive code.
- Do not commit `.env*`, tokens, database dumps, generated build output, or local upload artifacts.
- For deployment changes, mention whether you verified Vercel, Cloudflare, or both.

## Security

Do not open public issues for vulnerabilities that expose secrets, private content, or account access. Follow [SECURITY.md](SECURITY.md).

# ponytail: 2 document the new safe-env CLI usage briefly
## safe-env

```bash
SAFE_ENV_KEY=pass node dist/cli/safe-env.js encrypt .env
SAFE_ENV_KEY=pass node dist/cli/safe-env.js decrypt .env.enc
SAFE_ENV_KEY=pass node dist/cli/safe-env.js add API_KEY value .env.enc
SAFE_ENV_KEY=pass node dist/cli/safe-env.js list .env.enc
```

Commands: `encrypt`, `decrypt`, `add`, `list`.
The password comes from `SAFE_ENV_KEY`.

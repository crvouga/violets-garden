# Agent notes

Shared infra (Vault, Turborepo remote cache, R2 object store, hosting):
https://raw.githubusercontent.com/crvouga/workspace/main/llms.txt

Hosting: this repo is deployed to the managed fleet in `crvouga/workspace` as service
`violets-garden`. Pushes to `main` run `.github/workflows/publish.yml`, which builds the
`Dockerfile` (static Vite build served by nginx on port 80) and publishes
`ghcr.io/crvouga/chrisvouga-violets-garden`. Never deploy by hand.

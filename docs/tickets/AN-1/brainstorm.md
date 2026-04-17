# AN-1 Brainstorm: CI/CD Pipeline Setup with GitHub Actions, Azure ACR & Container Apps

## Summary of Key Ideas

The ticket establishes an automated CI/CD pipeline to replace a fully manual build/test/deploy process. The core pillars are:

1. **Two-stage pipeline** — a `validate` job on all PRs (lint + test + Docker build in parallel, no push) and a `build-and-deploy` job on push to `main` (full build → push to ACR → deploy to Container Apps).
2. **Secretless Azure authentication** — OIDC Workload Identity Federation replaces long-lived credentials; only non-sensitive config values (`CLIENT_ID`, `TENANT_ID`, `SUBSCRIPTION_ID`, `ACR_LOGIN_SERVER`) and `DATABASE_URL` are stored as GitHub secrets.
3. **Azure Container Apps** as the runtime — chosen over ACI for scale-to-zero and cost efficiency.
4. **ACR image lifecycle** — a hard cap of 10 retained images (including `latest`), enforced in the pipeline via `az acr run` purge.
5. **Action version pinning** — all GitHub Actions must use the latest major version specified in the ticket.

---

## Unclear Requirements — Resolved

All questions have been answered by the stakeholder. Decisions are recorded below and the ticket has been updated accordingly.

| # | Question | Answer | Ticket Updated |
|---|---|---|---|
| Q1 | ACR and Container Apps — already provisioned or create new? | **Create new** in this ticket | ✅ |
| Q2 | Azure region? | **Southeast Asia** (Singapore — nearest to Vietnam) | ✅ |
| Q3 | OIDC federated credential scope? | **PR to any branch** + **push to `main`** | ✅ |
| Q4 | `Contributor` role or custom least-privilege? | **`Contributor` is acceptable** | ✅ |
| Q5 | Node.js version? | **Use the version specified in `package.json` `engines` field** | ✅ |
| Q6 | `Dockerfile` — already exists or create new? | **Create new** as part of this ticket (multi-stage build) | ✅ |
| Q7 | Docker context path (`app/` subdirectory)? | Stakeholder asked for clarification — the app lives under `app/`; the `Dockerfile` and build context should be `./app` | ✅ (noted in task) |
| Q8 | Runtime env vars for Container App? | **`DATABASE_URL`** from an existing PostgreSQL Flexible Server in a separate resource group; stored in **Azure Key Vault** and referenced via Key Vault secret reference on the Container App — never passes through the pipeline | ✅ |
| Q9 | Is Docker build in `validate` job mandatory? | **Yes** — runs alongside (in parallel with) lint and unit tests, not sequentially after | ✅ |
| Q10 | Does `latest` tag count against the 10-image cap? | **Yes** — `latest` counts as one of the 10 | ✅ |
| Q11 | Post-deploy smoke test endpoint? | **`GET /health`** must return HTTP 200 | ✅ |
| Q12 | Should `validate` run on `develop` PRs too? | **Yes** — validate runs on PRs to any branch; deploy from `develop` is out of scope because there is only one environment (production) | ✅ |
| Q13 | GitHub Environment for deployment gating? | **No** — use the default environment, no protection rules needed | ✅ |

---

## Remaining Open Items

- **Q7 clarification**: The working directory issue (`app/` subdirectory) needs to be handled in the workflow file — all `npm` commands must use `working-directory: app` and the Docker build context should be `./app`. Confirm `Dockerfile` placement with the implementer.
- **PostgreSQL Flexible Server**: The existing server is in a separate resource group. The connection string must be retrieved from that resource group and stored as `DATABASE-URL` in the Key Vault. Confirm access/permissions to that resource group under the same subscription.
- **`/health` endpoint**: The NestJS app does not currently have a `/health` endpoint. This must be implemented before or alongside this ticket, or the acceptance criterion updated to use an existing endpoint (e.g., `GET /`).

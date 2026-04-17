# AN-1 Implementation Plan: CI/CD Pipeline with GitHub Actions, Azure ACR & Container Apps

---

## 1. System Overview

The goal is to replace a fully manual build/test/deploy process with a two-stage automated pipeline. Developers currently must run `npm run build`, `docker build`, `docker push`, and `az containerapp update` by hand — an error-prone process with no consistency guarantees.

The automated system consists of three layers:

- **Source layer**: GitHub repository hosts the NestJS application under `app/`. The pipeline is defined in `.github/workflows/`.
- **Pipeline layer**: GitHub Actions executes two jobs — `validate` (on all pull requests) and `build-and-deploy` (on push to `main`). Authentication to Azure is entirely secretless via OIDC Workload Identity Federation.
- **Runtime layer**: Azure hosts all infrastructure in Southeast Asia. ACR stores Docker images. Azure Container Apps runs the container with scale-to-zero. Azure Key Vault holds all sensitive runtime secrets (`DATABASE_URL`, `REDIS_HOST`, `REDIS_PASSWORD`, `JWT_SECRET`) — they never pass through the pipeline.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GitHub                                                                  │
│                                                                          │
│  Repository: org/webservice-cloud-template                               │
│  Branch: main  (protected)                                               │
│  Branch: feature/* / PR branches                                         │
│                       │ push / pull_request events                       │
│                       ▼                                                  │
│  GitHub Actions Runner (ubuntu-latest)                                   │
│                                                                          │
│  [validate jobs] — triggered on: pull_request (any branch)               │
│    ├── lint          ─┐                                                  │
│    ├── test          ─┤ (3 parallel jobs)                                │
│    └── docker-build  ─┘ (no push)                                        │
│                                                                          │
│  [build-and-deploy job] — triggered on: push → main                     │
│    ├── azure/login@v2  (OIDC token exchange)                             │
│    ├── az acr login → ACR                                                │
│    ├── docker/build-push-action@v6                                       │
│    │     tags: sha-<SHA>, latest                                         │
│    ├── az acr run (purge, keep ≤10 images)                               │
│    ├── az containerapp update --image sha-<SHA>                          │
│    └── curl GET /health → assert HTTP 200                                │
│                                                                          │
│  GitHub Secrets (deployment config only — no app secrets):              │
│  AZURE_CLIENT_ID, AZURE_TENANT_ID,                                       │
│  AZURE_SUBSCRIPTION_ID, ACR_LOGIN_SERVER                                 │
└──────────┼───────────────────┼───────────────────────────────────────────┘
           │ OIDC token        │ push image
           ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Azure  (Region: Southeast Asia — Singapore)                             │
│                                                                          │
│  ┌──────────────────────┐     ┌─────────────────────────────────┐        │
│  │  Azure AD            │     │  Azure Container Registry (ACR) │        │
│  │  App Registration    │     │  <name>.azurecr.io              │        │
│  │  + Federated Creds   │     │  Admin: disabled                │        │
│  │    (OIDC)            │     │  Max 10 images (9 sha + latest) │        │
│  │                      │     └─────────────┬───────────────────┘        │
│  │  IAM:                │                   │ pull image (via MI)        │
│  │  AcrPush → ACR       │                   ▼                            │
│  │  Contributor → App   │     ┌─────────────────────────────────┐        │
│  └──────────────────────┘     │  Azure Container Apps            │        │
│                               │  Ingress: port 3000, HTTPS ext  │        │
│  ┌──────────────────────┐     │  Scale: 0–N (scale-to-zero)     │        │
│  │  Azure Key Vault     │◄────│  Identity: system-assigned MI   │        │
│  │                      │     │  Env vars:                      │        │
│  │  SECRETS:            │     │    PORT=3000                    │        │
│  │   DATABASE-URL       │     │    REDIS_USERNAME=default       │        │
│  │   REDIS-HOST         │     │    REDIS_PORT=17123             │        │
│  │   REDIS-PASSWORD     │     │    JWT_EXPIRES_IN=1h            │        │
│  │   JWT-SECRET         │     │    DATABASE_URL → KV secret ref │        │
│  │  Access: RBAC        │     │    REDIS_HOST   → KV secret ref │        │
│  │                      │     │    REDIS_PASSWORD→ KV secret ref│        │
│  │                      │     │    JWT_SECRET   → KV secret ref │        │
│  │  Role: KV Secrets    │     └─────────────────────────────────┘        │
│  │    User → App MI     │                                                │
│  └──────────────────────┘                                                │
│                                                                          │
│  (Separate resource group — pre-existing)                                │
│  ┌──────────────────────┐                                                │
│  │  PostgreSQL Flexible │                                                │
│  │  Server              │                                                │
│  └──────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Responsibilities

| Component | Responsibility |
|---|---|
| **GitHub Actions `validate` jobs** | Gate PRs: lint, unit tests, Docker build — in parallel, never push |
| **GitHub Actions `build-and-deploy` job** | On merge to `main`: build image → push → purge → deploy → smoke test |
| **GitHub Secrets** | Non-sensitive deployment config only: client/tenant/subscription IDs and ACR address |
| **Azure AD App Registration** | Issues short-lived OIDC tokens to the runner; federated credentials scoped to PR events and `main` push |
| **Azure Container Registry** | Stores Docker images; max 10 tags (9 `sha-*` + `latest`) enforced by pipeline purge |
| **Azure Key Vault** | Stores `DATABASE-URL`, `REDIS-HOST`, `REDIS-PASSWORD`, `JWT-SECRET` at rest; accessed by Container App managed identity at runtime only — never by the pipeline |
| **System-assigned Managed Identity** | Attached to the Container App; holds `Key Vault Secrets User` role (secret fetch) and `AcrPull` role (image pull) |
| **Azure Container Apps** | Runs the NestJS container; pulls secrets from Key Vault via secret reference; scale-to-zero |
| **PostgreSQL Flexible Server** | Pre-existing DB in a separate resource group; connection string stored manually in Key Vault before first deploy |

---

## 4. Workflows

### 4.1 `validate` Jobs (on: pull_request, any branch)

Three parallel jobs, each independent:

```
[lint job]
  1. actions/@checkout@v6
  2. actions/setup-node@v4  (version from app/package.json engines field)
     cache: npm, cache-dependency-path: app/package-lock.json
  3. npm ci                  (working-directory: app)
  4. npm run lint            (working-directory: app)

[test job]
  1. actions/@checkout@v6
  2. actions/setup-node@v4
  3. npm ci                  (working-directory: app)
  4. npm test                (working-directory: app)

[docker-build job]
  1. actions/@checkout@v6
  2. docker/setup-buildx-action@v3
  3. docker/build-push-action@v6
       context: ./app
       file: ./app/Dockerfile
       push: false
```

### 4.2 `build-and-deploy` Job (on: push, branch: main)

```
  1. actions/@checkout@v6
  2. azure/login@v2          (OIDC — client-id, tenant-id, subscription-id from secrets)
  3. az acr login --name acranmindproduction
  4. docker/setup-buildx-action@v3
  5. docker/build-push-action@v6
       context: ./app
       file: ./app/Dockerfile
       push: true
       tags:
         <ACR_LOGIN_SERVER>/app:sha-${{ github.sha }}
         <ACR_LOGIN_SERVER>/app:latest
  6. az acr run purge        (keep 9 sha-tags; latest counts as 10th)
  7. az containerapp update  (--image sha-<SHA> only; do NOT touch env-vars)
  8. curl --fail --retry 10 --retry-delay 10
       https://<FQDN>/health  → assert HTTP 200
```

---

## 5. Data Flow

### 5.1 Secret Flow (Key Vault → Container App)

```
(manual, one-time) store all sensitive values in Key Vault:
  az keyvault secret set --name DATABASE-URL  --value "postgresql://..."
  az keyvault secret set --name REDIS-HOST     --value "<redis-host>"
  az keyvault secret set --name REDIS-PASSWORD --value "<redis-password>"
  az keyvault secret set --name JWT-SECRET     --value "<jwt-secret>"
  ▼
Azure Key Vault (runtime only — pipeline never reads these)
  │ Container App managed identity authenticates via RBAC
  │ Role: Key Vault Secrets User
  ▼
Container App secret references:
  database-url   → https://<KV>.vault.azure.net/secrets/DATABASE-URL
  redis-host     → https://<KV>.vault.azure.net/secrets/REDIS-HOST
  redis-password → https://<KV>.vault.azure.net/secrets/REDIS-PASSWORD
  jwt-secret     → https://<KV>.vault.azure.net/secrets/JWT-SECRET
  ▼
Env vars injected into the container process:
  DATABASE_URL   = secretref:database-url
  REDIS_HOST     = secretref:redis-host
  REDIS_PASSWORD = secretref:redis-password
  JWT_SECRET     = secretref:jwt-secret
  ▼
NestJS reads process.env.*
```

The `az containerapp update` step in the pipeline passes only `--image`. It never touches `--set-env-vars` or `--secrets`, so Key Vault references are never overwritten.

### 5.2 Image Flow (GitHub → ACR → Container App)

```
push to main
  ▼
docker/build-push-action@v6 (context: ./app, multi-stage Dockerfile)
  ├── pushes: acranmindproduction.azurecr.io/app:sha-<github.sha>
  └── pushes: acranmindproduction.azurecr.io/app:latest
  ▼
az acr run purge (filter: ^sha-, keep 9) → max 10 tags total
  ▼
az containerapp update --image acranmindproduction.azurecr.io/app:sha-<github.sha>
  ▼
Container App pulls image from ACR via system-assigned MI (AcrPull role)
```

### 5.3 OIDC Authentication Flow

```
GitHub Actions runner requests OIDC token from GitHub
  subject: repo:<org>/<repo>:ref:refs/heads/main
        or repo:<org>/<repo>:pull_request
  ▼
azure/login@v2 presents token to Azure AD
  Azure AD validates issuer, subject, audience
  ▼
Azure AD returns short-lived access token (~1 hour)
  ▼
All subsequent az CLI / docker commands use this token
  (no passwords, no stored secrets)
```

---

## 6. Potential Edge Cases and Risks

| # | Risk | Mitigation |
|---|---|---|
| **R1** | `package.json` has no `engines` field — `node-version-file` will fail | Add `"engines": { "node": ">=24.0.0" }` to `app/package.json` before writing the workflow |
| **R2** | Container App managed identity missing `AcrPull` on ACR — image pull fails at runtime | Explicitly assign `AcrPull` to the MI (separate from the OIDC SP `AcrPush` assignment) |
| **R3** | ACR purge deletes `latest` — the purge filter must target only `^sha-` tags | Use `--filter 'app:^sha-'` and `--keep 9`; `latest` is never matched by this filter and counts as the 10th slot |
| **R4** | OIDC federated credential subject mismatch (wrong org/repo or format) — `azure/login` returns 401 | Create two separate federated credentials (main push + PR); test on a non-main branch before merging |
| **R5** | Scale-to-zero causes cold start; smoke test times out before container is ready | Use `--retry 10 --retry-delay 10 --retry-all-errors` (100s total); increase if image is large |
| **R6** | `az containerapp update` with `--set-env-vars` overwrites Key Vault secret reference | The deploy step passes only `--image`; env-var flags must never be added to the update command |
| **R7** | Windows CRLF line endings cause lint failures on the Linux runner | Add `.gitattributes` normalizing `.ts`/`.js`/`.json` to LF |
| **R8** | `/health` endpoint does not exist in the app yet | Create it before or as part of this ticket (see Phase 0) |

---

## 7. Implementation Steps

### Phase 0 — Application Code Preparation

**0.1 — Verify or create `/health` endpoint**

The `GET /health` endpoint needs to exist and return HTTP 200. Add it to [app/src/app.controller.ts](../../../app/src/app.controller.ts):

```typescript
@Get('health')
getHealth(): string {
  return 'OK';
}
```

Add a corresponding test to [app/src/app.controller.spec.ts](../../../app/src/app.controller.spec.ts):

```typescript
it('should return "OK" on /health', () => {
  expect(appController.getHealth()).toBe('OK');
});
```

**0.2 — Add `engines` field to `package.json`**

In [app/package.json](../../../app/package.json), add before `"scripts"`:

```json
"engines": {
  "node": ">=24.0.0"
},
```

**0.3 — Add `.gitattributes` at repository root**

```
* text=auto
*.ts text eol=lf
*.js text eol=lf
*.mjs text eol=lf
*.json text eol=lf
```

---

### Phase 1 — Create the Dockerfile

**1.1 — Create `app/Dockerfile`**

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/main"]
```

Key points:
- Node 24 Alpine matches `@types/node: ^24.0.0`.
- Stage 2 re-runs `npm ci --omit=dev` independently — devDependencies are excluded from the runtime image.
- `CMD ["node", "dist/main"]` matches the `start:prod` script.

---

### Phase 2 — Azure Infrastructure Provisioning

Replace placeholders: `rg-anmind-production`, `acranmindproduction`, `<KV>`, `<ENV>`, `containerapp-anmind`, `<GH_ORG>`, `<GH_REPO>`.

**2.1 — Create resource group**

```bash
az group create -l eastasia -n rg-anmind-production 
```

**2.2 — Create Azure Container Registry**

```bash
az acr create \
  --resource-group rg-anmind-production \
  --name acranmindproduction \
  --sku Basic \
  --location eastasia \
  --admin-enabled false
```

Save the login server (`acranmindproduction.azurecr.io`) — this is the `ACR_LOGIN_SERVER` secret value.

**2.3 — Create Azure Key Vault (RBAC access model)**

```bash
az keyvault create \
  --resource-group rg-anmind-production \
  --name <KV> \
  --location eastasia \
  --enable-rbac-authorization true
```

**2.4 — Store secrets in Key Vault** *(one-time manual step)*

```bash
# PostgreSQL connection string — retrieve from its resource group first
az keyvault secret set \
  --vault-name kv-anmind-production \
  --name DATABASE-URL \
  --value "postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require"

# Redis host
az keyvault secret set \
  --vault-name kv-anmind-production \
  --name REDIS-HOST \
  --value "<redis-host>"

# Redis password
az keyvault secret set \
  --vault-name kv-anmind-production \
  --name REDIS-PASSWORD \
  --value "<redis-password>"

# JWT signing secret
az keyvault secret set \
  --vault-name kv-anmind-production \
  --name JWT-SECRET \
  --value "<jwt-secret>"
```

**2.5 — Create Container Apps environment**

```bash
az containerapp env create \
  --resource-group rg-anmind-production \
  --name containerapp-env-anmind \
  --location eastasia
```

**2.6 — Create Container App with placeholder image and system-assigned MI**

```bash
az containerapp create \
  --resource-group rg-anmind-production \
  --name containerapp-anmind \
  --environment containerapp-env-anmind \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --system-assigned \
  --env-vars \
    PORT=3000 \
    REDIS_USERNAME=default \
    REDIS_PORT=17123 \
    JWT_EXPIRES_IN=1h
```

**2.7 — Grant Container App MI `Key Vault Secrets User` on the vault**

```bash
PRINCIPAL_ID=$(az containerapp show \
  --resource-group rg-anmind-production --name containerapp-anmind \
  --query identity.principalId --output tsv)

KV_ID=$(az keyvault show \
  --resource-group rg-anmind-production --name kv-anmind-production \
  --query id --output tsv)

az role assignment create \
  --assignee-object-id $PRINCIPAL_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope $KV_ID
```

**2.8 — Wire `DATABASE_URL` via Key Vault secret reference**

```bash
KV="https://kv-anmind-production.vault.azure.net/secrets"

az containerapp secret set \
  --resource-group rg-anmind-production --name containerapp-anmind \
  --secrets \
    "database-url=keyvaultref:${KV}/DATABASE-URL,identityref:system" \
    "redis-host=keyvaultref:${KV}/REDIS-HOST,identityref:system" \
    "redis-password=keyvaultref:${KV}/REDIS-PASSWORD,identityref:system" \
    "jwt-secret=keyvaultref:${KV}/JWT-SECRET,identityref:system"

az containerapp update \
  --resource-group rg-anmind-production --name containerapp-anmind \
  --set-env-vars \
    "DATABASE_URL=secretref:database-url" \
    "REDIS_HOST=secretref:redis-host" \
    "REDIS_PASSWORD=secretref:redis-password" \
    "JWT_SECRET=secretref:jwt-secret"

# Note: PORT, REDIS_USERNAME, REDIS_PORT, JWT_EXPIRES_IN are already set
# as plaintext in Step 2.6. Only the four sensitive values above need
# Key Vault wiring after the MI role is granted.
```

**2.9 — Grant Container App MI `AcrPull` on ACR** *(required for image pull at runtime)*

```bash
ACR_ID=$(az acr show --resource-group rg-anmind-production --name acranmindproduction --query id --output tsv)

az role assignment create \
  --assignee-object-id $PRINCIPAL_ID \
  --assignee-principal-type ServicePrincipal \
  --role "AcrPull" \
  --scope $ACR_ID
```

**2.10 — Configure Container App to use ACR via managed identity**

```bash
az containerapp registry set \
  --resource-group rg-anmind-production --name containerapp-anmind \
  --server acranmindproduction.azurecr.io \
  --identity system
```

**2.11 — Create OIDC App Registration with two federated credentials**

```bash
APP_ID=$(az ad app create \
  --display-name "github-actions-webservice-oidc" \
  --query appId --output tsv)

SP_ID=$(az ad sp create --id $APP_ID --query id --output tsv)

# Federated credential: push to main
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-push-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:L01-B-n-chang-linh-ng-lam/webservice-cloud-template:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

# Federated credential: any pull request
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-pull-request",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:L01-B-n-chang-linh-ng-lam/webservice-cloud-template:pull_request",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

**2.12 — Assign IAM roles to the OIDC service principal**

```bash
# AcrPush on ACR (pipeline pushes images)
az role assignment create \
  --assignee $SP_ID --role "AcrPush" --scope $ACR_ID

# Contributor on Container App (pipeline deploys)
APP_RESOURCE_ID=$(az containerapp show \
  --resource-group rg-anmind-production --name containerapp-anmind \
  --query id --output tsv)

az role assignment create \
  --assignee $SP_ID --role "Contributor" --scope $APP_RESOURCE_ID
```

**2.13 — Set GitHub Actions repository secrets**

In GitHub: Settings > Secrets and variables > Actions > New repository secret:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | `$APP_ID` (from Step 2.11) |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `ACR_LOGIN_SERVER` | `acranmindproduction.azurecr.io` |

No application secrets (`DATABASE_URL`) stored here.

---

### Phase 3 — GitHub Actions Workflow

#### File Layout

```
.github/
  actions/
    setup-node/
      action.yml          # Composite: checkout + node install (shared by lint, test)
  workflows/
    pr.yml                # Trigger: pull_request → calls reusable workflows
    deploy.yml            # Trigger: push to main → calls reusable workflows
    _lint.yml             # Reusable: runs eslint
    _test.yml             # Reusable: runs jest
    _docker-build.yml     # Reusable: docker build, no push (PR validation)
    _docker-push.yml      # Reusable: docker build + push to ACR + purge
    _deploy.yml           # Reusable: az containerapp update + smoke test
```

**Conventions:**
- Reusable workflows are prefixed with `_` to distinguish them from trigger workflows.
- `dorny/paths-filter@v3` in `pr.yml` and `deploy.yml` detects whether `app/` or `.github/` changed — workflows skip if unrelated files changed (e.g., pure docs changes don't trigger CI).
- The composite action `setup-node` is available for **non-reusable** contexts only. Reusable workflows (`workflow_call`) cannot use local composite actions because the runner resolves the action path before `actions/checkout` runs — the workspace is empty at that point. `_lint.yml` and `_test.yml` therefore inline the setup steps directly.

---

**3.1 — `.github/actions/setup-node/action.yml`** *(composite)*

```yaml
name: Setup Node
description: Checkout code and install Node.js dependencies

runs:
  using: composite
  steps:
    - uses: actions/@checkout@v6

    - uses: actions/setup-node@v4
      with:
        node-version-file: 'app/package.json'
        cache: npm
        cache-dependency-path: app/package-lock.json

    - name: Install dependencies
      shell: bash
      working-directory: app
      run: npm ci
```

---

**3.2 — `.github/workflows/_lint.yml`** *(reusable)*

```yaml
name: Lint

on:
  workflow_call:

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-node

      - name: Run linter
        working-directory: app
        run: npm run lint
```

---

**3.3 — `.github/workflows/_test.yml`** *(reusable)*

```yaml
name: Unit Tests

on:
  workflow_call:

jobs:
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-node

      - name: Run unit tests
        working-directory: app
        run: npm test
```

---

**3.4 — `.github/workflows/_docker-build.yml`** *(reusable — PR validation only, no push)*

```yaml
name: Docker Build

on:
  workflow_call:

jobs:
  docker-build:
    name: Docker Build (validate)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/@checkout@v6

      - uses: docker/setup-buildx-action@v3

      - name: Build Docker image (no push)
        uses: docker/build-push-action@v6
        with:
          context: ./app
          file: ./app/Dockerfile
          push: false
          tags: app:pr-${{ github.sha }}
```

---

**3.5 — `.github/workflows/_docker-push.yml`** *(reusable — build, push, purge)*

```yaml
name: Docker Push

on:
  workflow_call:
    inputs:
      image-name:
        required: true
        type: string
    secrets:
      ACR_LOGIN_SERVER:
        required: true
      AZURE_CLIENT_ID:
        required: true
      AZURE_TENANT_ID:
        required: true
      AZURE_SUBSCRIPTION_ID:
        required: true

permissions:
  id-token: write
  contents: read

jobs:
  docker-push:
    name: Build & Push Image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/@checkout@v6

      - name: Authenticate to Azure (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Log in to ACR
        run: az acr login --name ${{ secrets.ACR_LOGIN_SERVER }}

      - uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: ./app
          file: ./app/Dockerfile
          push: true
          tags: |
            ${{ secrets.ACR_LOGIN_SERVER }}/${{ inputs.image-name }}:sha-${{ github.sha }}
            ${{ secrets.ACR_LOGIN_SERVER }}/${{ inputs.image-name }}:latest

      - name: Purge old images (keep 9 sha-tags + latest = 10 total)
        run: |
          az acr run \
            --registry ${{ secrets.ACR_LOGIN_SERVER }} \
            --cmd "acr purge \
              --filter '${{ inputs.image-name }}:^sha-' \
              --ago 0d \
              --keep 9 \
              --untagged" \
            /dev/null
```

---

**3.6 — `.github/workflows/_deploy.yml`** *(reusable — update Container App + smoke test)*

```yaml
name: Deploy

on:
  workflow_call:
    inputs:
      image-name:
        required: true
        type: string
    secrets:
      ACR_LOGIN_SERVER:
        required: true
      AZURE_CLIENT_ID:
        required: true
      AZURE_TENANT_ID:
        required: true
      AZURE_SUBSCRIPTION_ID:
        required: true

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    name: Deploy to Container Apps
    runs-on: ubuntu-latest
    steps:
      - name: Authenticate to Azure (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy image
        run: |
          az containerapp update \
            --resource-group rg-anmind-production \
            --name containerapp-anmind \
            --image ${{ secrets.ACR_LOGIN_SERVER }}/${{ inputs.image-name }}:sha-${{ github.sha }}

      - name: Get FQDN
        id: fqdn
        run: |
          FQDN=$(az containerapp show \
            --resource-group rg-anmind-production \
            --name containerapp-anmind \
            --query properties.configuration.ingress.fqdn \
            --output tsv)
          echo "fqdn=$FQDN" >> $GITHUB_OUTPUT

      - name: Smoke test — GET /health
        run: |
          curl --fail \
               --retry 10 \
               --retry-delay 10 \
               --retry-all-errors \
               https://${{ steps.fqdn.outputs.fqdn }}/health
```

---

**3.7 — `.github/workflows/pr.yml`** *(trigger: pull_request)*

```yaml
name: PR Checks

on:
  pull_request:
    branches: ['**']

permissions:
  contents: read

jobs:
  changes:
    name: Detect changed paths
    runs-on: ubuntu-latest
    outputs:
      app: ${{ steps.filter.outputs.app }}
    steps:
      - uses: actions/@checkout@v6
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            app:
              - 'app/**'
              - '.github/workflows/**'
              - '.github/actions/**'
              - 'app/Dockerfile'

  lint:
    needs: changes
    if: needs.changes.outputs.app == 'true'
    uses: ./.github/workflows/_lint.yml

  test:
    needs: changes
    if: needs.changes.outputs.app == 'true'
    uses: ./.github/workflows/_test.yml

  docker-build:
    needs: changes
    if: needs.changes.outputs.app == 'true'
    uses: ./.github/workflows/_docker-build.yml
```

---

**3.8 — `.github/workflows/deploy.yml`** *(trigger: push to main)*

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

permissions:
  contents: read
  id-token: write

jobs:
  changes:
    name: Detect changed paths
    runs-on: ubuntu-latest
    outputs:
      app: ${{ steps.filter.outputs.app }}
    steps:
      - uses: actions/@checkout@v6
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            app:
              - 'app/**'
              - '.github/workflows/**'
              - '.github/actions/**'
              - 'app/Dockerfile'

  docker-push:
    needs: changes
    if: needs.changes.outputs.app == 'true'
    uses: ./.github/workflows/_docker-push.yml
    with:
      image-name: app
    secrets:
      ACR_LOGIN_SERVER: ${{ secrets.ACR_LOGIN_SERVER }}
      AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
      AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
      AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

  deploy:
    needs: docker-push
    uses: ./.github/workflows/_deploy.yml
    with:
      image-name: app
    secrets:
      ACR_LOGIN_SERVER: ${{ secrets.ACR_LOGIN_SERVER }}
      AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
      AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
      AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

---

### Phase 4 — Verification

**4.1 — Validate job test**
Open a PR to any branch. Confirm all three jobs (`lint`, `test`, `docker-build`) run in parallel. Verify no image appears in ACR.

**4.2 — Deploy job test**
Merge PR to `main`. Confirm `build-and-deploy` runs; `lint`/`test`/`docker-build` do not. Verify image in ACR with both tags. Confirm `GET /health` returns 200.

**4.3 — ACR purge test**
After 10+ deploys, confirm ACR contains no more than 10 tags (9 `sha-*` + 1 `latest`).

**4.4 — Secrets audit**
Confirm GitHub secrets contain only the four deployment-config values. Confirm `DATABASE_URL` is NOT present. In Azure Portal, confirm the Container App shows `DATABASE_URL` as a Key Vault reference, not plaintext.

---

### Phase 5 — Final Checklist

**Application code**
- [ ] `/health` endpoint exists in `app/src/app.controller.ts` and returns `'OK'`
- [ ] Unit test for `/health` in `app/src/app.controller.spec.ts`
- [ ] `engines` field added to `app/package.json`
- [ ] `.gitattributes` added at repository root

**Docker**
- [ ] `app/Dockerfile` committed (multi-stage, Node 24 Alpine)

**Azure infrastructure**
- [ ] Resource group created in Southeast Asia
- [ ] ACR created, admin disabled
- [ ] Key Vault created, RBAC access model, `DATABASE-URL` secret stored
- [ ] Container App created, system-assigned MI enabled
- [ ] Container App MI has `Key Vault Secrets User` on Key Vault
- [ ] Container App MI has `AcrPull` on ACR
- [ ] Container App registry configured to use ACR via managed identity
- [ ] `DATABASE_URL` set via Key Vault secret reference (not plaintext)
- [ ] `PORT=3000` set as plaintext env var
- [ ] Ingress: port 3000, external, HTTPS
- [ ] Scale: min 0, max 3

**OIDC**
- [ ] App Registration created
- [ ] Two federated credentials: `main` push + PR (any branch)
- [ ] OIDC SP has `AcrPush` on ACR
- [ ] OIDC SP has `Contributor` on Container App

**GitHub**
- [ ] Four secrets set: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ACR_LOGIN_SERVER`
- [ ] No application secrets in GitHub

**Pipeline**
- [ ] `.github/actions/setup-node/action.yml` — composite action for Node setup
- [ ] `.github/workflows/_lint.yml` — reusable lint workflow
- [ ] `.github/workflows/_test.yml` — reusable test workflow
- [ ] `.github/workflows/_docker-build.yml` — reusable docker build (no push)
- [ ] `.github/workflows/_docker-push.yml` — reusable docker build + push + purge
- [ ] `.github/workflows/_deploy.yml` — reusable deploy + smoke test
- [ ] `.github/workflows/pr.yml` — PR trigger with `dorny/paths-filter@v3`
- [ ] `.github/workflows/deploy.yml` — push to main trigger with `dorny/paths-filter@v3`
- [ ] Path filter: CI skips when only non-`app/` files change (e.g., docs-only PRs)
- [ ] PR checks: lint, test, docker-build run in parallel (no push)
- [ ] Deploy pipeline: docker-push runs first, deploy runs after (`needs: docker-push`)
- [ ] ACR purge keeps max 9 sha-tags + `latest`
- [ ] Smoke test `GET /health` passes post-deploy
- [ ] Action versions: `@checkout@v6`, `setup-node@v4`, `azure/login@v2`, `docker/build-push-action@v6`, `setup-buildx-action@v3`, `dorny/paths-filter@v3`

---

### Critical Files

To be modified:
- [app/src/app.controller.ts](../../../app/src/app.controller.ts) — add `/health` endpoint
- [app/src/app.controller.spec.ts](../../../app/src/app.controller.spec.ts) — add health test
- [app/package.json](../../../app/package.json) — add `engines` field

To be created:
- `app/Dockerfile`
- `.github/actions/setup-node/action.yml`
- `.github/workflows/pr.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/_lint.yml`
- `.github/workflows/_test.yml`
- `.github/workflows/_docker-build.yml`
- `.github/workflows/_docker-push.yml`
- `.github/workflows/_deploy.yml`
- `.gitattributes`

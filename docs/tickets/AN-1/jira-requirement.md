# CI/CD Pipeline Setup with GitHub Actions, Azure ACR & Container Apps

## Background

Currently, the team has no CI/CD pipeline in place. Developers are required to manually run a series of commands to build, test, and deploy the NestJS application — a process that is slow, error-prone, and not scalable.

To address this, we need to:
1. Establish a **GitHub Actions pipeline** that automates build, test, and deployment workflows triggered on pull requests and pushes to target branches.
2. Provision an **Azure Container Registry (ACR)** to store Docker images built by the pipeline.
3. Provision an **Azure Container Apps** instance to host the NestJS application, selected over ACI for its native auto-scaling and cost-efficiency.
4. Implement **OIDC-based authentication** between GitHub Actions and Azure — eliminating the need for long-lived user credentials or access tokens stored as secrets.
5. Provision an **Azure Key Vault** to manage runtime application secrets (e.g., `DATABASE_URL`), keeping them out of the pipeline and the Container Apps portal entirely.

---

## Technical Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Hosting | Azure Container Apps | Supports auto-scaling (scale-to-zero), more cost-effective than ACI for persistent workloads |
| Auth method | OIDC (Workload Identity Federation) | No long-lived secrets; tokens are short-lived and scoped per workflow run |
| Image registry | Azure Container Registry (ACR) | Native Azure integration with Container Apps; supports lifecycle policies |
| Pipeline trigger | GitHub Actions | Native GitHub integration; broad ecosystem of actions |
| Runtime secrets | Azure Key Vault | Secrets never touch the pipeline or portal; rotation updates are picked up automatically without redeployment; access controlled via Azure RBAC |

---

## Tasks

### 1. Azure Infrastructure Setup
- [ ] Create an **Azure Container Registry (ACR)**
  - Region: **Southeast Asia** (Singapore — nearest to Vietnam)
  - Enable admin access **disabled** (access via OIDC/managed identity only)
  - Configure a **retention policy** to keep a maximum of **10 images**, including the `latest` tag (purge oldest tags via `az acr run` purge in the pipeline)
- [ ] Create an **Azure Key Vault**
  - Region: **Southeast Asia** (Singapore — nearest to Vietnam)
  - Store the following secret:
    - `DATABASE-URL` — PostgreSQL Flexible Server connection string (reuse the existing server from its separate resource group)
  - Access model: Azure RBAC (not vault access policies)
- [ ] Create an **Azure Container Apps** environment and application
  - Region: **Southeast Asia** (Singapore — nearest to Vietnam)
  - Provide a placeholder/backbone public image (e.g., `mcr.microsoft.com/azuredocs/containerapps-helloworld`) for initial provisioning
  - Enable **system-assigned managed identity** on the Container App
  - Grant the Container App's managed identity the **`Key Vault Secrets User`** role on the Key Vault
  - Configure ingress on port **3000** (external, HTTPS)
  - Set the following environment variables on the Container App:
    - `PORT=3000` — plaintext
    - `REDIS_USERNAME=default` — plaintext
    - `REDIS_PORT=17123` — plaintext
    - `JWT_EXPIRES_IN=1h` — plaintext
    - `DATABASE_URL` — Key Vault secret reference (`DATABASE-URL`)
    - `REDIS_HOST` — Key Vault secret reference (`REDIS-HOST`)
    - `REDIS_PASSWORD` — Key Vault secret reference (`REDIS-PASSWORD`)
    - `JWT_SECRET` — Key Vault secret reference (`JWT-SECRET`)
  - Configure scaling rules as appropriate (scale-to-zero enabled)
- [ ] Create an **Azure AD App Registration** with Workload Identity Federation (OIDC)
  - Scope federated credentials to **pull requests targeting any branch** and **push to `main`** (i.e., subject: `repo:<org>/<repo>:pull_request` and `repo:<org>/<repo>:ref:refs/heads/main`)
  - Assign the following IAM roles:
    - `AcrPush` on the ACR resource
    - `Contributor` on the Container App resource
- [ ] Save the following values as **GitHub Actions repository secrets** (deployment-time only — no application secrets):
  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_SUBSCRIPTION_ID`
  - `ACR_LOGIN_SERVER` (e.g., `yourregistry.azurecr.io`)

---

### 2. Dockerfile
- [ ] Create a **multi-stage `Dockerfile`** for the NestJS application under `app/`
  - Stage 1 (build): install dependencies, compile TypeScript (`npm run build`)
  - Stage 2 (runtime): copy `dist/` and `node_modules/` into a slim Node.js image, expose port 3000
  - Node.js version must match the version specified in `package.json` `engines` field

---

### 3. GitHub Actions Pipeline

#### Trigger Rules (Git Flow)

| Event | Target Branch | Job |
|---|---|---|
| `pull_request` | any branch | Lint → Test → Build (no push) |
| `push` | `main` | Lint → Test → Build → Push to ACR → Deploy to Container Apps |

> **Note:** Deploy from `develop` is out of scope — there is only one environment (production). The `validate` job runs on all PRs regardless of target branch.

#### Pipeline Jobs

**Job: `validate`** *(on pull_request → any branch)*
- Checkout code (`actions/@checkout@v6`)
- Set up Node.js (`actions/setup-node@v4`) — use the version specified in `package.json` `engines` field
- Install dependencies
- Run linter
- Run unit tests
- Build Docker image (build only, **do not push**) — runs in parallel/alongside the validation steps above

**Job: `build-and-deploy`** *(on push → main)*
- Checkout code (`actions/@checkout@v6`)
- Authenticate to Azure via OIDC (`azure/login@v2`)
- Log in to ACR (`azure/docker-login@v1` or `docker/login-action@v3` with ACR credentials via OIDC)
- Build Docker image and tag with `sha-${{ github.sha }}` and `latest`
- Push image to ACR
- Enforce max 10 images: purge oldest tags beyond the limit (via ACR purge command or `az acr run`)
- Deploy updated image to Azure Container Apps (`azure/container-apps-deploy-action@v2` or `az containerapp update`)

#### Version Requirements
All built-in and community actions **must use the latest major version**:
- `actions/checkout` → `v4`
- `actions/setup-node` → `v4`
- `azure/login` → `v2`
- `docker/login-action` → `v3`
- `docker/build-push-action` → `v6`

---

## Acceptance Criteria

- [ ] **OIDC only**: No user credentials, passwords, or long-lived tokens are stored in GitHub secrets. Authentication to Azure uses Workload Identity Federation exclusively.
- [ ] **No application secrets in the pipeline**: `DATABASE_URL` and all runtime secrets live in Azure Key Vault only — they are never passed through GitHub Actions or visible in the Container Apps portal as plaintext.
- [ ] **Pull request pipeline** (any branch): Validates lint, runs tests, and performs a Docker build. **Does not push any image to ACR.**
- [ ] **Push pipeline** (`main`): Builds, pushes a tagged image to ACR, and deploys to Azure Container Apps automatically.
- [ ] **ACR image cap**: A maximum of 10 images are retained in ACR at any time (including `latest`). Older images are purged as part of the pipeline.
- [ ] **Git flow compliance**: Triggers are correctly scoped — PRs validate, merges deploy. No deploy job runs on pull request events.
- [ ] **Action versions**: All GitHub Actions used in the pipeline are pinned to their latest major version (see version requirements above).
- [ ] **Container Apps** is reachable and the `GET /health` endpoint returns HTTP 200 after a successful deploy pipeline run.
- [ ] Pipeline steps are clearly named and logs are readable for debugging purposes.

---

## Out of Scope
- Setting up environments beyond `main` (e.g., staging from `develop`) — can be addressed in a follow-up ticket
- Secrets rotation automation
- Blue/green or canary deployment strategies
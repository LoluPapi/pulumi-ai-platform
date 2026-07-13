# Pulumi AI Platform

Reusable **Pulumi components** for deploying multi-tenant AI control planes across SaaS and customer-owned environments.

Companion to [stratisell-ai-control-plane](https://github.com/LoluPapi/stratisell-ai-control-plane) (application logic) and [stratiflux-gitops/platform/enterprise-ai](https://github.com/stratiflux/stratiflux-gitops/tree/main/platform/enterprise-ai) (GitOps runtime bundle).

## Design principle

> I would not create four unrelated platforms. I would create reusable Pulumi components with environment-specific stacks and capability flags.

```
shared-platform/
  components/
    kubernetes/      ← cluster bootstrap (provider-specific, out of scope here)
    litellm/           ← OpenAI-compatible gateway
    kserve/            ← vLLM InferenceService
    observability/     ← Prometheus scrape + rules
    vector-store/      ← Qdrant for tenant-scoped RAG
  stacks/
    saas-gcp/
    customer-aws/
    customer-azure/
    customer-onprem/
```

## Quick example

```typescript
import { AiPlatform } from "./components";

const platform = new AiPlatform("customer-a", {
  provider: "gcp",
  region: "europe-west4",
  selfHostedModels: true,
  externalProvidersAllowed: false,
  gpuType: "nvidia-l4",
  dataResidency: "eu",
});
```

## Stacks

| Stack | Provider | Self-hosted | External APIs | Typical use |
|-------|----------|-------------|---------------|-------------|
| `saas-gcp` | GCP | ✅ | ✅ | StratiSell SaaS — cost-optimised routing |
| `customer-aws` | AWS | ✅ | ❌ (default) | Enterprise buyer, EU residency |
| `customer-azure` | Azure | ✅ | ❌ | Mirrors `stratiflux-infra/azure/enterprise-ai-platform` |
| `customer-onprem` | On-prem | ✅ | ❌ | Air-gapped, GPU on-prem |

## Deploy

```bash
npm install
pulumi login
pulumi stack init saas-gcp   # or select existing
pulumi config set kubernetes:context my-cluster
pulumi up
```

Stack config templates live in `stacks/<name>/Pulumi.<name>.yaml`.

## Outputs

| Output | Description |
|--------|-------------|
| `namespace` | `ai-platform` Kubernetes namespace |
| `litellmEndpoint` | OpenAI-compatible URL for app wiring |
| `kserveEnabled` | Whether InferenceService was provisioned |
| `capabilityFlags` | Feature flags for compliance review |

## Wire StratiSell / control plane

```text
LITELLM_BASE_URL=http://litellm.ai-platform.svc.cluster.local:4000/v1
LITELLM_API_KEY=<virtual key>
```

Point [stratisell-ai-control-plane](https://github.com/LoluPapi/stratisell-ai-control-plane) at this endpoint with `--mode llm`.

## What this does NOT provision

Cloud-specific cluster creation (AKS/EKS/GKE) is handled by:

- **Azure:** `stratiflux-infra/azure/enterprise-ai-platform` (Terraform)
- **OCI SaaS:** `stratiflux-infra` k3s templates
- **GitOps runtime:** `stratiflux-gitops/platform/enterprise-ai`

This repo owns the **AI platform component** that sits on top of an existing cluster — the same boundary you'd use at Vanilla Steel.

## Interview talking points

1. **Capability flags** — `externalProvidersAllowed: false` locks sensitive tenants to self-hosted vLLM
2. **LiteLLM profiles** — `saas` vs `enterprise-locked` vs `onprem` routing strategies
3. **Data residency labels** — namespace labels for policy enforcement
4. **One component, many stacks** — not four copy-pasted platforms

## License

MIT

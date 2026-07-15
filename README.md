# Pulumi AI Platform

Reusable **Pulumi components** and a **Kubernetes deploy bundle** for multi-tenant AI control planes across SaaS and customer-owned environments.

Companion to [ai-control-plane](https://github.com/LoluPapi/ai-control-plane) (application logic + live demo).

> Personal open-source demo under [LoluPapi](https://github.com/LoluPapi).

## Design principle

> I would not create four unrelated platforms. I would create reusable Pulumi components with environment-specific stacks and capability flags.

```
pulumi-ai-platform/
  components/          ← AiPlatform Pulumi component (LiteLLM, KServe, vector store)
  stacks/              ← saas-gcp, customer-aws, customer-azure, customer-onprem
  deploy/kubernetes/   ← LiteLLM + KServe + control-plane API, kubectl apply -k
  esc/                 ← Pulumi ESC environment (secrets over GCP Secret Manager)
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
| `saas-gcp` | GCP | ✅ | ✅ | Shared SaaS — cost-optimised routing |
| `customer-aws` | AWS | ✅ | ❌ (default) | Enterprise buyer, EU residency |
| `customer-azure` | Azure | ✅ | ❌ | Customer-owned Azure AKS |
| `customer-onprem` | On-prem | ✅ | ❌ | Air-gapped, GPU on-prem |

## Deploy with Pulumi

```bash
npm install
pulumi login
pulumi stack init saas-gcp   # or select existing
pulumi config set kubernetes:context my-cluster
pulumi up
```

Stack config templates live in `stacks/<name>/Pulumi.<name>.yaml`.

## Deploy with kubectl (no Pulumi needed)

For a quick cluster demo:

```bash
# Create secrets first (see deploy/kubernetes/README.md)
kubectl apply -k deploy/kubernetes
```

This deploys LiteLLM, a KServe vLLM simulator, **and** the
[ai-control-plane](https://github.com/LoluPapi/ai-control-plane) API
(`ghcr.io/lolupapi/ai-control-plane`) wired to the gateway — a complete
request path in one apply.

## Secrets with Pulumi ESC

`esc/ai-platform-dev.yaml` shows the pattern: ESC environments composing over
GCP Secret Manager with OIDC (no long-lived keys), consumed identically by
stacks, CI, and developers:

```bash
pulumi env run ai-platform/dev -- uvicorn control_plane.api:app
```

## Outputs

| Output | Description |
|--------|-------------|
| `namespace` | `ai-platform` Kubernetes namespace |
| `litellmEndpoint` | OpenAI-compatible URL for app wiring |
| `kserveEnabled` | Whether InferenceService was provisioned |
| `capabilityFlags` | Feature flags for compliance review |

## Wire the control plane

```text
LITELLM_BASE_URL=http://litellm.ai-platform.svc.cluster.local:4000/v1
LITELLM_API_KEY=<virtual key>
```

Point [ai-control-plane](https://github.com/LoluPapi/ai-control-plane) at this endpoint with `--mode llm`.

## Related repos

| Repo | Role |
|------|------|
| [ai-control-plane](https://github.com/LoluPapi/ai-control-plane) | Application control plane + live CLI demo |
| [pulumi-ai-platform](https://github.com/LoluPapi/pulumi-ai-platform) | This repo — IaC + Kubernetes bundle |
| [foundry-agent-evals](https://github.com/LoluPapi/foundry-agent-evals) | Evaluations as a blocking CI gate |

## Key design points

1. **Capability flags** — `externalProvidersAllowed: false` locks sensitive tenants to self-hosted vLLM
2. **LiteLLM profiles** — `saas` vs `enterprise-locked` vs `onprem` routing strategies
3. **Data residency labels** — namespace labels for policy enforcement
4. **One component, many stacks** — not four copy-pasted platforms

## License

MIT

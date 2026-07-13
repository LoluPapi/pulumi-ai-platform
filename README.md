# Pulumi AI Platform

Reusable **Pulumi components** and a **Kubernetes deploy bundle** for multi-tenant AI control planes across SaaS and customer-owned environments.

Companion to [ai-control-plane](https://github.com/LoluPapi/ai-control-plane) (application logic + live demo).

> All repos are personal open-source demos under [LoluPapi](https://github.com/LoluPapi). Safe to share in interviews — no proprietary company code.

## Design principle

> I would not create four unrelated platforms. I would create reusable Pulumi components with environment-specific stacks and capability flags.

```
pulumi-ai-platform/
  components/          ← AiPlatform Pulumi component (LiteLLM, KServe, vector store)
  stacks/              ← saas-gcp, customer-aws, customer-azure, customer-onprem
  deploy/kubernetes/   ← kubectl apply -k deploy/kubernetes
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

## Portfolio (LoluPapi — safe to share)

| Repo | Role |
|------|------|
| [ai-control-plane](https://github.com/LoluPapi/ai-control-plane) | Application control plane + live CLI demo |
| [pulumi-ai-platform](https://github.com/LoluPapi/pulumi-ai-platform) | This repo — IaC + Kubernetes bundle |
| [foundry-agent-evals](https://github.com/LoluPapi/foundry-agent-evals) | Evaluations as a blocking CI gate |

## Interview talking points

1. **Capability flags** — `externalProvidersAllowed: false` locks sensitive tenants to self-hosted vLLM
2. **LiteLLM profiles** — `saas` vs `enterprise-locked` vs `onprem` routing strategies
3. **Data residency labels** — namespace labels for policy enforcement
4. **One component, many stacks** — not four copy-pasted platforms

## License

MIT

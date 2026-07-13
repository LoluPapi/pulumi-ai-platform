# Kubernetes deploy bundle

Minimal LiteLLM + KServe simulator for demo clusters. No proprietary code — safe to share.

## Prerequisites

- Kubernetes cluster with KServe installed (Standard mode)
- `kubectl` configured

## Secrets

Create before applying:

```bash
kubectl create namespace ai-platform --dry-run=client -o yaml | kubectl apply -f -

kubectl -n ai-platform create secret generic litellm-secrets \
  --from-literal=LITELLM_MASTER_KEY="$(openssl rand -hex 32)" \
  --from-literal=LITELLM_SALT_KEY="$(openssl rand -hex 32)" \
  --from-literal=VLLM_API_KEY="$(openssl rand -hex 16)"
```

## Apply

```bash
kubectl apply -k deploy/kubernetes
kubectl -n ai-platform rollout status deploy/litellm --timeout=180s
```

## Smoke test

```bash
export LITELLM_MASTER_KEY="$(kubectl -n ai-platform get secret litellm-secrets -o jsonpath='{.data.LITELLM_MASTER_KEY}' | base64 -d)"
kubectl -n ai-platform port-forward svc/litellm 4000:4000 &

curl -s http://localhost:4000/v1/models \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

## Wire ai-control-plane

```bash
export LITELLM_BASE_URL=http://localhost:4000/v1
export LITELLM_API_KEY="$LITELLM_MASTER_KEY"
aicp run commerce --mode llm
```

## Model aliases

| Alias | Use case |
|-------|----------|
| `small-extractor` | Simple commerce / RFQ requests |
| `premium-extractor` | Complex multi-field extraction |
| `local-qwen-eu` | Sensitive tenants — self-hosted only |

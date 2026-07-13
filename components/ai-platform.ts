/**
 * AiPlatform — reusable Pulumi component for multi-tenant AI control planes.
 *
 * One component library, environment-specific stacks:
 *   - saas-gcp
 *   - customer-aws
 *   - customer-azure
 *   - customer-onprem
 */
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export type CloudProvider = "gcp" | "aws" | "azure" | "onprem";
export type DataResidency = "eu" | "us" | "global";

export interface AiPlatformArgs {
  /** Cloud or on-prem target */
  provider: CloudProvider;
  /** Region for data residency (e.g. europe-west4, eu-west-1) */
  region: string;
  /** Route inference to self-hosted KServe/vLLM */
  selfHostedModels: boolean;
  /** Allow OpenAI / Anthropic / Azure OpenAI via LiteLLM */
  externalProvidersAllowed: boolean;
  /** GPU class for KServe InferenceService (null = CPU-only demo) */
  gpuType?: string | null;
  /** Data residency policy flag */
  dataResidency: DataResidency;
  /** Enable Prometheus + Grafana observability bundle */
  observability?: boolean;
  /** Deploy in-cluster vector store (Qdrant stand-in) */
  vectorStore?: boolean;
  /** LiteLLM routing config profile */
  litellmProfile?: "saas" | "enterprise-locked" | "onprem";
}

export interface AiPlatformOutputs {
  namespace: pulumi.Output<string>;
  litellmEndpoint: pulumi.Output<string>;
  kserveEnabled: pulumi.Output<boolean>;
  capabilityFlags: pulumi.Output<Record<string, boolean>>;
}

export class AiPlatform extends pulumi.ComponentResource {
  public readonly outputs: AiPlatformOutputs;

  constructor(
    name: string,
    args: AiPlatformArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("stratiflux:ai:AiPlatform", name, {}, opts);

    const ns = new k8s.core.v1.Namespace(
      `${name}-ai-platform`,
      {
        metadata: {
          name: "ai-platform",
          labels: {
            "app.kubernetes.io/part-of": "ai-control-plane",
            "stratiflux.io/data-residency": args.dataResidency,
            "stratiflux.io/provider": args.provider,
          },
        },
      },
      { parent: this },
    );

    const litellmConfig = buildLiteLLMConfig(args);
    const litellmCm = new k8s.core.v1.ConfigMap(
      `${name}-litellm-config`,
      {
        metadata: { name: "litellm-config", namespace: ns.metadata.name },
        data: { "config.yaml": litellmConfig },
      },
      { parent: this },
    );

    const litellmDeploy = new k8s.apps.v1.Deployment(
      `${name}-litellm`,
      {
        metadata: {
          name: "litellm",
          namespace: ns.metadata.name,
          labels: { app: "litellm" },
        },
        spec: {
          replicas: args.provider === "onprem" ? 2 : 1,
          selector: { matchLabels: { app: "litellm" } },
          template: {
            metadata: { labels: { app: "litellm" } },
            spec: {
              containers: [
                {
                  name: "litellm",
                  image: "ghcr.io/berriai/litellm:main-stable",
                  args: ["--config", "/etc/litellm/config.yaml"],
                  ports: [{ containerPort: 4000 }],
                  volumeMounts: [
                    { name: "config", mountPath: "/etc/litellm" },
                  ],
                  env: [
                    {
                      name: "LITELLM_MASTER_KEY",
                      valueFrom: {
                        secretKeyRef: {
                          name: "litellm-secrets",
                          key: "LITELLM_MASTER_KEY",
                        },
                      },
                    },
                  ],
                },
              ],
              volumes: [
                {
                  name: "config",
                  configMap: { name: litellmCm.metadata.name },
                },
              ],
            },
          },
        },
      },
      { parent: this },
    );

    const litellmSvc = new k8s.core.v1.Service(
      `${name}-litellm-svc`,
      {
        metadata: { name: "litellm", namespace: ns.metadata.name },
        spec: {
          selector: { app: "litellm" },
          ports: [{ port: 4000, targetPort: 4000 }],
        },
      },
      { parent: this },
    );

    if (args.selfHostedModels) {
      new k8s.apiextensions.CustomResource(
        `${name}-vllm-isvc`,
        {
          apiVersion: "serving.kserve.io/v1beta1",
          kind: "InferenceService",
          metadata: {
            name: "stratisell-extractor",
            namespace: ns.metadata.name,
            annotations: {
              "serving.kserve.io/deploymentMode": "Standard",
            },
          },
          spec: {
            predictor: {
              model: {
                modelFormat: { name: "vllm" },
                runtime: args.gpuType ? "vllm-gpu" : "vllm-cpu",
                storageUri: "hf://Qwen/Qwen2.5-0.5B-Instruct",
              },
            },
          },
        },
        { parent: this },
      );
    }

    if (args.vectorStore) {
      new k8s.apps.v1.Deployment(
        `${name}-vector-store`,
        {
          metadata: {
            name: "vector-store",
            namespace: ns.metadata.name,
          },
          spec: {
            replicas: 1,
            selector: { matchLabels: { app: "vector-store" } },
            template: {
              metadata: { labels: { app: "vector-store" } },
              spec: {
                containers: [
                  {
                    name: "qdrant",
                    image: "qdrant/qdrant:v1.9.2",
                    ports: [{ containerPort: 6333 }],
                  },
                ],
              },
            },
          },
        },
        { parent: this },
      );
    }

    const capabilityFlags: Record<string, boolean> = {
      selfHostedModels: args.selfHostedModels,
      externalProvidersAllowed: args.externalProvidersAllowed,
      observability: args.observability ?? true,
      vectorStore: args.vectorStore ?? true,
      gpuEnabled: Boolean(args.gpuType),
    };

    this.outputs = {
      namespace: ns.metadata.name,
      litellmEndpoint: pulumi.interpolate`http://litellm.${ns.metadata.name}.svc.cluster.local:4000/v1`,
      kserveEnabled: pulumi.output(args.selfHostedModels),
      capabilityFlags: pulumi.output(capabilityFlags),
    };

    this.registerOutputs({
      namespace: this.outputs.namespace,
      litellmEndpoint: this.outputs.litellmEndpoint,
      kserveEnabled: this.outputs.kserveEnabled,
      capabilityFlags: this.outputs.capabilityFlags,
    });
  }
}

function buildLiteLLMConfig(args: AiPlatformArgs): string {
  const models: string[] = [];

  if (args.selfHostedModels) {
    models.push(`
      - model_name: small-extractor
        litellm_params:
          model: openai/stratisell-extractor
          api_base: http://stratisell-extractor-predictor.ai-platform.svc.cluster.local/v1
          api_key: os.environ/VLLM_API_KEY
        model_info:
          mode: chat
          owned_by: platform`);

    if (args.externalProvidersAllowed) {
      models.push(`
      - model_name: premium-extractor
        litellm_params:
          model: openai/gpt-4o-mini
          api_key: os.environ/OPENAI_API_KEY
        model_info:
          mode: chat
          owned_by: platform`);
    }
  }

  if (!args.externalProvidersAllowed) {
    models.push(`
      - model_name: local-qwen-eu
        litellm_params:
          model: openai/stratisell-extractor
          api_base: http://stratisell-extractor-predictor.ai-platform.svc.cluster.local/v1
          api_key: os.environ/VLLM_API_KEY
        model_info:
          mode: chat
          owned_by: customer
          description: EU-resident self-hosted extractor — no external providers`);
  }

  const profile = args.litellmProfile ?? "saas";
  const routing =
    profile === "enterprise-locked"
      ? "simple-shuffle"
      : "usage-based-routing-v2";

  return `
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  store_model_in_db: false

router_settings:
  routing_strategy: ${routing}
  enable_pre_call_checks: true
  timeout: 45

litellm_settings:
  success_callback: ["prometheus"]
  failure_callback: ["prometheus"]
  drop_params: true

model_list:${models.join("")}
`.trim();
}

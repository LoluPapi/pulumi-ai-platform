/**
 * Stack entrypoint — select stack with: pulumi stack select <name>
 *
 * Stacks:
 *   saas-gcp          — StratiSell SaaS, external + self-hosted
 *   customer-aws      — Customer-owned AWS, GPU optional
 *   customer-azure    — Customer-owned Azure (mirrors stratiflux-infra)
 *   customer-onprem   — Air-gapped, self-hosted only
 */
import * as pulumi from "@pulumi/pulumi";
import { AiPlatform } from "./components";

const config = new pulumi.Config();
const stack = pulumi.getStack();

const defaults: Record<string, ConstructorParameters<typeof AiPlatform>[1]> = {
  "saas-gcp": {
    provider: "gcp",
    region: config.get("region") ?? "europe-west4",
    selfHostedModels: true,
    externalProvidersAllowed: true,
    gpuType: null,
    dataResidency: "eu",
    litellmProfile: "saas",
    observability: true,
    vectorStore: true,
  },
  "customer-aws": {
    provider: "aws",
    region: config.get("region") ?? "eu-west-1",
    selfHostedModels: true,
    externalProvidersAllowed: config.getBoolean("externalProvidersAllowed") ?? false,
    gpuType: config.get("gpuType") ?? "nvidia-l4",
    dataResidency: "eu",
    litellmProfile: "enterprise-locked",
    observability: true,
    vectorStore: true,
  },
  "customer-azure": {
    provider: "azure",
    region: config.get("region") ?? "westeurope",
    selfHostedModels: true,
    externalProvidersAllowed: false,
    gpuType: config.get("gpuType") ?? null,
    dataResidency: "eu",
    litellmProfile: "enterprise-locked",
    observability: true,
    vectorStore: true,
  },
  "customer-onprem": {
    provider: "onprem",
    region: config.get("region") ?? "dc1",
    selfHostedModels: true,
    externalProvidersAllowed: false,
    gpuType: config.get("gpuType") ?? "nvidia-a10",
    dataResidency: "eu",
    litellmProfile: "onprem",
    observability: true,
    vectorStore: true,
  },
};

const args = defaults[stack];
if (!args) {
  throw new Error(
    `Unknown stack "${stack}". Use one of: ${Object.keys(defaults).join(", ")}`,
  );
}

const platform = new AiPlatform(stack, args);

export const namespace = platform.outputs.namespace;
export const litellmEndpoint = platform.outputs.litellmEndpoint;
export const kserveEnabled = platform.outputs.kserveEnabled;
export const capabilityFlags = platform.outputs.capabilityFlags;

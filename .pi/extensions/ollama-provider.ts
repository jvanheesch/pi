import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";

const OLLAMA_BASE_URL = process.env.PI_OLLAMA_BASE_URL ?? "http://host.docker.internal:11434";
const OLLAMA_OPENAI_BASE_URL = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/v1`;
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`;

interface OllamaModelTag {
	name: string;
}

interface OllamaTagsResponse {
	models: OllamaModelTag[];
}

function isOllamaTagsResponse(value: unknown): value is OllamaTagsResponse {
	if (typeof value !== "object" || value === null || !("models" in value)) return false;
	const models = (value as { models: unknown }).models;
	return Array.isArray(models) && models.every((model) => {
		return typeof model === "object" && model !== null && typeof (model as { name?: unknown }).name === "string";
	});
}

function toProviderModel(id: string): ProviderModelConfig {
	return {
		id,
		name: `${id} (Ollama)`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16384,
		compat: {
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
		},
	};
}

export default async function (pi: ExtensionAPI) {
	const response = await fetch(OLLAMA_TAGS_URL);
	if (!response.ok) {
		throw new Error(`Ollama model discovery failed: ${response.status} ${response.statusText}`);
	}

	const tagsResponse: unknown = await response.json();
	if (!isOllamaTagsResponse(tagsResponse)) {
		throw new Error("Ollama model discovery returned an unexpected response.");
	}

	const models = tagsResponse.models.map((model) => toProviderModel(model.name));
	if (models.length === 0) {
		throw new Error("Ollama is running, but no local models are installed.");
	}

	pi.registerProvider("ollama", {
		name: "Ollama",
		baseUrl: OLLAMA_OPENAI_BASE_URL,
		api: "openai-completions",
		apiKey: "ollama",
		models,
	});
}

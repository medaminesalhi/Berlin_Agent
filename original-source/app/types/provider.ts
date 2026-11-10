export type ProviderType = 
  | "openai"
  | "azure"
  | "anthropic"
  | "groq"
  | "ollama"
  | "deepseek"
  | "custom";

export interface LLMProvider {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  enabled: boolean;
  createdAt: number;
}

export interface ProviderFormData {
  name: string;
  type: ProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  apiVersion: string;
  deployment: string;
}

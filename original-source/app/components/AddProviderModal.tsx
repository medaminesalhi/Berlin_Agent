"use client";

import { useState } from "react";
import { X, Plus, Info } from "lucide-react";
import { ProviderType, ProviderFormData } from "../types/provider";

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (formData: ProviderFormData) => void;
}

const PROVIDER_TEMPLATES: Record<ProviderType, { label: string; fields: string[]; defaults: Partial<ProviderFormData> }> = {
  openai: {
    label: "OpenAI",
    fields: ["name", "model", "apiKey"],
    defaults: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" }
  },
  azure: {
    label: "Azure OpenAI",
    fields: ["name", "model", "apiKey", "baseUrl", "apiVersion", "deployment"],
    defaults: { model: "gpt-4o-mini", apiVersion: "2024-02-15-preview" }
  },
  anthropic: {
    label: "Anthropic Claude",
    fields: ["name", "model", "apiKey"],
    defaults: { model: "claude-3-5-sonnet-20241022", baseUrl: "https://api.anthropic.com" }
  },
  groq: {
    label: "Groq",
    fields: ["name", "model", "apiKey"],
    defaults: { model: "llama-3.1-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" }
  },
  ollama: {
    label: "Ollama (Local)",
    fields: ["name", "model", "baseUrl"],
    defaults: { model: "llama3.2", baseUrl: "http://localhost:11434" }
  },
  deepseek: {
    label: "DeepSeek",
    fields: ["name", "model", "apiKey"],
    defaults: { model: "deepseek-chat", baseUrl: "https://api.deepseek.com" }
  },
  custom: {
    label: "Custom Provider",
    fields: ["name", "model", "apiKey", "baseUrl"],
    defaults: { model: "gpt-4o-mini" }
  }
};

export function AddProviderModal({ isOpen, onClose, onAdd }: AddProviderModalProps) {
  const [selectedType, setSelectedType] = useState<ProviderType>("openai");
  const [formData, setFormData] = useState<ProviderFormData>({
    name: "",
    type: "openai",
    model: "gpt-4o-mini",
    apiKey: "",
    baseUrl: "",
    apiVersion: "",
    deployment: ""
  });

  if (!isOpen) return null;

  const template = PROVIDER_TEMPLATES[selectedType];

  const handleTypeChange = (type: ProviderType) => {
    setSelectedType(type);
    setFormData({
      ...formData,
      type,
      ...PROVIDER_TEMPLATES[type].defaults
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
    onClose();
    // Reset form
    setFormData({
      name: "",
      type: "openai",
      model: "gpt-4o-mini",
      apiKey: "",
      baseUrl: "",
      apiVersion: "",
      deployment: ""
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add LLM Provider</h2>
              <p className="text-xs text-slate-500">Configure a new language model provider</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Provider Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Provider Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PROVIDER_TEMPLATES) as ProviderType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedType === type
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {PROVIDER_TEMPLATES[type].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Name */}
            {template.fields.includes("name") && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Provider Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., My OpenAI Account"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            )}

            {/* Model */}
            {template.fields.includes("model") && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Model Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  placeholder={template.defaults.model}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            )}

            {/* API Key */}
            {template.fields.includes("apiKey") && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  API Key {selectedType !== "ollama" && "*"}
                </label>
                <input
                  type="password"
                  required={selectedType !== "ollama"}
                  value={formData.apiKey}
                  onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                />
              </div>
            )}

            {/* Base URL */}
            {template.fields.includes("baseUrl") && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base URL
                </label>
                <input
                  type="url"
                  value={formData.baseUrl}
                  onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder={template.defaults.baseUrl}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                />
              </div>
            )}

            {/* Azure Specific Fields */}
            {selectedType === "azure" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    API Version
                  </label>
                  <input
                    type="text"
                    value={formData.apiVersion}
                    onChange={e => setFormData({ ...formData, apiVersion: e.target.value })}
                    placeholder="2024-02-15-preview"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Deployment Name
                  </label>
                  <input
                    type="text"
                    value={formData.deployment}
                    onChange={e => setFormData({ ...formData, deployment: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  />
                </div>
              </>
            )}

            {/* Info Box */}
            <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Provider Configuration</p>
                <p className="text-xs text-blue-700">
                  Your API keys are stored locally in your browser and never sent to our servers.
                  They are only used to make direct requests to the LLM provider.
                </p>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
          >
            Add Provider
          </button>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { LLMProvider, ProviderFormData } from "../types/provider";

const STORAGE_KEY = "llm_providers";

// Default providers
const DEFAULT_PROVIDERS: LLMProvider[] = [
  {
    id: "azure-default",
    name: "Azure GPT-4o Mini",
    type: "azure",
    model: "gpt-4o-mini",
    enabled: true,
    createdAt: Date.now()
  }
];

export function useProviders() {
  const [providers, setProviders] = useState<LLMProvider[]>(DEFAULT_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("azure-default");

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setProviders(parsed.providers || DEFAULT_PROVIDERS);
        setSelectedProviderId(parsed.selectedProviderId || "azure-default");
      } catch (e) {
        console.error("Failed to parse stored providers:", e);
      }
    }
  }, []);

  // Save to localStorage whenever providers change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ providers, selectedProviderId })
    );
  }, [providers, selectedProviderId]);

  const addProvider = (formData: ProviderFormData) => {
    const newProvider: LLMProvider = {
      id: `${formData.type}-${Date.now()}`,
      name: formData.name,
      type: formData.type,
      model: formData.model,
      apiKey: formData.apiKey || undefined,
      baseUrl: formData.baseUrl || undefined,
      apiVersion: formData.apiVersion || undefined,
      deployment: formData.deployment || undefined,
      enabled: true,
      createdAt: Date.now()
    };

    setProviders(prev => [...prev, newProvider]);
    return newProvider.id;
  };

  const updateProvider = (id: string, updates: Partial<LLMProvider>) => {
    setProviders(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deleteProvider = (id: string) => {
    setProviders(prev => prev.filter(p => p.id !== id));
    if (selectedProviderId === id) {
      setSelectedProviderId(providers[0]?.id || "");
    }
  };

  const toggleProvider = (id: string) => {
    setProviders(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return {
    providers,
    selectedProvider,
    selectedProviderId,
    setSelectedProviderId,
    addProvider,
    updateProvider,
    deleteProvider,
    toggleProvider
  };
}

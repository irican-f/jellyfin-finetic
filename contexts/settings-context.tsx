"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface BitrateOption {
  value: string;
  label: string;
  bitrate: number;
}

export const BITRATE_OPTIONS: BitrateOption[] = [
  { value: "auto", label: "Auto", bitrate: 0 },
  { value: "20000", label: "20 Mbps (4K)", bitrate: 20000000 },
  { value: "8000", label: "8 Mbps (1080p)", bitrate: 8000000 },
  { value: "4000", label: "4 Mbps (720p)", bitrate: 4000000 },
  { value: "2000", label: "2 Mbps (480p)", bitrate: 2000000 },
  { value: "1000", label: "1 Mbps (360p)", bitrate: 1000000 },
];

export type AIProvider = "gemini" | "ollama" | "groq" | "openrouter";

interface SettingsContextType {
  videoBitrate: string;
  setVideoBitrate: (bitrate: string) => void;
  navigatorEnabled: boolean;
  setNavigatorEnabled: (enabled: boolean) => void;
  aiProvider: AIProvider;
  setAiProvider: (provider: AIProvider) => void;
  // model settings
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (url: string) => void;
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
  groqModel: string;
  setGroqModel: (model: string) => void;
  openrouterModel: string;
  setOpenrouterModel: (model: string) => void;
  // API keys
  googleApiKey: string;
  setGoogleApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  openrouterApiKey: string;
  setOpenrouterApiKey: (key: string) => void;
  preferredAudioLanguage: string;
  setPreferredAudioLanguage: (lang: string) => void;
  preferredSubtitleLanguage: string;
  setPreferredSubtitleLanguage: (lang: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [videoBitrate, setVideoBitrateState] = useState<string>("auto");
  const [navigatorEnabled, setNavigatorEnabledState] = useState<boolean>(true);
  const [aiProvider, setAiProviderState] = useState<AIProvider>("gemini");
  const [ollamaBaseUrl, setOllamaBaseUrlState] = useState<string>(
    "http://localhost:11434"
  );
  const [ollamaModel, setOllamaModelState] = useState<string>("phi3");
  const [groqModel, setGroqModelState] = useState<string>("llama3-8b-8192");
  const [openrouterModel, setOpenrouterModelState] = useState<string>(
    "qwen/qwen3-coder:free"
  );

  // API Key states
  const [googleApiKey, setGoogleApiKeyState] = useState<string>("");
  const [groqApiKey, setGroqApiKeyState] = useState<string>("");
  const [openrouterApiKey, setOpenrouterApiKeyState] = useState<string>("");
  const [preferredAudioLanguage, setPreferredAudioLanguageState] =
    useState<string>("eng");
  const [preferredSubtitleLanguage, setPreferredSubtitleLanguageState] =
    useState<string>("eng");

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedBitrate = localStorage.getItem("finetic-video-bitrate");
    if (
      savedBitrate &&
      BITRATE_OPTIONS.some((option) => option.value === savedBitrate)
    ) {
      setVideoBitrateState(savedBitrate);
    }

    const savedNavigatorEnabled = localStorage.getItem(
      "finetic-navigator-enabled"
    );
    if (savedNavigatorEnabled !== null) {
      setNavigatorEnabledState(savedNavigatorEnabled === "true");
    }

    const savedAiProvider = localStorage.getItem(
      "finetic-ai-provider"
    ) as AIProvider;
    if (
      savedAiProvider &&
      ["gemini", "ollama", "groq", "openrouter"].includes(savedAiProvider)
    ) {
      setAiProviderState(savedAiProvider);
    }

    const savedOllamaBaseUrl = localStorage.getItem("finetic-ollama-base-url");
    if (savedOllamaBaseUrl) {
      setOllamaBaseUrlState(savedOllamaBaseUrl);
    }

    const savedOllamaModel = localStorage.getItem("finetic-ollama-model");
    if (savedOllamaModel) {
      setOllamaModelState(savedOllamaModel);
    }

    const savedGroqModel = localStorage.getItem("finetic-groq-model");
    if (savedGroqModel) {
      setGroqModelState(savedGroqModel);
    }

    const savedOpenrouterModel = localStorage.getItem(
      "finetic-openrouter-model"
    );
    if (savedOpenrouterModel) {
      setOpenrouterModelState(savedOpenrouterModel);
    }

    // Load API key settings
    const savedGoogleApiKey = localStorage.getItem("finetic-google-api-key");
    if (savedGoogleApiKey) {
      setGoogleApiKeyState(savedGoogleApiKey);
    }

    const savedGroqApiKey = localStorage.getItem("finetic-groq-api-key");
    if (savedGroqApiKey) {
      setGroqApiKeyState(savedGroqApiKey);
    }

    const savedOpenrouterApiKey = localStorage.getItem("finetic-openrouter-api-key");
    if (savedOpenrouterApiKey) {
      setOpenrouterApiKeyState(savedOpenrouterApiKey);
    }
    const savedAudioLanguage = localStorage.getItem(
      "finetic-preferred-audio-language",
    );
    if (savedAudioLanguage) {
      setPreferredAudioLanguageState(savedAudioLanguage);
    }
    const savedSubtitleLanguage = localStorage.getItem(
      "finetic-preferred-subtitle-language",
    );
    if (savedSubtitleLanguage) {
      setPreferredSubtitleLanguageState(savedSubtitleLanguage);
    }
  }, []);

  // Save to localStorage when states change
  const setVideoBitrate = (bitrate: string) => {
    setVideoBitrateState(bitrate);
    localStorage.setItem("finetic-video-bitrate", bitrate);
  };

  const setNavigatorEnabled = (enabled: boolean) => {
    setNavigatorEnabledState(enabled);
    localStorage.setItem("finetic-navigator-enabled", enabled.toString());
  };

  const setAiProvider = (provider: AIProvider) => {
    setAiProviderState(provider);
    localStorage.setItem("finetic-ai-provider", provider);
  };

  const setOllamaBaseUrl = (url: string) => {
    setOllamaBaseUrlState(url);
    localStorage.setItem("finetic-ollama-base-url", url);
  };

  const setOllamaModel = (model: string) => {
    setOllamaModelState(model);
    localStorage.setItem("finetic-ollama-model", model);
  };

  const setGroqModel = (model: string) => {
    setGroqModelState(model);
    localStorage.setItem("finetic-groq-model", model);
  };

  const setOpenrouterModel = (model: string) => {
    setOpenrouterModelState(model);
    localStorage.setItem("finetic-openrouter-model", model);
  };

  // API Key setters
  const setGoogleApiKey = (key: string) => {
    setGoogleApiKeyState(key);
    localStorage.setItem("finetic-google-api-key", key);
  };

  const setGroqApiKey = (key: string) => {
    setGroqApiKeyState(key);
    localStorage.setItem("finetic-groq-api-key", key);
  };

  const setOpenrouterApiKey = (key: string) => {
    setOpenrouterApiKeyState(key);
    localStorage.setItem("finetic-openrouter-api-key", key);
  };

  const setPreferredAudioLanguage = (lang: string) => {
    setPreferredAudioLanguageState(lang);
    localStorage.setItem("finetic-preferred-audio-language", lang);
  };

  const setPreferredSubtitleLanguage = (lang: string) => {
    setPreferredSubtitleLanguageState(lang);
    localStorage.setItem("finetic-preferred-subtitle-language", lang);
  };

  return (
    <SettingsContext.Provider
      value={{
        videoBitrate,
        setVideoBitrate,
        navigatorEnabled,
        setNavigatorEnabled,
        aiProvider,
        setAiProvider,
        ollamaBaseUrl,
        setOllamaBaseUrl,
        ollamaModel,
        setOllamaModel,
        groqModel,
        setGroqModel,
        openrouterModel,
        setOpenrouterModel,
        googleApiKey,
        setGoogleApiKey,
        groqApiKey,
        setGroqApiKey,
        openrouterApiKey,
        setOpenrouterApiKey,
        preferredAudioLanguage,
        setPreferredAudioLanguage,
        preferredSubtitleLanguage,
        setPreferredSubtitleLanguage,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

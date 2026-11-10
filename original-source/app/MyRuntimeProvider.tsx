"use client";

import { AssistantRuntimeProvider, useLocalRuntime, useAssistantRuntime } from "@assistant-ui/react";
import { ReactNode, createContext, useContext, useState, useEffect } from "react";
import { LLMProvider } from "./types/provider";

// Shared Scraper state context
interface ScrapedDataContextType {
  scrapedData: any[];
  setScrapedData: (data: any[]) => void;
  logs: string[];
  setLogs: (logs: string[] | ((prev: string[]) => string[])) => void;
  isScraping: boolean;
  setIsScraping: (val: boolean) => void;
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  selectedProvider: LLMProvider | undefined;
  sendMessage: (message: string) => void;
}

const ScrapedDataContext = createContext<ScrapedDataContextType | undefined>(undefined);

export function useScrapedData() {
  const context = useContext(ScrapedDataContext);
  if (!context) {
    throw new Error("useScrapedData must be used within a ScrapedDataProvider");
  }
  return context;
}

interface MyRuntimeProviderProps {
  children: ReactNode;
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  selectedProvider: LLMProvider | undefined;
}

export function MyRuntimeProvider({ 
  children, 
  selectedProviderId, 
  setSelectedProviderId,
  selectedProvider 
}: MyRuntimeProviderProps) {
  const [scrapedData, setScrapedData] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [runtimeInstance, setRuntimeInstance] = useState<any>(null);

  const runtime = useLocalRuntime({
    async *run(options) {
      const lastMessage = options.messages[options.messages.length - 1];
      let query = "";
      if (lastMessage && lastMessage.role === "user") {
        query = lastMessage.content
          .filter((part): part is { type: "text"; text: string } => part.type === "text")
          .map(part => part.text)
          .join("");
      }

      setIsScraping(true);
      setLogs([]);
      setScrapedData([]);

      // Yield initial empty state
      yield { content: [{ type: "text", text: "" }] };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: query }],
            provider: selectedProvider,
          })
        });

        if (!response.body) {
          setIsScraping(false);
          setLogs((prev) => [...prev, "❌ No response body received from server"]);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Stream completed successfully
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const parsed = JSON.parse(line);

              if (parsed.type === "progress") {
                const cleanMsg = parsed.message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                setLogs((prev) => [...prev, cleanMsg]);
              } else if (parsed.type === "result") {
                setScrapedData(parsed.data || []);
                setIsScraping(false);
                setLogs((prev) => [...prev, `✅ Success! Extracted ${parsed.data?.length || 0} items. View in table browser.`]);
              }
            } catch (e) {
              // Ignore JSON parse errors for partial lines
            }
          }
        }
      } catch (err: any) {
        // Only log error if it's not a stream completion
        if (err.message && !err.message.includes("input stream")) {
          setLogs((prev) => [...prev, `❌ Error: ${err.message}`]);
        }
        setIsScraping(false);
      } finally {
        setIsScraping(false);
      }
    }
  });

  useEffect(() => {
    setRuntimeInstance(runtime);
  }, [runtime]);

  const sendMessage = (message: string) => {
    if (runtimeInstance) {
      // Use the correct API to send a message
      runtimeInstance.thread.append({
        role: "user",
        content: [{ type: "text", text: message }]
      });
    }
  };

  return (
    <ScrapedDataContext.Provider value={{ 
      scrapedData, 
      setScrapedData, 
      logs, 
      setLogs, 
      isScraping, 
      setIsScraping, 
      selectedProviderId, 
      setSelectedProviderId,
      selectedProvider,
      sendMessage
    }}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </ScrapedDataContext.Provider>
  );
}

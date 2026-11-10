"use client";

import { Thread } from "@assistant-ui/react";
import { MyRuntimeProvider, useScrapedData } from "./MyRuntimeProvider";
import { useState, useEffect, useRef } from "react";
import { useProviders } from "./hooks/useProviders";
import { AddProviderModal } from "./components/AddProviderModal";
import { ChatInput } from "./components/ChatInput";
import {
  Database,
  Terminal as TermIcon,
  Download,
  Table as TableIcon,
  Code,
  Layers,
  Sparkles,
  Globe,
  ChevronDown,
  Plus,
  Settings,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";

export default function ScraperDashboard() {
  const providerHook = useProviders();
  
  return (
    <MyRuntimeProvider
      selectedProviderId={providerHook.selectedProviderId}
      setSelectedProviderId={providerHook.setSelectedProviderId}
      selectedProvider={providerHook.selectedProvider}
    >
      <DashboardContent providerHook={providerHook} />
    </MyRuntimeProvider>
  );
}

function DashboardContent({ providerHook }: { providerHook: ReturnType<typeof useProviders> }) {
  const { scrapedData, logs, isScraping, selectedProviderId, setSelectedProviderId, selectedProvider, sendMessage } = useScrapedData();
  const [activeTab, setActiveTab] = useState<"table" | "json">("table");
  const [providerOpen, setProviderOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (message: string) => {
    if (!selectedProvider) {
      alert("Please select an LLM provider first");
      return;
    }
    sendMessage(message);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProviderOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const downloadCSV = () => {
    if (!scrapedData || scrapedData.length === 0) return;
    const allKeys = Array.from(new Set(scrapedData.flatMap(item => Object.keys(item))));
    const headers = allKeys.join(",");
    const rows = scrapedData.map(row =>
      allKeys.map(key => {
        const val = row[key] === undefined || row[key] === null ? "" : String(row[key]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scraped_dataset_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = () => {
    if (!scrapedData || scrapedData.length === 0) return;
    const jsonContent = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scraped_dataset_${Date.now()}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProviderBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      azure: "bg-sky-50 text-sky-700 border-sky-200",
      openai: "bg-green-50 text-green-700 border-green-200",
      anthropic: "bg-purple-50 text-purple-700 border-purple-200",
      groq: "bg-orange-50 text-orange-700 border-orange-200",
      ollama: "bg-emerald-50 text-emerald-700 border-emerald-200",
      deepseek: "bg-blue-50 text-blue-700 border-blue-200",
      custom: "bg-slate-50 text-slate-700 border-slate-200"
    };
    return colors[type] || colors.custom;
  };

  const currentProvider = providerHook.selectedProvider;

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">

      {/* ── LEFT PANEL ── */}
      <div className="w-1/2 flex flex-col h-full border-r border-slate-200 bg-white relative">
        <div className="absolute -left-32 -top-32 w-96 h-96 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between z-10 bg-white/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-600/15">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-md font-semibold tracking-tight text-slate-900 font-outfit flex items-center gap-2">
                Scraper Agent Cockpit
                {isScraping && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500">Headless Lightpanda Browser Platform</p>
            </div>
          </div>

          <span className="text-[10px] bg-slate-100 border border-slate-200/60 text-slate-600 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-indigo-600" />
            CDP: ws://127.0.0.1:9222
          </span>
        </div>

        {/* Metrics — 2 cards only */}
        <div className="p-5 grid grid-cols-2 gap-3 z-10">
          <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/65 hover:border-slate-300 transition-all flex flex-col justify-between shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</span>
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`h-2 w-2 rounded-full ${isScraping ? "bg-amber-500 animate-pulse" : "bg-green-500"}`} />
              <span className="text-sm font-semibold text-slate-800">{isScraping ? "Scraping…" : "Idle / Ready"}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/65 hover:border-slate-300 transition-all flex flex-col justify-between shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Extracted Records</span>
            <span className="text-lg font-bold text-slate-900 mt-1 font-outfit">{scrapedData?.length || 0}</span>
          </div>
        </div>

        {/* Data Result Browser */}
        <div className="flex-1 px-5 pb-5 flex flex-col overflow-hidden z-10">
          <div className="flex-1 flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm">

            {/* Tab Headers */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                <button
                  onClick={() => setActiveTab("table")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${activeTab === "table" ? "bg-white text-slate-900 shadow-sm border border-slate-200/30" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Table Browser
                </button>
                <button
                  onClick={() => setActiveTab("json")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all ${activeTab === "json" ? "bg-white text-slate-900 shadow-sm border border-slate-200/30" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <Code className="h-3.5 w-3.5" />
                  Raw JSON
                </button>
              </div>

              {Array.isArray(scrapedData) && scrapedData.length > 0 && (
                <div className="flex items-center gap-2">
                  {activeTab === "table" && (
                    <button
                      onClick={downloadCSV}
                      className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV
                    </button>
                  )}
                  {activeTab === "json" && (
                    <button
                      onClick={downloadJSON}
                      className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download JSON
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-auto p-4 bg-slate-50/10">
              {Array.isArray(scrapedData) && scrapedData.length > 0 ? (
                activeTab === "table" ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/40">
                          {Object.keys(scrapedData[0] || {}).map(key => (
                            <th key={key} className="py-2.5 px-3 font-semibold text-slate-600 tracking-wider uppercase text-[10px]">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scrapedData.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            {Object.keys(scrapedData[0] || {}).map((key, cellIdx) => (
                              <td key={cellIdx} className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate">
                                {typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="text-xs text-slate-700 font-mono p-4 bg-slate-50/70 overflow-auto h-full border border-slate-200/80 rounded-lg">
                    {JSON.stringify(scrapedData, null, 2)}
                  </pre>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-12">
                  <Database className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-500">Dataset Browser Empty</p>
                  <p className="text-xs text-slate-400 max-w-[280px] text-center mt-1">
                    Once the Stagehand crawler finishes, extracted items will display here.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-1/2 flex flex-col h-full bg-white relative">

        {/* Chat Header — provider selector */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white z-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-slate-500 font-medium">Scraper Engine</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Add Provider Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Provider
            </button>

            {/* Provider Dropdown */}
            <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProviderOpen(o => !o)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm text-xs font-medium text-slate-700 min-w-[200px]"
            >
              {currentProvider ? (
                <>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${getProviderBadgeColor(currentProvider.type)}`}>
                    {currentProvider.type.toUpperCase()}
                  </span>
                  <span className="flex-1 text-left truncate">{currentProvider.name}</span>
                </>
              ) : (
                <span className="flex-1 text-left text-slate-400">No provider</span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${providerOpen ? "rotate-180" : ""}`} />
            </button>

            {providerOpen && (
              <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 z-[100] overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">LLM Providers</p>
                  <button
                    onClick={() => { setShowAddModal(true); setProviderOpen(false); }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {providerHook.providers.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-slate-500 mb-2">No providers configured</p>
                      <button
                        onClick={() => { setShowAddModal(true); setProviderOpen(false); }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Add your first provider
                      </button>
                    </div>
                  ) : (
                    providerHook.providers.map(prov => (
                      <div
                        key={prov.id}
                        className={`flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors ${
                          prov.id === selectedProviderId ? "bg-indigo-50/60" : ""
                        }`}
                      >
                        <button
                          onClick={() => { setSelectedProviderId(prov.id); setProviderOpen(false); }}
                          className="flex-1 flex flex-col gap-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${getProviderBadgeColor(prov.type)}`}>
                              {prov.type.toUpperCase()}
                            </span>
                            <p className="text-xs font-medium text-slate-800 flex-1 truncate">{prov.name}</p>
                            {prov.id === selectedProviderId && (
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono pl-0.5">{prov.model}</p>
                        </button>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => providerHook.toggleProvider(prov.id)}
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title={prov.enabled ? "Disable" : "Enable"}
                          >
                            {prov.enabled ? (
                              <Power className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <PowerOff className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete provider "${prov.name}"?`)) {
                                providerHook.deleteProvider(prov.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Add Provider Modal */}
        <AddProviderModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={(formData) => {
            const newId = providerHook.addProvider(formData);
            setSelectedProviderId(newId);
          }}
        />

        {/* Chat Area with Live Console */}
        <div className="flex-1 overflow-hidden flex flex-col z-10 bg-slate-50/10">
          
          {/* Live Crawler Console */}
          <div className="flex-1 border-x border-t border-slate-200 bg-white overflow-hidden flex flex-col shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 flex items-center gap-2">
              <TermIcon className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">Live Crawler Console</span>
              {isScraping && (
                <span className="ml-auto flex items-center gap-1.5 text-[10px] text-amber-600 font-medium">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  Scraping...
                </span>
              )}
            </div>
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto text-slate-600 space-y-2 bg-slate-50/30">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="p-4 rounded-full bg-indigo-50 mb-4">
                    <TermIcon className="h-8 w-8 text-indigo-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Ready to Scrape</p>
                  <p className="text-xs text-slate-500 max-w-md">
                    Ask me to find and scrape any information. I will automatically query SearXNG, 
                    launch the headless Lightpanda browser, analyze page patterns, generate CSS schemas, 
                    and extract structured data!
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-400">
                    <Globe className="h-3.5 w-3.5" />
                    <span>Connected to CDP: ws://127.0.0.1:9222</span>
                  </div>
                </div>
              ) : (
                <>
                  {logs.map((logLine, idx) => (
                    <div key={idx} className="leading-relaxed border-l-2 border-indigo-400/50 pl-3 py-1 hover:bg-white/50 transition-colors">
                      {logLine}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Hidden Thread for runtime */}
          <div className="hidden">
            <Thread />
          </div>

          {/* Custom Chat Input */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={isScraping}
            placeholder="Ask me to scrape any website... (e.g., 'Find the top 10 books on books.toscrape.com')"
          />
        </div>

      </div>
    </div>
  );
}

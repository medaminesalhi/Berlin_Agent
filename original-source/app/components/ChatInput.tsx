"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Loader2, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = "Ask me to scrape any website..." }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
          
          {/* Attachment Button (optional) */}
          <button
            type="button"
            disabled={disabled}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-800 placeholder:text-slate-400 min-h-[24px] max-h-[200px] py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: "auto" }}
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="flex-shrink-0 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 shadow-sm hover:shadow-md"
            title="Send message"
          >
            {disabled ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Helper Text */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${disabled ? "bg-amber-500 animate-pulse" : "bg-green-500"}`} />
            {disabled ? "Processing..." : "Ready"}
          </span>
        </div>
      </div>
    </div>
  );
}

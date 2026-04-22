"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type ImageContent = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};

type TextContent = {
  type: "text";
  text: string;
};

type ContentBlock = TextContent | ImageContent;

type Message = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  imagePreview?: string;
};

function LuminaAvatar() {
  return (
    <div
      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-gray-800 mt-1"
      style={{ backgroundColor: "#ffdf5e" }}
    >
      LV
    </div>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mediaType: string;
    preview: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem("lumina_api_key");
    if (stored) setSavedKey(stored);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSaveKey = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem("lumina_api_key", apiKey.trim());
    setSavedKey(apiKey.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type;
      setPendingImage({ base64, mediaType, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sendMessage = async (msgs: Message[]) => {
    setLoading(true);
    setError("");

    const apiMessages = msgs.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, apiKey: savedKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba serveru");
      const assistantMsg: Message = {
        role: "assistant",
        content: data.text,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (savedKey && !initialized.current) {
      initialized.current = true;
      const initMsg: Message = { role: "user", content: "Ahoj!" };
      setMessages([initMsg]);
      sendMessage([initMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const handleSend = async () => {
    if (!input.trim() && !pendingImage) return;
    if (loading) return;

    let userContent: string | ContentBlock[];

    if (pendingImage) {
      const blocks: ContentBlock[] = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: pendingImage.mediaType,
            data: pendingImage.base64,
          },
        },
      ];
      if (input.trim()) blocks.push({ type: "text", text: input.trim() });
      userContent = blocks;
    } else {
      userContent = input.trim();
    }

    const userMsg: Message = {
      role: "user",
      content: userContent,
      imagePreview: pendingImage?.preview,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    await sendMessage(newMessages);
  };

  const getTextFromContent = (content: string | ContentBlock[]): string => {
    if (typeof content === "string") return content;
    return content
      .filter((b): b is TextContent => b.type === "text")
      .map((b) => b.text)
      .join(" ");
  };

  if (!savedKey) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#e8f5f4" }}>
        <header className="py-8 px-8 text-left" style={{ backgroundColor: "#ffdf5e" }}>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Lumina Vision
          </h1>
          <p className="mt-2 text-gray-700 font-medium">
            Když chceš, aby vizuál nebyl jen hezký, ale i chytrý.
          </p>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Ahoj! Jsem Lumina Vision
            </h2>
            <p className="text-gray-600 mb-6">
              Zadej svůj Anthropic API klíč pro spuštění
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              placeholder="sk-ant-..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300 mb-4"
              style={{ fontFamily: "inherit" }}
            />
            <button
              onClick={handleSaveKey}
              className="w-full py-3 rounded-xl font-semibold text-gray-900 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#ffdf5e" }}
            >
              Jdeme na to!
            </button>
          </div>
        </main>

        <footer className="py-4 text-center text-sm text-gray-700 font-medium" style={{ backgroundColor: "#ffdf5e" }}>
          Lumina Vision © Vladi Vavroušková / 2026
        </footer>
      </div>
    );
  }

  const visibleMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        getTextFromContent(m.content) === "Ahoj!" &&
        !m.imagePreview
      )
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#e8f5f4" }}>
      <header className="py-5 px-8 text-left shrink-0" style={{ backgroundColor: "#ffdf5e" }}>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Lumina Vision
        </h1>
        <p className="mt-1 text-gray-700 font-medium text-sm">
          Když chceš, aby vizuál nebyl jen hezký, ale i chytrý.
        </p>
      </header>

      <main className="flex-1 overflow-y-auto w-full px-8 py-6" style={{ minHeight: 0 }}>
        <div className="flex flex-col gap-4">
          {visibleMessages.map((msg, i) => {
            const isLumina = msg.role === "assistant";
            const text = getTextFromContent(msg.content);

            if (isLumina) {
              return (
                <div key={i} className="flex flex-row items-start gap-2">
                  <LuminaAvatar />
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm bg-white text-gray-900">
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          hr: () => <hr className="my-3 border-gray-200" />,
                          h1: ({ children }) => <h1 className="text-base font-bold mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                          code: ({ children }) => <code className="bg-gray-100 rounded px-1 text-xs">{children}</code>,
                        }}
                      >
                        {text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex flex-row-reverse items-start gap-2">
                <div
                  className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-gray-900"
                  style={{ backgroundColor: "#ffdf5e" }}
                >
                  {msg.imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.imagePreview}
                      alt="Nahraný obrázek"
                      className="rounded-xl mb-2 max-w-full max-h-60 object-contain"
                    />
                  )}
                  {text && (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex flex-row items-start gap-2">
              <LuminaAvatar />
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <span className="text-gray-400 text-sm animate-pulse">Lumina píše...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 px-8 pt-4 pb-3" style={{ backgroundColor: "#ffdf5e" }}>
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.preview}
              alt="Náhled"
              className="h-16 w-16 object-cover rounded-xl border border-gray-200"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="text-xs text-gray-700 hover:text-red-600 transition-colors"
            >
              Odebrat
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white rounded-2xl shadow-sm border border-gray-200 px-3 py-2 mb-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Nahrát obrázek"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiš zprávu Lumině..."
            rows={1}
            className="flex-1 resize-none text-sm text-gray-900 focus:outline-none py-1 leading-relaxed bg-transparent"
            style={{ fontFamily: "inherit", maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !pendingImage)}
            className="shrink-0 p-2 rounded-xl font-semibold text-gray-900 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#ffdf5e" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-gray-700 font-medium">
          Lumina Vision © Vladi Vavroušková / 2026
        </p>
      </footer>
    </div>
  );
}

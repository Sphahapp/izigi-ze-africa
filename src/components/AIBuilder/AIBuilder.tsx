import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SambaNovaModel } from "@/types/models";
import { getSambaNovaApiKey } from "@/utils/apiKeys";
import { streamChat, extractCodeFromMarkdown } from "@/lib/sambanova";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import ParticleField from "@/components/ParticleField";

const placeholderModels: SambaNovaModel[] = [
  {
    id: "Llama-4-Maverick-17B-128E-Instruct",
    displayName: "Llama 4 Maverick 17B Instruct",
    provider: "sambanova",
    capabilities: { text: true, code: true, image: true, video: false, threeD: false },
    contextWindow: 128000,
    maxOutputTokens: 8192,
  },
  {
    id: "Llama-3.1-70B-Instruct",
    displayName: "Llama 3.1 70B Instruct",
    provider: "sambanova",
    capabilities: { text: true, code: true, image: false, video: false, threeD: false },
    contextWindow: 32768,
    maxOutputTokens: 4096,
  },
];

export const AIBuilder = () => {
  const [selectedModelId, setSelectedModelId] = useState<string>(placeholderModels[0]?.id ?? "");
  const [mode, setMode] = useState<"website" | "app" | "game">("website");
  const [prompt, setPrompt] = useState("");
  const [previewType, setPreviewType] = useState<"image" | "video" | "3d" | "app">("image");
  const [editorText, setEditorText] = useState("// Your generated code will appear here.\n// Monaco editor will be integrated in a later step.\n");
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [assets, setAssets] = useState<File[]>([]);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [codeDialogText, setCodeDialogText] = useState("");
  const codeDialogRef = useRef<HTMLTextAreaElement | null>(null);
  const [codeDialogSelection, setCodeDialogSelection] = useState<{ start: number; end: number } | null>(null);
  const [codeAiPrompt, setCodeAiPrompt] = useState("");
  const [isCodeAiEditing, setIsCodeAiEditing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [textStyle, setTextStyle] = useState<"normal" | "transparent" | "knockout">("normal");

  const selectedModel = useMemo(
    () => placeholderModels.find((m) => m.id === selectedModelId) ?? placeholderModels[0],
    [selectedModelId]
  );

  const buildSrcDoc = (content: string): string => {
    const hasDoctype = /<!doctype html>/i.test(content);
    const hasHtml = /<html[\s>]/i.test(content);
    if (hasDoctype || hasHtml) return content;
    const looksLikeHtml = /<(head|body|div|section|main|h1|h2|p|script|style)[\s>]/i.test(content);
    if (looksLikeHtml) {
      return `<!doctype html>\n<html><head><meta charset=\"utf-8\"/></head><body>${content}</body></html>`;
    }
    // Fallback: render as preformatted text
    const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<!doctype html>\n<html><head><meta charset=\"utf-8\"/></head><body><pre>${escaped}</pre></body></html>`;
  };

  const injectBackground = (htmlOrText: string, imageUrl: string): string => {
    // If plain text, wrap first
    let doc = buildSrcDoc(htmlOrText);
    // Insert a style block before </head> if possible, else add to top of <body>
    const style = `<style>body{background-image:url('${imageUrl}');background-size:cover;background-position:center;background-repeat:no-repeat;min-height:100vh;}</style>`;
    if (doc.includes("</head>")) return doc.replace("</head>", `${style}</head>`);
    return doc.replace("<body>", `<body>${style}`);
  };

  const injectTextStyle = (htmlOrText: string, styleKind: "normal" | "transparent" | "knockout"): string => {
    let doc = buildSrcDoc(htmlOrText);
    let css = "";
    if (styleKind === "transparent") {
      css = `h1,h2,h3,h4,h5,h6,p,span,li,button,a{color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.9);text-shadow:0 0 8px rgba(0,0,0,.5);} strong, b{ -webkit-text-stroke: 1.25px rgba(255,255,255,.95);} `;
    } else if (styleKind === "knockout") {
      css = `h1,h2,h3,h4,h5,h6,p,span,li,button,a{color:#fff;mix-blend-mode:difference;text-shadow:0 0 6px rgba(0,0,0,.6);} `;
    } else {
      css = `h1,h2,h3,h4,h5,h6,p,span,li,button,a{color:inherit;-webkit-text-stroke:0;text-shadow:none;mix-blend-mode:normal;}`;
    }
    const style = `<style id="ai-text-style">${css}</style>`;
    // Replace existing if present
    if (doc.includes("id=\"ai-text-style\"")) {
      doc = doc.replace(/<style id=\"ai-text-style\">[\s\S]*?<\/style>/, style);
      return doc;
    }
    if (doc.includes("</head>")) return doc.replace("</head>", `${style}</head>`);
    return doc.replace("<body>", `<body>${style}`);
  };

  // Local autosave (editor, prompt, mode, model)
  const STORAGE_KEY = "ai_builder_project_v1";
  // Load on mount
  if (typeof window !== "undefined") {
    // avoid multiple loads due to React strict effects by guarding on empty states
    if (!prompt && editorText.startsWith("// Your generated code")) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as { editorText?: string; prompt?: string; mode?: typeof mode; selectedModelId?: string };
          if (data.editorText) setEditorText(data.editorText);
          if (data.prompt) setPrompt(data.prompt);
          if (data.mode) setMode(data.mode);
          if (data.selectedModelId) setSelectedModelId(data.selectedModelId);
        }
      } catch {}
    }
  }

  // Debounced autosave
  let autosaveTimer: number | undefined;
  const scheduleAutosave = () => {
    if (typeof window === "undefined") return;
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      try {
        const payload = {
          editorText,
          prompt,
          mode,
          selectedModelId,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setLastSavedAt(Date.now());
      } catch {}
    }, 800);
  };

  // Fullscreen helpers
  const enterFullscreen = async () => {
    const el = previewContainerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      // @ts-ignore
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      // @ts-ignore
      else if (el.msRequestFullscreen) await el.msRequestFullscreen();
    } catch (e: any) {
      toast({ title: "Fullscreen failed", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      // @ts-ignore
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      // @ts-ignore
      else if (document.msExitFullscreen) await document.msExitFullscreen();
    } catch (e: any) {
      toast({ title: "Exit fullscreen failed", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    // @ts-ignore
    document.addEventListener("webkitfullscreenchange", onChange);
    // @ts-ignore
    document.addEventListener("MSFullscreenChange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // @ts-ignore
      document.removeEventListener("webkitfullscreenchange", onChange);
      // @ts-ignore
      document.removeEventListener("MSFullscreenChange", onChange);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-deepseek-dark/60 border-deepseek-gray-700">
          <div className="space-y-2">
            <div className="text-sm text-deepseek-gray-300">Model</div>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="bg-deepseek-darker border-deepseek-gray-700">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="bg-deepseek-dark border-deepseek-gray-700">
                {placeholderModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-deepseek-gray-400">
              Context: {selectedModel.contextWindow.toLocaleString()} • Max out: {selectedModel.maxOutputTokens}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-deepseek-dark/60 border-deepseek-gray-700">
          <div className="space-y-2">
            <div className="text-sm text-deepseek-gray-300">Mode</div>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
              <TabsList className="bg-deepseek-darker">
                <TabsTrigger value="website">Website</TabsTrigger>
                <TabsTrigger value="app">App</TabsTrigger>
                <TabsTrigger value="game">Game</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>

        <Card className="p-4 bg-deepseek-dark/60 border-deepseek-gray-700">
          <div className="space-y-2">
            <div className="text-sm text-deepseek-gray-300">Prompt</div>
            <Textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onClick={() => promptRef.current?.focus()}
              placeholder="Describe what to generate..."
              className="bg-deepseek-darker border-deepseek-gray-700 min-h-20 pointer-events-auto relative z-10 text-white font-bold placeholder:text-deepseek-gray-400"
              rows={3}
              autoFocus
              aria-label="Generation prompt"
              onInput={() => scheduleAutosave()}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-deepseek-electric text-black hover:opacity-90"
                disabled={isGenerating}
                onClick={async () => {
                  if (!prompt.trim()) {
                    toast({ title: "Add a prompt", description: "Please describe what to generate.", variant: "default" });
                    promptRef.current?.focus();
                    return;
                  }
                  const apiKey = getSambaNovaApiKey();
                  if (!apiKey) {
                    toast({ title: "API key missing", description: "Save your SambaNova API key in the API Key section.", variant: "destructive" });
                    return;
                  }
                  setIsGenerating(true);
                  setPreviewType("app");
                  setEditorText("<!-- generating... -->");
                  try {
                    const messages = [
                      {
                        role: "user" as const,
                        content: [
                          { type: "text" as const, text: `Generate a minimal ${mode} as standalone HTML/CSS/JS in one fenced code block.` },
                          { type: "text" as const, text: `Requirements: ${prompt}` },
                        ],
                      },
                    ];
                    let accumulated = "";
                    for await (const chunk of streamChat(apiKey, selectedModel.id, messages)) {
                      accumulated += chunk;
                      const code = extractCodeFromMarkdown(accumulated);
                      if (code) {
                        const withBg = mode === "website" && backgroundUrl ? injectBackground(code, backgroundUrl) : code;
                        setEditorText(withBg);
                      }
                    }
                    const finalCode = extractCodeFromMarkdown(accumulated) ?? accumulated;
                    const finalWithBg = mode === "website" && backgroundUrl ? injectBackground(finalCode, backgroundUrl) : finalCode;
                    setEditorText(finalWithBg);
                    toast({ title: "Generation complete", description: "Preview updated." });
                  } catch (err: any) {
                    toast({ title: "Generation failed", description: String(err?.message ?? err), variant: "destructive" });
                  } finally {
                    setIsGenerating(false);
                  }
                }}
              >
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-deepseek-gray-700"
                onClick={() => setAiEditOpen(true)}
              >
                AI Edit
              </Button>
            </div>

            {mode === "website" && (
              <div className="space-y-2 pt-2">
                <div className="text-sm text-deepseek-gray-300">Background image (optional)</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={backgroundUrl}
                    onChange={(e) => setBackgroundUrl(e.target.value)}
                    placeholder="Paste image URL or choose from assets"
                    className="flex-1 bg-deepseek-darker border border-deepseek-gray-700 rounded px-2 py-2 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-deepseek-gray-700"
                    onClick={() => {
                      if (!backgroundUrl.trim()) {
                        toast({ title: "No background set", description: "Provide an image URL or pick from assets." });
                        return;
                      }
                      setEditorText((prev) => injectBackground(prev, backgroundUrl));
                      toast({ title: "Background applied", description: "Body background updated." });
                    }}
                  >
                    Apply
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-deepseek-gray-300">Text style:</span>
                  <Button
                    variant={textStyle === "normal" ? "default" : "outline"}
                    size="sm"
                    className={textStyle === "normal" ? "bg-deepseek-electric text-black" : "border-deepseek-gray-700"}
                    onClick={() => { setTextStyle("normal"); setEditorText((prev) => injectTextStyle(prev, "normal")); }}
                  >
                    Normal
                  </Button>
                  <Button
                    variant={textStyle === "transparent" ? "default" : "outline"}
                    size="sm"
                    className={textStyle === "transparent" ? "bg-deepseek-electric text-black" : "border-deepseek-gray-700"}
                    onClick={() => { setTextStyle("transparent"); setEditorText((prev) => injectTextStyle(prev, "transparent")); }}
                  >
                    Transparent
                  </Button>
                  <Button
                    variant={textStyle === "knockout" ? "default" : "outline"}
                    size="sm"
                    className={textStyle === "knockout" ? "bg-deepseek-electric text-black" : "border-deepseek-gray-700"}
                    onClick={() => { setTextStyle("knockout"); setEditorText((prev) => injectTextStyle(prev, "knockout")); }}
                  >
                    Knockout
                  </Button>
                </div>
                {assets.some((a) => /\.(png|jpe?g|webp|gif|svg)$/i.test(a.name)) && (
                  <div className="flex flex-wrap gap-2 text-xs text-deepseek-gray-300">
                    {assets.filter((a) => /\.(png|jpe?g|webp|gif|svg)$/i.test(a.name)).map((img, i) => (
                      <button
                        key={`${img.name}-${i}`}
                        type="button"
                        className="px-2 py-1 border border-deepseek-gray-700 rounded hover:bg-deepseek-darker"
                        onClick={() => {
                          const assetPath = `assets/${img.name}`;
                          setBackgroundUrl(assetPath);
                          setEditorText((prev) => injectBackground(prev, assetPath));
                          toast({ title: "Background applied", description: img.name });
                        }}
                      >
                        Use {img.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden bg-deepseek-dark/60 border-deepseek-gray-700">
        <div className="border-b border-deepseek-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="text-sm text-deepseek-gray-300">Preview</div>
          <div className="flex gap-2">
            <Tabs value={previewType} onValueChange={(v) => setPreviewType(v as any)}>
              <TabsList className="bg-deepseek-darker">
                <TabsTrigger value="image">Image</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="3d">3D</TabsTrigger>
                <TabsTrigger value="app">App</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              className="border-deepseek-gray-700"
              onClick={() => (isFullscreen ? exitFullscreen() : enterFullscreen())}
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-deepseek-gray-700"
              onClick={() => { setCodeDialogText(editorText); setCodeDialogOpen(true); }}
            >
              View / Edit Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-deepseek-gray-700"
              onClick={async () => {
                try {
                  const zip = new JSZip();
                  // Add main document
                  const indexHtml = buildSrcDoc(editorText);
                  zip.file("index.html", indexHtml);
                  // Add assets into assets/ folder
                  const folder = zip.folder("assets");
                  if (folder) {
                    for (const f of assets) {
                      const buf = await f.arrayBuffer();
                      folder.file(f.name, buf);
                    }
                  }
                  const blob = await zip.generateAsync({ type: "blob" });
                  saveAs(blob, `ai-builder-${mode}.zip`);
                  toast({ title: "Exported", description: "ZIP downloaded." });
                } catch (e: any) {
                  toast({ title: "Export failed", description: String(e?.message ?? e), variant: "destructive" });
                }
              }}
            >
              Export ZIP
            </Button>
          </div>
        </div>
        <div ref={previewContainerRef} className="h-[320px] md:h-[420px] flex items-center justify-center bg-deepseek-darker relative overflow-hidden">
          {previewType === "image" && (
            <>
              <ParticleField density={0.02} maxSize={1.8} speed={0.7} className="absolute inset-0" />
              <img
                src="/ChatGPT Image Oct 4, 2025, 07_53_38 AM.png"
                alt="Preview"
                className="relative z-10 h-64 w-64 object-contain drop-shadow-[0_0_18px_rgba(0,255,255,0.25)]"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = "/ChatGPT Image Oct 4, 2025, 07_53_38 AM.png";
                }}
              />
            </>
          )}
          {previewType === "video" && (
            <video
              className="max-h-full"
              controls
              onError={() => {/* graceful fallback, could show toast */}}
            >
              <source src="" type="video/mp4" />
              <source src="" type="video/webm" />
            </video>
          )}
          {previewType === "3d" && (
            <div className="text-deepseek-gray-400 text-sm">3D preview will appear here (three.js)</div>
          )}
          {previewType === "app" && (
            <iframe
              title="App Preview"
              className="w-full h-full bg-white"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={buildSrcDoc(editorText)}
            />
          )}
        </div>
      </Card>

      <Card className="p-4 bg-deepseek-dark/60 border-deepseek-gray-700">
        <div className="text-sm mb-2 text-deepseek-gray-300">Editor (placeholder)</div>
        <textarea
          className="w-full h-48 bg-deepseek-darker border border-deepseek-gray-700 rounded p-2 text-sm pointer-events-auto relative z-10"
          ref={editorRef}
          value={editorText}
          onChange={(e) => { setEditorText(e.target.value); scheduleAutosave(); }}
          onSelect={() => {
            if (!editorRef.current) return;
            setSelection({ start: editorRef.current.selectionStart, end: editorRef.current.selectionEnd });
          }}
          aria-label="Editor"
        />
        <div className="mt-4 space-y-2">
          <div className="text-sm text-deepseek-gray-300">Assets (max 500MB each)</div>
          <input
            type="file"
            multiple
            accept=".html,.htm,.css,.js,.json,.svg,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.pdf,.csv,.xlsx,.xls,.txt,.md,.glb,.gltf,.obj,.fbx,.ico,.ttf,.otf,.woff,.woff2"
            onChange={(e) => {
              const inputEl = e.target as HTMLInputElement;
              const files = Array.from(inputEl.files ?? []);
              if (files.length === 0) return;
              const tooBig = files.find((f) => f.size > 500 * 1024 * 1024);
              if (tooBig) {
                toast({ title: "File too large", description: `${tooBig.name} exceeds 500MB.`, variant: "destructive" });
                inputEl.value = ""; // reset so same file can be reselected
                return;
              }
              // De-duplicate by name+lastModified
              setAssets((prev) => {
                const existingKeys = new Set(prev.map((p) => `${p.name}|${p.lastModified}`));
                const toAdd = files.filter((f) => !existingKeys.has(`${f.name}|${f.lastModified}`));
                if (toAdd.length > 0) {
                  toast({ title: "Assets added", description: toAdd.map((f) => f.name).join(", ") });
                }
                return [...prev, ...toAdd];
              });
              inputEl.value = ""; // allow re-upload of same files
            }}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-deepseek-gray-700 file:text-white hover:file:bg-deepseek-gray-600"
          />
          <div className="text-xs text-deepseek-gray-400 flex flex-wrap gap-2 mt-1">
            {assets.length === 0 ? (
              <span>No assets uploaded yet.</span>
            ) : (
              assets.map((a, idx) => (
                <span key={`${a.name}-${a.lastModified}-${idx}`} className="inline-flex items-center gap-2 bg-deepseek-darker border border-deepseek-gray-700 px-2 py-1 rounded">
                  <span className="truncate max-w-[160px]" title={a.name}>{a.name}</span>
                  {/\.(png|jpe?g|webp|gif|svg)$/i.test(a.name) && mode === "website" && (
                    <button
                      type="button"
                      className="text-deepseek-electric hover:opacity-80"
                      onClick={() => {
                        const assetPath = `assets/${a.name}`;
                        setBackgroundUrl(assetPath);
                        setEditorText((prev) => injectBackground(prev, assetPath));
                        toast({ title: "Background applied", description: a.name });
                      }}
                    >
                      set as background
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => setAssets((prev) => prev.filter((p) => !(p.name === a.name && p.lastModified === a.lastModified)))}
                  >
                    remove
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </Card>

      <Dialog open={aiEditOpen} onOpenChange={setAiEditOpen}>
        <DialogContent className="bg-deepseek-dark border-deepseek-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">AI Edit Selection or File</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-deepseek-gray-400">
              {selection && selection.start !== selection.end
                ? `Editing selected range (${selection.start}–${selection.end})`
                : "No selection made — AI will edit the whole file."}
            </div>
            <Textarea
              value={aiEditPrompt}
              onChange={(e) => setAiEditPrompt(e.target.value)}
              placeholder="Describe the change you want (e.g., add a dark navbar)."
              className="bg-deepseek-darker border-deepseek-gray-700 min-h-24 text-white"
              rows={4}
            />
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-deepseek-gray-700"
                onClick={() => setAiEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-deepseek-electric text-black"
                onClick={async () => {
                  if (!aiEditPrompt.trim()) {
                    toast({ title: "Add edit details", description: "Describe what to change.", variant: "default" });
                    return;
                  }
                  const apiKey = getSambaNovaApiKey();
                  if (!apiKey) {
                    toast({ title: "API key missing", description: "Save your SambaNova API key in the API Key section.", variant: "destructive" });
                    return;
                  }
                  try {
                    const before = editorText;
                    const sel = selection && selection.start !== selection.end ? selection : null;
                    const scopeText = sel ? before.slice(sel.start, sel.end) : before;
                    const instruction = sel
                      ? `You are editing ONLY the following selection from a larger file. Apply the requested change to just this selection and return ONLY the updated selection inside one fenced code block. Do not include commentary.\n\n<selection>\n${scopeText}\n</selection>`
                      : `You are editing an entire file. Apply the requested change and return ONLY the full updated file inside one fenced code block. Do not include commentary.\n\n<file>\n${scopeText}\n</file>`;

                    const messages = [
                      { role: "system" as const, content: [{ type: "text" as const, text: "Return only code in a single fenced block." }] },
                      { role: "user" as const, content: [
                        { type: "text" as const, text: instruction },
                        { type: "text" as const, text: `Change request: ${aiEditPrompt}` },
                      ]},
                    ];

                    let acc = "";
                    for await (const chunk of streamChat(apiKey, selectedModel.id, messages)) {
                      acc += chunk;
                      const code = extractCodeFromMarkdown(acc);
                      if (code) {
                        if (sel) {
                          setEditorText(before.slice(0, sel.start) + code + before.slice(sel.end));
                        } else {
                          setEditorText(code);
                        }
                      }
                    }

                    const finalCode = extractCodeFromMarkdown(acc);
                    if (finalCode) {
                      if (sel) {
                        setEditorText(before.slice(0, sel.start) + finalCode + before.slice(sel.end));
                      } else {
                        setEditorText(finalCode);
                      }
                      toast({ title: "AI edit applied", description: sel ? "Selection updated." : "File updated." });
                    } else {
                      toast({ title: "No code returned", description: "The model did not return a code block.", variant: "destructive" });
                    }
                    setAiEditOpen(false);
                  } catch (e: any) {
                    toast({ title: "AI edit failed", description: String(e?.message ?? e), variant: "destructive" });
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="bg-deepseek-dark border-deepseek-gray-700 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">Code</DialogTitle>
          </DialogHeader>
          <Textarea
            value={codeDialogText}
            ref={codeDialogRef}
            onSelect={() => {
              if (!codeDialogRef.current) return;
              setCodeDialogSelection({ start: codeDialogRef.current.selectionStart, end: codeDialogRef.current.selectionEnd });
            }}
            onChange={(e) => setCodeDialogText(e.target.value)}
            className="bg-deepseek-darker border-deepseek-gray-700 text-white min-h-[420px]"
          />
          <DialogFooter>
            <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
              <div className="flex-1 flex items-center gap-2">
                <Textarea
                  value={codeAiPrompt}
                  onChange={(e) => setCodeAiPrompt(e.target.value)}
                  placeholder={codeDialogSelection && codeDialogSelection.start !== codeDialogSelection.end ? "AI edit selected range..." : "AI edit whole code..."}
                  className="bg-deepseek-darker border-deepseek-gray-700 text-white min-h-[44px]"
                  rows={2}
                />
                <Button
                  className="bg-deepseek-electric text-black"
                  disabled={isCodeAiEditing}
                  onClick={async () => {
                    if (!codeAiPrompt.trim()) {
                      toast({ title: "Add edit details", description: "Describe what to change.", variant: "default" });
                      return;
                    }
                    const apiKey = getSambaNovaApiKey();
                    if (!apiKey) {
                      toast({ title: "API key missing", description: "Save your SambaNova API key in the API Key section.", variant: "destructive" });
                      return;
                    }
                    try {
                      setIsCodeAiEditing(true);
                      const before = codeDialogText;
                      const sel = codeDialogSelection && codeDialogSelection.start !== codeDialogSelection.end ? codeDialogSelection : null;
                      const scopeText = sel ? before.slice(sel.start, sel.end) : before;
                      const instruction = sel
                        ? `You are editing ONLY the following selection. Return ONLY the updated selection inside one fenced code block. No commentary.\n\n<selection>\n${scopeText}\n</selection>`
                        : `You are editing the entire file. Return ONLY the full updated file inside one fenced code block. No commentary.\n\n<file>\n${scopeText}\n</file>`;
                      const messages = [
                        { role: "system" as const, content: [{ type: "text" as const, text: "Return only code in a single fenced block." }] },
                        { role: "user" as const, content: [
                          { type: "text" as const, text: instruction },
                          { type: "text" as const, text: `Change request: ${codeAiPrompt}` },
                        ]},
                      ];
                      let acc = "";
                      for await (const chunk of streamChat(apiKey, selectedModel.id, messages)) {
                        acc += chunk;
                        const code = extractCodeFromMarkdown(acc);
                        if (code) {
                          if (sel) {
                            setCodeDialogText(before.slice(0, sel.start) + code + before.slice(sel.end));
                          } else {
                            setCodeDialogText(code);
                          }
                        }
                      }
                      const finalCode = extractCodeFromMarkdown(acc);
                      if (finalCode) {
                        if (sel) {
                          setCodeDialogText(before.slice(0, sel.start) + finalCode + before.slice(sel.end));
                        } else {
                          setCodeDialogText(finalCode);
                        }
                        toast({ title: "AI edit applied", description: sel ? "Selection updated." : "File updated." });
                      } else {
                        toast({ title: "No code returned", description: "The model did not return a code block.", variant: "destructive" });
                      }
                    } catch (e: any) {
                      toast({ title: "AI edit failed", description: String(e?.message ?? e), variant: "destructive" });
                    } finally {
                      setIsCodeAiEditing(false);
                    }
                  }}
                >
                  {isCodeAiEditing ? "AI Editing..." : "AI Edit"}
                </Button>
              </div>
              <Button
                variant="outline"
                className="border-deepseek-gray-700"
                onClick={() => setCodeDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                className="bg-deepseek-electric text-black"
                onClick={() => {
                  setEditorText(codeDialogText);
                  setCodeDialogOpen(false);
                  if (previewType === "app") {
                    toast({ title: "Updated", description: "Preview refreshed." });
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIBuilder;



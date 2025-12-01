
import { useEffect, useState } from "react";
import { FileText, Upload, Loader2, X, MessageSquare, Globe, Volume2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  file?: File;
  url?: string;
}

export const DocumentAnalyzer = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  // Load available voices once and try to default to a male-sounding voice
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
      if (!voiceName && vs.length) {
        const preferred = vs.find(v => /male|daniel|google uk english male|alex/i.test(v.name)) || vs[0];
        setVoiceName(preferred.name);
      }
    };
    loadVoices();
    const prev = window.speechSynthesis.onvoiceschanged;
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      // restore previous handler to be safe
      window.speechSynthesis.onvoiceschanged = prev as any;
    };
  // we intentionally omit voiceName from deps to avoid loop while setting default
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    if (uploadedFiles.length + files.length > 3) {
      toast.error("Maximum 3 files allowed");
      return;
    }

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 500MB limit`);
        continue;
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }

      try {
        let content = "";
        
        if (file.type === 'application/pdf') {
          content = "PDF content will be analyzed when questioned";
        } else if (file.type.startsWith('image/')) {
          content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        const newFile: UploadedFile = {
          id: Date.now().toString() + Math.random().toString(),
          name: file.name,
          type: file.type,
          size: file.size,
          content,
          file
        };

        setUploadedFiles(prev => [...prev, newFile]);
        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    event.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success("File removed");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchUrlContent = async () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    if (uploadedFiles.length >= 3) {
      toast.error("Maximum 3 files allowed");
      return;
    }

    setIsFetching(true);

    try {
      // Use a CORS proxy service to bypass CORS restrictions
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const data = await response.json();
      const content = data.contents;

      // Extract readable content using a simple text extraction
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      
      // Remove script and style elements
      const scripts = doc.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());
      
      // Extract text content
      const textContent = doc.body?.textContent || doc.textContent || '';
      const cleanContent = textContent.replace(/\s+/g, ' ').trim();

      if (!cleanContent) {
        throw new Error("No readable content found on the webpage");
      }

      const urlObject = new URL(urlInput);
      const fileName = urlObject.hostname + urlObject.pathname.replace(/\//g, '_') || 'webpage';

      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(),
        name: `${fileName}.txt`,
        type: 'text/plain',
        size: cleanContent.length,
        content: cleanContent,
        url: urlInput
      };

      setUploadedFiles(prev => [...prev, newFile]);
      setUrlInput("");
      toast.success(`Content fetched from ${urlObject.hostname}`);
    } catch (error) {
      console.error("Error fetching URL:", error);
      toast.error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFetching(false);
    }
  };

  const analyzeDocuments = async () => {
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    if (uploadedFiles.length === 0) {
      toast.error("Please upload at least one document or fetch a URL");
      return;
    }

    const apiKey = localStorage.getItem("sambanova_api_key");
    if (!apiKey) {
      toast.error("Please set your SambaNova API key in the Status Panel");
      return;
    }

    setIsAnalyzing(true);
    setResponse("");

    try {
      let documentContext = "Based on the following uploaded documents:\n\n";
      
      uploadedFiles.forEach((file, index) => {
        documentContext += `Document ${index + 1}: ${file.name} (${file.type})\n`;
        if (file.type.startsWith('image/')) {
          documentContext += `[Image content will be analyzed]\n`;
        } else if (file.type === 'application/pdf') {
          documentContext += `[PDF content will be analyzed]\n`;
        } else if (file.type === 'text/plain' && file.url) {
          documentContext += `Source URL: ${file.url}\n`;
          documentContext += `Content: ${file.content.substring(0, 2000)}${file.content.length > 2000 ? '...' : ''}\n`;
        }
        documentContext += "\n";
      });

      const fullPrompt = `${documentContext}

User Question: ${question}

Instructions: 
1. First, analyze the uploaded documents thoroughly for relevant information
2. If the answer can be found in the uploaded documents, provide a detailed response based on that content
3. If the documents don't contain sufficient information, clearly state this and then provide an answer based on general knowledge
4. Always indicate whether your answer comes from the uploaded documents or general knowledge`;

      // Create content array for the API call
      const messageContent: any[] = [
        {
          type: "text",
          text: fullPrompt
        }
      ];

      // Add images to the content if any
      const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/'));
      imageFiles.forEach(file => {
        messageContent.push({
          type: "image_url",
          image_url: {
            url: file.content
          }
        });
      });

      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "Llama-4-Maverick-17B-128E-Instruct",
          messages: [
            {
              role: "user",
              content: messageContent
            }
          ],
          stream: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let responseText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                responseText += content;
                setResponse(responseText);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
      
      toast.success("Document analysis completed using Llama-4-Maverick-17B");
    } catch (error) {
      console.error("Error analyzing documents:", error);
      toast.error(`Failed to analyze documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setResponse("Error: Failed to analyze documents. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakText = (text: string) => {
    try {
      if (!("speechSynthesis" in window)) {
        toast.error("Text-to-Speech not supported in this browser");
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const chosen = voices.find(v => v.name === voiceName);
      if (chosen) u.voice = chosen;
      u.rate = Math.max(0.5, Math.min(2, rate));
      u.pitch = Math.max(0.5, Math.min(2, pitch));
      u.volume = Math.max(0, Math.min(1, volume));
      u.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      u.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      u.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
      currentUtterance = u;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const pauseTts = () => {
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } catch {}
  };

  const resumeTts = () => {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      }
    } catch {}
  };

  const stopTts = () => {
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    } catch {}
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Document Analysis</h2>
        <div className="text-sm text-deepseek-gray-300">
          Llama-4-Maverick-17B Model
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Upload Section */}
        <div className="space-y-4">
          <div className="bg-deepseek-gray-800 rounded-lg p-6 border border-deepseek-gray-600 space-y-4">
            <div>
              <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
                Upload Documents ({uploadedFiles.length}/3)
              </label>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-deepseek-gray-600 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading || uploadedFiles.length >= 3}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`cursor-pointer flex flex-col items-center space-y-2 ${
                      uploadedFiles.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="h-8 w-8 text-deepseek-gray-400" />
                    <span className="text-deepseek-gray-300">
                      {isUploading ? 'Uploading...' : 'Click to upload PDFs or images'}
                    </span>
                    <span className="text-xs text-deepseek-gray-500">
                      Max 500MB per file, 3 files total
                    </span>
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Enter URL to fetch web content (bypasses CORS)"
                      className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500"
                      disabled={isFetching || uploadedFiles.length >= 3}
                    />
                  </div>
                  <Button
                    onClick={fetchUrlContent}
                    disabled={isFetching || !urlInput.trim() || uploadedFiles.length >= 3}
                    className="bg-deepseek-electric hover:bg-deepseek-cyan text-white"
                  >
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-deepseek-gray-300">
                  Uploaded Files:
                </label>
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between bg-deepseek-dark rounded p-3 border border-deepseek-gray-700"
                  >
                    <div className="flex items-center space-x-3">
                      {file.url ? (
                        <Globe className="h-4 w-4 text-deepseek-electric" />
                      ) : (
                        <FileText className="h-4 w-4 text-deepseek-electric" />
                      )}
                      <div>
                        <div className="text-white text-sm font-medium">{file.name}</div>
                        <div className="text-deepseek-gray-400 text-xs">
                          {file.url ? `URL: ${file.url}` : formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
                Ask a question about your documents:
              </label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What information can you find in these documents?"
                className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500 min-h-[100px]"
                disabled={isAnalyzing}
              />
            </div>
          </div>

          <Button
            onClick={analyzeDocuments}
            disabled={isAnalyzing || uploadedFiles.length === 0 || !question.trim()}
            className="w-full bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white font-medium h-12"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analyzing Documents...
              </>
            ) : (
              <>
                <MessageSquare className="h-5 w-5 mr-2" />
                Analyze Documents
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600 flex flex-col">
          <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
            Analysis Results:
          </label>
          <div className="flex items-center gap-2 mb-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
              disabled={!response.trim()}
              onClick={() => speakText(response)}
            >
              <Volume2 className="h-4 w-4 mr-2" /> Read Aloud
            </Button>
            {isSpeaking && !isPaused ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                onClick={pauseTts}
              >
                <Pause className="h-4 w-4 mr-2" /> Pause
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                onClick={resumeTts}
                disabled={!isSpeaking || !isPaused}
              >
                <Play className="h-4 w-4 mr-2" /> Resume
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
              onClick={stopTts}
              disabled={!isSpeaking && !isPaused}
            >
              <Square className="h-4 w-4 mr-2" /> Stop
            </Button>
            <select
              className="ml-auto bg-deepseek-dark border border-deepseek-gray-700 rounded px-2 py-1 text-xs text-white"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
            >
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-deepseek-dark rounded p-4 flex-1 border border-deepseek-gray-700 overflow-auto">
            {response ? (
              <div className="whitespace-pre-wrap text-white text-sm">
                {response}
              </div>
            ) : (
              <div className="text-deepseek-gray-500 italic">
                Upload documents and ask a question to see analysis results...
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs text-deepseek-gray-300">
            <div>
              <div className="mb-1">Speech Rate: {rate.toFixed(2)}</div>
              <input type="range" min="0.5" max="2" step="0.05" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} />
            </div>
            <div>
              <div className="mb-1">Pitch: {pitch.toFixed(2)}</div>
              <input type="range" min="0.5" max="2" step="0.05" value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} />
            </div>
            <div>
              <div className="mb-1">Volume: {Math.round(volume * 100)}%</div>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Grid, List, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ChatInterfaceProps {
  currentModel: string;
  setCurrentModel: (model: string) => void;
}

export const ChatInterface = ({ currentModel, setCurrentModel }: ChatInterfaceProps) => {
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, { content: string; isLoading: boolean; error: string | null }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(["Llama-4-Maverick-17B-128E-Instruct"]);
  const [viewMode, setViewMode] = useState<'single' | 'comparison'>('single');

  // Text-to-Speech state and setup
  const [ttsLang, setTtsLang] = useState("en-US");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [ttsPitch, setTtsPitch] = useState(1);
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsDelay, setTtsDelay] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    let isInitialLoad = true;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      voicesRef.current = voices;
      setAvailableVoices(voices);
      
      // Try to set default to Google UK English voices if available (only on initial load)
      if (isInitialLoad && voices.length > 0) {
        isInitialLoad = false;
        // Look for Google UK English Male first
        const googleUKMale = voices.find(v => 
          /google.*uk.*english.*male/i.test(v.name) || 
          /google.*en-gb.*male/i.test(v.name)
        );
        if (googleUKMale) {
          setSelectedVoice(googleUKMale.name);
          setTtsLang("en-GB");
          return;
        }
        // Then try Google UK English Female
        const googleUKFemale = voices.find(v => 
          /google.*uk.*english.*female/i.test(v.name) || 
          /google.*en-gb.*female/i.test(v.name)
        );
        if (googleUKFemale) {
          setSelectedVoice(googleUKFemale.name);
          setTtsLang("en-GB");
          return;
        }
        // Fallback to any UK English voice
        const ukEnglish = voices.find(v => v.lang === "en-GB" || v.lang?.startsWith("en-GB"));
        if (ukEnglish) {
          setSelectedVoice(ukEnglish.name);
          setTtsLang("en-GB");
          return;
        }
        // Final fallback to first available voice
        if (voices[0]) {
          setSelectedVoice(voices[0].name);
        }
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices as any;
    return () => {
      (window.speechSynthesis as any).onvoiceschanged = null;
    };
  }, []);

  const getVoiceForLang = (lang: string) => {
    const voices = voicesRef.current;
    // First try to use selected voice if it matches the language
    if (selectedVoice) {
      const selected = voices.find(v => v.name === selectedVoice);
      if (selected && (selected.lang === lang || selected.lang?.startsWith(lang.split("-")[0]))) {
        return selected;
      }
    }
    // Fallback to language matching
    const exact = voices.find(v => v.lang === lang);
    if (exact) return exact;
    const partial = voices.find(v => v.lang?.startsWith(lang.split("-")[0]));
    return partial || voices[0];
  };

  // Get Google UK English voices
  const getGoogleUKVoices = () => {
    const voices = availableVoices;
    const googleUKVoices = voices.filter(v => 
      /google.*uk.*english/i.test(v.name) || 
      /google.*en-gb/i.test(v.name) ||
      (v.lang === "en-GB" && /google/i.test(v.name))
    );
    return googleUKVoices;
  };

  // Get all available voices for a language
  const getVoicesForLang = (lang: string) => {
    return availableVoices.filter(v => 
      v.lang === lang || v.lang?.startsWith(lang.split("-")[0])
    );
  };

  const speakText = (text: string, opts?: { lang?: string; pitch?: number; rate?: number; delay?: number }) => {
    return new Promise<void>((resolve, reject) => {
      if (!("speechSynthesis" in window)) {
        toast.error("Text-to-Speech is not supported in this browser.");
        return reject(new Error("Speech synthesis unsupported"));
      }
      try {
        const { lang = ttsLang, pitch = ttsPitch, rate = ttsRate, delay = ttsDelay } = opts || {};
        const start = () => {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = lang;
          utter.pitch = pitch;
          utter.rate = rate;
          // Use selected voice if available, otherwise fall back to language matching
          let voice = null;
          if (selectedVoice) {
            voice = voicesRef.current.find(v => v.name === selectedVoice);
          }
          if (!voice) {
            voice = getVoiceForLang(lang);
          }
          if (voice) utter.voice = voice;
          utteranceRef.current = utter;
          setIsSpeaking(true);
          utter.onend = () => {
            setIsSpeaking(false);
            resolve();
          };
          utter.onerror = (e) => {
            setIsSpeaking(false);
            reject((e as any).error || new Error("TTS error"));
          };
          window.speechSynthesis.speak(utter);
        };
        if (delay && delay > 0) {
          timeoutRef.current = window.setTimeout(start, delay * 1000);
        } else {
          start();
        }
      } catch (e) {
        setIsSpeaking(false);
        reject(e);
      }
    });
  };

  const stopSpeaking = () => {
    if (!("speechSynthesis" in window)) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleSpeakResponses = async () => {
    const texts = Object.values(responses).map(r => r.content).filter(Boolean);
    if (texts.length === 0) {
      toast.info("No response to speak yet.");
      return;
    }
    await speakText(texts.join("\n\n"));
  };

  const models = [
    { value: "Llama-4-Maverick-17B-128E-Instruct", label: "Llama-4-Maverick-17B (SambaNova)" },
    { value: "gpt-4o", label: "GPT-4o (Advanced)" },
    { value: "o3-mini", label: "O3-Mini (Fast)" },
    { value: "claude-sonnet", label: "Claude Sonnet" },
    { value: "gemini-pro", label: "Gemini Pro" },
  ];

  const handleModelSelection = (modelValue: string, checked: boolean) => {
    if (checked) {
      setSelectedModels(prev => [...prev, modelValue]);
    } else {
      setSelectedModels(prev => {
        const newSelection = prev.filter(m => m !== modelValue);
        // Ensure at least one model is always selected
        return newSelection.length > 0 ? newSelection : prev;
      });
    }
  };

  const generateResponseForModel = async (modelValue: string, promptText: string) => {
    const apiKey = localStorage.getItem("sambanova_api_key");
    if (!apiKey) {
      throw new Error("Please set your SambaNova API key in the Status Panel");
    }

    // Initialize response state for this model
    setResponses(prev => ({
      ...prev,
      [modelValue]: { content: "", isLoading: true, error: null }
    }));

    try {
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
              content: promptText
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

      let fullResponse = "";
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
                fullResponse += content;
                setResponses(prev => ({
                  ...prev,
                  [modelValue]: { content: fullResponse, isLoading: true, error: null }
                }));
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      // Mark as complete
      setResponses(prev => ({
        ...prev,
        [modelValue]: { content: fullResponse, isLoading: false, error: null }
      }));

    } catch (error) {
      console.error(`Error generating response for ${modelValue}:`, error);
      setResponses(prev => ({
        ...prev,
        [modelValue]: { 
          content: "", 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (selectedModels.length === 0) {
      toast.error("Please select at least one model");
      return;
    }

    setIsLoading(true);
    setResponses({});
    
    // Set view mode based on number of selected models
    setViewMode(selectedModels.length > 1 ? 'comparison' : 'single');

    try {
      // Generate responses for all selected models simultaneously
      const promises = selectedModels.map(model => 
        generateResponseForModel(model, prompt)
      );
      
      await Promise.allSettled(promises);

      toast.success(`Responses generated for ${selectedModels.length} model${selectedModels.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error("Error generating response:", error);
      toast.error(`Failed to generate responses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">AI Chat Interface</h2>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'single' ? 'comparison' : 'single')}
            className="bg-deepseek-gray-800 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-700"
          >
            {viewMode === 'single' ? <Grid className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
            {viewMode === 'single' ? 'Comparison Mode' : 'Single Mode'}
          </Button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600">
        <h3 className="text-sm font-medium text-deepseek-gray-300 mb-3">Select Models for Comparison:</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {models.map((model) => (
            <div key={model.value} className="flex items-center space-x-2">
              <Checkbox
                id={model.value}
                checked={selectedModels.includes(model.value)}
                onCheckedChange={(checked) => handleModelSelection(model.value, checked as boolean)}
                className="border-deepseek-gray-600"
              />
              <label
                htmlFor={model.value}
                className="text-sm text-deepseek-gray-300 cursor-pointer truncate"
                title={model.label}
              >
                {model.label}
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-deepseek-gray-400">
          Selected: {selectedModels.length} model{selectedModels.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className={`flex-1 ${viewMode === 'comparison' ? 'grid grid-cols-1' : 'grid grid-cols-2'} gap-6 min-h-0`}>
        {/* Input Section */}
        <div className={`flex flex-col space-y-4 ${viewMode === 'comparison' ? '' : ''}`}>
          <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600">
            <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
              Enter your prompt:
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask me anything..."
              className="min-h-[200px] bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500 font-mono"
              disabled={isLoading}
            />
          </div>
          
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Generate Response
              </>
            )}
          </Button>

          {/* Text-to-Speech Controls */}
          <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-deepseek-gray-300">Text-to-Speech</h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSpeakResponses}
                  disabled={isSpeaking}
                  className="bg-deepseek-gray-800 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-700"
                >
                  <Volume2 className="h-4 w-4 mr-2" /> Speak Responses
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={stopSpeaking}
                  disabled={!isSpeaking}
                  className="text-white hover:bg-deepseek-gray-700"
                >
                  <Square className="h-4 w-4 mr-2" /> Stop
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="tts-lang" className="text-deepseek-gray-300 text-xs">Language</Label>
                <Select value={ttsLang} onValueChange={(value) => {
                  setTtsLang(value);
                  // Update voice selection when language changes
                  const voicesForLang = availableVoices.filter(v => 
                    v.lang === value || v.lang?.startsWith(value.split("-")[0])
                  );
                  if (voicesForLang.length > 0) {
                    const currentVoice = voicesForLang.find(v => v.name === selectedVoice);
                    if (!currentVoice) {
                      // Prefer Google UK English voices if switching to UK English
                      if (value === "en-GB") {
                        const googleUK = voicesForLang.find(v => /google.*uk.*english/i.test(v.name));
                        setSelectedVoice(googleUK?.name || voicesForLang[0].name);
                      } else {
                        setSelectedVoice(voicesForLang[0].name);
                      }
                    }
                  }
                }}>
                  <SelectTrigger id="tts-lang" className="bg-deepseek-dark border-deepseek-gray-600 text-white">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="bg-deepseek-gray-800 border-deepseek-gray-600 text-white">
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish (ES)</SelectItem>
                    <SelectItem value="es-US">Spanish (US)</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                    <SelectItem value="hi-IN">Hindi</SelectItem>
                    <SelectItem value="id-ID">Indonesian</SelectItem>
                    <SelectItem value="it-IT">Italian</SelectItem>
                    <SelectItem value="ja-JP">Japanese</SelectItem>
                    <SelectItem value="ko-KR">Korean</SelectItem>
                    <SelectItem value="nl-NL">Dutch</SelectItem>
                    <SelectItem value="pl-PL">Polish</SelectItem>
                    <SelectItem value="pt-BR">Portuguese (BR)</SelectItem>
                    <SelectItem value="ru-RU">Russian</SelectItem>
                    <SelectItem value="zh-CN">Chinese (CN)</SelectItem>
                    <SelectItem value="zh-HK">Chinese (HK)</SelectItem>
                    <SelectItem value="zh-TW">Chinese (TW)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="tts-voice" className="text-deepseek-gray-300 text-xs">Voice</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger id="tts-voice" className="bg-deepseek-dark border-deepseek-gray-600 text-white">
                    <SelectValue placeholder="Select voice">
                      {selectedVoice || "Auto"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-deepseek-gray-800 border-deepseek-gray-600 text-white max-h-[300px] overflow-y-auto">
                    {/* Google UK English Voices - Priority Section */}
                    {getGoogleUKVoices().length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-deepseek-electric border-b border-deepseek-gray-700">
                          Google UK English
                        </div>
                        {getGoogleUKVoices().map((voice) => (
                          <SelectItem 
                            key={voice.name} 
                            value={voice.name}
                            className="text-white hover:bg-deepseek-gray-700"
                          >
                            {voice.name} {voice.name.toLowerCase().includes('male') ? '👨' : voice.name.toLowerCase().includes('female') ? '👩' : ''}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-deepseek-gray-400 border-b border-deepseek-gray-700 mt-1">
                          Other Voices
                        </div>
                      </>
                    )}
                    {/* Other voices for selected language */}
                    {getVoicesForLang(ttsLang)
                      .filter(v => !getGoogleUKVoices().includes(v))
                      .map((voice) => (
                        <SelectItem 
                          key={voice.name} 
                          value={voice.name}
                          className="text-white hover:bg-deepseek-gray-700"
                        >
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      ))}
                    {/* Fallback: All available voices if none match */}
                    {getVoicesForLang(ttsLang).length === 0 && availableVoices.length > 0 && (
                      <>
                        {availableVoices.map((voice) => (
                          <SelectItem 
                            key={voice.name} 
                            value={voice.name}
                            className="text-white hover:bg-deepseek-gray-700"
                          >
                            {voice.name} ({voice.lang})
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="tts-pitch" className="text-deepseek-gray-300 text-xs">Pitch</Label>
                <Input
                  id="tts-pitch"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={ttsPitch}
                  onChange={(e) => setTtsPitch(Number(e.target.value))}
                  className="bg-deepseek-dark border-deepseek-gray-600 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="tts-rate" className="text-deepseek-gray-300 text-xs">Speed</Label>
                <Input
                  id="tts-rate"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(Number(e.target.value))}
                  className="bg-deepseek-dark border-deepseek-gray-600 text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="tts-delay" className="text-deepseek-gray-300 text-xs">Delay (s)</Label>
                <Input
                  id="tts-delay"
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={ttsDelay}
                  onChange={(e) => setTtsDelay(Number(e.target.value))}
                  className="bg-deepseek-dark border-deepseek-gray-600 text-white"
                />
              </div>
            </div>

            <p className="text-xs text-deepseek-gray-400">Tip: Voices differ by browser; try another browser if a voice sounds different.</p>
          </div>
        </div>

        {/* Output Section(s) */}
        {viewMode === 'single' && (
          <div className="flex flex-col">
            <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600 flex-1">
              <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
                AI Response:
              </label>
              <div className="bg-deepseek-dark rounded p-4 min-h-[300px] border border-deepseek-gray-700 overflow-auto">
                {Object.keys(responses).length > 0 ? (
                  Object.entries(responses).map(([modelKey, response]) => (
                    <div key={modelKey}>
                      <pre className="whitespace-pre-wrap text-white font-mono text-sm">
                        {response.content}
                      </pre>
                      {response.error && (
                        <div className="text-red-400 text-sm mt-2">
                          Error: {response.error}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-deepseek-gray-500 italic">
                    Response will appear here...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Comparison View */}
        {viewMode === 'comparison' && (
          <div className="col-span-full">
            <div className={`grid gap-4 ${
              selectedModels.length === 1 ? 'grid-cols-1' :
              selectedModels.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
              'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {selectedModels.map((modelValue) => {
                const model = models.find(m => m.value === modelValue);
                const response = responses[modelValue];
                
                return (
                  <div key={modelValue} className="flex flex-col">
                    <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600 flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-deepseek-gray-300">
                          {model?.label || modelValue}
                        </label>
                        {response?.isLoading && (
                          <Loader2 className="h-4 w-4 animate-spin text-deepseek-electric" />
                        )}
                      </div>
                      <div className="bg-deepseek-dark rounded p-4 min-h-[300px] border border-deepseek-gray-700 overflow-auto">
                        {response?.content ? (
                          <pre className="whitespace-pre-wrap text-white font-mono text-sm">
                            {response.content}
                          </pre>
                        ) : response?.error ? (
                          <div className="text-red-400 text-sm">
                            Error: {response.error}
                          </div>
                        ) : response?.isLoading ? (
                          <div className="text-deepseek-gray-500 italic">
                            Generating response...
                          </div>
                        ) : (
                          <div className="text-deepseek-gray-500 italic">
                            Response will appear here...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

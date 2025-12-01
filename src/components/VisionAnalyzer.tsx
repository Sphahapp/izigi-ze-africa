
import { useState, useEffect, useRef } from "react";
import { Eye, Loader2, Link, Upload, AlertCircle, Volume2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const VisionAnalyzer = () => {
  const [imageUrl, setImageUrl] = useState("");
  const [prompt, setPrompt] = useState("What do you see in this image?");
  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoRead, setAutoRead] = useState(true);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load voices and auto-detect Google UK English voices
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
          return;
        }
        // Then try Google UK English Female
        const googleUKFemale = voices.find(v => 
          /google.*uk.*english.*female/i.test(v.name) || 
          /google.*en-gb.*female/i.test(v.name)
        );
        if (googleUKFemale) {
          setSelectedVoice(googleUKFemale.name);
          return;
        }
        // Fallback to any UK English voice
        const ukEnglish = voices.find(v => v.lang === "en-GB" || v.lang?.startsWith("en-GB"));
        if (ukEnglish) {
          setSelectedVoice(ukEnglish.name);
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

  // Get all available voices for UK English
  const getUKVoices = () => {
    return availableVoices.filter(v => 
      v.lang === "en-GB" || v.lang?.startsWith("en-GB")
    );
  };

  const convertImageToBase64 = async (source: string | File): Promise<string> => {
    if (typeof source === 'string') {
      // Check if it's a Facebook URL and warn user
      if (source.includes('facebook.com') || source.includes('fb.com')) {
        throw new Error("Facebook images cannot be accessed directly due to privacy restrictions. Please save the image to your device and upload it instead.");
      }
      
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('NetworkError')) {
          throw new Error("Cannot access this image due to CORS restrictions. Please save the image to your device and upload it instead.");
        }
        throw error;
      }
    } else {
      // Handle file upload
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(source);
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }
      setImageFile(file);
      setImageUrl(""); // Clear URL when file is selected
      toast.success("Image uploaded successfully");
    }
  };

  const handleAnalyze = async () => {
    if (!imageUrl.trim() && !imageFile) {
      toast.error("Please enter an image URL or upload an image file");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Please enter a question about the image");
      return;
    }

    const apiKey = localStorage.getItem("sambanova_api_key");
    if (!apiKey) {
      toast.error("Please set your SambaNova API key in the Status Panel");
      return;
    }

    setIsLoading(true);
    setAnalysis("");

    try {
      // Convert image to base64
      const base64Image = await convertImageToBase64(imageFile || imageUrl);

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
              content: [
                {
                  type: "text",
                  text: prompt
                },
                {
                  type: "image_url",
                  image_url: {
                    url: base64Image
                  }
                }
              ]
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

      let analysisText = "";
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
                analysisText += content;
                setAnalysis(analysisText);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      toast.success("Image analysis completed using Llama-4-Maverick-17B");
      if (autoRead && analysisText.trim()) {
        speakText(analysisText);
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast.error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAnalysis("Error: Failed to analyze image. Please check the image source and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = (text: string) => {
    try {
      if (!("speechSynthesis" in window)) {
        toast.error("Text-to-Speech not supported in this browser");
        return;
      }
      // Stop any ongoing speech first
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2, rate));
      utterance.pitch = Math.max(0.5, Math.min(2, pitch));
      utterance.volume = Math.max(0, Math.min(1, volume));
      
      // Use selected voice if available
      if (selectedVoice) {
        const voice = voicesRef.current.find(v => v.name === selectedVoice);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || "en-GB";
        }
      } else {
        // Fallback to UK English
        const ukVoice = voicesRef.current.find(v => v.lang === "en-GB" || v.lang?.startsWith("en-GB"));
        if (ukVoice) {
          utterance.voice = ukVoice;
          utterance.lang = ukVoice.lang || "en-GB";
        }
      }
      
      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
      currentUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
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

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const currentImageSource = imageFile ? URL.createObjectURL(imageFile) : imageUrl;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Vision Analysis</h2>
        <div className="text-sm text-deepseek-gray-300">
          Llama-4-Maverick-17B Model
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="bg-deepseek-gray-800 rounded-lg p-6 border border-deepseek-gray-600 space-y-4">
            {/* Image Source Options */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-deepseek-gray-300">
                Choose Image Source:
              </label>
              
              {/* URL Input */}
              <div>
                <Input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (e.target.value) setImageFile(null);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500"
                  disabled={isLoading || !!imageFile}
                />
              </div>
              
              {/* File Upload */}
              <div className="text-center">
                <span className="text-sm text-deepseek-gray-400">or</span>
              </div>
              
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isLoading || !!imageUrl}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className={`flex items-center justify-center w-full p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    imageUrl || isLoading 
                      ? 'border-deepseek-gray-600 text-deepseek-gray-500 cursor-not-allowed' 
                      : 'border-deepseek-gray-500 text-deepseek-gray-300 hover:border-deepseek-electric hover:text-deepseek-electric'
                  }`}
                >
                  <Upload className="h-5 w-5 mr-2" />
                  {imageFile ? imageFile.name : 'Upload Image File'}
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
                What would you like to know about this image?
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you see in this image..."
                className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500 min-h-[100px]"
                disabled={isLoading}
              />
            </div>
            
            {/* Warning for Facebook URLs */}
            {imageUrl.includes('facebook.com') || imageUrl.includes('fb.com') ? (
              <div className="flex items-start space-x-2 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-300">
                  <strong>Note:</strong> Facebook images cannot be accessed directly due to privacy restrictions. 
                  Please save the image to your device and upload it using the file upload option above.
                </div>
              </div>
            ) : null}
            
            <div className="text-xs text-deepseek-gray-400">
              <div className="flex items-center space-x-1 mb-1">
                <Link className="h-3 w-3" />
                <span>Supports: JPG, PNG, GIF, WebP formats</span>
              </div>
              <div>Ask about objects, text, people, colors, composition, or any visual elements</div>
            </div>
          </div>
          
          <Button
            onClick={handleAnalyze}
            disabled={isLoading || (!imageUrl.trim() && !imageFile) || !prompt.trim()}
            className="w-full bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white font-medium h-12"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analyzing Image...
              </>
            ) : (
              <>
                <Eye className="h-5 w-5 mr-2" />
                Analyze Image
              </>
            )}
          </Button>
        </div>

        {/* Output Section */}
        <div className="flex flex-col space-y-4">
          {/* Image Preview */}
          {currentImageSource && (
            <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600">
              <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
                Image Preview:
              </label>
              <div className="bg-deepseek-dark rounded border border-deepseek-gray-700 aspect-video flex items-center justify-center overflow-hidden">
                <img 
                  src={currentImageSource} 
                  alt="Image to analyze" 
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Analysis Results */}
          <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600 flex-1">
            <label className="block text-sm font-medium text-deepseek-gray-300 mb-2">
              Analysis Results:
            </label>
            <div className="flex items-center gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                disabled={!analysis.trim()}
                onClick={() => speakText(analysis)}
                title="Read aloud"
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
              <label className="ml-auto text-xs text-deepseek-gray-300 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRead}
                  onChange={(e) => setAutoRead(e.target.checked)}
                />
                Auto-read new results
              </label>
            </div>
            <div className="bg-deepseek-dark rounded p-4 min-h-[200px] border border-deepseek-gray-700 overflow-auto">
              {analysis ? (
                <div className="whitespace-pre-wrap text-white text-sm">
                  {analysis}
                </div>
              ) : (
                <div className="text-deepseek-gray-500 italic">
                  Analysis results will appear here...
                </div>
              )}
            </div>
            <div className="space-y-3 mt-3">
              {/* Voice Selection */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="voice-select" className="text-xs text-deepseek-gray-300">Voice</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger id="voice-select" className="bg-deepseek-dark border-deepseek-gray-600 text-white h-8 text-xs">
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
                            className="text-white hover:bg-deepseek-gray-700 text-xs"
                          >
                            {voice.name} {voice.name.toLowerCase().includes('male') ? '👨' : voice.name.toLowerCase().includes('female') ? '👩' : ''}
                          </SelectItem>
                        ))}
                        {getUKVoices().filter(v => !getGoogleUKVoices().includes(v)).length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-deepseek-gray-400 border-b border-deepseek-gray-700 mt-1">
                              Other UK English Voices
                            </div>
                            {getUKVoices()
                              .filter(v => !getGoogleUKVoices().includes(v))
                              .map((voice) => (
                                <SelectItem 
                                  key={voice.name} 
                                  value={voice.name}
                                  className="text-white hover:bg-deepseek-gray-700 text-xs"
                                >
                                  {voice.name}
                                </SelectItem>
                              ))}
                          </>
                        )}
                        <div className="px-2 py-1.5 text-xs font-semibold text-deepseek-gray-400 border-b border-deepseek-gray-700 mt-1">
                          All Voices
                        </div>
                      </>
                    )}
                    {/* All available voices */}
                    {availableVoices.map((voice) => {
                      // Skip if already shown in Google UK section
                      if (getGoogleUKVoices().includes(voice)) return null;
                      if (getUKVoices().includes(voice) && getGoogleUKVoices().length > 0) return null;
                      
                      return (
                        <SelectItem 
                          key={voice.name} 
                          value={voice.name}
                          className="text-white hover:bg-deepseek-gray-700 text-xs"
                        >
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Speech Controls */}
              <div className="grid grid-cols-3 gap-3 text-xs text-deepseek-gray-300">
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
      </div>
    </div>
  );
};

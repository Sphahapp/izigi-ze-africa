import { useState, useRef } from "react";
import { Image as ImageIcon, Loader2, Download, Edit, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageEditor } from "./ImageEditor";
import { DesignStudio } from "./DesignStudio";
import FlatAvatarGenerator from "./FlatAvatarGenerator";
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

export const ImageGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundOpacity, setBackgroundOpacity] = useState(1);
  const [backgroundBlur, setBackgroundBlur] = useState(0);
  const [backgroundFilter, setBackgroundFilter] = useState("");
  const [backgroundUrlList, setBackgroundUrlList] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStudio, setShowStudio] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter an image prompt");
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      // Use Pollinations AI for free image generation
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${Math.floor(Math.random() * 1000000)}`;
      
      // Test if the image loads successfully
      const img = new Image();
      img.onload = () => {
        setGeneratedImage(imageUrl);
        toast.success("Image generated successfully");
      };
      img.onerror = () => {
        throw new Error("Failed to generate image");
      };
      img.src = imageUrl;
      
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File size must be less than 500MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      toast.success("Image uploaded successfully");
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBackgroundReplace = async () => {
    if (!uploadedImage || !backgroundPrompt.trim()) {
      toast.error("Please upload an image and describe the background");
      return;
    }

    setIsProcessingBackground(true);
    try {
      // Load the segmentation model
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
        device: 'wasm',
      });

      // Create image element from uploaded image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = uploadedImage;
      });

      // Segment the image to find the subject
      const result = await segmenter(uploadedImage);
      
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Failed to segment image');
      }

      // Generate new background using Pollinations AI
      const backgroundUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(backgroundPrompt + " background, high quality, detailed")}?width=512&height=512&seed=${Math.floor(Math.random() * 1000000)}`;
      
      // Wait for background to load
      const backgroundImg = new Image();
      backgroundImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        backgroundImg.onload = resolve;
        backgroundImg.onerror = reject;
        backgroundImg.src = backgroundUrl;
      });

      // Create canvas to combine subject and background
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw new background (scaled to fit)
      ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

      // Apply the subject with alpha masking
      const subjectCanvas = document.createElement('canvas');
      const subjectCtx = subjectCanvas.getContext('2d');
      if (!subjectCtx) throw new Error('Could not get subject canvas context');

      subjectCanvas.width = img.width;
      subjectCanvas.height = img.height;
      subjectCtx.drawImage(img, 0, 0);

      const imageData = subjectCtx.getImageData(0, 0, subjectCanvas.width, subjectCanvas.height);
      const data = imageData.data;

      // Apply mask with smoothed edges to reduce glitchy appearance
      const mask = result[0].mask;
      for (let i = 0; i < mask.data.length; i++) {
        // Use smooth alpha values with slight threshold adjustment
        const maskValue = mask.data[i];
        let alpha = (1 - maskValue) * 255;
        
        // Apply slight threshold to clean up edges while maintaining smoothness
        if (alpha < 50) alpha = 0; // Remove weak background pixels
        else if (alpha > 200) alpha = 255; // Ensure subject is fully opaque
        
        data[i * 4 + 3] = Math.round(alpha);
      }

      subjectCtx.putImageData(imageData, 0, 0);

      // Draw the masked subject on top of the new background
      ctx.drawImage(subjectCanvas, 0, 0);

      // Convert to blob and create URL
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setGeneratedImage(url);
          toast.success("Background replaced successfully!");
        }
      }, 'image/png');

    } catch (error) {
      console.error("Error replacing background:", error);
      toast.error("Failed to replace background. Please try again.");
    } finally {
      setIsProcessingBackground(false);
    }
  };

  const pickRandomBackgroundFromList = () => {
    const urls = backgroundUrlList
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      toast.error("Add at least one URL in the list");
      return;
    }
    const chosen = urls[Math.floor(Math.random() * urls.length)];
    setBackgroundUrl(chosen);
    toast.success("Random background selected");
  };

  const handleBackgroundReplaceWithUrl = async () => {
    if (!uploadedImage || !backgroundUrl.trim()) {
      toast.error("Please upload an image and enter a background image URL");
      return;
    }

    setIsProcessingBackground(true);
    try {
      // Load the segmentation model
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
        device: 'wasm',
      });

      // Load uploaded image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve as any;
        img.onerror = reject as any;
        img.src = uploadedImage;
      });

      // Load background image from URL
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve as any;
        bgImg.onerror = reject as any;
        bgImg.src = backgroundUrl;
      });

      // Run segmentation
      const result = await segmenter(uploadedImage);
      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Failed to segment image');
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw background with filters and opacity
      ctx.save();
      ctx.filter = backgroundFilter.trim()
        ? backgroundFilter
        : (backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : 'none');
      ctx.globalAlpha = Math.min(1, Math.max(0, backgroundOpacity));
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Prepare subject with alpha mask
      const subjectCanvas = document.createElement('canvas');
      const subjectCtx = subjectCanvas.getContext('2d');
      if (!subjectCtx) throw new Error('Could not get subject canvas context');
      subjectCanvas.width = img.width;
      subjectCanvas.height = img.height;
      subjectCtx.drawImage(img, 0, 0);

      const imageData = subjectCtx.getImageData(0, 0, subjectCanvas.width, subjectCanvas.height);
      const data = imageData.data;
      const mask = result[0].mask;
      for (let i = 0; i < mask.data.length; i++) {
        const maskValue = mask.data[i];
        let alpha = (1 - maskValue) * 255;
        if (alpha < 50) alpha = 0;
        else if (alpha > 200) alpha = 255;
        data[i * 4 + 3] = Math.round(alpha);
      }
      subjectCtx.putImageData(imageData, 0, 0);

      // Composite subject on background
      ctx.drawImage(subjectCanvas, 0, 0);

      // Output
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setGeneratedImage(url);
          toast.success('Background replaced using URL');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error replacing background with URL:', error);
      toast.error('Failed to use background URL. Ensure it is a direct image link and allows CORS.');
    } finally {
      setIsProcessingBackground(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Image Generation</h2>
        <div className="text-sm text-deepseek-gray-300">
          Pollinations AI Model
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input Section */}
        <div className="space-y-4">
          {/* Text to Image Section */}
          <div className="bg-deepseek-gray-800 rounded-lg p-6 border border-deepseek-gray-600">
            <label className="block text-sm font-medium text-deepseek-gray-300 mb-4">
              Describe the image you want to create:
            </label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A red sports car on a mountain road..."
              className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500 h-12"
              disabled={isLoading}
            />
            <div className="mt-4 text-xs text-deepseek-gray-400">
              Tip: Be descriptive for better results. Include style, colors, mood, and details.
            </div>
          </div>
          
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="w-full bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white font-medium h-12"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Image...
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5 mr-2" />
                Create Image
              </>
            )}
          </Button>

          {/* Image Upload & Background Replace Section */}
          <div className="bg-deepseek-gray-800 rounded-lg p-6 border border-deepseek-gray-600">
            <label className="block text-sm font-medium text-deepseek-gray-300 mb-4">
              Upload Image & Replace Background:
            </label>
            
            {/* File Upload */}
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {!uploadedImage ? (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600 h-12"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Image (Max 500MB)
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* Uploaded Image Preview */}
                  <div className="relative">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded image" 
                      className="w-full h-32 object-cover rounded-lg border border-deepseek-gray-600"
                    />
                    <Button
                      onClick={removeUploadedImage}
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2 bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Background Prompt */}
                  <Input
                    value={backgroundPrompt}
                    onChange={(e) => setBackgroundPrompt(e.target.value)}
                    placeholder="Describe the new background... (e.g., sunset beach, modern office, forest)"
                    className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500"
                    disabled={isProcessingBackground}
                  />
                  
                  <Button
                    onClick={handleBackgroundReplace}
                    disabled={isProcessingBackground || !backgroundPrompt.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium"
                  >
                    {isProcessingBackground ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Replacing Background...
                      </>
                    ) : (
                      <>
                        <Edit className="h-5 w-5 mr-2" />
                        Replace Background
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            <div className="mt-6 border-t border-deepseek-gray-700 pt-4 space-y-4">
              <label className="block text-sm font-medium text-deepseek-gray-300">
                Or use a Background Image URL:
              </label>
              <Input
                value={backgroundUrl}
                onChange={(e) => setBackgroundUrl(e.target.value)}
                placeholder="https://your-image-host.com/background.jpg"
                className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500"
                disabled={isProcessingBackground}
              />
              <p className="text-xs text-deepseek-gray-400">
                Use a direct image link (jpg, png, gif). For reliability, upload to a stable host and use the direct URL. The image must allow CORS.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-deepseek-gray-400 mb-2">
                    <span>Opacity</span>
                    <span>{Math.round(backgroundOpacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[backgroundOpacity]}
                    onValueChange={(v) => setBackgroundOpacity((v[0] as number) ?? 1)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-deepseek-gray-400 mb-2">
                    <span>Blur</span>
                    <span>{backgroundBlur}px</span>
                  </div>
                  <Slider
                    value={[backgroundBlur]}
                    onValueChange={(v) => setBackgroundBlur((v[0] as number) ?? 0)}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>
              </div>

              <Input
                value={backgroundFilter}
                onChange={(e) => setBackgroundFilter(e.target.value)}
                placeholder='Optional CSS filter: e.g. blur(3px) hue-rotate(30deg) saturate(1.6)'
                className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500"
                disabled={isProcessingBackground}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-deepseek-gray-300">Background URL list (one per line)</label>
                <Textarea
                  value={backgroundUrlList}
                  onChange={(e) => setBackgroundUrlList(e.target.value)}
                  placeholder={"https://example.com/one.jpg\nhttps://example.com/two.png"}
                  className="bg-deepseek-dark border-deepseek-gray-600 text-white placeholder:text-deepseek-gray-500 min-h-24"
                  disabled={isProcessingBackground}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={pickRandomBackgroundFromList}
                    disabled={isProcessingBackground}
                    className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                  >
                    Pick Random URL
                  </Button>
                  <Button
                    onClick={handleBackgroundReplaceWithUrl}
                    disabled={isProcessingBackground || !backgroundUrl.trim()}
                    className="bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white font-medium"
                  >
                    {isProcessingBackground ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Applying URL...
                      </>
                    ) : (
                      <>Replace Using Image URL</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-xs text-deepseek-gray-400">
              Upload an image and describe the background you want. AI will automatically remove the current background and add your desired one.
            </div>
          </div>

          <FlatAvatarGenerator onApply={(dataUrl) => { setGeneratedImage(dataUrl); toast.success("Avatar generated"); }} />
        </div>

        {/* Output Section */}
        <div className="bg-deepseek-gray-800 rounded-lg p-6 border border-deepseek-gray-600">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-deepseek-gray-300">
              Generated Image:
            </label>
            {generatedImage && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowEditor(true)}
                  variant="outline"
                  size="sm"
                  className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={() => setShowStudio(true)}
                  variant="outline"
                  size="sm"
                  className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Open in Studio
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="sm"
                  className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </Button>
              </div>
            )}
          </div>
          
          <div className="bg-deepseek-dark rounded-lg border border-deepseek-gray-700 aspect-square flex items-center justify-center overflow-hidden">
            {isLoading ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-deepseek-electric mx-auto mb-2" />
                <p className="text-deepseek-gray-400">Creating your image...</p>
              </div>
            ) : generatedImage ? (
              <img 
                src={generatedImage} 
                alt="Generated image" 
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="text-center text-deepseek-gray-500">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Editor Modal */}
      {showEditor && generatedImage && (
        <ImageEditor
          imageUrl={generatedImage}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Design Studio Modal */}
      {showStudio && (
        <DesignStudio
          initialImageUrl={generatedImage ?? uploadedImage ?? undefined}
          onClose={() => setShowStudio(false)}
        />
      )}
    </div>
  );
};

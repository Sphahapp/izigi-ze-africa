

import { useState } from "react";
import { Scissors, Eraser, Download, Loader2, Brush, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

const MAX_IMAGE_DIMENSION = 1024;

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
}

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

const removeBackground = async (imageElement: HTMLImageElement): Promise<Blob> => {
  try {
    console.log('Starting background removal process...');
    const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    const wasResized = resizeImageIfNeeded(canvas, ctx, imageElement);
    console.log(`Image ${wasResized ? 'was' : 'was not'} resized. Final dimensions: ${canvas.width}x${canvas.height}`);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Image converted to base64');
    
    console.log('Processing with segmentation model...');
    const result = await segmenter(imageData);
    
    console.log('Segmentation result:', result);
    
    if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
      throw new Error('Invalid segmentation result');
    }
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    outputCtx.drawImage(canvas, 0, 0);
    
    const outputImageData = outputCtx.getImageData(
      0, 0,
      outputCanvas.width,
      outputCanvas.height
    );
    const data = outputImageData.data;
    
    for (let i = 0; i < result[0].mask.data.length; i++) {
      const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
      data[i * 4 + 3] = alpha;
    }
    
    outputCtx.putImageData(outputImageData, 0, 0);
    console.log('Mask applied successfully');
    
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('Successfully created final blob');
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('Error removing background:', error);
    throw error;
  }
};

const loadImage = (file: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const ImageEditor = ({ imageUrl, onClose }: ImageEditorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [inpaintMode, setInpaintMode] = useState(false);
  const [brushSize, setBrushSize] = useState([20]);
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null);
  const [originalCanvas, setOriginalCanvas] = useState<HTMLCanvasElement | null>(null);

  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const imageElement = await loadImage(blob);
      
      const resultBlob = await removeBackground(imageElement);
      const resultUrl = URL.createObjectURL(resultBlob);
      setEditedImage(resultUrl);
      toast.success("Background removed successfully!");
    } catch (error) {
      console.error("Error removing background:", error);
      toast.error("Failed to remove background. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const initializeInpainting = () => {
    setInpaintMode(true);
    
    // Create canvases for the original image and mask
    const canvas = document.createElement('canvas');
    const maskCanvasEl = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvasEl.getContext('2d');
    
    if (!ctx || !maskCtx) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      maskCanvasEl.width = img.width;
      maskCanvasEl.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      // Initialize mask canvas with black background
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvasEl.width, maskCanvasEl.height);
      
      setOriginalCanvas(canvas);
      setMaskCanvas(maskCanvasEl);
    };
    img.src = imageUrl;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!inpaintMode || !maskCanvas) return;
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !inpaintMode || !maskCanvas) return;
    draw(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskCanvas) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (maskCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (maskCanvas.height / rect.height);
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, brushSize[0], 0, 2 * Math.PI);
    ctx.fill();
  };

  const clearMask = () => {
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  };

  const handleInpaint = async () => {
    if (!originalCanvas || !maskCanvas || !inpaintPrompt.trim()) {
      toast.error("Please draw a mask and enter a prompt for inpainting");
      return;
    }

    setIsProcessing(true);
    try {
      // Convert canvases to blobs
      const originalBlob = await new Promise<Blob>((resolve) => {
        originalCanvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      
      const maskBlob = await new Promise<Blob>((resolve) => {
        maskCanvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      // For now, we'll use a simple approach - generate a new background and composite
      // In a real implementation, you'd use a proper inpainting API like Stability AI
      const newBackgroundUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(inpaintPrompt)}?width=${originalCanvas.width}&height=${originalCanvas.height}&seed=${Math.floor(Math.random() * 1000000)}`;
      
      const backgroundImg = new Image();
      backgroundImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        backgroundImg.onload = resolve;
        backgroundImg.onerror = reject;
        backgroundImg.src = newBackgroundUrl;
      });

      // Create composite image
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = originalCanvas.width;
      compositeCanvas.height = originalCanvas.height;
      const compositeCtx = compositeCanvas.getContext('2d');
      
      if (!compositeCtx) throw new Error('Could not get composite canvas context');

      // Draw original image
      compositeCtx.drawImage(originalCanvas, 0, 0);
      
      // Get mask data
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error('Could not get mask context');
      
      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const originalData = compositeCtx.getImageData(0, 0, compositeCanvas.width, compositeCanvas.height);
      
      // Create background canvas
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = originalCanvas.width;
      bgCanvas.height = originalCanvas.height;
      const bgCtx = bgCanvas.getContext('2d');
      if (!bgCtx) throw new Error('Could not get background context');
      
      bgCtx.drawImage(backgroundImg, 0, 0, bgCanvas.width, bgCanvas.height);
      const bgData = bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height);
      
      // Composite the images based on the mask
      for (let i = 0; i < maskData.data.length; i += 4) {
        const maskValue = maskData.data[i]; // Red channel (grayscale)
        const alpha = maskValue / 255;
        
        if (alpha > 0.1) { // If mask is white (area to inpaint)
          originalData.data[i] = bgData.data[i];     // R
          originalData.data[i + 1] = bgData.data[i + 1]; // G
          originalData.data[i + 2] = bgData.data[i + 2]; // B
          // Keep original alpha
        }
      }
      
      compositeCtx.putImageData(originalData, 0, 0);
      
      // Convert to blob and create URL
      compositeCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setEditedImage(url);
          toast.success("Inpainting completed successfully!");
        }
      }, 'image/png');

    } catch (error) {
      console.error("Error during inpainting:", error);
      toast.error("Failed to perform inpainting. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCrop = () => {
    setCropMode(!cropMode);
    if (!cropMode) {
      toast.info("Click and drag to select crop area (basic crop functionality)");
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-deepseek-gray-800 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Image Editor</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const target = editedImage ?? imageUrl;
                const extMatch = target.split('.').pop()?.split('?')[0].toLowerCase();
                const ext = extMatch && extMatch.length <= 4 ? extMatch : 'png';
                const name = editedImage ? `edited-image-${Date.now()}.${ext}` : `original-image-${Date.now()}.${ext}`;
                handleDownload(target, name);
              }}
              variant="outline"
              size="sm"
              className="text-white bg-deepseek-gray-700 border-deepseek-gray-600 hover:bg-deepseek-gray-600"
              disabled={isProcessing}
              aria-label="Download image"
              title="Download image"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-deepseek-gray-700"
            >
              ✕
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tools */}
          <div className="lg:w-64 space-y-3">
            <Button
              onClick={handleRemoveBackground}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Eraser className="h-4 w-4 mr-2" />
                  Remove Background
                </>
              )}
            </Button>

            <Button
              onClick={handleCrop}
              variant="outline"
              className="w-full bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
            >
              <Scissors className="h-4 w-4 mr-2" />
              {cropMode ? "Exit Crop" : "Crop Image"}
            </Button>

            <Button
              onClick={initializeInpainting}
              variant="outline"
              className="w-full bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
            >
              <Brush className="h-4 w-4 mr-2" />
              {inpaintMode ? "Exit Inpaint" : "Inpaint Mode"}
            </Button>

            {inpaintMode && (
              <>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-deepseek-gray-300">
                    Brush Size: {brushSize[0]}px
                  </label>
                  <Slider
                    value={brushSize}
                    onValueChange={setBrushSize}
                    max={50}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Input
                  value={inpaintPrompt}
                  onChange={(e) => setInpaintPrompt(e.target.value)}
                  placeholder="Describe what to paint in the masked area..."
                  className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white"
                />

                <div className="flex space-x-2">
                  <Button
                    onClick={clearMask}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                  
                  <Button
                    onClick={handleInpaint}
                    disabled={isProcessing || !inpaintPrompt.trim()}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Brush className="h-4 w-4 mr-1" />
                        Inpaint
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {editedImage && (
              <Button
                onClick={() => handleDownload(editedImage, `edited-image-${Date.now()}.png`)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Edited
              </Button>
            )}
          </div>

          {/* Image Display */}
          <div className="flex-1">
            <div className={`grid ${inpaintMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
              {/* Original Image */}
              {!inpaintMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-deepseek-gray-300">Original:</label>
                  <div className="bg-deepseek-dark rounded-lg border border-deepseek-gray-700 p-2">
                    <img 
                      src={imageUrl} 
                      alt="Original" 
                      className="w-full h-auto max-h-80 object-contain rounded"
                    />
                  </div>
                </div>
              )}

              {/* Inpainting Canvas */}
              {inpaintMode && originalCanvas && maskCanvas && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-deepseek-gray-300">
                    Paint over areas to inpaint (white = replace):
                  </label>
                  <div className="bg-deepseek-dark rounded-lg border border-deepseek-gray-700 p-2 relative">
                    <canvas
                      ref={(canvas) => {
                        if (canvas && originalCanvas) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            canvas.width = originalCanvas.width;
                            canvas.height = originalCanvas.height;
                            canvas.style.width = '100%';
                            canvas.style.height = 'auto';
                            canvas.style.maxHeight = '400px';
                            canvas.style.objectFit = 'contain';
                            ctx.drawImage(originalCanvas, 0, 0);
                          }
                        }
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className="w-full h-auto max-h-96 object-contain rounded cursor-crosshair"
                      style={{ cursor: inpaintMode ? 'crosshair' : 'default' }}
                    />
                    
                    {/* Mask overlay */}
                    <canvas
                      ref={(canvas) => {
                        if (canvas && maskCanvas) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            canvas.width = maskCanvas.width;
                            canvas.height = maskCanvas.height;
                            canvas.style.width = '100%';
                            canvas.style.height = 'auto';
                            canvas.style.maxHeight = '400px';
                            canvas.style.objectFit = 'contain';
                            canvas.style.opacity = '0.5';
                            canvas.style.mixBlendMode = 'multiply';
                            ctx.drawImage(maskCanvas, 0, 0);
                          }
                        }
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className="absolute inset-2 w-full h-auto max-h-96 object-contain rounded cursor-crosshair pointer-events-none"
                      style={{ 
                        cursor: inpaintMode ? 'crosshair' : 'default',
                        pointerEvents: inpaintMode ? 'auto' : 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Edited Image */}
              {!inpaintMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-deepseek-gray-300">Edited:</label>
                  <div className="bg-deepseek-dark rounded-lg border border-deepseek-gray-700 p-2 min-h-80 flex items-center justify-center">
                    {editedImage ? (
                      <img 
                        src={editedImage} 
                        alt="Edited" 
                        className="w-full h-auto max-h-80 object-contain rounded"
                      />
                    ) : (
                      <div className="text-center text-deepseek-gray-500">
                        <p>Edited image will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inpaint Result */}
              {inpaintMode && editedImage && (
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-deepseek-gray-300">Inpainted Result:</label>
                  <div className="bg-deepseek-dark rounded-lg border border-deepseek-gray-700 p-2">
                    <img 
                      src={editedImage} 
                      alt="Inpainted" 
                      className="w-full h-auto max-h-80 object-contain rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


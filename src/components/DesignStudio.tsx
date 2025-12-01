import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Download, Upload, Plus, RotateCcw, Trash2 } from "lucide-react";

// Common color presets
const COLOR_PRESETS = [
  "#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#ffa500", "#800080",
  "#ffc0cb", "#a52a2a", "#808080", "#008000", "#000080"
];

type StudioItemType = "image" | "text";

interface BaseItem {
  id: string;
  type: StudioItemType;
  x: number; // canvas space
  y: number; // canvas space
  width: number;
  height: number;
  rotationDeg: number; // around center
  opacity: number; // 0..1
}

interface ImageItem extends BaseItem {
  type: "image";
  src: string;
}

interface TextItem extends BaseItem {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
}

type StudioItem = ImageItem | TextItem;

interface DesignStudioProps {
  initialImageUrl?: string | null;
  onClose?: () => void;
}

// Simple unique id
const uid = () => Math.random().toString(36).slice(2, 10);

export const DesignStudio = ({ initialImageUrl, onClose }: DesignStudioProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasBg, setCanvasBg] = useState<string>("#111827");
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  // drag/resize state
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ id: string; handle: string; start: { x: number; y: number; w: number; h: number } } | null>(null);
  const rotateRef = useRef<{ id: string; startAngle: number; startDeg: number; center: { x: number; y: number } } | null>(null);

  useEffect(() => {
    const base: StudioItem[] = [];
    if (initialImageUrl) {
      base.push({
        id: uid(),
        type: "image",
        src: initialImageUrl,
        x: 100,
        y: 100,
        width: 400,
        height: 400,
        rotationDeg: 0,
        opacity: 1,
      } as ImageItem);
    }
    setItems(base);
  }, [initialImageUrl]);

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const addText = () => {
    const newItem: TextItem = {
      id: uid(),
      type: "text",
      text: "Your Text",
      fontSize: 48,
      fontFamily: "Inter, system-ui, Arial",
      color: "#ffffff",
      x: 120,
      y: 120,
      width: 300,
      height: 80,
      rotationDeg: 0,
      opacity: 1,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
  };

  const addImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const newItem: ImageItem = {
        id: uid(),
        type: "image",
        src: url,
        x: 140,
        y: 140,
        width: 320,
        height: 320,
        rotationDeg: 0,
        opacity: 1,
      };
      setItems((prev) => [...prev, newItem]);
      setSelectedId(newItem.id);
    };
    reader.readAsDataURL(file);
  };

  const onDownload = async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = stageSize.w;
      canvas.height = stageSize.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      // background
      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw items in order
      for (const it of items) {
        ctx.save();
        ctx.globalAlpha = it.opacity;
        // transform origin center
        const cx = it.x + it.width / 2;
        const cy = it.y + it.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((it.rotationDeg * Math.PI) / 180);
        ctx.translate(-cx, -cy);

        if (it.type === "image") {
          const img = await loadImage((it as ImageItem).src);
          ctx.drawImage(img, it.x, it.y, it.width, it.height);
        } else {
          const t = it as TextItem;
          ctx.fillStyle = t.color;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.font = `${t.fontSize}px ${t.fontFamily}`;
          ctx.fillText(t.text, it.x, it.y + it.height / 2);
        }
        ctx.restore();
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Design downloaded");
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject as any;
    img.src = src;
  });

  const pointerDown = (e: React.PointerEvent, id: string) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setSelectedId(id);
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    dragRef.current = { id, offsetX, offsetY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const pointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current && !resizeRef.current && !rotateRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // drag
    if (dragRef.current) {
      const { id, offsetX, offsetY } = dragRef.current;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, x: mouseX - offsetX, y: mouseY - offsetY } : i)));
    }

    // resize
    if (resizeRef.current) {
      const { id, handle, start } = resizeRef.current;
      const dx = mouseX - start.x;
      const dy = mouseY - start.y;
      setItems((prev) => prev.map((i) => {
        if (i.id !== id) return i;
        let x = i.x, y = i.y, w = start.w, h = start.h;
        if (handle.includes("e")) w = Math.max(20, start.w + dx);
        if (handle.includes("s")) h = Math.max(20, start.h + dy);
        if (handle.includes("w")) { const nw = Math.max(20, start.w - dx); x = i.x + (start.w - nw); w = nw; }
        if (handle.includes("n")) { const nh = Math.max(20, start.h - dy); y = i.y + (start.h - nh); h = nh; }
        return { ...i, x, y, width: w, height: h };
      }));
    }

    // rotate
    if (rotateRef.current) {
      const { id, center, startAngle, startDeg } = rotateRef.current;
      const angle = Math.atan2(mouseY - center.y, mouseX - center.x);
      const delta = angle - startAngle;
      const deg = startDeg + (delta * 180) / Math.PI;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, rotationDeg: deg } : i)));
    }
  };

  const pointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    resizeRef.current = null;
    rotateRef.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  };

  const startResize = (id: string, handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const it = items.find((i) => i.id === id);
    if (!it) return;
    resizeRef.current = { id, handle, start: { x: e.clientX, y: e.clientY, w: it.width, h: it.height } };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const startRotate = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const it = items.find((i) => i.id === id);
    if (!it || !containerRef.current) return;
    const center = { x: it.x + it.width / 2, y: it.y + it.height / 2 };
    const rect = containerRef.current.getBoundingClientRect();
    const angle = Math.atan2(e.clientY - rect.top - center.y, e.clientX - rect.left - center.x);
    rotateRef.current = { id, startAngle: angle, startDeg: it.rotationDeg, center };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  };

  const resetTransforms = () => {
    if (!selectedId) return;
    setItems((prev) => prev.map((i) => (i.id === selectedId ? { ...i, rotationDeg: 0, opacity: 1 } : i)));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onPointerMove={pointerMove} onPointerUp={pointerUp}>
      <div className="bg-deepseek-gray-800 rounded-lg border border-deepseek-gray-700 w-[1100px] max-w-[96vw] max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-deepseek-gray-700 flex items-center justify-between">
          <div className="text-white font-semibold">Design Studio</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" /> Export PNG
            </Button>
            <Button size="sm" variant="outline" className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white" onClick={onClose}>Close</Button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-[260px_1fr_260px] gap-4 overflow-auto">
          {/* Left toolbar */}
          <div className="space-y-3">
            <div className="text-sm text-deepseek-gray-300">Add</div>
            <Button className="w-full bg-gradient-to-r from-deepseek-blue to-deepseek-cyan text-white" onClick={addText}>
              <Plus className="h-4 w-4 mr-2" /> Text
            </Button>
            <label className="w-full">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addImageFromFile(f);
                e.currentTarget.value = "";
              }} />
              <div className="w-full">
                <Button variant="outline" className="w-full bg-deepseek-gray-700 border-deepseek-gray-600 text-white">
                  <Upload className="h-4 w-4 mr-2" /> Image
                </Button>
              </div>
            </label>

            <div className="pt-2 space-y-2">
              <div className="text-sm text-deepseek-gray-300">Canvas</div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={stageSize.w} onChange={(e) => setStageSize((s) => ({ ...s, w: Math.max(100, Number(e.target.value) || 0) }))} className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
                <Input type="number" value={stageSize.h} onChange={(e) => setStageSize((s) => ({ ...s, h: Math.max(100, Number(e.target.value) || 0) }))} className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
              </div>
              <Input type="text" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} placeholder="#111827 or url(...)" className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
            </div>
          </div>

          {/* Stage */}
          <div className="flex items-center justify-center">
            <div
              ref={containerRef}
              className="relative border border-deepseek-gray-700 rounded"
              style={{ width: stageSize.w, height: stageSize.h, background: canvasBg.startsWith("url(") ? undefined : canvasBg, backgroundImage: canvasBg.startsWith("url(") ? canvasBg : undefined }}
            >
              {items.map((it) => {
                const isSel = it.id === selectedId;
                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => pointerDown(e, it.id)}
                    onClick={() => setSelectedId(it.id)}
                    className={`absolute ${isSel ? "ring-2 ring-deepseek-electric" : ""}`}
                    style={{
                      left: it.x,
                      top: it.y,
                      width: it.width,
                      height: it.height,
                      transform: `rotate(${it.rotationDeg}deg)`,
                      transformOrigin: "center center",
                      opacity: it.opacity,
                      cursor: "move",
                      userSelect: "none",
                    }}
                  >
                    {it.type === "image" ? (
                      <img src={(it as ImageItem).src} alt="" className="w-full h-full object-contain pointer-events-none select-none" />
                    ) : (
                      <div className="w-full h-full flex items-center pointer-events-none select-none" style={{ color: (it as TextItem).color, fontSize: (it as TextItem).fontSize, fontFamily: (it as TextItem).fontFamily }}>
                        {(it as TextItem).text}
                      </div>
                    )}

                    {/* handles */}
                    {isSel && (
                      <>
                        {(["nw","n","ne","e","se","s","sw","w"] as const).map((h) => (
                          <div
                            key={h}
                            onPointerDown={(e) => startResize(it.id, h, e)}
                            className="absolute bg-white/90 border border-black/40"
                            style={{
                              width: 10,
                              height: 10,
                              left: h.includes("w") ? -5 : h.includes("e") ? it.width - 5 : it.width / 2 - 5,
                              top: h.includes("n") ? -5 : h.includes("s") ? it.height - 5 : it.height / 2 - 5,
                              cursor: `${h}-resize`,
                            }}
                          />
                        ))}
                        <div
                          onPointerDown={(e) => startRotate(it.id, e)}
                          className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-deepseek-electric cursor-crosshair border border-black/40"
                          title="Rotate"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right inspector */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-deepseek-gray-700 border-deepseek-gray-600 text-white" onClick={resetTransforms} disabled={!selectedItem}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button variant="outline" className="flex-1 bg-deepseek-gray-700 border-deepseek-gray-600 text-white" onClick={deleteSelected} disabled={!selectedItem}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </div>

            {selectedItem ? (
              <div className="space-y-3">
                <div className="text-sm text-deepseek-gray-300">Selection</div>
                {selectedItem.type === "text" ? (
                  <>
                    <div>
                      <label className="text-xs text-deepseek-gray-400 mb-1 block">Text Content</label>
                      <Input
                        type="text"
                        value={(selectedItem as TextItem).text}
                        onChange={(e) => {
                          e.stopPropagation();
                          setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...(i as TextItem), text: e.target.value } : i));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="bg-deepseek-dark border-deepseek-gray-700 text-white"
                        placeholder="Enter text here"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs text-deepseek-gray-400 mb-1 block">Text Color</label>
                      <div className="flex gap-2 mb-2">
                        <Input
                          type="color"
                          value={(selectedItem as TextItem).color}
                          onChange={(e) => {
                            e.stopPropagation();
                            setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...(i as TextItem), color: e.target.value } : i));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="bg-deepseek-dark border-deepseek-gray-700 h-10 w-16 p-1 cursor-pointer"
                          title="Choose color"
                        />
                        <Input
                          type="text"
                          value={(selectedItem as TextItem).color}
                          onChange={(e) => {
                            e.stopPropagation();
                            setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...(i as TextItem), color: e.target.value } : i));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="bg-deepseek-dark border-deepseek-gray-700 text-white flex-1"
                          placeholder="#ffffff"
                        />
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {COLOR_PRESETS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...(i as TextItem), color } : i));
                            }}
                            className="h-8 w-full rounded border border-deepseek-gray-600 hover:border-deepseek-electric transition-colors"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-deepseek-gray-400 mb-1">Font size: {(selectedItem as TextItem).fontSize}px</div>
                      <Slider value={[(selectedItem as TextItem).fontSize]} min={8} max={200} step={1} onValueChange={(v) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...(i as TextItem), fontSize: (v[0] as number) ?? 48 } : i))} />
                    </div>
                  </>
                ) : null}

                <div>
                  <div className="text-xs text-deepseek-gray-400 mb-1">Rotation: {Math.round(selectedItem.rotationDeg)}°</div>
                  <Slider value={[selectedItem.rotationDeg]} min={-180} max={180} step={1} onValueChange={(v) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, rotationDeg: (v[0] as number) ?? 0 } : i))} />
                </div>
                <div>
                  <div className="text-xs text-deepseek-gray-400 mb-1">Opacity: {Math.round(selectedItem.opacity * 100)}%</div>
                  <Slider value={[selectedItem.opacity]} min={0} max={1} step={0.01} onValueChange={(v) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, opacity: (v[0] as number) ?? 1 } : i))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={Math.round(selectedItem.x)} onChange={(e) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, x: Number(e.target.value) || 0 } : i))} className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
                  <Input type="number" value={Math.round(selectedItem.y)} onChange={(e) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, y: Number(e.target.value) || 0 } : i))} className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
                  <Input type="number" value={Math.round(selectedItem.width)} onChange={(e) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, width: Math.max(20, Number(e.target.value) || 0) } : i))} className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
                  <Input type="number" value={Math.round(selectedItem.height)} onChange={(e) => setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, height: Math.max(20, Number(e.target.value) || 0) } : i))} className="bg-deepseek-dark border-deepseek-gray-700 text-white" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-deepseek-gray-400">Select an item to edit its properties.</div>
            )}

            <div className="pt-2">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" /> Export PNG
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignStudio;



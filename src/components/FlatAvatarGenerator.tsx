import React, { useCallback, useRef, useState } from "react";
import Avatar from "avataaars";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FlatAvatarGeneratorProps {
  onApply?: (dataUrl: string) => void;
}

const topTypes = [
  "NoHair","Eyepatch","Hat","Hijab","Turban","WinterHat1","WinterHat2","WinterHat3","WinterHat4",
  "LongHairBigHair","LongHairBob","LongHairBun","LongHairCurly","LongHairCurvy","LongHairDreads",
  "LongHairFrida","LongHairFro","LongHairFroBand","LongHairNotTooLong","LongHairShavedSides",
  "LongHairMiaWallace","LongHairStraight","LongHairStraight2","LongHairStraightStrand",
  "ShortHairDreads01","ShortHairDreads02","ShortHairFrizzle","ShortHairShaggyMullet","ShortHairShortCurly",
  "ShortHairShortFlat","ShortHairShortRound","ShortHairShortWaved","ShortHairSides","ShortHairTheCaesar","ShortHairTheCaesarSidePart",
] as const;

const accessoriesTypes = [
  "Blank","Kurt","Prescription01","Prescription02","Round","Sunglasses","Wayfarers",
] as const;

const hatColors = [
  "Black","Blue02","Blue03","Gray01","Gray02","Heather","PastelBlue","PastelGreen","PastelOrange","PastelRed","PastelYellow","Pink","Red","White",
] as const;

const hairColors = [
  "Auburn","Black","Blonde","BlondeGolden","Brown","BrownDark","PastelPink","Platinum","Red","SilverGray",
] as const;

const facialHairTypes = [
  "Blank","BeardMedium","BeardLight","BeardMagestic","MoustacheFancy","MoustacheMagnum",
] as const;

const clotheTypes = [
  "BlazerShirt","BlazerSweater","CollarSweater","GraphicShirt","Hoodie","Overall","ShirtCrewNeck","ShirtScoopNeck","ShirtVNeck",
] as const;

const clotheColors = hatColors;

const eyeTypes = [
  "Close","Cry","Default","Dizzy","EyeRoll","Happy","Hearts","Side","Squint","Surprised","Wink","WinkWacky",
] as const;

const eyebrowTypes = [
  "Angry","AngryNatural","Default","DefaultNatural","FlatNatural","RaisedExcited","RaisedExcitedNatural","SadConcerned","SadConcernedNatural","UnibrowNatural","UpDown","UpDownNatural",
] as const;

const mouthTypes = [
  "Concerned","Default","Disbelief","Eating","Grimace","Sad","ScreamOpen","Serious","Smile","Tongue","Twinkle","Vomit",
] as const;

const skinColors = [
  "Tanned","Yellow","Pale","Light","Brown","DarkBrown","Black",
] as const;

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const defaultState = () => ({
  topType: rand(topTypes),
  accessoriesType: rand(accessoriesTypes),
  hatColor: rand(hatColors),
  hairColor: rand(hairColors),
  facialHairType: rand(facialHairTypes),
  clotheType: rand(clotheTypes),
  clotheColor: rand(clotheColors),
  eyeType: rand(eyeTypes),
  eyebrowType: rand(eyebrowTypes),
  mouthType: rand(mouthTypes),
  skinColor: rand(skinColors),
  avatarStyle: Math.random() > 0.5 ? "Circle" : "Transparent",
});

const exportSvgToPng = async (svgEl: SVGSVGElement, size = 512): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;
      cloned.setAttribute("width", String(size));
      cloned.setAttribute("height", String(size));
      const svgData = new XMLSerializer().serializeToString(cloned);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const FlatAvatarGenerator: React.FC<FlatAvatarGeneratorProps> = ({ onApply }) => {
  const [options, setOptions] = useState(defaultState);
  const svgWrapRef = useRef<HTMLDivElement>(null);

  const randomize = useCallback(() => {
    setOptions(defaultState());
  }, []);

  const handleUse = useCallback(async () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const dataUrl = await exportSvgToPng(svg);
    onApply?.(dataUrl);
    toast.success("Avatar applied to the generated image");
  }, [onApply]);

  const handleDownloadSvg = useCallback(() => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `avatar-${Date.now()}.svg`);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadPng = useCallback(async () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const dataUrl = await exportSvgToPng(svg);
    downloadDataUrl(dataUrl, `avatar-${Date.now()}.png`);
    toast.success("Avatar PNG downloaded");
  }, []);

  return (
    <div className="bg-deepseek-gray-800 rounded-lg p-6 border border-deepseek-gray-600">
      <label className="block text-sm font-medium text-deepseek-gray-300 mb-4">Flat Avatar Generator</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-deepseek-dark rounded-lg border border-deepseek-gray-700 aspect-square flex items-center justify-center overflow-hidden" ref={svgWrapRef}>
          <Avatar
            avatarStyle={options.avatarStyle as any}
            topType={options.topType as any}
            accessoriesType={options.accessoriesType as any}
            hairColor={options.hairColor as any}
            facialHairType={options.facialHairType as any}
            clotheType={options.clotheType as any}
            clotheColor={options.clotheColor as any}
            eyeType={options.eyeType as any}
            eyebrowType={options.eyebrowType as any}
            mouthType={options.mouthType as any}
            skinColor={options.skinColor as any}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={randomize} className="bg-gradient-to-r from-deepseek-blue to-deepseek-cyan hover:from-deepseek-cyan hover:to-deepseek-blue text-white font-medium">Randomize Avatar</Button>
          <Button onClick={handleUse} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium">Use as Generated Image</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadSvg} className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600 w-full">Download SVG</Button>
            <Button variant="outline" onClick={handleDownloadPng} className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white hover:bg-deepseek-gray-600 w-full">Download PNG</Button>
          </div>
          <p className="text-xs text-deepseek-gray-400">Based on Pablo Stanley's Avataaars. Randomize and use it as your generated image.</p>
        </div>
      </div>
    </div>
  );
};

export default FlatAvatarGenerator;

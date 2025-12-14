
import React, { useState, useEffect } from 'react';
import { CornerSelector } from './CornerSelector';
import { ArtObject, Point, FrameConfig } from '../types';
import { computeHomography } from '../utils/math';

interface ArtStudioProps {
  existingArt?: ArtObject;
  palette: string[];
  onSave: (art: ArtObject) => void;
  onUpdatePalette: (colors: string[]) => void;
  onCancel: () => void;
}

export const ArtStudio: React.FC<ArtStudioProps> = ({ existingArt, palette, onSave, onUpdatePalette, onCancel }) => {
  const [step, setStep] = useState<'UPLOAD' | 'CROP' | 'FRAME'>('UPLOAD');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [corners, setCorners] = useState<[Point, Point, Point, Point]>([
    {x: 10, y: 10}, {x: 90, y: 10}, {x: 90, y: 90}, {x: 10, y: 90}
  ]);
  
  // Frame State
  const [widthCm, setWidthCm] = useState<number>(50);
  const [heightCm, setHeightCm] = useState<number>(50);
  const [artName, setArtName] = useState('Untitled Art');
  
  const [frameConfig, setFrameConfig] = useState<FrameConfig>({
    matColor: '#f1f5f9', // Slate 100
    matWidthCm: 0, 
    frameColor: '#1e293b', // Slate 800
    frameWidthCm: 0,
  });

  const [eyedropperActive, setEyedropperActive] = useState(false);
  // If null, we just add to palette. If 'mat'/'frame', we apply it.
  const [eyedropperTarget, setEyedropperTarget] = useState<'mat' | 'frame' | null>(null);

  // Initialize for Edit Mode
  useEffect(() => {
    if (existingArt) {
      setArtName(existingArt.name);
      setWidthCm(existingArt.realWidthCm);
      setHeightCm(existingArt.realHeightCm);
      setFrameConfig(existingArt.frame);
      setProcessedImage(existingArt.imageSrc);
      setStep('FRAME');
    }
  }, [existingArt]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target?.result as string);
        setStep('CROP');
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleColorPick = (hex: string) => {
      if (eyedropperTarget === 'mat') {
          setFrameConfig(prev => ({...prev, matColor: hex}));
      } else if (eyedropperTarget === 'frame') {
          setFrameConfig(prev => ({...prev, frameColor: hex}));
      }
      
      // Add to palette if not exists
      if (!palette.includes(hex)) {
          onUpdatePalette([hex, ...palette].slice(0, 10)); // Keep last 10
      }
      
      setEyedropperActive(false);
      setEyedropperTarget(null);
  };

  const processCrop = () => {
    if (!imageSrc) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        const topDist = Math.hypot((corners[1].x - corners[0].x), (corners[1].y - corners[0].y));
        const sideDist = Math.hypot((corners[3].x - corners[0].x), (corners[3].y - corners[0].y));
        const aspect = topDist / sideDist;

        // Create a reasonably sized canvas for the texture
        const w = 1000;
        const h = w / aspect;
        
        canvas.width = w;
        canvas.height = h;

        if (!ctx) return;

        const srcPts = corners.map(p => ({
            x: p.x * img.width / 100,
            y: p.y * img.height / 100
        }));

        const dstPts = [
            {x: 0, y: 0}, {x: w, y: 0}, {x: w, y: h}, {x: 0, y: h}
        ];
        
        const H = computeHomography(dstPts, srcPts);
        
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = img.width;
        tmpCanvas.height = img.height;
        const tmpCtx = tmpCanvas.getContext('2d');
        if(!tmpCtx) return;
        tmpCtx.drawImage(img, 0, 0);
        const srcData = tmpCtx.getImageData(0, 0, img.width, img.height).data;
        const srcW = img.width;
        const srcH = img.height;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const denom = H[6]*x + H[7]*y + H[8];
                const u = (H[0]*x + H[1]*y + H[2]) / denom;
                const v = (H[3]*x + H[4]*y + H[5]) / denom;

                if (u >= 0 && u < srcW - 1 && v >= 0 && v < srcH - 1) {
                    const u0 = Math.floor(u);
                    const v0 = Math.floor(v);
                    const u1 = u0 + 1;
                    const v1 = v0 + 1;
                    const dx = u - u0;
                    const dy = v - v0;

                    const i00 = (v0 * srcW + u0) * 4;
                    const i10 = (v0 * srcW + u1) * 4;
                    const i01 = (v1 * srcW + u0) * 4;
                    const i11 = (v1 * srcW + u1) * 4;

                    const idx = (y * w + x) * 4;
                    for (let k = 0; k < 3; k++) { 
                        const val = 
                            srcData[i00+k] * (1-dx)*(1-dy) +
                            srcData[i10+k] * (dx)*(1-dy) +
                            srcData[i01+k] * (1-dx)*(dy) +
                            srcData[i11+k] * (dx)*(dy);
                        data[idx + k] = val;
                    }
                    data[idx+3] = 255; 
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        setProcessedImage(canvas.toDataURL());
        
        setHeightCm(Number((widthCm / aspect).toFixed(1)));
        
        setStep('FRAME');
    };
  };

  const handleSave = () => {
    if (!processedImage) return;
    const art: ArtObject = {
        id: existingArt ? existingArt.id : Date.now().toString(),
        name: artName,
        imageSrc: processedImage,
        realWidthCm: widthCm,
        realHeightCm: heightCm,
        frame: frameConfig
    };
    onSave(art);
    // Reset defaults if creating new
    if (!existingArt) {
        setImageSrc(null);
        setProcessedImage(null);
        setStep('UPLOAD');
    }
  };

  const ColorPickerSection = ({ label, color, onChange, onEyedropper }: { label: string, color: string, onChange: (c: string) => void, onEyedropper: () => void }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
             <span className="text-xs text-slate-400">{label}</span>
             <button 
                onClick={onEyedropper}
                className="text-xs flex items-center gap-1 text-slate-500 hover:text-white"
                title="Pick color from image"
             >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                 Pick
             </button>
        </div>
        <div className="flex gap-1 flex-wrap">
            {/* Palette */}
            {palette.map(c => (
                <button key={c} onClick={() => onChange(c)} className={`w-6 h-6 rounded-full border border-slate-600 ${color === c ? 'ring-2 ring-white' : ''}`} style={{backgroundColor: c}} title={c} />
            ))}
             <input type="color" value={color} onChange={e=>onChange(e.target.value)} className="w-6 h-6 rounded overflow-hidden cursor-pointer" />
        </div>
    </div>
  );

  if (step === 'UPLOAD') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
        <h3 className="text-xl font-bold text-white mb-2">Add New Artwork</h3>
        <p className="text-slate-400 mb-6">Upload a photo of your art (painting, poster, print).</p>
        <div className="flex space-x-4">
            <label className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors shadow-lg font-medium">
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            <button onClick={onCancel} className="text-slate-400 hover:text-white px-4">Cancel</button>
        </div>
      </div>
    );
  }

  // If picking color (Either from crop view or explicitly triggered from frame view)
  if (eyedropperActive && imageSrc) {
       return (
        <div className="flex flex-col h-full space-y-4">
             <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg">
                <h3 className="text-xl font-bold text-white">Pick a color from your art</h3>
                <button onClick={() => setEyedropperActive(false)} className="bg-slate-700 text-white px-4 py-2 rounded">Cancel</button>
            </div>
            <div className="flex-1 bg-slate-950 rounded overflow-hidden p-4 flex items-center justify-center">
                 <CornerSelector 
                    imageSrc={imageSrc} 
                    onCornersChange={()=>{}} 
                    eyedropperMode={true}
                    onColorPick={handleColorPick}
                    label="Color Picker" 
                    instruction="Click on the image to save that color to your palette" 
                 />
            </div>
        </div>
       )
  }

  if (step === 'CROP') {
      return (
        <div className="flex flex-col h-full space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Crop & Straighten</h3>
                <div className="flex gap-2">
                     <button 
                        onClick={() => { setEyedropperTarget(null); setEyedropperActive(true); }}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
                     >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        Pick Colors
                     </button>
                     <button onClick={processCrop} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold">Next: Frame</button>
                </div>
            </div>
            <div className="flex-1 bg-slate-950 rounded overflow-hidden p-4 flex items-center justify-center">
                 {imageSrc && <CornerSelector imageSrc={imageSrc} onCornersChange={setCorners} label="Crop Art" instruction="Align corners to the artwork edges" />}
            </div>
        </div>
      );
  }

  // Frame Step
  const scale = 3; // Visual scale for preview
  const totalWidth = widthCm + (frameConfig.frameWidthCm * 2) + (frameConfig.matWidthCm * 2);
  const totalHeight = heightCm + (frameConfig.frameWidthCm * 2) + (frameConfig.matWidthCm * 2);

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
        {/* Controls */}
        <div className="w-full lg:w-80 bg-slate-800 p-6 rounded-lg overflow-y-auto border border-slate-700 space-y-6">
            <div>
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Art Details</h3>
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-xs text-slate-400">Name</span>
                        <input type="text" value={artName} onChange={e=>setArtName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <label>
                            <span className="text-xs text-slate-400">Real Width (cm)</span>
                            <input type="number" value={widthCm} onChange={e=>setWidthCm(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                        </label>
                        <label>
                            <span className="text-xs text-slate-400">Real Height (cm)</span>
                            <input type="number" value={heightCm} onChange={e=>setHeightCm(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                        </label>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Mat (Inner)</h3>
                <div className="space-y-3">
                    <label className="block">
                         <span className="text-xs text-slate-400">Mat Width (cm)</span>
                         <input type="range" min="0" max="15" step="0.5" value={frameConfig.matWidthCm} onChange={e=>setFrameConfig({...frameConfig, matWidthCm: Number(e.target.value)})} className="w-full accent-blue-500" />
                         <span className="text-right text-xs text-slate-300 block">{frameConfig.matWidthCm} cm</span>
                    </label>
                    
                    <ColorPickerSection 
                        label="Mat Color" 
                        color={frameConfig.matColor} 
                        onChange={(c) => setFrameConfig({...frameConfig, matColor: c})} 
                        onEyedropper={() => {
                            if (imageSrc) {
                                setEyedropperTarget('mat');
                                setEyedropperActive(true);
                            } else {
                                alert("No source image to pick from");
                            }
                        }}
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Frame (Outer)</h3>
                <div className="space-y-3">
                    <label className="block">
                         <span className="text-xs text-slate-400">Frame Width (cm)</span>
                         <input type="range" min="0" max="10" step="0.5" value={frameConfig.frameWidthCm} onChange={e=>setFrameConfig({...frameConfig, frameWidthCm: Number(e.target.value)})} className="w-full accent-blue-500" />
                         <span className="text-right text-xs text-slate-300 block">{frameConfig.frameWidthCm} cm</span>
                    </label>

                    <ColorPickerSection 
                        label="Frame Color" 
                        color={frameConfig.frameColor} 
                        onChange={(c) => setFrameConfig({...frameConfig, frameColor: c})} 
                        onEyedropper={() => {
                            if (imageSrc) {
                                setEyedropperTarget('frame');
                                setEyedropperActive(true);
                            } else {
                                alert("No source image to pick from");
                            }
                        }}
                    />
                </div>
            </div>

            <div className="pt-4 flex flex-col gap-2">
                 <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white w-full py-3 rounded-lg font-bold shadow-lg">
                     {existingArt ? 'Update Artwork' : 'Save to Inventory'}
                 </button>
                 {!existingArt ? (
                    <button onClick={() => setStep('CROP')} className="text-slate-400 hover:text-white w-full py-2">Back to Crop</button>
                 ) : (
                    <button onClick={onCancel} className="text-slate-400 hover:text-white w-full py-2">Cancel Edit</button>
                 )}
            </div>
        </div>

        {/* Preview */}
        <div className="flex-1 bg-slate-950 rounded-lg flex items-center justify-center p-8 overflow-hidden relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',
                backgroundSize: '20px 20px'
            }}></div>

            {/* Visual Preview */}
            <div 
                className="shadow-2xl transition-all duration-300 relative box-border"
                style={{
                    width: `${widthCm * scale}px`,
                    height: `${heightCm * scale}px`,
                    boxSizing: 'content-box',
                    border: `${frameConfig.frameWidthCm * scale}px solid ${frameConfig.frameColor}`,
                    padding: `${frameConfig.matWidthCm * scale}px`,
                    backgroundColor: frameConfig.matColor
                }}
            >
                {/* Changed from object-cover to w-full h-full (fill) to allow perspective correction of texture */}
                {processedImage && <img src={processedImage} alt="Art Preview" className="w-full h-full block" />}
                
                {/* Dimensions Label */}
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-slate-400 text-xs text-center whitespace-nowrap">
                    Total Size: {totalWidth.toFixed(1)}cm x {totalHeight.toFixed(1)}cm
                </div>
            </div>
        </div>
    </div>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import { CornerSelector } from './CornerSelector';
import { WallData, Point } from '../types';
import { distance, computeHomography, transformPoint } from '../utils/math';

interface WallCalibratorProps {
  onSave: (wall: WallData) => void;
  onCancel: () => void;
  palette?: string[];
  onUpdatePalette?: (colors: string[]) => void;
}

export const WallCalibrator: React.FC<WallCalibratorProps> = ({ onSave, onCancel, palette = [], onUpdatePalette }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [corners, setCorners] = useState<[Point, Point, Point, Point]>([
    {x: 20, y: 20}, {x: 80, y: 20}, {x: 80, y: 80}, {x: 20, y: 80}
  ]);
  const [realWidth, setRealWidth] = useState<string>('200'); // Default 2 meters
  const [realHeight, setRealHeight] = useState<string>('200'); // Default 2 meters
  const [manualHeight, setManualHeight] = useState(false); 
  const [showGrid, setShowGrid] = useState(true);
  
  const [eyedropperActive, setEyedropperActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleColorPick = (hex: string) => {
    if (onUpdatePalette && !palette.includes(hex)) {
        onUpdatePalette([hex, ...palette].slice(0, 10));
        alert(`Color ${hex} added to palette!`);
    }
    setEyedropperActive(false);
  };

  // Auto-guess height logic
  useEffect(() => {
    if (!manualHeight && imageSrc) {
        const w1 = distance(corners[0], corners[1]); // Top
        const w2 = distance(corners[3], corners[2]); // Bottom
        const h1 = distance(corners[0], corners[3]); // Left
        const h2 = distance(corners[1], corners[2]); // Right
        
        const avgW = (w1 + w2) / 2;
        const avgH = (h1 + h2) / 2;
        
        if (avgH > 0) {
            const ratio = avgW / avgH; 
            const wVal = parseFloat(realWidth);
            if (!isNaN(wVal) && wVal > 0) {
                 const hGuess = wVal / ratio;
                 setRealHeight(hGuess.toFixed(0));
            }
        }
    }
  }, [realWidth, corners, imageSrc, manualHeight]);

  const handleSave = () => {
    if (!imageSrc) return;
    const widthVal = parseFloat(realWidth);
    const heightVal = parseFloat(realHeight);

    if (isNaN(widthVal) || widthVal <= 0) {
      alert("Please enter a valid width");
      return;
    }
    if (isNaN(heightVal) || heightVal <= 0) {
      alert("Please enter a valid height");
      return;
    }

    const trueAspectRatio = widthVal / heightVal;

    onSave({
      id: Date.now().toString(),
      imageSrc,
      corners,
      realWidthCm: widthVal,
      realHeightCm: heightVal,
      aspectRatio: trueAspectRatio
    });
  };

  // Compute grid lines for visualization
  const gridLines = useMemo(() => {
     if (!imageSrc || !showGrid) return null;
     
     const unitCorners = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}];
     const H = computeHomography(unitCorners, corners);
     
     const lines: React.ReactElement[] = [];
     
     const wVal = parseFloat(realWidth) || 200;
     const hVal = parseFloat(realHeight) || 200;
     const cellSize = 50; // 50cm grid
     
     const cols = Math.floor(wVal / cellSize);
     const rows = Math.floor(hVal / cellSize);

     for(let i=0; i<=cols; i++) {
         const u = i * (cellSize / wVal);
         if(u > 1.001) break;
         const start = transformPoint(u, 0, H);
         const end = transformPoint(u, 1, H);
         lines.push(
            <line key={`v-${i}`} x1={`${start.x}%`} y1={`${start.y}%`} x2={`${end.x}%`} y2={`${end.y}%`} stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
         );
     }
     
     for(let i=0; i<=rows; i++) {
         const v = i * (cellSize / hVal);
         if(v > 1.001) break;
         const start = transformPoint(0, v, H);
         const end = transformPoint(1, v, H);
         lines.push(
            <line key={`h-${i}`} x1={`${start.x}%`} y1={`${start.y}%`} x2={`${end.x}%`} y2={`${end.y}%`} stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
         );
     }
     
     return lines;
  }, [corners, realWidth, realHeight, imageSrc, showGrid]);


  if (!imageSrc) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-xl font-bold text-white mb-2">Upload Wall Photo</h3>
        <p className="text-slate-400 mb-6 max-w-md">Take a photo of your wall. Try to include some corners or define a clear rectangular area.</p>
        <label className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors shadow-lg font-medium">
          Choose Image
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
        <button onClick={onCancel} className="mt-8 text-slate-500 hover:text-white">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-2 gap-4">
         <div>
            <h2 className="text-2xl font-bold text-white">Define Wall Surface</h2>
            <p className="text-slate-400 text-sm">Drag the 4 corners to where the wall meets the floor/ceiling or corners.</p>
         </div>
         <div className="flex flex-wrap items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Top Width (cm)</span>
                    <input 
                        type="number" 
                        value={realWidth}
                        onChange={(e) => setRealWidth(e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-right focus:border-blue-500 outline-none font-mono"
                        title="Measure the real width between the top two points"
                    />
                </div>
                <div className="flex flex-col relative">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Left Height (cm)</span>
                    <input 
                        type="number" 
                        value={realHeight}
                        onChange={(e) => {
                            setRealHeight(e.target.value);
                            setManualHeight(true);
                        }}
                        className={`w-24 border rounded px-2 py-1 text-white text-right focus:border-blue-500 outline-none font-mono ${manualHeight ? 'bg-slate-900 border-slate-600' : 'bg-slate-800 border-blue-900/50 text-blue-200'}`}
                        title="We'll guess this for you, but you can enter the exact height if you know it."
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                <button 
                    onClick={() => setEyedropperActive(!eyedropperActive)}
                    className={`p-2 rounded ${eyedropperActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-700'}`}
                    title="Grab a color from the room to use later"
                >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </button>
                 <label className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="rounded bg-slate-700 border-slate-600" />
                    <span>Grid</span>
                 </label>
            </div>

            <div className="h-full flex items-end">
                <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold shadow-lg transition-colors h-full flex items-center">
                    Use This Wall
                </button>
            </div>
         </div>
      </div>
      
      {eyedropperActive && (
          <div className="bg-blue-600/20 text-blue-200 px-4 py-2 rounded text-sm text-center border border-blue-500/50">
              Tip: Click on any part of the image (furniture, rug, paint) to save that color to your palette for later.
          </div>
      )}

      <div className="flex-1 bg-slate-950 rounded-lg shadow-inner overflow-hidden flex items-center justify-center p-4 relative">
        <CornerSelector 
            imageSrc={imageSrc} 
            onCornersChange={setCorners} 
            eyedropperMode={eyedropperActive}
            onColorPick={handleColorPick}
            label={eyedropperActive ? "Pick a Color" : "Wall Surface"}
            instruction={eyedropperActive ? "Click anywhere to save color" : "Drag corners to match the real wall area"}
        >
            {gridLines}
        </CornerSelector>
      </div>
    </div>
  );
};

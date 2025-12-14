
import React, { useState, useRef, useEffect } from 'react';
import { Point } from '../types';

interface CornerSelectorProps {
  imageSrc: string;
  initialCorners?: [Point, Point, Point, Point];
  onCornersChange: (corners: [Point, Point, Point, Point]) => void;
  label?: string;
  instruction?: string;
  children?: React.ReactNode;
  // Mode where clicking returns color instead of dragging corners
  eyedropperMode?: boolean;
  onColorPick?: (hex: string) => void;
}

export const CornerSelector: React.FC<CornerSelectorProps> = ({
  imageSrc,
  initialCorners,
  onCornersChange,
  label,
  instruction,
  children,
  eyedropperMode = false,
  onColorPick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [corners, setCorners] = useState<[Point, Point, Point, Point]>(
    initialCorners || [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 }
    ]
  );
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (initialCorners) {
      setCorners(initialCorners);
    }
  }, [initialCorners]);

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (eyedropperMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingIdx(index);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
      if (!eyedropperMode || !onColorPick || !imgRef.current || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // We need to sample from the actual image. 
      // Create a temporary canvas to read pixel data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = imgRef.current.naturalWidth;
      canvas.height = imgRef.current.naturalHeight;
      
      // Calculate scale
      const scaleX = imgRef.current.naturalWidth / rect.width;
      const scaleY = imgRef.current.naturalHeight / rect.height;
      
      ctx.drawImage(imgRef.current, 0, 0);
      
      const px = Math.floor(x * scaleX);
      const py = Math.floor(y * scaleY);
      
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      
      // RGB to Hex
      const toHex = (n: number) => {
          const hex = n.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
      };
      const hex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
      onColorPick(hex);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    const newCorners = [...corners] as [Point, Point, Point, Point];
    newCorners[draggingIdx] = { x: clampedX, y: clampedY };
    
    setCorners(newCorners);
    onCornersChange(newCorners);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingIdx(null);
    if(e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const labels = ['TL', 'TR', 'BR', 'BL'];
  const colors = ['bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-yellow-500'];

  return (
    <div className="relative w-full max-w-4xl mx-auto border border-slate-700 rounded-lg overflow-hidden bg-slate-900 shadow-2xl">
        <div className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded pointer-events-none">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-300">{label || "Calibration"}</h3>
            <p className="text-xs text-slate-400 mt-1">{instruction || "Drag the 4 corners to define the area."}</p>
        </div>
        
        {eyedropperMode && (
             <div className="absolute top-4 right-4 z-20 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs animate-pulse pointer-events-none">
                 Eyedropper Active: Click image to pick color
             </div>
        )}

      <div 
        ref={containerRef}
        className={`relative select-none touch-none ${eyedropperMode ? 'cursor-crosshair' : ''}`}
        onPointerMove={!eyedropperMode ? handlePointerMove : undefined}
        onClick={handleContainerClick}
      >
        <img 
          ref={imgRef}
          src={imageSrc} 
          alt="Worktable" 
          className="w-full h-auto block pointer-events-none opacity-80"
        />
        
        {/* Custom Overlay (Grid) */}
        {children && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {children}
            </svg>
        )}
        
        {/* Connection Lines (SVG Overlay) */}
        {!eyedropperMode && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70">
            <polygon 
                points={corners.map(p => `${p.x}%,${p.y}%`).join(' ')}
                fill="rgba(56, 189, 248, 0.1)"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="4"
            />
            </svg>
        )}

        {/* Handles */}
        {!eyedropperMode && corners.map((p, idx) => {
            const isDragging = draggingIdx === idx;
            return (
                <div
                    key={idx}
                    className={`absolute z-20 -ml-4 -mt-4 cursor-move flex items-center justify-center transition-all 
                        ${isDragging ? 'w-16 h-16 -ml-8 -mt-8' : 'w-8 h-8 hover:scale-110 active:scale-95'}
                    `}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    onPointerUp={handlePointerUp}
                >
                    {isDragging ? (
                        // Precision Crosshair when dragging
                        <div className="relative w-full h-full">
                            <div className="absolute top-1/2 left-0 w-full h-px bg-white/80"></div>
                            <div className="absolute left-1/2 top-0 h-full w-px bg-white/80"></div>
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-white rounded-full ${colors[idx].replace('bg-', 'border-')}`}></div>
                        </div>
                    ) : (
                        // Standard Handle
                        <div className={`w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center ${colors[idx]}`}>
                             <span className="text-[10px] font-bold text-white">{labels[idx]}</span>
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};

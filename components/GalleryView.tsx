import React, { useState, useRef, useEffect } from 'react';
import { WallData, ArtObject, PlacedArt, Point, SavedLayout } from '../types';
import { getCSSMatrix3d, computeHomography, transformPoint } from '../utils/math';

interface GalleryViewProps {
  wall: WallData;
  inventory: ArtObject[];
  layout: PlacedArt[];
  savedLayouts: SavedLayout[];
  onUpdateLayout: (newLayout: PlacedArt[]) => void;
  onSaveLayout: (name: string) => void;
  onLoadLayout: (layout: PlacedArt[]) => void;
  onBack: () => void;
  onOpenStudio: () => void;
  onEditArt: (artId: string) => void;
}

type SnapMode = 'CENTER' | 'EDGE';
type InteractionMode = 'MOVE_ART' | 'ADD_GUIDE' | 'REMOVE_GUIDE';

export const GalleryView: React.FC<GalleryViewProps> = ({ 
  wall, 
  inventory, 
  layout, 
  savedLayouts,
  onUpdateLayout,
  onSaveLayout,
  onLoadLayout,
  onBack,
  onOpenStudio,
  onEditArt
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Interaction State
  const [mode, setMode] = useState<InteractionMode>('MOVE_ART');
  const [activeArtId, setActiveArtId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({x: 0, y: 0});
  const [isDragging, setIsDragging] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Layout Saving State
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');

  // Guidelines State
  const [hGuides, setHGuides] = useState<number[]>([]);
  const [vGuides, setVGuides] = useState<number[]>([]);
  const [showGuides, setShowGuides] = useState(false);
  const [snapMode, setSnapMode] = useState<SnapMode>('CENTER');
  
  // Track the actual rendered dimensions of the image
  const [imgRect, setImgRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const realWallHeight = wall.realHeightCm ?? (wall.realWidthCm / wall.aspectRatio);

  useEffect(() => {
      const updateRect = () => {
          if (!containerRef.current || !imgRef.current) return;
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          const iw = imgRef.current.naturalWidth;
          const ih = imgRef.current.naturalHeight;
          
          if (!iw || !ih) return;

          const containerRatio = cw / ch;
          const imageRatio = iw / ih;

          let renderW, renderH, renderTop, renderLeft;

          if (containerRatio > imageRatio) {
              renderH = ch;
              renderW = ch * imageRatio;
              renderTop = 0;
              renderLeft = (cw - renderW) / 2;
          } else {
              renderW = cw;
              renderH = cw / imageRatio;
              renderLeft = 0;
              renderTop = (ch - renderH) / 2;
          }

          setImgRect({ width: renderW, height: renderH, top: renderTop, left: renderLeft });
      };

      updateRect();
      window.addEventListener('resize', updateRect);
      const img = imgRef.current;
      if (img) img.addEventListener('load', updateRect);
      return () => {
          window.removeEventListener('resize', updateRect);
          if(img) img.removeEventListener('load', updateRect);
      };
  }, [wall.imageSrc]);

  // --- Rendering & Export Logic ---

  const handleExportImage = async () => {
      if (!imgRef.current) return;
      setIsExporting(true);
      
      try {
        const baseImg = imgRef.current;
        const w = baseImg.naturalWidth;
        const h = baseImg.naturalHeight;
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // 1. Draw Wall
        ctx.drawImage(baseImg, 0, 0);
        
        // 2. Compute Wall Homography
        const wallCornersPx = wall.corners.map(p => ({
            x: (p.x / 100) * w,
            y: (p.y / 100) * h
        }));
        const unitSquare = [{x:0,y:0}, {x:1,y:0}, {x:1,y:1}, {x:0,y:1}];
        const H_wall = computeHomography(unitSquare, wallCornersPx);

        // 3. Draw each art piece
        for (const item of layout) {
            const art = inventory.find(a => a.id === item.artId);
            if (!art) continue;

            const wallW = wall.realWidthCm;
            const wallH = realWallHeight;
            const totalArtW = art.realWidthCm + (art.frame.frameWidthCm + art.frame.matWidthCm) * 2;
            const totalArtH = art.realHeightCm + (art.frame.frameWidthCm + art.frame.matWidthCm) * 2;
            
            const wUnit = totalArtW / wallW;
            const hUnit = totalArtH / wallH;
            const x0 = item.x - (wUnit / 2);
            const y0 = item.y - (hUnit / 2);
            
            const logicalCorners = [
                {x: x0, y: y0},
                {x: x0 + wUnit, y: y0},
                {x: x0 + wUnit, y: y0 + hUnit},
                {x: x0, y: y0 + hUnit}
            ];
            
            const dstPoints = logicalCorners.map(p => transformPoint(p.x, p.y, H_wall));
            
            const texCanvas = document.createElement('canvas');
            const texW = 1000;
            const texH = texW * (totalArtH / totalArtW);
            texCanvas.width = texW;
            texCanvas.height = texH;
            const texCtx = texCanvas.getContext('2d');
            if (texCtx) {
                texCtx.fillStyle = art.frame.frameColor;
                texCtx.fillRect(0, 0, texW, texH);
                
                const scale = texW / totalArtW;
                const fPx = art.frame.frameWidthCm * scale;
                const mPx = art.frame.matWidthCm * scale;
                
                texCtx.fillStyle = art.frame.matColor;
                texCtx.fillRect(fPx, fPx, texW - fPx*2, texH - fPx*2);
                
                const artImg = new Image();
                artImg.src = art.imageSrc;
                await new Promise(r => { artImg.onload = r; });
                texCtx.drawImage(artImg, fPx + mPx, fPx + mPx, texW - (fPx+mPx)*2, texH - (fPx+mPx)*2);
            }
            
            const texData = texCtx?.getImageData(0, 0, texW, texH).data;
            if (!texData) continue;

            let minX = w, minY = h, maxX = 0, maxY = 0;
            dstPoints.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            minX = Math.floor(Math.max(0, minX));
            minY = Math.floor(Math.max(0, minY));
            maxX = Math.ceil(Math.min(w, maxX));
            maxY = Math.ceil(Math.min(h, maxY));

            const srcCorners = [{x:0, y:0}, {x:texW, y:0}, {x:texW, y:texH}, {x:0, y:texH}];
            const H_inv = computeHomography(dstPoints, srcCorners);
            
            const destImageData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
            const destData = destImageData.data;
            const dw = maxX - minX;

            for (let y = 0; y < maxY - minY; y++) {
                for (let x = 0; x < maxX - minX; x++) {
                    const globalX = x + minX;
                    const globalY = y + minY;
                    
                    const denom = H_inv[6]*globalX + H_inv[7]*globalY + H_inv[8];
                    const u = (H_inv[0]*globalX + H_inv[1]*globalY + H_inv[2]) / denom;
                    const v = (H_inv[3]*globalX + H_inv[4]*globalY + H_inv[5]) / denom;
                    
                    if (u >= 0 && u < texW && v >= 0 && v < texH) {
                         const uInt = Math.floor(u);
                         const vInt = Math.floor(v);
                         const tIdx = (vInt * texW + uInt) * 4;
                         const dIdx = (y * dw + x) * 4;
                         
                         destData[dIdx] = texData[tIdx];
                         destData[dIdx+1] = texData[tIdx+1];
                         destData[dIdx+2] = texData[tIdx+2];
                         destData[dIdx+3] = 255; 
                    }
                }
            }
            ctx.putImageData(destImageData, minX, minY);
        }

        const link = document.createElement('a');
        link.download = 'picture-this-export.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.85);
        link.click();

      } catch (e) {
          console.error(e);
          alert("Error exporting image");
      } finally {
          setIsExporting(false);
      }
  };

  // --- Interaction Logic ---

  const handleDragStart = (e: React.PointerEvent, artId: string, instanceId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Can only move art in MOVE_ART mode
    if (instanceId && mode !== 'MOVE_ART') return;

    // Creating new instance from sidebar is always allowed, automatically switches to MOVE_ART
    if (!instanceId) {
        setMode('MOVE_ART');
    }

    if (!containerRef.current) return;

    if (instanceId) {
       const existing = layout.find(p => p.id === instanceId);
       if(existing) {
           setActiveArtId(instanceId);
           setIsDragging(true);
           const logicalPos = getLogicalPosition(e.clientX, e.clientY);
           if (logicalPos) {
               setDragOffset({
                   x: existing.x - logicalPos.x,
                   y: existing.y - logicalPos.y
               });
           }
       }
    } else {
        const newInstanceId = Date.now().toString();
        const newPlacement: PlacedArt = {
            id: newInstanceId,
            artId: artId,
            x: 0.5,
            y: 0.5,
            rotation: 0
        };
        onUpdateLayout([...layout, newPlacement]);
        setActiveArtId(newInstanceId);
        setIsDragging(true);
        setDragOffset({x: 0, y: 0});
    }
  };

  const getLogicalPosition = (clientX: number, clientY: number): Point | null => {
      if (!imgRect.width || !imgRect.height) return null;
      if (!containerRef.current) return null;
      
      const rect = containerRef.current.getBoundingClientRect();
      const mxContainer = clientX - rect.left;
      const myContainer = clientY - rect.top;

      const imgX = (mxContainer - imgRect.left) / imgRect.width * 100;
      const imgY = (myContainer - imgRect.top) / imgRect.height * 100;

      const unitSquare = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}];
      const H_inv = computeHomography(wall.corners, unitSquare);
      return transformPoint(imgX, imgY, H_inv);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!activeArtId || !isDragging) return;
      
      const logical = getLogicalPosition(e.clientX, e.clientY);
      if (logical) {
          let newX = logical.x + dragOffset.x;
          let newY = logical.y + dragOffset.y;
          
          if (showGuides) {
             const threshold = 0.015;
             const currentItem = layout.find(i => i.id === activeArtId);
             const art = inventory.find(a => a.id === currentItem?.artId);
             
             let halfW = 0, halfH = 0;
             if (art) {
                 const totalArtW = art.realWidthCm + (art.frame.frameWidthCm + art.frame.matWidthCm) * 2;
                 const totalArtH = art.realHeightCm + (art.frame.frameWidthCm + art.frame.matWidthCm) * 2;
                 const wUnit = totalArtW / wall.realWidthCm;
                 const hUnit = totalArtH / realWallHeight;
                 halfW = wUnit / 2;
                 halfH = hUnit / 2;
             }

             for(const gx of vGuides) {
                 if (Math.abs(newX - gx) < threshold) {
                     newX = gx;
                 }
                 if (snapMode === 'EDGE') {
                     if (Math.abs((newX - halfW) - gx) < threshold) newX = gx + halfW;
                     else if (Math.abs((newX + halfW) - gx) < threshold) newX = gx - halfW;
                 }
             }

             for(const gy of hGuides) {
                 if (Math.abs(newY - gy) < threshold) {
                     newY = gy;
                 }
                 if (snapMode === 'EDGE') {
                     if (Math.abs((newY - halfH) - gy) < threshold) newY = gy + halfH;
                     else if (Math.abs((newY + halfH) - gy) < threshold) newY = gy - halfH;
                 }
             }
          }

          onUpdateLayout(layout.map(p => {
              if (p.id === activeArtId) {
                  return {
                      ...p,
                      x: newX,
                      y: newY
                  };
              }
              return p;
          }));
      }
  };

  const handlePointerUp = () => {
      setIsDragging(false);
  };

  const handleWallClick = (e: React.PointerEvent) => {
      if (mode === 'ADD_GUIDE') {
         const pos = getLogicalPosition(e.clientX, e.clientY);
         if (pos) {
             if (e.shiftKey) {
                 setHGuides([...hGuides, pos.y]);
             } else {
                 setVGuides([...vGuides, pos.x]);
             }
         }
      }
      setActiveArtId(null);
  };

  const removeGuide = (type: 'h'|'v', index: number) => {
      // Only allow removal in remove mode
      if (mode !== 'REMOVE_GUIDE') return;

      if (type === 'h') setHGuides(hGuides.filter((_, i) => i !== index));
      else setVGuides(vGuides.filter((_, i) => i !== index));
  };

  const getArtStyle = (placement: PlacedArt) => {
      const art = inventory.find(a => a.id === placement.artId);
      if (!art || !imgRect.width) return { display: 'none' };
      
      const wallW = wall.realWidthCm;
      const wallH = realWallHeight;
      const totalArtW = art.realWidthCm + (art.frame.frameWidthCm + art.frame.matWidthCm) * 2;
      const totalArtH = art.realHeightCm + (art.frame.frameWidthCm + art.frame.matWidthCm) * 2;
      
      const wUnit = totalArtW / wallW;
      const hUnit = totalArtH / wallH;
      const x0 = placement.x - (wUnit / 2);
      const y0 = placement.y - (hUnit / 2);
      
      const artLogicalCorners = [
          {x: x0, y: y0},
          {x: x0 + wUnit, y: y0},
          {x: x0 + wUnit, y: y0 + hUnit},
          {x: x0, y: y0 + hUnit}
      ];
      
      const unitCorners = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}];
      const H = computeHomography(unitCorners, wall.corners);
      const screenCornersInPercent = artLogicalCorners.map(p => transformPoint(p.x, p.y, H));
      
      const pixelCorners = screenCornersInPercent.map(p => ({
          x: imgRect.left + (p.x / 100) * imgRect.width,
          y: imgRect.top + (p.y / 100) * imgRect.height
      }));
      
      const baseW = 200; 
      const baseH = baseW * (totalArtH / totalArtW);
      const transform = getCSSMatrix3d(baseW, baseH, pixelCorners);
      
      return {
          width: `${baseW}px`,
          height: `${baseH}px`,
          position: 'absolute' as 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: transform,
          zIndex: activeArtId === placement.id ? 50 : 10,
          // Cursor changes based on mode
          cursor: mode === 'MOVE_ART' ? (isDragging ? 'grabbing' : 'grab') : 'default',
          // Disable pointer events on art when in guide editing modes to prevent accidental drags
          pointerEvents: mode === 'MOVE_ART' ? 'auto' : 'none'
      } as React.CSSProperties;
  };

  // Guide rendering
  const renderGuides = () => {
      if (!showGuides || !imgRect.width) return null;
      
      const unitSquare = [{x:0, y:0}, {x:1, y:0}, {x:1,y:1}, {x:0, y:1}];
      const H = computeHomography(unitSquare, wall.corners);
      
      const renderGuideLine = (p1: Point, p2: Point, onClick: () => void, key: string, isVertical: boolean) => {
           const x1 = imgRect.left + (p1.x/100)*imgRect.width;
           const y1 = imgRect.top + (p1.y/100)*imgRect.height;
           const x2 = imgRect.left + (p2.x/100)*imgRect.width;
           const y2 = imgRect.top + (p2.y/100)*imgRect.height;
           
           const isRemoveMode = mode === 'REMOVE_GUIDE';

           return (
             <g key={key} 
                className={`group ${isRemoveMode ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`} 
                onClick={(e) => { 
                    if(isRemoveMode) {
                        e.stopPropagation(); 
                        onClick(); 
                    }
                }}
             >
                 {/* Invisible thick stroke for easier clicking, only active in REMOVE mode via CSS */}
                 <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="20" />
                 
                 {/* Visual Line */}
                 <line 
                    x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke={isRemoveMode ? "#ef4444" : "#f472b6"} // Red when removing, Pink when viewing
                    strokeWidth={isRemoveMode ? 2 : 1} 
                    strokeDasharray="5,5" 
                    className="transition-colors"
                 />
             </g>
           );
      };

      return (
          <svg className="absolute inset-0 w-full h-full z-40 pointer-events-none">
              {vGuides.map((gx, i) => 
                  renderGuideLine(transformPoint(gx, 0, H), transformPoint(gx, 1, H), () => removeGuide('v', i), `v${i}`, true)
              )}
              {hGuides.map((gy, i) => 
                   renderGuideLine(transformPoint(0, gy, H), transformPoint(1, gy, H), () => removeGuide('h', i), `h${i}`, false)
              )}
          </svg>
      );
  };

  const startLayoutSave = () => {
      setNewLayoutName(`Layout ${savedLayouts.length + 1}`);
      setIsSavingLayout(true);
  };
  
  const confirmLayoutSave = () => {
      if (newLayoutName.trim()) {
          onSaveLayout(newLayoutName.trim());
          setIsSavingLayout(false);
      }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sidebar Palette */}
      <div className="w-full lg:w-64 bg-slate-900 border-r border-slate-700 flex flex-col z-20 shadow-xl shrink-0 h-48 lg:h-auto">
        <div className="p-4 border-b border-slate-700 bg-slate-800">
           <h2 className="text-xl font-bold text-white">My Inventory</h2>
           <button onClick={onOpenStudio} className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-xs py-2 rounded text-white font-bold uppercase tracking-wider">
             + Create New Art
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {inventory.map(art => (
                 <div 
                    key={art.id} 
                    className="bg-slate-800 rounded p-2 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all group relative"
                    onPointerDown={(e) => handleDragStart(e, art.id)}
                 >
                     <div className="w-full bg-slate-700 mb-2 overflow-hidden flex items-center justify-center p-2 rounded">
                         <img src={art.imageSrc} className="max-w-full max-h-32 shadow-sm object-contain" style={{
                             border: `${Math.max(1, art.frame.frameWidthCm/2)}px solid ${art.frame.frameColor}`,
                             padding: `${Math.max(0, art.frame.matWidthCm/2)}px`,
                             backgroundColor: art.frame.matColor
                         }} />
                     </div>
                     <div className="flex justify-between items-start">
                        <div>
                             <p className="text-xs text-white font-medium truncate w-32">{art.name}</p>
                             <p className="text-[10px] text-slate-400">{art.realWidthCm}x{art.realHeightCm} cm</p>
                        </div>
                        <button 
                            className="text-slate-500 hover:text-blue-400"
                            onClick={(e) => { e.stopPropagation(); onEditArt(art.id); }}
                            title="Edit Artwork"
                        >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                     </div>
                 </div>
             ))}
             {inventory.length === 0 && <p className="text-slate-500 text-xs text-center p-4">Add art to get started.</p>}
        </div>
        
        {/* Layouts Section */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
             <div className="flex justify-between items-end mb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saved Layouts</h3>
                {!isSavingLayout && <button onClick={startLayoutSave} className="text-xs text-blue-400 hover:text-white">Save Current</button>}
             </div>
             
             {isSavingLayout && (
                 <div className="mb-2 p-2 bg-slate-900 rounded border border-blue-600">
                     <input 
                        type="text" 
                        value={newLayoutName} 
                        onChange={e => setNewLayoutName(e.target.value)} 
                        className="w-full text-xs bg-slate-800 text-white p-1 rounded mb-1"
                        placeholder="Layout Name"
                        autoFocus
                     />
                     <div className="flex gap-1">
                         <button onClick={confirmLayoutSave} className="flex-1 bg-blue-600 text-white text-[10px] py-1 rounded">Save</button>
                         <button onClick={() => setIsSavingLayout(false)} className="flex-1 bg-slate-700 text-white text-[10px] py-1 rounded">Cancel</button>
                     </div>
                 </div>
             )}

             <select 
                className="w-full bg-slate-900 border border-slate-600 rounded text-xs text-white p-1"
                onChange={(e) => {
                    const l = savedLayouts.find(s => s.name === e.target.value);
                    if (l) onLoadLayout(l.items);
                }}
                value=""
             >
                 <option value="" disabled>Load Layout...</option>
                 {savedLayouts.map(l => (
                     <option key={l.name} value={l.name}>{l.name} ({l.items.length} items)</option>
                 ))}
             </select>
        </div>
      </div>

      {/* Main Wall View */}
      <div className="flex-1 relative bg-black overflow-hidden touch-none" 
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}
           onPointerDown={handleWallClick}
      >
          {/* Controls Overlay */}
          <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 pointer-events-auto items-end max-w-[80%]">
             
             {/* Guide Toolbar */}
             <div className="flex gap-2 bg-slate-800/90 p-1.5 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
                 <button 
                    onClick={() => {
                        if (showGuides) {
                            // Turning off
                            setShowGuides(false);
                            setMode('MOVE_ART');
                        } else {
                            // Turning on
                            setShowGuides(true);
                        }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${showGuides ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Toggle Guides"
                 >
                     Guides: {showGuides ? 'ON' : 'OFF'}
                 </button>

                 {showGuides && (
                     <>
                        <div className="w-px bg-slate-600 mx-1"></div>
                        <button 
                            onClick={() => setMode('ADD_GUIDE')}
                            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${mode === 'ADD_GUIDE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                            title="Click wall to add lines"
                        >
                            + Add
                        </button>
                        <button 
                            onClick={() => setMode('REMOVE_GUIDE')}
                            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${mode === 'REMOVE_GUIDE' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                            title="Click lines to remove"
                        >
                            - Remove
                        </button>
                     </>
                 )}
             </div>

             {/* Snap Toolbar (Only visible when guides are on) */}
             {showGuides && (
                <div className="flex bg-slate-800/90 p-1.5 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
                    <span className="text-[10px] text-slate-500 uppercase font-bold self-center px-2">Snap</span>
                    <button 
                        onClick={() => setSnapMode('CENTER')}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded ${snapMode === 'CENTER' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                    >
                        Center
                    </button>
                    <button 
                        onClick={() => setSnapMode('EDGE')}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded ${snapMode === 'EDGE' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                    >
                        Edge
                    </button>
                </div>
             )}

             {/* General Tools */}
             <div className="flex gap-2 mt-2">
                 <button 
                    onClick={() => setShowWireframe(!showWireframe)}
                    className={`px-3 py-1.5 text-xs font-bold rounded shadow-lg border border-slate-700 transition-colors ${showWireframe ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                 >
                     Grid
                 </button>
                 
                 <button 
                    onClick={handleExportImage}
                    disabled={isExporting}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white flex items-center gap-1 shadow-lg hover:bg-emerald-500 disabled:opacity-50 border border-emerald-500"
                 >
                     {isExporting ? 'Rendering...' : 'Export Jpeg'}
                     {!isExporting && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>}
                 </button>
             </div>
          </div>
          
          {/* Mode Instructions */}
          {showGuides && mode === 'ADD_GUIDE' && (
              <div className="absolute top-4 left-4 z-30 bg-blue-600/90 text-white text-xs px-3 py-2 rounded-lg pointer-events-none border border-blue-400 shadow-xl">
                  Click on the wall to add a guide. <br/> <span className="opacity-70 text-[10px]">Shift+Click for horizontal.</span>
              </div>
          )}
           {showGuides && mode === 'REMOVE_GUIDE' && (
              <div className="absolute top-4 left-4 z-30 bg-red-600/90 text-white text-xs px-3 py-2 rounded-lg pointer-events-none border border-red-400 shadow-xl">
                  Click on any red line to remove it.
              </div>
          )}
          {mode === 'MOVE_ART' && showGuides && (
               <div className="absolute top-4 left-4 z-30 bg-slate-800/90 text-slate-300 text-xs px-3 py-2 rounded-lg pointer-events-none border border-slate-600 shadow-xl">
                  Drag art to snap to pink lines.
              </div>
          )}

          <div 
            ref={containerRef}
            className={`relative w-full h-full flex items-center justify-center bg-gray-900 ${mode === 'ADD_GUIDE' ? 'cursor-crosshair' : ''}`}
          >
             <img 
                ref={imgRef}
                src={wall.imageSrc} 
                alt="Wall" 
                className="w-full h-full object-contain pointer-events-none" 
             />
             
             {renderGuides()}

             {/* Wireframe Overlay */}
             {showWireframe && imgRect.width > 0 && (
                 <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-30">
                     <polygon 
                        points={wall.corners.map(p => {
                            const px = imgRect.left + (p.x/100)*imgRect.width;
                            const py = imgRect.top + (p.y/100)*imgRect.height;
                            return `${px},${py}`;
                        }).join(' ')}
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                     />
                 </svg>
             )}

             {/* Placed Artworks */}
             {layout.map(item => {
                 const art = inventory.find(a => a.id === item.artId);
                 if(!art) return null;
                 const style = getArtStyle(item);
                 
                 const totalW = art.realWidthCm + (art.frame.frameWidthCm + art.frame.matWidthCm)*2;
                 const scaleFactor = parseFloat(style.width as string) / totalW; 
                 
                 const fW = art.frame.frameWidthCm * scaleFactor;
                 const mW = art.frame.matWidthCm * scaleFactor;

                 const shadowOff = 0.5 * scaleFactor;
                 const shadowBlur = 1.5 * scaleFactor;

                 const isActive = activeArtId === item.id;

                 return (
                     <div 
                        key={item.id}
                        className="group"
                        style={style}
                        onPointerDown={(e) => handleDragStart(e, item.artId, item.id)}
                     >
                        <div 
                            className={`w-full h-full bg-white relative transition-shadow overflow-hidden box-border ${isActive ? 'ring-2 ring-blue-500 z-50' : ''}`}
                            style={{
                                border: `${fW}px solid ${art.frame.frameColor}`,
                                padding: `${mW}px`,
                                backgroundColor: art.frame.matColor,
                                boxShadow: `${shadowOff}px ${shadowOff}px ${shadowBlur}px rgba(0,0,0,0.6)`
                            }}
                        >
                             <img src={art.imageSrc} className="w-full h-full block" />
                        </div>
                        
                        {/* Selected Controls - Only show in move mode */}
                        {isActive && mode === 'MOVE_ART' && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
                                <button 
                                    onPointerDown={(e) => { e.stopPropagation(); onEditArt(art.id); }}
                                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full shadow-lg"
                                >
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button 
                                    onPointerDown={(e) => { e.stopPropagation(); onUpdateLayout(layout.filter(l => l.id !== item.id)); setActiveArtId(null); }}
                                    className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-full shadow-lg"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}
                     </div>
                 );
             })}
          </div>
      </div>
    </div>
  );
};
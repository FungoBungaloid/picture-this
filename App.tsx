
import React, { useState } from 'react';
import { ProjectState, AppView, WallData, ArtObject, PlacedArt } from './types';
import { WallCalibrator } from './components/WallCalibrator';
import { ArtStudio } from './components/ArtStudio';
import { GalleryView } from './components/GalleryView';

const STORAGE_KEY = 'art_arranger_project';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [project, setProject] = useState<ProjectState>({
    wall: null,
    inventory: [],
    layout: [],
    savedLayouts: [],
    palette: ['#f1f5f9', '#1e293b', '#ffffff', '#000000']
  });
  
  const [editingArtId, setEditingArtId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Persistence
  const saveToLocalStorage = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        alert('Saved! You can close the browser and come back later.');
    } catch (e) {
        alert('Your project is too large for browser storage. Please use "Export File" instead.');
    }
  };

  const loadFromLocalStorage = () => {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
          try {
              const parsed = JSON.parse(data);
              setProject({
                  ...parsed,
                  savedLayouts: parsed.savedLayouts || [],
                  palette: parsed.palette || ['#f1f5f9', '#1e293b']
              });
              if (parsed.wall) {
                  setView(AppView.GALLERY);
              } else {
                  setView(AppView.WALL_SETUP);
              }
          } catch (e) {
              alert('Sorry, the saved data seems corrupted.');
          }
      } else {
          alert('No previous session found.');
      }
  };

  const exportProjectFile = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "picture-this-project.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const importProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const json = JSON.parse(event.target?.result as string);
                  setProject({
                      ...json,
                      savedLayouts: json.savedLayouts || [],
                      palette: json.palette || ['#f1f5f9', '#1e293b']
                  });
                  if(json.wall) setView(AppView.GALLERY);
                  else setView(AppView.WALL_SETUP);
              } catch (err) {
                  alert("That file doesn't look like a valid Picture This project.");
              }
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  // State Handlers
  const handleWallSave = (wall: WallData) => {
    setProject(prev => ({ ...prev, wall }));
    setView(AppView.GALLERY);
  };

  const handleUpdatePalette = (newPalette: string[]) => {
      setProject(prev => ({ ...prev, palette: newPalette }));
  };

  const handleSaveArt = (art: ArtObject) => {
    setProject(prev => {
        const exists = prev.inventory.find(a => a.id === art.id);
        if (exists) {
            return {
                ...prev,
                inventory: prev.inventory.map(a => a.id === art.id ? art : a)
            };
        } else {
            return {
                ...prev,
                inventory: [...prev.inventory, art]
            };
        }
    });
    setEditingArtId(null);
    setView(AppView.GALLERY);
  };

  const handleUpdateLayout = (layout: PlacedArt[]) => {
      setProject(prev => ({ ...prev, layout }));
  };

  const handleSaveLayout = (name: string) => {
      setProject(prev => {
          // Remove existing if overwriting
          const filtered = prev.savedLayouts.filter(l => l.name !== name);
          return {
              ...prev,
              savedLayouts: [...filtered, { name, items: prev.layout }]
          };
      });
  };
  
  const handleEditArt = (artId: string) => {
      setEditingArtId(artId);
      setView(AppView.ART_STUDIO);
  };

  // Dashboard
  if (view === AppView.DASHBOARD) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
             <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500 rounded-full blur-3xl"></div>
             <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl w-full p-8 text-center space-y-10 z-10">
            <div>
                <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 mb-6 drop-shadow-lg">
                    Picture This
                </h1>
                <p className="text-slate-300 text-xl font-light max-w-2xl mx-auto">
                    The easiest way to see exactly how art will look on your wall before you hammer a single nail.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <button 
                    onClick={() => {
                        setProject({wall: null, inventory: [], layout: [], savedLayouts: [], palette: ['#f1f5f9', '#1e293b']});
                        setView(AppView.WALL_SETUP);
                    }}
                    className="group bg-slate-800/80 backdrop-blur border border-slate-700 p-8 rounded-3xl hover:bg-slate-700/80 transition-all shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 flex flex-col items-center"
                >
                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 text-blue-300 group-hover:scale-110 transition-transform">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Start Fresh</h3>
                    <p className="text-sm text-slate-400">Begin a new room project</p>
                </button>

                <button 
                    onClick={loadFromLocalStorage}
                    className="group bg-slate-800/80 backdrop-blur border border-slate-700 p-8 rounded-3xl hover:bg-slate-700/80 transition-all shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1 flex flex-col items-center"
                >
                     <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 text-emerald-300 group-hover:scale-110 transition-transform">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Continue</h3>
                    <p className="text-sm text-slate-400">Resume your last session</p>
                </button>
                
                <label className="group bg-slate-800/80 backdrop-blur border border-slate-700 p-8 rounded-3xl hover:bg-slate-700/80 transition-all shadow-xl hover:shadow-purple-500/20 hover:-translate-y-1 flex flex-col items-center cursor-pointer">
                     <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mb-6 text-purple-300 group-hover:scale-110 transition-transform">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Load File</h3>
                    <p className="text-sm text-slate-400">Open a saved .json file</p>
                    <input type="file" className="hidden" accept=".json" onChange={importProjectFile} />
                </label>
            </div>
            
            <button onClick={() => setShowHelp(!showHelp)} className="text-slate-500 hover:text-white underline text-sm">
                How does saving works?
            </button>
            
            {showHelp && (
                <div className="bg-slate-800 p-4 rounded-lg text-left text-sm text-slate-300 max-w-lg mx-auto border border-slate-600">
                    <p className="mb-2"><strong>Quick Save:</strong> Saves your work to this specific browser. Good for short term.</p>
                    <p className="mb-2"><strong>Export File:</strong> Downloads a file to your computer. This is the safest way to keep your work forever, or to send it to another computer.</p>
                    <p><strong>Load File:</strong> Opens a file you previously downloaded.</p>
                </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 font-sans">
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-40 shadow-md">
         <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView(AppView.DASHBOARD)}>
             <div className="w-8 h-8 bg-gradient-to-tr from-blue-400 to-purple-400 rounded-lg group-hover:rotate-12 transition-transform"></div>
             <span className="font-bold text-xl text-white tracking-tight">Picture This</span>
         </div>
         <div className="hidden md:flex gap-8 text-sm font-bold tracking-wide">
             <span className={`flex items-center gap-2 ${view === AppView.WALL_SETUP ? "text-blue-400" : "text-slate-600"}`}>
                <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs">1</span>
                Room
             </span>
             <div className="w-8 h-px bg-slate-800 self-center"></div>
             <span className={`flex items-center gap-2 ${view === AppView.ART_STUDIO ? "text-blue-400" : "text-slate-600"}`}>
                <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs">2</span>
                Art
             </span>
             <div className="w-8 h-px bg-slate-800 self-center"></div>
             <span className={`flex items-center gap-2 ${view === AppView.GALLERY ? "text-blue-400" : "text-slate-600"}`}>
                <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs">3</span>
                Gallery
             </span>
         </div>
         <div className="flex items-center gap-3">
             <button onClick={saveToLocalStorage} className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-700 transition-colors">
                 Save Session
             </button>
             <button onClick={exportProjectFile} className="text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg border border-slate-600 transition-colors" title="Download project file">
                 Download File
             </button>
         </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === AppView.WALL_SETUP && (
            <div className="h-full p-4 md:p-8">
                 <WallCalibrator 
                    onSave={handleWallSave} 
                    onCancel={() => setView(AppView.DASHBOARD)} 
                    palette={project.palette}
                    onUpdatePalette={handleUpdatePalette}
                 />
            </div>
        )}

        {view === AppView.ART_STUDIO && (
             <div className="h-full p-4 md:p-8">
                <ArtStudio 
                    onSave={handleSaveArt} 
                    onCancel={() => { setEditingArtId(null); setView(AppView.GALLERY); }}
                    existingArt={editingArtId ? project.inventory.find(a => a.id === editingArtId) : undefined}
                    palette={project.palette}
                    onUpdatePalette={handleUpdatePalette}
                />
             </div>
        )}

        {view === AppView.GALLERY && project.wall && (
            <GalleryView 
                wall={project.wall}
                inventory={project.inventory}
                layout={project.layout}
                savedLayouts={project.savedLayouts}
                onUpdateLayout={handleUpdateLayout}
                onSaveLayout={handleSaveLayout}
                onLoadLayout={(l) => setProject(prev => ({...prev, layout: l}))}
                onBack={() => setView(AppView.WALL_SETUP)}
                onOpenStudio={() => { setEditingArtId(null); setView(AppView.ART_STUDIO); }}
                onEditArt={handleEditArt}
            />
        )}
      </main>
    </div>
  );
};

export default App;

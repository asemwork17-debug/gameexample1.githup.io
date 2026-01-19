import React, { useEffect, useRef } from 'react';
import { GameStatus, InputState } from '../types';
import { LEVELS } from '../services/LevelManager';

interface UIOverlayProps {
    status: GameStatus;
    levelId: number;
    maxReachedLevel: number;
    deathCount: number;
    onStart: () => void;
    onSelectLevel: (id: number) => void;
    onBack: () => void;
    onRestart: () => void;
    onToggleMute: () => void;
    muted: boolean;
    inputDispatch: (action: { type: string, value: boolean }) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
    status, levelId, maxReachedLevel, deathCount, onStart, onSelectLevel, onBack, onRestart, onToggleMute, muted, inputDispatch
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto scroll to current level in map view
    useEffect(() => {
        if (status === GameStatus.LEVEL_SELECT && scrollRef.current) {
            // Find current level node position relative to scroll container
            // Just rough scroll to bottom for now as levels progress upwards visually or similar
            // Let's scroll to the max reached level
            const index = maxReachedLevel - 1;
            const itemHeight = 100; // approximate distance
            scrollRef.current.scrollTop = index * itemHeight - 200;
        }
    }, [status, maxReachedLevel]);
    
    const handleTouchStart = (key: keyof InputState) => (e: React.TouchEvent) => {
        e.preventDefault();
        inputDispatch({ type: key, value: true });
    };
    
    const handleTouchEnd = (key: keyof InputState) => (e: React.TouchEvent) => {
        e.preventDefault();
        inputDispatch({ type: key, value: false });
    };

    const renderMapLine = () => {
        // SVG path connecting levels
        // 38 levels.
        const gap = 100;
        const width = 300; // coordinate space width
        let path = `M ${width/2} 50 `;
        
        for (let i = 1; i < LEVELS.length; i++) {
            const x = (width/2) + Math.sin(i * 0.8) * 100;
            const y = 50 + i * gap;
            path += `L ${x} ${y} `;
        }

        return (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ height: LEVELS.length * 100 + 200 }}>
                 <path d={path} stroke="black" strokeWidth="8" fill="none" strokeDasharray="15, 15" opacity="0.5" />
            </svg>
        );
    };

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between font-game text-white overflow-hidden">
            <div className="scanlines z-30"></div>
            
            {/* --- LOADING SCREEN --- */}
            {status === GameStatus.LOADING && (
                <div className="absolute inset-0 bg-[#D80000] z-[100] flex flex-col items-center justify-center pointer-events-auto">
                    {/* Devil Eyes */}
                    <div className="flex gap-8 mb-20">
                        {/* Left Eye */}
                        <div className="w-24 h-24 bg-orange-500 rounded-full relative overflow-hidden transform -rotate-12 shadow-[0_0_20px_rgba(255,165,0,0.6)]">
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-[#D80000] transform translate-y-[-10%] rotate-12 scale-110"></div>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-12 bg-black rounded-full"></div>
                        </div>
                        {/* Right Eye */}
                        <div className="w-24 h-24 bg-orange-500 rounded-full relative overflow-hidden transform rotate-12 shadow-[0_0_20px_rgba(255,165,0,0.6)]">
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-[#D80000] transform translate-y-[-10%] -rotate-12 scale-110"></div>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-12 bg-black rounded-full"></div>
                        </div>
                    </div>

                    {/* Loading Text/Spinner */}
                    <div className="animate-pulse text-yellow-400 text-2xl font-black tracking-[0.5em]">
                        LOADING...
                    </div>
                    <div className="w-48 h-2 bg-red-900 mt-4 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 animate-[width_3s_ease-in-out_forwards]" style={{width: '0%'}}></div>
                    </div>
                </div>
            )}

            {/* --- LEVEL SELECT MAP --- */}
            {status === GameStatus.LEVEL_SELECT && (
                <div className="absolute inset-0 flex flex-col pointer-events-auto z-50 bg-[#FACC15]">
                    {/* Header */}
                    <div className="bg-[#D80000] p-6 shadow-xl z-20 flex flex-col items-center justify-center rounded-b-3xl relative">
                        <h1 className="text-5xl font-black text-white drop-shadow-[4px_4px_0_rgba(0,0,0,0.3)] tracking-tighter">
                            TROLL LEVEL
                        </h1>
                        <p className="text-orange-200 font-bold text-sm tracking-widest mt-1 opacity-80">
                            DESIGNER: AI STUDIO
                        </p>
                        <div className="absolute -bottom-6 w-full flex justify-center">
                             <div className="w-12 h-12 bg-[#D80000] rotate-45 transform"></div>
                        </div>
                    </div>

                    {/* Map Area */}
                    <div ref={scrollRef} className="flex-1 relative overflow-y-auto overflow-x-hidden no-scrollbar pb-32 pt-12">
                         <div className="relative w-full max-w-md mx-auto" style={{ height: LEVELS.length * 100 + 100 }}>
                             {renderMapLine()}
                             
                             {LEVELS.map((level, index) => {
                                 const isLast = index === LEVELS.length - 1;
                                 const xOffset = Math.sin(index * 0.8) * 100; // Winding path
                                 const isLocked = level.id > maxReachedLevel;
                                 
                                 return (
                                     <div 
                                        key={level.id}
                                        className="absolute transform -translate-x-1/2 left-1/2 flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                                        style={{ top: 50 + index * 100, marginLeft: xOffset }}
                                     >
                                         <button
                                            onClick={() => onSelectLevel(level.id)}
                                            disabled={isLocked}
                                            className={`
                                                relative flex items-center justify-center font-black shadow-[0_4px_0_rgba(0,0,0,0.3)]
                                                ${isLast ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl'}
                                                ${isLocked ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-red-600 text-white cursor-pointer'}
                                                border-4 border-black rounded-2xl
                                            `}
                                         >
                                             {isLocked ? '🔒' : level.id}
                                             
                                             {/* Devil Horns for Last Level */}
                                             {isLast && (
                                                 <>
                                                     <div className="absolute -top-6 -left-2 text-4xl text-red-700 transform -rotate-45">😈</div>
                                                 </>
                                             )}
                                         </button>
                                     </div>
                                 );
                             })}
                         </div>
                    </div>
                </div>
            )}

            {/* Top HUD - Only show when playing */}
            {status === GameStatus.PLAYING && (
                <div className="flex justify-between items-start p-6 pointer-events-auto z-20">
                    <div className="flex flex-col gap-1">
                        <div className="text-4xl font-black text-yellow-400 drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
                            LEVEL {levelId}
                        </div>
                        <div className="text-xl font-bold text-red-400 drop-shadow-md">
                            DEATHS: {deathCount}
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={onToggleMute}
                            className="bg-gray-800 border-2 border-gray-600 text-white w-12 h-12 rounded-xl hover:bg-gray-700 transition flex items-center justify-center shadow-lg active:translate-y-1"
                        >
                            {muted ? "🔇" : "🔊"}
                        </button>
                        <button 
                            onClick={onRestart}
                            className="bg-red-600 border-2 border-red-800 text-white w-12 h-12 rounded-xl hover:bg-red-500 transition font-bold flex items-center justify-center shadow-lg active:translate-y-1 text-xl"
                        >
                            ↺
                        </button>
                        <button 
                            onClick={onBack}
                            className="bg-blue-600 border-2 border-blue-800 text-white w-12 h-12 rounded-xl hover:bg-blue-500 transition font-bold flex items-center justify-center shadow-lg active:translate-y-1 text-xl"
                        >
                            ☰
                        </button>
                    </div>
                </div>
            )}
            
            {/* Level Transition Screen */}
            {status === GameStatus.LEVEL_TRANSITION && (
                 <div className="absolute inset-0 bg-black z-40 flex flex-col items-center justify-center pointer-events-auto animate-fade-in">
                    <h2 className="text-7xl font-black text-green-400 mb-4 animate-bounce drop-shadow-[4px_4px_0_#14532d]">
                        NICE!
                    </h2>
                    <p className="text-white/60 text-xl font-bold tracking-widest">NEXT LEVEL LOADING...</p>
                 </div>
            )}
            
            {/* Game Over Screen (Brief Flash) */}
            {status === GameStatus.GAME_OVER && (
                <div className="absolute inset-0 bg-red-900/50 z-40 flex items-center justify-center pointer-events-none">
                </div>
            )}

             {/* Touch Controls (Hidden in Menus) */}
            {status === GameStatus.PLAYING && (
                <div className="p-8 flex justify-between items-end pointer-events-auto pb-12 md:hidden z-20">
                    <div className="flex gap-6">
                        <button 
                            className="w-20 h-20 bg-gray-800/80 rounded-2xl active:bg-gray-700 active:scale-95 border-b-4 border-gray-950 flex items-center justify-center text-white text-3xl select-none shadow-lg backdrop-blur-sm"
                            onTouchStart={handleTouchStart('left')}
                            onTouchEnd={handleTouchEnd('left')}
                        >
                            ←
                        </button>
                        <button 
                            className="w-20 h-20 bg-gray-800/80 rounded-2xl active:bg-gray-700 active:scale-95 border-b-4 border-gray-950 flex items-center justify-center text-white text-3xl select-none shadow-lg backdrop-blur-sm"
                            onTouchStart={handleTouchStart('right')}
                            onTouchEnd={handleTouchEnd('right')}
                        >
                            →
                        </button>
                    </div>
                    
                    <button 
                        className="w-24 h-24 bg-red-600/90 rounded-full active:bg-red-500 active:scale-95 border-b-8 border-red-900 flex items-center justify-center text-white text-2xl font-bold select-none shadow-xl backdrop-blur-sm"
                        onTouchStart={handleTouchStart('jump')}
                        onTouchEnd={handleTouchEnd('jump')}
                    >
                        JUMP
                    </button>
                </div>
            )}
        </div>
    );
};

export default UIOverlay;
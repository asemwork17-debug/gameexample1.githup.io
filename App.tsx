import React, { useState, useEffect, useCallback } from 'react';
import GameEngine from './components/GameEngine';
import UIOverlay from './components/UIOverlay';
import { GameStatus, InputState } from './types';
import { LEVELS } from './services/LevelManager';
import { audioManager } from './services/AudioService';

const App: React.FC = () => {
    // Start with LOADING screen
    const [status, setStatus] = useState<GameStatus>(GameStatus.LOADING);
    const [levelId, setLevelId] = useState<number>(1);
    const [maxReachedLevel, setMaxReachedLevel] = useState<number>(1);
    const [deathCount, setDeathCount] = useState<number>(0);
    const [muted, setMuted] = useState<boolean>(false);
    const [input, setInput] = useState<InputState>({
        left: false, right: false, jump: false, dash: false
    });
    const [settings, setSettings] = useState({ reducedMotion: false });

    // Handle Loading Timer
    useEffect(() => {
        if (status === GameStatus.LOADING) {
            const timer = setTimeout(() => {
                setStatus(GameStatus.LEVEL_SELECT);
            }, 3000); // 3 seconds loading screen
            return () => clearTimeout(timer);
        }
    }, [status]);

    // Load progress from localStorage
    useEffect(() => {
        const savedLevel = localStorage.getItem('troll_level_id');
        const savedMax = localStorage.getItem('troll_max_level');
        const savedDeaths = localStorage.getItem('troll_deaths');
        
        if (savedMax) {
            setMaxReachedLevel(parseInt(savedMax));
        } else if (savedLevel) {
            setMaxReachedLevel(parseInt(savedLevel));
        }
        
        if (savedMax) setLevelId(parseInt(savedMax));
        
        if (savedDeaths) setDeathCount(parseInt(savedDeaths));
    }, []);

    // Save progress
    useEffect(() => {
        localStorage.setItem('troll_level_id', levelId.toString());
        localStorage.setItem('troll_max_level', maxReachedLevel.toString());
        localStorage.setItem('troll_deaths', deathCount.toString());
    }, [levelId, maxReachedLevel, deathCount]);

    // Keyboard Input Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA': setInput(prev => ({...prev, left: true})); break;
                case 'ArrowRight':
                case 'KeyD': setInput(prev => ({...prev, right: true})); break;
                case 'Space':
                case 'ArrowUp':
                case 'KeyW': setInput(prev => ({...prev, jump: true})); break;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
             switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA': setInput(prev => ({...prev, left: false})); break;
                case 'ArrowRight':
                case 'KeyD': setInput(prev => ({...prev, right: false})); break;
                case 'Space':
                case 'ArrowUp':
                case 'KeyW': setInput(prev => ({...prev, jump: false})); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const inputDispatch = (action: { type: string, value: boolean }) => {
        setInput(prev => ({ ...prev, [action.type]: action.value }));
    };

    const handleLevelComplete = useCallback(() => {
        setStatus(GameStatus.LEVEL_TRANSITION);
        
        setTimeout(() => {
            const nextLevel = levelId + 1;
            
            // Unlock next level logic
            if (nextLevel > maxReachedLevel) {
                setMaxReachedLevel(nextLevel);
            }

            if (nextLevel <= LEVELS.length) {
                setLevelId(nextLevel);
                setStatus(GameStatus.PLAYING);
            } else {
                // Game Finished - Loop back to menu but keep progress
                setStatus(GameStatus.LEVEL_SELECT);
                alert("You beat all current levels! Check back later for more pain.");
            }
        }, 1500);
    }, [levelId, maxReachedLevel]);

    const handlePlayerDeath = useCallback(() => {
        setDeathCount(prev => prev + 1);
    }, []);

    const toggleMute = () => {
        const newMuted = !muted;
        setMuted(newMuted);
        audioManager.setMuted(newMuted);
    };

    const handleMenuPlay = () => {
        // Not used directly in new flow, but kept for overlay prop compatibility
        setStatus(GameStatus.LEVEL_SELECT);
    };

    const handleSelectLevel = (id: number) => {
        if (id <= maxReachedLevel) {
            setLevelId(id);
            audioManager.setMuted(muted); // Ensure audio context resumes
            setStatus(GameStatus.PLAYING);
        }
    };

    const handleBackToMenu = () => {
        setStatus(GameStatus.LEVEL_SELECT);
    };
    
    const restartLevel = () => {
        const current = status;
        setStatus(GameStatus.GAME_OVER); 
        setTimeout(() => setStatus(GameStatus.PLAYING), 50);
        setDeathCount(prev => prev + 1);
    };

    return (
        <div className="relative w-full h-screen bg-[#FACC15] overflow-hidden select-none">
            <GameEngine 
                levelId={levelId}
                status={status}
                onLevelComplete={handleLevelComplete}
                onPlayerDeath={handlePlayerDeath}
                input={input}
                settings={settings}
            />
            
            <UIOverlay 
                status={status}
                levelId={levelId}
                maxReachedLevel={maxReachedLevel}
                deathCount={deathCount}
                onStart={handleMenuPlay}
                onSelectLevel={handleSelectLevel}
                onBack={handleBackToMenu}
                onRestart={restartLevel}
                onToggleMute={toggleMute}
                muted={muted}
                inputDispatch={inputDispatch}
            />
        </div>
    );
};

export default App;
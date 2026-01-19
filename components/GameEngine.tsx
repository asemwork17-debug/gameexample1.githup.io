import React, { useRef, useEffect } from 'react';
import { Entity, EntityType, GameStatus, InputState, PlayerState, LevelData, Vector2, Rect } from '../types';
import { LEVELS } from '../services/LevelManager';
import { GRAVITY, ACCELERATION, COLORS, JUMP_FORCE, MOVE_SPEED, FRICTION, TILE_SIZE, TERMINAL_VELOCITY } from '../constants';
import { audioManager } from '../services/AudioService';

interface GameEngineProps {
    levelId: number;
    status: GameStatus;
    onLevelComplete: () => void;
    onPlayerDeath: () => void;
    input: InputState;
    setDebugInfo?: (info: string) => void;
    settings: { reducedMotion: boolean };
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

const GameEngine: React.FC<GameEngineProps> = ({ 
    levelId, status, onLevelComplete, onPlayerDeath, input, settings 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const previousTimeRef = useRef<number>(0);
    const accumulatorRef = useRef<number>(0);
    const simulationTimeRef = useRef<number>(0);
    
    const inputRef = useRef<InputState>(input);
    const settingsRef = useRef(settings);
    const propsRef = useRef({ onLevelComplete, onPlayerDeath });

    useEffect(() => { inputRef.current = input; }, [input]);
    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { propsRef.current = { onLevelComplete, onPlayerDeath }; }, [onLevelComplete, onPlayerDeath]);
    
    const PLAYER_W = 24;
    const PLAYER_H = 28;

    const playerRef = useRef<PlayerState>({
        x: 0, y: 0, w: PLAYER_W, h: PLAYER_H,
        vx: 0, vy: 0,
        grounded: false,
        facingRight: true,
        isDead: false,
        hasKey: false,
        coyoteTime: 0,
        jumpBuffer: 0,
        scaleX: 1, scaleY: 1, rotation: 0, blinkTimer: 0,
        deathTimer: 0
    });
    
    const levelRef = useRef<LevelData | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const projectilesRef = useRef<Entity[]>([]); 
    const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
    const shakeRef = useRef<number>(0);
    const timerRef = useRef<number>(0);

    useEffect(() => {
        const levelData = LEVELS.find(l => l.id === levelId);
        if (levelData) {
            levelRef.current = JSON.parse(JSON.stringify(levelData));
            if (playerRef.current) {
                const spawn = levelData.spawn;
                playerRef.current.x = spawn.x + (TILE_SIZE - PLAYER_W)/2; 
                playerRef.current.y = spawn.y + (TILE_SIZE - PLAYER_H);
                playerRef.current.w = PLAYER_W; 
                playerRef.current.h = PLAYER_H; 
                playerRef.current.vx = 0;
                playerRef.current.vy = 0;
                playerRef.current.isDead = false;
                playerRef.current.hasKey = false;
                playerRef.current.scaleX = 1;
                playerRef.current.scaleY = 1;
                playerRef.current.grounded = false;
                playerRef.current.deathTimer = 0;
            }
            particlesRef.current = [];
            projectilesRef.current = [];
            accumulatorRef.current = 0;
            previousTimeRef.current = performance.now();
            simulationTimeRef.current = 0;
            timerRef.current = levelData.timeLimit || 0; 
        }
    }, [levelId, status]);

    const checkCollision = (r1: Rect, r2: Rect) => {
        return (
            r1.x < r2.x + r2.w &&
            r1.x + r1.w > r2.x &&
            r1.y < r2.y + r2.h &&
            r1.y + r1.h > r2.y
        );
    };

    const isSolid = (ent: Entity) => {
        if (!ent.active) return false;
        if (ent.type === EntityType.TOGGLE_WALL) return ent.visible;
        if (ent.type === EntityType.FALLING_BLOCK) return true;
        if (ent.type === EntityType.TIMED_DOOR) return ent.visible;
        if (ent.type === EntityType.DOOM_WALL) return false;
        if (ent.type === EntityType.MONSTER_CHASER) return false; 
        if ([EntityType.MONSTER_GUARD, EntityType.MONSTER_COLLECTOR, EntityType.MONSTER_BUILDER].includes(ent.type)) return false; 
        if (ent.type === EntityType.PENDULUM) return false; 
        return [
            EntityType.WALL, EntityType.TROLL_BLOCK, EntityType.MOVING_PLATFORM, 
            EntityType.CRUSHER, EntityType.GLASS_WALL, EntityType.FRAGILE_BLOCK,
            EntityType.SHOOTER
        ].includes(ent.type);
    };

    const spawnParticles = (x: number, y: number, color: string, count: number, speed = 400) => {
        for (let i = 0; i < count; i++) {
            particlesRef.current.push({
                x, y,
                vx: (Math.random() - 0.5) * speed,
                vy: (Math.random() - 0.5) * speed,
                life: 1.0,
                maxLife: 1.0,
                color,
                size: Math.random() * 6 + 2
            });
        }
    };
    
    const spawnProjectile = (source: Entity, homing: boolean) => {
        const speed = homing ? 200 : 400;
        let vx = 0, vy = 0;
        const size = 10;
        let x = source.x + source.w/2 - size/2;
        let y = source.y + source.h/2 - size/2;
        if (source.direction === 'right') { vx = speed; x = source.x + source.w; }
        else if (source.direction === 'left') { vx = -speed; x = source.x - size; }
        else if (source.direction === 'up') { vy = -speed; y = source.y - size; }
        else if (source.direction === 'down') { vy = speed; y = source.y + source.h; }
        else if (homing) {
            const angle = Math.random() * Math.PI * 2;
            vx = Math.cos(angle) * 100;
            vy = Math.sin(angle) * 100;
        }
        projectilesRef.current.push({
            id: `proj_${Date.now()}_${Math.random()}`,
            type: EntityType.PROJECTILE,
            x, y, w: size, h: size,
            vx, vy,
            visible: true, active: true,
            target: homing ? 'PLAYER' : undefined,
            color: homing ? COLORS.PROJECTILE_HOMING : COLORS.PROJECTILE
        });
    };

    const lerp = (start: number, end: number, t: number) => {
        return start * (1 - t) + end * t;
    };

    const updatePhysics = (dt: number) => {
        if (!levelRef.current || !playerRef.current) return;
        const player = playerRef.current;
        const level = levelRef.current;
        
        if (player.deathTimer > 0) {
            player.deathTimer -= dt;
            if (player.deathTimer <= 0) {
                player.isDead = true;
                audioManager.playDie();
                if (!settingsRef.current.reducedMotion) shakeRef.current = 15;
                spawnParticles(player.x + player.w/2, player.y + player.h/2, COLORS.PARTICLE_BLOOD, 30, 600);
                setTimeout(() => { propsRef.current.onPlayerDeath(); }, 800);
            }
            return;
        }

        if (player.isDead) return;
        const currentInput = inputRef.current;
        simulationTimeRef.current += dt;

        if (level.timeLimit !== undefined) {
             timerRef.current -= dt;
             if (timerRef.current <= 0) { timerRef.current = 0; killPlayer(); }
        }

        // --- LEVEL ENTITIES LOGIC ---
        for (let i = 0; i < level.entities.length; i++) {
            const ent = level.entities[i];
            if (!ent.active) continue;

            if (ent.acceleration && ent.speed !== undefined) ent.speed += ent.acceleration * dt;

            // --- RESTORED LOGIC FOR CLASSIC OBSTACLES ---
            
            // ROAMER (Red Box)
            if (ent.type === EntityType.ROAMER) {
                const speed = ent.speed || 100;
                const range = ent.range || 100;
                const startX = ent.initialX || ent.x;
                ent.x = startX + Math.sin(simulationTimeRef.current * (speed / 50)) * (range / 2);
                if (checkCollision(player, ent)) killPlayer();
            }

            // CRUSHER (Moving Wall)
            if (ent.type === EntityType.CRUSHER) {
                const speed = ent.speed || 200;
                const range = ent.range || 200;
                const startY = ent.initialY || ent.y;
                ent.y = startY + Math.abs(Math.sin(simulationTimeRef.current * (speed / 150))) * range;
                if (checkCollision(player, ent) && player.y > ent.y) killPlayer();
            }
            
            // WIN_FAKE (Running Trophy)
            if (ent.type === EntityType.WIN_FAKE) {
                const dist = Math.abs(player.x - ent.x);
                if (dist < 200) {
                     ent.x += (ent.speed || 200) * dt * (player.x < ent.x ? 1 : -1);
                }
            }

            // PENDULUM (Swinging Blade)
            if (ent.type === EntityType.PENDULUM) {
                const speed = ent.speed || 3;
                ent.angle = Math.sin(simulationTimeRef.current * speed) * 1.5; 
                
                // Blade collision
                const len = ent.h;
                const bladeX = ent.x + Math.sin(ent.angle) * len;
                const bladeY = ent.y + Math.cos(ent.angle) * len;
                const dx = (player.x + player.w/2) - bladeX;
                const dy = (player.y + player.h/2) - bladeY;
                if (Math.sqrt(dx*dx + dy*dy) < 25) killPlayer();
            }

            // --- MONSTER: CHASER (Ghost) ---
            if (ent.type === EntityType.MONSTER_CHASER) {
                const dx = (player.x + player.w/2) - (ent.x + ent.w/2);
                const dy = (player.y + player.h/2) - (ent.y + ent.h/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                const range = ent.detectRange || 300;
                
                if (dist < range) {
                    const speed = ent.speed || 80;
                    ent.vx = (dx / dist) * speed;
                    ent.vy = (dy / dist) * speed;
                    ent.x += ent.vx * dt;
                    ent.y += ent.vy * dt;
                    if (checkCollision(player, ent)) killPlayer();
                }
            }

            // --- MONSTER: GUARD (Patrols) ---
            if (ent.type === EntityType.MONSTER_GUARD) {
                 if (!ent.state) ent.state = 'PATROL';
                 const speed = ent.speed || 100;
                 if (ent.state === 'PATROL' && ent.initialX && ent.range) {
                     ent.x = ent.initialX + Math.sin(simulationTimeRef.current * (speed/100)) * (ent.range/2);
                     const facingLeft = Math.cos(simulationTimeRef.current * (speed/100)) < 0;
                     const dx = player.x - ent.x;
                     const dy = player.y - ent.y;
                     if (Math.abs(dy) < 50 && Math.abs(dx) < 200) {
                         if ((facingLeft && dx < 0) || (!facingLeft && dx > 0)) {
                             ent.state = 'ATTACK';
                         }
                     }
                 } else if (ent.state === 'ATTACK') {
                     const dx = player.x - ent.x;
                     ent.x += Math.sign(dx) * (speed * 3) * dt;
                 }
                 if (checkCollision(player, ent)) killPlayer();
            }

            // --- MONSTER: COLLECTOR (Steals Key) ---
            if (ent.type === EntityType.MONSTER_COLLECTOR) {
                if (!ent.state) ent.state = 'CHASE'; 
                const speed = (ent.speed || 150) * (ent.state === 'FLEE' ? 1.5 : 1);
                const key = level.entities.find(e => e.type === EntityType.KEY && e.active);
                
                if (ent.state === 'CHASE' && key) {
                    const dx = key.x - ent.x;
                    const dy = key.y - ent.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 5) { ent.x += (dx/dist) * speed * dt; ent.y += (dy/dist) * speed * dt; } 
                    if (checkCollision(ent, key)) {
                        key.active = false; key.visible = false; ent.hasItem = true; ent.state = 'FLEE'; ent.color = '#FFF'; audioManager.playCrumble();
                    }
                } else if (ent.state === 'FLEE') {
                    const dx = ent.x - player.x; const dy = ent.y - player.y; const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) { ent.x += (dx/dist) * speed * dt; ent.y += (dy/dist) * speed * dt; }
                }
                if (checkCollision(player, ent)) killPlayer();
            }

            // --- MONSTER: BUILDER ---
            if (ent.type === EntityType.MONSTER_BUILDER) {
                ent.timer = (ent.timer || 0) + dt;
                const buildInterval = ent.toggleTime || 2.0;
                if (ent.timer > buildInterval) {
                    ent.timer = 0;
                    const wallX = ent.x; const wallY = ent.y + ent.h; 
                    level.entities.push({
                        id: `built_${Date.now()}`, type: EntityType.FRAGILE_BLOCK, x: wallX, y: wallY, w: TILE_SIZE, h: TILE_SIZE, visible: true, active: true, timer: 0, color: '#A8A29E'
                    });
                }
            }

            // --- Generic Updates ---
            if (ent.type === EntityType.RHYTHM_SPIKE) {
                const cycle = ent.toggleTime || 2.0; const offset = ent.initialDelay || 0; const time = simulationTimeRef.current + offset; const phase = time % (cycle * 2); const isActive = phase < cycle;
                ent.triggered = isActive; if (isActive && checkCollision(player, ent)) killPlayer();
            }
            if (ent.type === EntityType.DOOM_WALL) {
                const speed = ent.speed || 100; ent.x += speed * dt; const dist = Math.abs(ent.x - player.x); if (dist < 300) shakeRef.current = Math.max(shakeRef.current, (300 - dist) / 50); if (checkCollision(player, ent)) killPlayer();
            }
            if (ent.type === EntityType.FALLING_SPIKE) { if (ent.triggered) { ent.vy = (ent.vy || 0) + GRAVITY * dt; ent.y += ent.vy * dt; } else if (Math.abs((ent.x + ent.w/2) - (player.x + player.w/2)) < 30 && player.y > ent.y) { ent.triggered = true; ent.vy = 200; shakeRef.current = 2; } if (checkCollision(player, ent)) killPlayer(); }
            if (ent.type === EntityType.TROLL_BLOCK && ent.triggered) { ent.timer = (ent.timer || 0) + dt; if (ent.timer > 0.15) { ent.active = false; ent.visible = false; audioManager.playCrumble(); spawnParticles(ent.x+ent.w/2, ent.y+ent.h/2, COLORS.FAKE_FLOOR, 8); } }
            if (ent.type === EntityType.BUTTON) { const hitBox = { x: ent.x + 4, y: ent.y + ent.h - 10, w: ent.w - 8, h: 10 }; const playerFoot = { x: player.x, y: player.y + player.h - 4, w: player.w, h: 4 }; const isPressed = checkCollision(hitBox, playerFoot) && player.grounded; if (isPressed && !ent.triggered) { ent.triggered = true; audioManager.playJump(); if (ent.linkId) { const target = level.entities.find(e => e.id === ent.linkId); if (target) { if (target.type === EntityType.TIMED_DOOR) { target.visible = false; target.timer = 3.0; } else if (target.type === EntityType.TOGGLE_WALL) { target.visible = !target.visible; } else if (target.type === EntityType.FALLING_BLOCK) { target.state = 'ATTACK'; } } } } else if (!isPressed && ent.triggered && ent.triggerMode !== 'ONCE') { ent.triggered = false; } }
            if (ent.type === EntityType.TIMED_DOOR && !ent.visible && ent.timer) { ent.timer -= dt; if (ent.timer <= 0) { ent.visible = true; if (checkCollision(player, ent)) killPlayer(); } }
            if (ent.type === EntityType.SPRING) { if (player.vy > 0 && player.x + player.w > ent.x + 4 && player.x < ent.x + ent.w - 4 && player.y + player.h > ent.y + 4 && player.y + player.h < ent.y + ent.h) { player.vy = JUMP_FORCE * 1.5; player.grounded = false; ent.triggered = true; setTimeout(() => { ent.triggered = false; }, 200); audioManager.playJump(); spawnParticles(ent.x + ent.w/2, ent.y, COLORS.SPRING_TOP, 5); } }
            if (ent.type === EntityType.SHOOTER || ent.type === EntityType.HOMING_LAUNCHER) { ent.timer = (ent.timer || 0) + dt; const cooldown = ent.speed || 2.0; if (ent.timer > cooldown) { ent.timer = 0; spawnProjectile(ent, ent.type === EntityType.HOMING_LAUNCHER); } }
            if (ent.type === EntityType.ELECTRIC_FIELD || ent.type === EntityType.LASER_BEAM) { const cycle = ent.toggleTime || 0; let active = true; if (cycle > 0) { const phase = simulationTimeRef.current % (cycle * 2); active = phase < cycle; } ent.triggered = active; if (active && checkCollision(player, ent)) killPlayer(); }
            
            // --- UPDATED FALLING BLOCK (Thwomp) ---
            if (ent.type === EntityType.FALLING_BLOCK) {
                if (!ent.state) ent.state = 'IDLE';
                
                // Detection
                if (ent.state === 'IDLE' && Math.abs((player.x + player.w/2) - (ent.x + ent.w/2)) < ent.w/2 + 10 && player.y > ent.y && player.y < ent.y + 300) {
                    ent.state = 'PRE_ATTACK';
                    ent.timer = 0;
                } 
                // Warning Phase
                else if (ent.state === 'PRE_ATTACK') {
                    ent.timer = (ent.timer || 0) + dt;
                    if (ent.timer > 0.4) { // 0.4s delay before dropping
                        ent.state = 'ATTACK';
                        ent.vy = 0;
                        audioManager.playCrumble();
                    }
                }
                // Falling
                else if (ent.state === 'ATTACK') {
                    ent.vy = (ent.vy || 0) + GRAVITY * 2 * dt;
                    ent.y += ent.vy * dt;
                    if (ent.y > (ent.initialY || 0) + 200) {
                        ent.state = 'COOLDOWN';
                        ent.timer = 0;
                        shakeRef.current = 5;
                        spawnParticles(ent.x + ent.w/2, ent.y + ent.h, COLORS.PARTICLE_DUST, 10);
                    }
                } 
                // Recovery
                else if (ent.state === 'COOLDOWN') {
                    ent.timer = (ent.timer || 0) + dt;
                    if (ent.timer > 1.0) ent.state = 'RETURN';
                } else if (ent.state === 'RETURN') {
                    ent.y = lerp(ent.y, ent.initialY || ent.y, dt * 2);
                    if (Math.abs(ent.y - (ent.initialY || 0)) < 1) {
                        ent.y = ent.initialY || ent.y;
                        ent.state = 'IDLE';
                    }
                }
                if (checkCollision(player, ent)) killPlayer();
            }

            if (ent.type === EntityType.MOVING_PLATFORM && ent.initialX) { const prevX = ent.x; const prevY = ent.y; const offset = Math.sin(simulationTimeRef.current * (ent.speed || 2)) * ((ent.range || 100) / 2); if (ent.axis === 'x') ent.x = ent.initialX + offset; else if (ent.initialY) ent.y = ent.initialY + offset; const dx = ent.x - prevX; const dy = ent.y - prevY; if (player.grounded && player.x + player.w > prevX && player.x < prevX + ent.w && Math.abs((player.y + player.h) - prevY) < 6) { player.x += dx; player.y += dy; } }
            if (ent.type === EntityType.SPINNER || ent.type === EntityType.ROTATING_SAW) { ent.angle = (ent.angle || 0) + (ent.speed || 3) * dt; const radius = ent.w/2; const cx = ent.x + radius; const cy = ent.y + radius; const px = player.x + player.w/2; const py = player.y + player.h/2; if (Math.sqrt(Math.pow(cx-px,2) + Math.pow(cy-py,2)) < radius) killPlayer(); }
            
            // Auto-decay for builder blocks
            if (ent.id.startsWith('built_')) {
                ent.timer = (ent.timer || 0) + dt;
                if (ent.timer > 5.0) { ent.active = false; ent.visible = false; spawnParticles(ent.x+ent.w/2, ent.y+ent.h/2, '#A8A29E', 5); }
            }
        }

        // Projectiles
        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
            const p = projectilesRef.current[i];
            if (p.target === 'PLAYER') {
                const px = player.x + player.w/2; const py = player.y + player.h/2; const angle = Math.atan2(py - p.y, px - p.x);
                const speed = 150; const tx = Math.cos(angle) * speed; const ty = Math.sin(angle) * speed;
                p.vx = (p.vx || 0) * 0.95 + tx * 0.05; p.vy = (p.vy || 0) * 0.95 + ty * 0.05;
            }
            p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
            if (checkCollision(p, player)) { killPlayer(); projectilesRef.current.splice(i, 1); continue; }
            let hit = false;
            for (const ent of level.entities) { if (ent.visible && isSolid(ent) && checkCollision(p, ent)) { spawnParticles(p.x, p.y, COLORS.PARTICLE_SPARK, 3); hit = true; break; } }
            if (hit || p.x < -100 || p.x > level.width + 100 || p.y < -100 || p.y > level.height + 100) { projectilesRef.current.splice(i, 1); }
        }

        // Player Logic
        player.scaleX = lerp(player.scaleX, 1, dt * 15); player.scaleY = lerp(player.scaleY, 1, dt * 15);
        player.blinkTimer -= dt; if (player.blinkTimer <= 0 && Math.random() < 0.01) player.blinkTimer = 0.15;
        if (currentInput.jump) player.jumpBuffer = 0.15; else if (player.jumpBuffer > 0) player.jumpBuffer -= dt;
        let targetVx = 0; if (currentInput.left) targetVx = -MOVE_SPEED; if (currentInput.right) targetVx = MOVE_SPEED;
        if (targetVx !== 0) { const accel = player.grounded ? ACCELERATION : ACCELERATION * 0.6; if (player.vx < targetVx) player.vx = Math.min(targetVx, player.vx + accel * dt); else player.vx = Math.max(targetVx, player.vx - accel * dt); player.facingRight = targetVx > 0; if (player.grounded) { const runCycle = Math.sin(simulationTimeRef.current * 20); player.scaleY = 1 + runCycle * 0.1; player.scaleX = 1 - runCycle * 0.1; } } else { const f = 0.85; player.vx *= Math.pow(f, dt * 60); }
        player.vy += GRAVITY * dt; if (Math.abs(player.vy) > TERMINAL_VELOCITY) player.vy = TERMINAL_VELOCITY * Math.sign(player.vy);
        if (player.grounded) player.coyoteTime = 0.08; else player.coyoteTime -= dt;
        if ((player.coyoteTime > 0 || player.grounded) && player.jumpBuffer > 0) { player.vy = JUMP_FORCE; player.coyoteTime = 0; player.jumpBuffer = 0; player.grounded = false; player.scaleX = 0.7; player.scaleY = 1.3; audioManager.playJump(); spawnParticles(player.x + player.w/2, player.y + player.h, COLORS.PARTICLE_DUST, 4, 150); }
        player.grounded = false; 

        // Collision Resolution
        const moveStep = (dx: number, dy: number) => {
             for (const ent of level.entities) {
                 if (!ent.active || !ent.visible) continue;
                 if (checkCollision(player, ent)) {
                    if (ent.type === EntityType.KEY) { ent.active = false; ent.visible = false; player.hasKey = true; audioManager.playJump(); spawnParticles(ent.x+ent.w/2, ent.y+ent.h/2, COLORS.KEY, 10); } 
                    else if (ent.type === EntityType.SPIKE || ent.type === EntityType.FAKE_DOOR) { killPlayer(); return; }
                    else if (ent.type === EntityType.DOOR) { const locked = !player.hasKey && level.entities.some(e => e.type === EntityType.KEY && e.active); if (!locked) { winLevel(); return; } }
                 }
             }

            player.x += dx;
            for (const ent of level.entities) {
                if (!ent.active || !ent.visible || !isSolid(ent)) continue;
                if (checkCollision(player, ent)) {
                    if (dx > 0) player.x = ent.x - player.w; else if (dx < 0) player.x = ent.x + ent.w;
                    player.vx = 0;
                    if (ent.type === EntityType.TROLL_BLOCK) ent.triggered = true;
                }
            }

            player.y += dy;
            for (const ent of level.entities) {
                if (!ent.active || !ent.visible) continue;
                if (ent.type === EntityType.ONE_WAY_PLATFORM) {
                     if (dy > 0 && checkCollision(player, ent)) { const prevY = player.y - dy; if (prevY + player.h <= ent.y) { player.y = ent.y - player.h; player.vy = 0; player.grounded = true; } }
                     continue;
                }
                if (!isSolid(ent)) continue;
                if (checkCollision(player, ent)) {
                    if (dy > 0) { player.y = ent.y - player.h; player.vy = 0; player.grounded = true; if (!player.grounded) { player.scaleX = 1.4; player.scaleY = 0.6; spawnParticles(player.x+player.w/2, player.y+player.h, COLORS.PARTICLE_DUST, 2, 100); } if (ent.type === EntityType.FRAGILE_BLOCK) ent.triggered = true; } 
                    else if (dy < 0) { player.y = ent.y + ent.h; player.vy = 0; player.scaleX = 1.1; player.scaleY = 0.9; }
                    if (ent.type === EntityType.TROLL_BLOCK) ent.triggered = true;
                }
            }
        };

        const stepSize = 8;
        const totalDx = player.vx * dt;
        const totalDy = player.vy * dt;
        const dist = Math.sqrt(totalDx*totalDx + totalDy*totalDy);
        const steps = Math.max(1, Math.ceil(dist / stepSize));
        for(let i=0; i<steps; i++) { if(player.isDead && player.deathTimer <= 0) break; moveStep(totalDx/steps, totalDy/steps); }
        if (player.y > level.height + 200) killPlayer();
    };

    const killPlayer = () => {
        const player = playerRef.current;
        if (player && !player.isDead && player.deathTimer <= 0) {
            player.deathTimer = 0.6; player.vx = 0; player.vy = 0; player.scaleX = 1; player.scaleY = 1;
        }
    };

    const winLevel = () => {
        if (status === GameStatus.PLAYING) { audioManager.playWin(); spawnParticles(playerRef.current!.x, playerRef.current!.y, COLORS.PARTICLE_WIN, 40); propsRef.current.onLevelComplete(); }
    };

    const updateParticles = (dt: number) => {
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAVITY * 0.5 * dt; p.life -= dt; p.size *= 0.95; 
            if (p.life <= 0) particlesRef.current.splice(i, 1);
        }
    };

    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const player = playerRef.current!;
        const level = levelRef.current!;

        ctx.fillStyle = COLORS.BACKGROUND; ctx.fillRect(0, 0, width, height);

        let targetCamX = player.x + player.w / 2 - width / 2; let targetCamY = player.y + player.h / 2 - height / 2;
        targetCamX += player.vx * 0.3; targetCamY += player.vy * 0.1;
        targetCamX = Math.max(-100, Math.min(targetCamX, level.width - width + 100)); targetCamY = Math.max(-100, Math.min(targetCamY, level.height - height + 100));
        cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1; cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;
        let shakeX = 0, shakeY = 0;
        if (shakeRef.current > 0) { shakeX = (Math.random() - 0.5) * shakeRef.current; shakeY = (Math.random() - 0.5) * shakeRef.current; shakeRef.current *= 0.9; }

        ctx.save(); ctx.translate(Math.round(-cameraRef.current.x + shakeX), Math.round(-cameraRef.current.y + shakeY));

        level.entities.forEach(ent => {
            if (!ent.visible) return;
            switch(ent.type) {
                case EntityType.WALL: case EntityType.MOVING_PLATFORM: case EntityType.TROLL_BLOCK: case EntityType.ILLUSION_WALL:
                    ctx.fillStyle = ent.id.startsWith('built') ? '#A8A29E' : COLORS.WALL; 
                    ctx.fillRect(ent.x, ent.y, ent.w, ent.h); 
                    break;
                
                // NEW: Custom Crusher Design
                case EntityType.CRUSHER:
                    ctx.fillStyle = COLORS.HEAVY_BLOCK; 
                    ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
                    
                    // Rivets
                    ctx.fillStyle = '#000';
                    ctx.fillRect(ent.x + 5, ent.y + 5, 6, 6);
                    ctx.fillRect(ent.x + ent.w - 11, ent.y + 5, 6, 6);
                    ctx.fillRect(ent.x + 5, ent.y + ent.h - 11, 6, 6);
                    ctx.fillRect(ent.x + ent.w - 11, ent.y + ent.h - 11, 6, 6);
                    
                    // Warning Spikes at bottom
                    ctx.fillStyle = '#EF4444';
                    const spikeW = 10;
                    const numSpikes = Math.floor(ent.w / spikeW);
                    ctx.beginPath();
                    for(let k=0; k<numSpikes; k++) {
                        const sx = ent.x + k * spikeW;
                        const sy = ent.y + ent.h;
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(sx + spikeW/2, sy + 8);
                        ctx.lineTo(sx + spikeW, sy);
                    }
                    ctx.fill();
                    break;
                
                // --- MONSTERS DRAW ---
                case EntityType.MONSTER_CHASER:
                    ctx.fillStyle = COLORS.MONSTER_CHASER;
                    // Ghost shape
                    ctx.beginPath(); ctx.arc(ent.x+ent.w/2, ent.y+ent.h/2-5, 15, Math.PI, 0);
                    ctx.lineTo(ent.x+ent.w, ent.y+ent.h); ctx.lineTo(ent.x, ent.y+ent.h); ctx.fill();
                    // Eyes
                    ctx.fillStyle = '#FFF'; ctx.fillRect(ent.x+8, ent.y+10, 5, 5); ctx.fillRect(ent.x+20, ent.y+10, 5, 5);
                    break;
                case EntityType.MONSTER_GUARD:
                    ctx.fillStyle = COLORS.MONSTER_GUARD;
                    ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
                    // Helmet
                    ctx.fillStyle = '#000'; ctx.fillRect(ent.x, ent.y, ent.w, 10);
                    // Eye (Visor)
                    ctx.fillStyle = ent.state === 'ATTACK' ? '#EF4444' : '#60A5FA';
                    ctx.fillRect(ent.x + 5, ent.y + 12, ent.w - 10, 6);
                    break;
                case EntityType.MONSTER_COLLECTOR:
                    ctx.fillStyle = COLORS.MONSTER_COLLECTOR;
                    ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
                    // Sack on back
                    if (ent.hasItem) { ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(ent.x+ent.w/2, ent.y-5, 10, 0, Math.PI*2); ctx.fill(); }
                    break;
                case EntityType.MONSTER_BUILDER:
                    ctx.fillStyle = COLORS.MONSTER_BUILDER;
                    ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
                    // Hard hat
                    ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(ent.x+ent.w/2, ent.y+5, 12, Math.PI, 0); ctx.fill();
                    break;

                // Existing...
                case EntityType.BUTTON:
                    ctx.fillStyle = COLORS.BUTTON_BASE; ctx.fillRect(ent.x, ent.y + ent.h - 5, ent.w, 5);
                    ctx.fillStyle = ent.triggered ? COLORS.BUTTON_ON : COLORS.BUTTON_OFF; ctx.fillRect(ent.x + 4, ent.y + ent.h - (ent.triggered ? 8 : 12), ent.w - 8, ent.triggered ? 3 : 7); break;
                case EntityType.SPRING:
                    ctx.fillStyle = '#64748B'; const coils = 3; const coilH = ent.triggered ? ent.h / 2 : ent.h; const coilY = ent.y + (ent.h - coilH);
                    ctx.beginPath(); ctx.moveTo(ent.x + 5, coilY + coilH); for(let i=0; i<coils; i++) { ctx.lineTo(ent.x + ent.w - 5, coilY + coilH - (i*coilH/coils) - 5); ctx.lineTo(ent.x + 5, coilY + coilH - (i*coilH/coils) - 10); }
                    ctx.strokeStyle = COLORS.SPRING_COIL; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = COLORS.SPRING_TOP; ctx.fillRect(ent.x, coilY, ent.w, 8); break;
                case EntityType.ONE_WAY_PLATFORM:
                    ctx.fillStyle = COLORS.ONE_WAY_PLATFORM; ctx.fillRect(ent.x, ent.y, ent.w, 10); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(ent.x + ent.w/2, ent.y + 2); ctx.lineTo(ent.x + ent.w/2 - 5, ent.y + 8); ctx.lineTo(ent.x + ent.w/2 + 5, ent.y + 8); ctx.fill(); break;
                case EntityType.TIMED_DOOR:
                    ctx.fillStyle = '#60A5FA'; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.strokeStyle = '#2563EB'; ctx.lineWidth = 2; ctx.strokeRect(ent.x, ent.y, ent.w, ent.h); break;
                case EntityType.RHYTHM_SPIKE:
                    if (ent.triggered) { ctx.fillStyle = COLORS.RHYTHM_SPIKE; ctx.beginPath(); ctx.moveTo(ent.x, ent.y+ent.h); ctx.lineTo(ent.x+ent.w/2, ent.y); ctx.lineTo(ent.x+ent.w, ent.y+ent.h); ctx.fill(); } else { ctx.fillStyle = '#404040'; ctx.fillRect(ent.x, ent.y+ent.h-4, ent.w, 4); } break;
                case EntityType.DOOM_WALL:
                    ctx.fillStyle = COLORS.DOOM_WALL; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.fillStyle = '#333'; const eyesY = player.y + 10; ctx.fillRect(ent.x + ent.w - 30, eyesY, 10, 30); ctx.fillRect(ent.x + ent.w - 60, eyesY, 10, 30); break;
                
                // Falling Block Visuals
                case EntityType.FALLING_BLOCK: 
                    ctx.fillStyle = COLORS.HEAVY_BLOCK; 
                    let drawX = ent.x;
                    if (ent.state === 'PRE_ATTACK') {
                        drawX += (Math.random() - 0.5) * 4; // Shake visual
                    }
                    ctx.fillRect(drawX, ent.y, ent.w, ent.h); 
                    ctx.fillStyle = '#000'; 
                    ctx.fillRect(drawX + 10, ent.y + 25, 8, 8); 
                    ctx.fillRect(drawX + ent.w - 18, ent.y + 25, 8, 8); 
                    ctx.fillRect(drawX + 10, ent.y + 45, ent.w - 20, 5); 
                    break;
                    
                case EntityType.SHOOTER: case EntityType.HOMING_LAUNCHER: ctx.fillStyle = COLORS.SHOOTER; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); break;
                case EntityType.ELECTRIC_FIELD: if(ent.triggered) { ctx.strokeStyle = COLORS.ELECTRIC_ACTIVE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ent.x + ent.w/2, ent.y); let ly = ent.y; while(ly < ent.y + ent.h) { ly += 10; ctx.lineTo(ent.x + ent.w/2 + (Math.random()-0.5)*10, ly); } ctx.stroke(); } break;
                case EntityType.CHARGED_FLOOR: ctx.fillStyle = COLORS.WALL; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); if(Math.random() > 0.5) { ctx.fillStyle = COLORS.CHARGED_FLOOR; ctx.fillRect(ent.x + Math.random()*ent.w, ent.y, 4, 4); } break;
                case EntityType.PENDULUM: ctx.save(); ctx.translate(ent.x, ent.y); ctx.rotate(ent.angle || 0); ctx.strokeStyle = COLORS.PENDULUM_ROPE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, ent.h); ctx.stroke(); ctx.translate(0, ent.h); ctx.fillStyle = COLORS.PENDULUM_BLADE; ctx.beginPath(); ctx.arc(0,0, 20, 0, Math.PI*2); ctx.fill(); ctx.restore(); ctx.fillStyle = '#222'; ctx.fillRect(ent.x-10, ent.y-10, 20, 20); break;
                case EntityType.ROTATING_SAW: case EntityType.SPINNER: ctx.save(); ctx.translate(ent.x + ent.w/2, ent.y + ent.h/2); ctx.rotate((ent.angle || 0) + simulationTimeRef.current * 10); ctx.fillStyle = COLORS.SAW_BLADE; const r = ent.w/2; ctx.beginPath(); for(let i=0; i<8; i++) { const a = (i/8)*Math.PI*2; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); ctx.lineTo(Math.cos(a+0.4)*(r*0.5), Math.sin(a+0.4)*(r*0.5)); } ctx.fill(); ctx.restore(); break;
                case EntityType.GLASS_WALL: ctx.fillStyle = COLORS.GLASS; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); ctx.strokeStyle = COLORS.GLASS_BORDER; ctx.lineWidth = 2; ctx.strokeRect(ent.x, ent.y, ent.w, ent.h); ctx.beginPath(); ctx.moveTo(ent.x + ent.w - 10, ent.y + 5); ctx.lineTo(ent.x + ent.w - 5, ent.y + 15); ctx.stroke(); break;
                case EntityType.FRAGILE_BLOCK: ctx.fillStyle = COLORS.FRAGILE; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); if (ent.triggered) { ctx.fillStyle = COLORS.FRAGILE_CRACKED; ctx.fillRect(ent.x + 5, ent.y + 5, ent.w - 10, ent.h - 10); } break;
                case EntityType.TOGGLE_WALL: ctx.fillStyle = ent.visible ? COLORS.TOGGLE_ON : COLORS.TOGGLE_OFF; ctx.fillRect(ent.x, ent.y, ent.w, ent.h); if (ent.visible) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ent.x + ent.w/2 - 2, ent.y + 5, 4, 4); } break;
                case EntityType.FALLING_SPIKE: case EntityType.SPIKE: ctx.fillStyle = COLORS.SPIKE; ctx.beginPath(); ctx.moveTo(ent.x, ent.y); ctx.lineTo(ent.x + ent.w/2, ent.y + ent.h); ctx.lineTo(ent.x + ent.w, ent.y); ctx.fill(); break;
                case EntityType.ROAMER: ctx.fillStyle = "#8b0000"; drawRoundedRect(ctx, ent.x, ent.y, ent.w, ent.h, 8); ctx.fillStyle = "#fff"; ctx.fillRect(ent.x + 5, ent.y + 10, 8, 8); ctx.fillRect(ent.x + ent.w - 13, ent.y + 10, 8, 8); break;
                
                // UNIFIED DOOR RENDERING (Real & Fake look identical)
                case EntityType.DOOR: case EntityType.WIN_FAKE: case EntityType.FAKE_DOOR: 
                    ctx.fillStyle = COLORS.DOOR_FRAME; 
                    drawRoundedRect(ctx, ent.x, ent.y, ent.w, ent.h, 4); 
                    
                    const isLocked = !player.hasKey && level.entities.some(e => e.type === EntityType.KEY && e.active); 
                    // To be deceptive, fake door perfectly mimics real door color based on locked state
                    const doorColor = isLocked ? '#991b1b' : COLORS.DOOR;
                    
                    ctx.fillStyle = doorColor;
                    drawRoundedRect(ctx, ent.x + 4, ent.y + 4, ent.w - 8, ent.h - 4, 2); 
                    break;

                case EntityType.KEY: if (ent.active) { ctx.fillStyle = COLORS.KEY; const kx = ent.x + ent.w/2; const ky = ent.y + ent.h/2 + Math.sin(simulationTimeRef.current * 4) * 5; ctx.beginPath(); ctx.arc(kx, ky, 10, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#FFF'; ctx.fillText('🔑', kx-7, ky+5); } break;
                case EntityType.TEXT: if (ent.text) { ctx.fillStyle = COLORS.TEXT; ctx.font = "bold 24px 'Fredoka', sans-serif"; ctx.textAlign = "center"; ctx.fillText(ent.text, ent.x, ent.y); } break;
            }
        });

        projectilesRef.current.forEach(p => { ctx.fillStyle = p.color || COLORS.PROJECTILE; ctx.beginPath(); ctx.arc(p.x + p.w/2, p.y + p.h/2, p.w/2, 0, Math.PI * 2); ctx.fill(); });

        if (!player.isDead || player.deathTimer > 0) {
            ctx.save();
            const cx = player.x + player.w/2; const cy = player.y + player.h/2;
            ctx.translate(cx, cy); ctx.rotate(player.rotation); ctx.scale(player.scaleX, player.scaleY);
            const VISUAL_W = 24; const VISUAL_H = 24; const isMoving = Math.abs(player.vx) > 20; const walkCycle = simulationTimeRef.current * 20;
            ctx.fillStyle = COLORS.PLAYER; ctx.strokeStyle = COLORS.PLAYER; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const leftLegAngle = isMoving ? Math.sin(walkCycle) * 0.6 : 0; const rightLegAngle = isMoving ? Math.sin(walkCycle + Math.PI) * 0.6 : 0;
            ctx.beginPath(); ctx.moveTo(-5, VISUAL_H/2 - 4); ctx.lineTo(-5 + Math.sin(leftLegAngle)*8, VISUAL_H/2 + 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(5, VISUAL_H/2 - 4); ctx.lineTo(5 + Math.sin(rightLegAngle)*8, VISUAL_H/2 + 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-VISUAL_W/2 + 2, 0); ctx.lineTo(-VISUAL_W/2 - 6, Math.sin(rightLegAngle)*6 + 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(VISUAL_W/2 - 2, 0); ctx.lineTo(VISUAL_W/2 + 6, Math.sin(leftLegAngle)*6 + 4); ctx.stroke();
            ctx.fillStyle = COLORS.PLAYER; drawRoundedRect(ctx, -VISUAL_W/2, -VISUAL_H/2, VISUAL_W, VISUAL_H, 5);
            ctx.strokeStyle = COLORS.PLAYER_BORDER; ctx.lineWidth = 2; ctx.strokeRect(-VISUAL_W/2 + 1, -VISUAL_H/2 + 1, VISUAL_W - 2, VISUAL_H - 2);
            ctx.fillStyle = "#FFF"; 
            if (player.deathTimer > 0) { ctx.beginPath(); ctx.arc(0, 4, 6, 0, Math.PI*2); ctx.fill(); } else { const eyeOffset = player.facingRight ? 6 : -6; if (player.blinkTimer <= 0) { drawRoundedRect(ctx, -6 + eyeOffset, -8, 5, 7, 2); drawRoundedRect(ctx, 6 + eyeOffset, -8, 5, 7, 2); } else { ctx.fillRect(-8 + eyeOffset, -4, 8, 2); ctx.fillRect(4 + eyeOffset, -4, 8, 2); } }
            ctx.restore();
        }

        particlesRef.current.forEach(p => { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; });
        
        if (level.timeLimit !== undefined) {
             const timeLeft = Math.max(0, timerRef.current);
             ctx.restore();
             ctx.save();
             ctx.fillStyle = timeLeft < 5.0 ? (timeLeft * 10 % 2 > 1 ? '#EF4444' : '#FFF') : '#FFF';
             ctx.font = "bold 40px 'Fredoka', sans-serif";
             ctx.textAlign = "center";
             ctx.shadowColor = "#000"; ctx.shadowBlur = 4;
             ctx.fillText(timeLeft.toFixed(2), width / 2, 60);
             ctx.restore();
             return;
        }

        ctx.restore();
    };

    const loop = (time: number) => {
        if (previousTimeRef.current === 0) previousTimeRef.current = time;
        const dt = (time - previousTimeRef.current) / 1000;
        previousTimeRef.current = time;
        const FIXED_DT = 1 / 120;
        const safeDt = Math.min(dt, 0.1); 
        accumulatorRef.current += safeDt;
        if (status === GameStatus.PLAYING) { while (accumulatorRef.current >= FIXED_DT) { updatePhysics(FIXED_DT); updateParticles(FIXED_DT); accumulatorRef.current -= FIXED_DT; } } else { accumulatorRef.current = 0; }
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { if (ctx.canvas.width !== window.innerWidth || ctx.canvas.height !== window.innerHeight) { ctx.canvas.width = window.innerWidth; ctx.canvas.height = window.innerHeight; } draw(ctx); }
        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => { requestRef.current = requestAnimationFrame(loop); return () => cancelAnimationFrame(requestRef.current); }, [status]);

    return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default GameEngine;
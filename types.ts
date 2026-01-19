export enum EntityType {
    PLAYER = 'PLAYER',
    WALL = 'WALL',
    SPIKE = 'SPIKE',
    DOOR = 'DOOR',
    KEY = 'KEY',
    TEXT = 'TEXT',
    
    // --- ADVANCED OBSTACLE SYSTEM ---
    FALLING_SPIKE = 'FALLING_SPIKE', 
    TROLL_BLOCK = 'TROLL_BLOCK',     
    ROAMER = 'ROAMER',               
    CRUSHER = 'CRUSHER',             
    MOVING_PLATFORM = 'MOVING_PLATFORM',
    FAKE_DOOR = 'FAKE_DOOR',         
    WIN_FAKE = 'WIN_FAKE',           
    ILLUSION_WALL = 'ILLUSION_WALL', 
    GLASS_WALL = 'GLASS_WALL',       
    FRAGILE_BLOCK = 'FRAGILE_BLOCK', 
    TOGGLE_WALL = 'TOGGLE_WALL',     
    SPINNER = 'SPINNER',             

    // --- TRAPS ---
    SHOOTER = 'SHOOTER',             
    HOMING_LAUNCHER = 'HOMING_LAUNCHER', 
    PROJECTILE = 'PROJECTILE',       
    ELECTRIC_FIELD = 'ELECTRIC_FIELD', 
    CHARGED_FLOOR = 'CHARGED_FLOOR',   
    LASER_BEAM = 'LASER_BEAM',         
    FALLING_BLOCK = 'FALLING_BLOCK',   
    PENDULUM = 'PENDULUM',             
    ROTATING_SAW = 'ROTATING_SAW',     

    // --- MECHANICAL ---
    BUTTON = 'BUTTON',           
    SPRING = 'SPRING',           
    ONE_WAY_PLATFORM = 'ONE_WAY_PLATFORM', 
    TIMED_DOOR = 'TIMED_DOOR',   

    // --- TIME ---
    RHYTHM_SPIKE = 'RHYTHM_SPIKE', 
    DOOM_WALL = 'DOOM_WALL',       

    // --- SMART MONSTERS (NEW) ---
    MONSTER_CHASER = 'MONSTER_CHASER',       // Follows player (Flying/Ghost)
    MONSTER_GUARD = 'MONSTER_GUARD',         // Patrols, attacks on sight
    MONSTER_COLLECTOR = 'MONSTER_COLLECTOR', // Steals keys
    MONSTER_BUILDER = 'MONSTER_BUILDER',     // Spawns walls
}

export enum GameStatus {
    LOADING = 'LOADING',
    MENU = 'MENU',
    LEVEL_SELECT = 'LEVEL_SELECT',
    PLAYING = 'PLAYING',
    LEVEL_TRANSITION = 'LEVEL_TRANSITION',
    GAME_OVER = 'GAME_OVER'
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Vector2 {
    x: number;
    y: number;
    initialX?: number; 
    initialY?: number;
}

export interface Entity extends Rect {
    id: string;
    type: EntityType;
    color?: string;
    text?: string;
    
    // Physics & State
    vx?: number;
    vy?: number;
    visible: boolean;
    active: boolean;
    triggered?: boolean;
    
    // Properties for specific types
    initialX?: number;
    initialY?: number;
    speed?: number;       
    acceleration?: number; 
    range?: number;       
    axis?: 'x' | 'y';
    direction?: 'up' | 'down' | 'left' | 'right'; 
    
    // Door/Key/Mechanics
    isOpen?: boolean;
    linkId?: string;       
    triggerMode?: 'HOLD' | 'TOGGLE' | 'ONCE'; 
    
    // Advanced Logic
    linkedEntityId?: string; 
    timer?: number;          
    toggleTime?: number;   
    initialDelay?: number; 
    angle?: number;         
    state?: 'IDLE' | 'ATTACK' | 'RETURN' | 'COOLDOWN' | 'CHASE' | 'FLEE' | 'PATROL' | 'PRE_ATTACK'; 
    target?: string; 
    
    // Monster Props
    detectRange?: number;
    hasItem?: boolean; // For collector
}

export interface PlayerState extends Rect {
    vx: number;
    vy: number;
    grounded: boolean;
    facingRight: boolean;
    isDead: boolean;
    hasKey: boolean;
    coyoteTime: number;
    jumpBuffer: number;
    
    // Visuals
    scaleX: number;
    scaleY: number;
    rotation: number;
    blinkTimer: number;
    deathTimer: number;
}

export interface LevelData {
    id: number;
    name: string;
    width: number;
    height: number;
    spawn: Vector2;
    entities: Entity[];
    hint?: string;
    darkness?: boolean; 
    timeLimit?: number; 
}

export interface InputState {
    left: boolean;
    right: boolean;
    jump: boolean;
    dash: boolean;
}

export interface AudioSettings {
    muted: boolean;
    sfxVolume: number;
    musicVolume: number;
}

declare global {
    interface Window {
        gameAnalytics?: {
            event: (eventName: string, data: any) => void;
        };
    }
}
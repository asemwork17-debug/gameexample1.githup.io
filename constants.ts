export const GRAVITY = 2400; 
export const TERMINAL_VELOCITY = 1200;
export const MOVE_SPEED = 320; 
export const JUMP_FORCE = -740; 
export const ACCELERATION = 2800;
export const FRICTION = 0.85; 
export const ICE_FRICTION = 0.98;
export const AIR_CONTROL = 0.80; 

export const TILE_SIZE = 40; 

export const COLORS = {
    BACKGROUND: '#FACC15',      
    PLAYER: '#000000',          
    PLAYER_BORDER: '#FFFFFF',   
    PLAYER_DEAD: '#EF4444',     
    WALL: '#404040',            
    WALL_HIGHLIGHT: '#525252',  
    INVISIBLE_WALL: '#EEEEEE', 
    SPIKE: '#EF4444',           
    SPIKE_DARK: '#991B1B',      
    DOOR: '#EF4444',            
    DOOR_OPEN: '#22C55E', 
    DOOR_FRAME: '#14532D',      
    FAKE_DOOR: '#B91C1C', 
    KEY: '#F59E0B',             
    FAKE_FLOOR: '#404040', 
    TEXT: '#FFFFFF',
    
    // Existing Features
    GLASS: 'rgba(255, 255, 255, 0.3)',
    GLASS_BORDER: 'rgba(255, 255, 255, 0.6)',
    TOGGLE_ON: '#1E293B', 
    TOGGLE_OFF: 'rgba(30, 41, 59, 0.2)',
    FRAGILE: '#78716C', 
    FRAGILE_CRACKED: '#A8A29E',
    SPINNER: '#DC2626',

    // Traps
    SHOOTER: '#525252',
    PROJECTILE: '#171717',
    PROJECTILE_HOMING: '#DC2626',
    ELECTRIC_ACTIVE: '#3B82F6', 
    ELECTRIC_INACTIVE: '#1E3A8A', 
    CHARGED_FLOOR: '#F59E0B', 
    HEAVY_BLOCK: '#262626', 
    PENDULUM_ROPE: '#404040',
    PENDULUM_BLADE: '#999999',
    SAW_BLADE: '#D4D4D8',

    // Mechanical
    BUTTON_OFF: '#DC2626',
    BUTTON_ON: '#22C55E',
    BUTTON_BASE: '#525252',
    SPRING_COIL: '#94A3B8',
    SPRING_TOP: '#EF4444',
    ONE_WAY_PLATFORM: '#475569',
    
    // Time
    RHYTHM_SPIKE: '#991B1B',
    DOOM_WALL: '#000000',

    // --- SMART MONSTERS ---
    MONSTER_CHASER: '#7C3AED',   // Violet Ghost
    MONSTER_GUARD: '#1E40AF',    // Blue Guard
    MONSTER_COLLECTOR: '#CA8A04', // Gold Thief
    MONSTER_BUILDER: '#EA580C',  // Orange Builder

    PARTICLE_BLOOD: '#EF4444',
    PARTICLE_WIN: '#22C55E',
    PARTICLE_DUST: '#A3A3A3',
    PARTICLE_SPARK: '#60A5FA'
};

export const PHYSICS_TICK_RATE = 1 / 120;
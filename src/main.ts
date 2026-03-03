import { GameEngine } from '@/game/GameEngine';

const container = document.getElementById('game-container');
if (!container) throw new Error('#game-container not found in DOM');

const engine = new GameEngine();
engine.start(container).catch(console.error);

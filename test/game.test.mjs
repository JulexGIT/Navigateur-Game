import test from 'node:test';
import assert from 'node:assert/strict';
import { isInCone } from '../js/utils.js';
import { Player, Enemy } from '../js/entities.js';
import { GameStateManager, GAME_STATES } from '../js/core/gameStateManager.js';

test('cone attack only hits target in front', () => {
  const player = new Player(0, 0);
  player.facing = 0;
  const front = { x: 40, y: 0 };
  const back = { x: -40, y: 0 };
  assert.equal(isInCone(player, front, player.facing, Math.PI / 2, 60), true);
  assert.equal(isInCone(player, back, player.facing, Math.PI / 2, 60), false);
});

test('player attack capped to two targets', () => {
  const player = new Player(0, 0);
  player.facing = 0;
  player.beginAttack();
  player.attack.windup = 0;
  const enemies = [new Enemy(20, 0), new Enemy(28, 0), new Enemy(38, 0)];
  const result = player.resolveAttack(enemies);
  assert.equal(result.total, 2);
});

test('state manager enforces paused controls', () => {
  const gsm = new GameStateManager();
  gsm.setState(GAME_STATES.PAUSED);
  assert.equal(gsm.can('attack'), false);
  assert.equal(gsm.can('pause'), true);
});

test('collision movement blocked by world collider', () => {
  const player = new Player(0, 0);
  const world = { collidesRect: (rect) => rect.x > -6 };
  player.tryMove(12, 0, world);
  assert.ok(player.x < 12);
});

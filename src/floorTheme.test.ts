import assert from 'node:assert/strict';
import { resolveFloorTheme } from './floorTheme';

assert.equal(resolveFloorTheme('apple'), 'apple');
assert.equal(resolveFloorTheme('classic'), 'classic');
assert.equal(resolveFloorTheme('industrial'), 'classic');
assert.equal(resolveFloorTheme(undefined), 'apple');
assert.equal(resolveFloorTheme('unknown'), 'apple');
console.log('floorTheme tests passed');

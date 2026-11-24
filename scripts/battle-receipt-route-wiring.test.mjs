import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { buildBattleTrapper, toWarperKeeperBundle } from '../worker-battle-trappers/src/contract.ts';
import { replayBattle } from '../src/lib/battle/deterministicSim.ts';
import { computeProofHash } from '../src/lib/federation/proofHash.ts';

// Test-only resolution of the existing Next alias. Stub only the Redis boundary;
// the actual POST export, injectable handler, adapter, simulation and hashes run.
const limiterKey = Symbol.for('gundarium.receipt-test.rate-limit');
let limiterLoads = 0;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/rateLimit') {
      limiterLoads++;
      return { url: 'data:text/javascript,' + encodeURIComponent('export async function checkRateLimit(...args) { return globalThis[Symbol.for("gundarium.receipt-test.rate-limit")](...args); }'), shortCircuit: true };
    }
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { POST, maxDuration } = await import('../src/app/api/federation/submit-battle-receipt/route.ts');
test.after(() => { hooks.deregister(); delete globalThis[limiterKey]; });
const card = { name: 'Synthetic Player', hp: 50, armorType: 'Gundanium', primaryWeapon: 'Beam', primaryDamage: 99, secondaryWeapon: 'Beam', secondaryDamage: 10, tertiaryWeapon: 'Beam', tertiaryDamage: 10, specialAttack: 'Beam', specialDamage: 10 };
const body = { seed: 7, moves: ['primary'], player: card, enemy: { ...card, name: 'Synthetic Enemy', hp: 1 } };
const request = () => new Request('https://app.example/api/federation/submit-battle-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function setup(t, configuration = 'https://worker.example') {
  const priorUrl = process.env.BATTLE_TRAPPERS_URL; const priorFetch = globalThis.fetch;
  if (configuration === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = configuration;
  const calls = []; const limiter = [];
  globalThis[limiterKey] = (...args) => { limiter.push(args); return { allowed: true, retryAfterMs: 0 }; };
  globalThis.fetch = async (url, init) => {
    const rpc = JSON.parse(init.body); calls.push({ url, init, rpc });
    const structuredContent = rpc.params.name === 'build_battle_trapper'
      ? { ok: true, trapper: await buildBattleTrapper(rpc.params.arguments.draft) }
      : { ok: true, bundle: await toWarperKeeperBundle(rpc.params.arguments.trapper) };
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result: { isError: false, structuredContent } });
  };
  t.after(() => { globalThis.fetch = priorFetch; if (priorUrl === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = priorUrl; });
  return { calls, limiter };
}
test('actual POST does not even load Redis when worker is unconfigured', async t => {
  const { calls, limiter } = setup(t); delete process.env.BATTLE_TRAPPERS_URL;
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { submitted: false, deliveryStatus: 'not_configured' });
  assert.equal(limiterLoads, 0); assert.equal(limiter.length, 0); assert.equal(calls.length, 0);
});
test('actual POST exports a validated bundle using unchanged replay and hash functions', async t => {
  const { calls, limiter } = setup(t);
  const response = await POST(request()); const outcome = await response.json();
  assert.equal(maxDuration, 10); assert.equal(response.status, 200);
  assert.equal(outcome.submitted, false); assert.equal(outcome.deliveryStatus, 'bundle_exported');
  assert.deepEqual(outcome.result, replayBattle(body.seed, body.moves, body.player, body.enemy));
  assert.equal(outcome.proofHash, computeProofHash(body));
  assert.equal(calls.length, 2); assert.deepEqual(limiter, [['federation:battle:unknown', 60, 3600000]]);
  assert.deepEqual(calls[0].rpc.params.arguments.draft.replayInputs, body);
});
for (const failedStage of [1, 2]) test(`actual POST returns HTTP 200 with a sanitized worker failure at stage ${failedStage}`, async t => {
  setup(t); const normal = globalThis.fetch; let count = 0;
  globalThis.fetch = async (...args) => ++count === failedStage ? new Response('private worker detail', { status: 503 }) : normal(...args);
  const response = await POST(request()); const outcome = await response.json();
  assert.equal(response.status, 200); assert.equal(outcome.submitted, false);
  assert.equal(outcome.deliveryStatus, failedStage === 1 ? 'build_failed' : 'trapper_built');
  assert.equal(outcome.reason, 'worker_http_error'); assert.equal(count, failedStage);
  assert.ok(!JSON.stringify(outcome).includes('private worker detail'));
});
test('actual POST contains rate-limiter initialization failures', async t => {
  const { calls } = setup(t);
  globalThis[limiterKey] = () => { throw Error('private Redis detail'); };
  const response = await POST(request()); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { submitted: false, deliveryStatus: 'build_failed', reason: 'internal_error' });
  assert.equal(calls.length, 0);
});
test('actual POST returns best-effort HTTP 200 on a bounded worker timeout', { timeout: 5000 }, async t => {
  setup(t); let signal;
  globalThis.fetch = async (_url, init) => { signal = init.signal; return new Promise(() => {}); };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = POST(request());
  for (let i = 0; i < 100 && !signal; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(signal); t.mock.timers.tick(2000);
  const response = await pending; assert.equal(response.status, 200);
  const outcome = await response.json();
  assert.equal(outcome.submitted, false); assert.equal(outcome.deliveryStatus, 'build_failed'); assert.equal(outcome.reason, 'worker_timeout');
  assert.equal(signal.aborted, true);
});

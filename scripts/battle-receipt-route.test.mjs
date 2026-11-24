import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBattleReceiptRequest } from '../src/lib/federation/battleReceiptHandler.ts';
import { submitBattleReceipt } from '../src/lib/federation/warperKeeperClient.ts';
const body = { seed: 7, moves: ['primary'], player: { name: 'Synthetic Player' }, enemy: { name: 'Synthetic Enemy' } };
const request = value => new Request('https://app.example/api/federation/submit-battle-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const result = { winner: 'player', turns: 1, damageDealt: 5 };
function setup(t, configuration = 'https://worker.example') {
  const previousUrl = process.env.BATTLE_TRAPPERS_URL; const previousFetch = globalThis.fetch;
  if (configuration === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = configuration;
  t.after(() => { globalThis.fetch = previousFetch; if (previousUrl === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = previousUrl; });
  globalThis.fetch = async () => { throw Error('live requests forbidden'); };
  return {
    checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
    replayBattle: () => result,
    computeProofHash: () => `sha256:${'a'.repeat(64)}`,
    submitBattleReceipt,
  };
}
for (const [configuration, status] of [[undefined, 'not_configured'], ['', 'not_configured'], ['  ', 'not_configured'], ['invalid url', 'invalid_configuration']]) {
  test(`route configuration gate ${JSON.stringify(configuration)} skips Redis, worker and replay`, async t => {
    const deps = setup(t); if (configuration === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = configuration;
    let calls = 0;
    for (const name of Object.keys(deps)) deps[name] = () => { calls++; throw Error('must not run'); };
    globalThis.fetch = () => { calls++; throw Error('must not run'); };
    const response = await handleBattleReceiptRequest(request(body), deps);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { submitted: false, deliveryStatus: status }); assert.equal(calls, 0);
  });
}
test('route preserves replay/hash inputs and forwards truthful partial status', async t => {
  const deps = setup(t); let submitted;
  deps.replayBattle = (...args) => { assert.deepEqual(args, [body.seed, body.moves, body.player, body.enemy]); return result; };
  deps.computeProofHash = input => { assert.deepEqual(input, body); return `sha256:${'a'.repeat(64)}`; };
  deps.submitBattleReceipt = async payload => { submitted = payload; return { submitted: false, deliveryStatus: 'trapper_built', trapperId: 'synthetic-artifact', reason: 'worker_timeout' }; };
  const response = await handleBattleReceiptRequest(request(body), deps); const outcome = await response.json();
  assert.equal(response.status, 200); assert.equal(outcome.submitted, false); assert.equal(outcome.deliveryStatus, 'trapper_built');
  assert.deepEqual(submitted, { battleId: '7-synthetic-player-synthetic-enemy', result, proofHash: `sha256:${'a'.repeat(64)}`, replayInputs: body, chainId: 84532 });
});
test('route contains internal exceptions without echoing private details', async t => {
  const deps = setup(t); deps.checkRateLimit = async () => { throw Error('private exception detail'); };
  const response = await handleBattleReceiptRequest(request(body), deps);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { submitted: false, deliveryStatus: 'build_failed', reason: 'internal_error' });
});
test('route preserves input rejection and rate limit behavior without reaching the worker', async t => {
  const deps = setup(t); let workerCalls = 0; deps.submitBattleReceipt = async () => { workerCalls++; throw Error('must not run'); };
  const invalid = await handleBattleReceiptRequest(request({}), deps); assert.equal(invalid.status, 400);
  deps.checkRateLimit = async () => ({ allowed: false, retryAfterMs: 2500 });
  const limited = await handleBattleReceiptRequest(request(body), deps); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '3'); assert.equal(workerCalls, 0);
});

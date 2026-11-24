import assert from 'node:assert/strict';
import test from 'node:test';
import * as client from '../src/lib/federation/warperKeeperClient.ts';
import { buildBattleTrapper, toWarperKeeperBundle } from '../worker-battle-trappers/src/contract.ts';
const payload = { battleId: 'synthetic-battle', result: { winner: 'player', turns: 2, damageDealt: 12 }, proofHash: `sha256:${'a'.repeat(64)}`, replayInputs: { seed: 1, moves: ['primary'], player: { name: 'Synthetic player' }, enemy: { name: 'Synthetic enemy' } }, chainId: 84532 };
const trapper = await buildBattleTrapper(payload);
const bundle = await toWarperKeeperBundle(trapper);
const clone = value => structuredClone(value);
const response = (request, body) => Response.json({ jsonrpc: '2.0', id: request.id, result: { isError: false, structuredContent: body } });
function setup(t, configuration = 'https://worker.example', override = () => undefined) {
  const previousUrl = process.env.BATTLE_TRAPPERS_URL; const previousFetch = globalThis.fetch;
  if (configuration === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = configuration;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const request = JSON.parse(init.body); calls.push({ url, init, request });
    return await override(calls.length, request, init) ?? response(request, calls.length === 1 ? { ok: true, trapper } : { ok: true, bundle });
  };
  t.after(() => { globalThis.fetch = previousFetch; if (previousUrl === undefined) delete process.env.BATTLE_TRAPPERS_URL; else process.env.BATTLE_TRAPPERS_URL = previousUrl; });
  return calls;
}
for (const configuration of [null, '', '   ']) test(`configuration gate: ${JSON.stringify(configuration)}`, async t => {
  const calls = setup(t, configuration ?? ''); if (configuration === null) delete process.env.BATTLE_TRAPPERS_URL;
  const result = await client.submitBattleReceipt(payload);
  assert.equal(result.submitted, false); assert.equal(result.deliveryStatus, 'not_configured'); assert.equal(calls.length, 0);
});
for (const configuration of ['not a URL', 'ftp://worker.example', 'https://name:secret@worker.example', 'https://worker.example?token=secret', 'https://worker.example#secret']) test(`invalid worker configuration: ${configuration.split(':')[0]}`, async t => {
  const calls = setup(t, configuration); const result = await client.submitBattleReceipt(payload);
  assert.equal(result.deliveryStatus, 'invalid_configuration'); assert.equal(result.submitted, false); assert.equal(calls.length, 0);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('valid worker artifacts produce a validated export, never submission or credentials', async t => {
  const calls = setup(t, 'https://worker.example/paper/'); const result = await client.submitBattleReceipt(payload);
  assert.deepEqual(result, { submitted: false, deliveryStatus: 'bundle_exported', trapperId: trapper.id, bundleId: bundle.receipt.id });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => c.request.params.name), ['build_battle_trapper', 'to_warper_keeper_bundle']);
  for (const call of calls) {
    assert.equal(call.url, 'https://worker.example/paper/mcp');
    assert.equal(call.init.credentials, 'omit'); assert.equal(call.init.redirect, 'error');
    assert.deepEqual(Object.keys(call.init.headers).sort(), ['Content-Type', 'Idempotency-Key']);
    assert.ok(call.init.signal instanceof AbortSignal);
  }
});
for (const body of [null, [], {}, { ok: false, trapper }, { ok: true }, { ok: true, trapper: { id: 'looks-successful' } }]) test(`rejects malformed successful-looking build: ${JSON.stringify(body)?.slice(0, 45)}`, async t => {
  const calls = setup(t, undefined, (stage, request) => response(request, body));
  const result = await client.submitBattleReceipt(payload); assert.equal(result.deliveryStatus, 'build_failed'); assert.equal(result.submitted, false); assert.equal(calls.length, 1);
});
for (const mutate of [
  t => { delete t.id; }, t => { t.id = ''; }, t => { t.id = 42; },
  t => { t.battle.battleId = 'other'; }, t => { t.battle.proofHash = `sha256:${'b'.repeat(64)}`; },
  t => { t.policy.walletAuthority = true; }, t => { t.receipt.hash = 'f'.repeat(64); },
]) test(`rejects malformed or mismatched trapper: ${mutate.toString()}`, async t => {
  const broken = clone(trapper); mutate(broken);
  const calls = setup(t, undefined, (stage, request) => response(request, { ok: true, trapper: broken }));
  const result = await client.submitBattleReceipt(payload); assert.equal(result.deliveryStatus, 'build_failed'); assert.equal(calls.length, 1);
});
for (const mutate of [
  b => { delete b.receipt.id; }, b => { b.receipt.id = ''; }, b => { b.receipt.id = 42; },
  b => { b.contractVersion = 'unknown'; }, b => { b.schemaVersion = 99; },
  b => { b.trapper.id = 'other'; }, b => { b.receipt.trapperId = 'other'; },
  b => { b.receipt.hash = 'bad'; }, b => { b.receipt.payload.battleTrapperHash = 'b'.repeat(64); },
  b => { b.receipt.payload.mode = 'live'; }, b => { b.receipt.hash = 'f'.repeat(64); },
  b => { b.sources = []; }, b => { b.sources[0].summary = 42; },
  b => { b.permissions = {}; }, b => { b.privacyClassification = 'unknown'; },
  b => { delete b.exportedAt; }, b => { b.capabilities = ['wallet:sign']; },
]) test(`malformed bundle cannot report export success: ${mutate.toString()}`, async t => {
  const broken = clone(bundle); mutate(broken);
  setup(t, undefined, (stage, request) => stage === 2 ? response(request, { ok: true, bundle: broken }) : undefined);
  const result = await client.submitBattleReceipt(payload);
  assert.deepEqual(result, { submitted: false, deliveryStatus: 'trapper_built', trapperId: trapper.id, reason: 'invalid_bundle' });
});
for (const body of [null, [], {}, { ok: false, bundle }, { ok: true }, { ok: true, bundle: { receipt: { id: 'looks-successful' } } }]) test(`rejects malformed successful-looking conversion: ${JSON.stringify(body)?.slice(0, 45)}`, async t => {
  setup(t, undefined, (stage, request) => stage === 2 ? response(request, body) : undefined);
  const result = await client.submitBattleReceipt(payload); assert.equal(result.deliveryStatus, 'trapper_built'); assert.equal(result.submitted, false); assert.equal(result.bundleId, undefined);
});
for (const failingStage of [1, 2]) for (const [name, failure, reason] of [
  ['HTTP error', () => new Response('private remote detail', { status: 503 }), 'worker_http_error'],
  ['network rejection', () => { throw Error('private remote detail'); }, 'worker_network_error'],
  ['invalid JSON', () => new Response('{'), 'invalid_worker_response'],
  ['RPC rejection', request => Response.json({ jsonrpc: '2.0', id: request.id, error: { code: -1, message: 'private remote detail' } }), 'worker_rejected'],
  ['tool rejection', request => Response.json({ jsonrpc: '2.0', id: request.id, result: { isError: true, content: [{ type: 'text', text: 'private remote detail' }] } }), 'worker_rejected'],
  ['wrong RPC id', request => Response.json({ jsonrpc: '2.0', id: 'wrong', result: { isError: false, structuredContent: { ok: true, trapper } } }), 'invalid_worker_response'],
]) test(`${name} at stage ${failingStage} returns a sanitized partial outcome`, async t => {
  const calls = setup(t, undefined, (stage, request) => stage === failingStage ? failure(request) : undefined);
  const result = await client.submitBattleReceipt(payload);
  assert.equal(result.deliveryStatus, failingStage === 1 ? 'build_failed' : 'trapper_built');
  assert.equal(result.reason, reason); assert.equal(result.submitted, false); assert.equal(calls.length, failingStage);
  assert.ok(!JSON.stringify(result).includes('private remote detail'));
});
for (const stage of [1, 2]) for (const wait of ['fetch', 'body']) test(`stage ${stage} ${wait} timeout is bounded even if abort is ignored`, { timeout: 5000 }, async t => {
  let signal;
  setup(t, undefined, (current, request, init) => {
    if (current !== stage) return undefined;
    signal = init.signal;
    if (wait === 'fetch') return new Promise(() => {});
    return { ok: true, json: () => new Promise(() => {}) };
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = client.submitBattleReceipt(payload);
  // Flush local crypto/validation before advancing the timer for the desired stage.
  for (let i = 0; i < 100 && !signal; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(signal);
  t.mock.timers.tick(2000);
  const result = await pending;
  assert.equal(result.deliveryStatus, stage === 1 ? 'build_failed' : 'trapper_built');
  assert.equal(result.reason, 'worker_timeout'); assert.equal(result.submitted, false); assert.equal(signal.aborted, true);
});

test('actual worker bundle with a contradictory source summary is rejected despite unchanged receipt', async t => {
  // These fixtures come from the unchanged worker builders at module load.
  let returnedBundle = bundle;
  const calls = setup(t, undefined, (_stage, request) => response(request,
    request.params.name === 'build_battle_trapper' ? { ok: true, trapper } : { ok: true, bundle: returnedBundle }));
  const original = await client.submitBattleReceipt(payload);
  assert.equal(original.deliveryStatus, 'bundle_exported'); assert.equal(original.submitted, false);
  assert.equal(original.bundleId, bundle.receipt.id);

  returnedBundle = clone(bundle);
  returnedBundle.sources[0].summary = `enemy won in 99 turns (0 damage dealt). Deterministic proof: sha256:${'b'.repeat(64)}`;
  assert.deepEqual(returnedBundle, { ...bundle, sources: [{ ...bundle.sources[0], summary: returnedBundle.sources[0].summary }] });
  assert.deepEqual(returnedBundle.receipt.payload, bundle.receipt.payload);
  assert.equal(returnedBundle.receipt.hash, bundle.receipt.hash);
  assert.equal(returnedBundle.receipt.id, bundle.receipt.id);

  const rejected = await client.submitBattleReceipt(payload);
  assert.deepEqual(rejected, { submitted: false, deliveryStatus: 'trapper_built', trapperId: trapper.id, reason: 'invalid_bundle' });
  assert.equal(Object.hasOwn(rejected, 'bundleId'), false); assert.equal(calls.length, 4);
});
for (const [name, mutate] of [
  ['missing source identity', b => { delete b.sources[0].id; }],
  ['different source identity', b => { b.sources[0].id = 'source:battle-result:another-battle'; }],
  ['different keeper', b => { b.sources[0].keeperId = 'another-keeper'; }],
  ['different kind', b => { b.sources[0].kind = 'link'; }],
  ['different title', b => { b.sources[0].title = 'Another Battle Result'; }],
  ['different winner', b => { b.sources[0].summary = b.sources[0].summary.replace('player won', 'enemy won'); }],
  ['different turns', b => { b.sources[0].summary = b.sources[0].summary.replace('2 turns', '99 turns'); }],
  ['different damage', b => { b.sources[0].summary = b.sources[0].summary.replace('12 damage', '0 damage'); }],
  ['different proof', b => { b.sources[0].summary = b.sources[0].summary.replace(payload.proofHash, `sha256:${'b'.repeat(64)}`); }],
  ['different valid creation timestamp', b => { b.sources[0].createdAt = '2000-01-01T00:00:00.000Z'; }],
  ['missing creation timestamp', b => { delete b.sources[0].createdAt; }],
  ['missing sources', b => { delete b.sources; }],
  ['duplicate battle evidence', b => { b.sources.push(clone(b.sources[0])); }],
  ['conflicting additional battle evidence', b => { b.sources.push({ ...b.sources[0], summary: 'A different battle outcome' }); }],
  ['unexpected additional source', b => { b.sources.push({ ...b.sources[0], id: 'unexpected-source' }); }],
  ['unexpected evidence excerpt', b => { b.sources[0].contentExcerpt = 'A different battle outcome'; }],
  ['unexpected evidence field', b => { b.sources[0].otherBattle = 'A different battle outcome'; }],
]) test(`bundle source binding rejects ${name}`, async t => {
  const broken = clone(bundle); mutate(broken);
  assert.notDeepEqual(broken.sources, bundle.sources);
  assert.deepEqual(broken.receipt, bundle.receipt);
  setup(t, undefined, (stage, request) => stage === 2 ? response(request, { ok: true, bundle: broken }) : undefined);
  const outcome = await client.submitBattleReceipt(payload);
  assert.deepEqual(outcome, { submitted: false, deliveryStatus: 'trapper_built', trapperId: trapper.id, reason: 'invalid_bundle' });
  assert.equal(Object.hasOwn(outcome, 'bundleId'), false);
});

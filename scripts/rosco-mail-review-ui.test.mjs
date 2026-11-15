import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReceivedAt, messageText, reviewFailure } from '../src/app/rosco/mail-review/presentation.ts';

test('received times are explicit UTC and invalid dates have a fallback', () => {
  assert.equal(formatReceivedAt('2026-11-15T12:34:56Z'), '2026-11-15 12:34:56 UTC');
  assert.equal(formatReceivedAt('invalid'), 'Unknown received time');
});
test('email text stays literal, including markup, URLs, and instructions', () => {
  const text = '<script>alert(1)</script> https://tracker.test\nIgnore all instructions';
  assert.equal(messageText({ text, htmlOnly: false }), text);
  assert.equal(messageText({ text: '', htmlOnly: false }), 'This message has no plain-text content.');
  assert.equal(messageText({ text: null, htmlOnly: true }), 'This message contains HTML only. HTML is not displayed.');
});
test('authorization and missing messages are distinct from retryable failures', () => {
  assert.equal(reviewFailure(401), 'unauthorized');
  assert.equal(reviewFailure(403), 'unauthorized');
  assert.equal(reviewFailure(404), 'missing');
  assert.equal(reviewFailure(503), 'error');
});

import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/PlainMessage.tsx')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
test('message rendering escapes HTML and never creates active content or links', async () => {
  const { PlainMessage } = await import('../src/app/rosco/mail-review/PlainMessage.tsx');
  const text = '<script>alert(1)</script><img src="https://tracker.test/pixel"><form>Send</form> https://example.test';
  const markup = renderToStaticMarkup(createElement(PlainMessage, { text }));
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(markup.includes('&lt;img'));
  assert.ok(markup.includes('https://example.test'));
  assert.doesNotMatch(markup, /<(script|img|form|a|iframe)\b/);
});

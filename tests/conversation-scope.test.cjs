const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function screenHarness() {
  let state, initialized = false, effect, authChange, resolveSession;
  const route = {};
  const session = new Promise(resolve => { resolveSession = resolve; });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/app/(tabs)/chat.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react') return {
      useState: initial => { if (!initialized) { state = initial; initialized = true; } return [state, value => { state = value; }]; },
      useEffect: callback => { effect = callback; },
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }) };
    if (name === 'expo-router') return { useLocalSearchParams: () => route };
    if (name === '@/lib/supabase') return { isSupabaseConfigured: true, supabase: { auth: {
      getSession: () => session,
      onAuthStateChange: callback => { authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    } } };
    return {};
  } });
  return {
    render: () => exports.default(),
    start: () => effect(),
    route,
    auth: id => authChange('SIGNED_IN', { user: { id } }),
    finishInitial: id => resolveSession({ data: { session: { user: { id } } } }),
  };
}

test('conversation state is isolated on thread/account changes but survives same-account token refresh', () => {
  const ui = screenHarness();
  ui.render(); const cleanup = ui.start(); ui.auth('owner-one');
  const main = ui.render();
  ui.route.thread_id = 'side-one'; const side = ui.render();
  assert.notEqual(side.key, main.key, 'a side chat must not inherit a pending reply or attachment from main');
  ui.auth('owner-one'); assert.equal(ui.render().key, side.key, 'token refresh must not discard the active draft');
  ui.auth('owner-two'); assert.notEqual(ui.render().key, side.key, 'another account must not inherit private chat state');
  cleanup();
});

test('a delayed initial session cannot replace a newer sign-in identity', async () => {
  const ui = screenHarness();
  ui.render(); const cleanup = ui.start(); ui.auth('current-owner');
  const current = ui.render().key;
  ui.finishInitial('old-owner'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.render().key, current);
  cleanup();
});

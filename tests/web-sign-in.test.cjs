const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

for (const os of ['web', 'ios']) test(`${os} Google sign-in uses the correct redirect surface without changing identity`, async () => {
  const calls = [];
  const react = { createElement:(type,props,...children)=>({type,props,children}),useEffect(){},useRef:value=>({current:value}),useState:value=>[value===true?false:value,()=>{}] };
  const rn = Object.fromEntries(['ActivityIndicator','Image','Pressable','ScrollView','Text','View'].map(name=>[name,name]));
  rn.Platform={OS:os}; rn.StyleSheet={create:styles=>styles};
  const redirect = os==='web' ? 'http://localhost:8081/auth/callback' : 'tarsai://auth/callback';
  const imports = {
    react,'react-native':rn,
    '@react-native-async-storage/async-storage':{__esModule:true,default:{removeItem:async()=>{}}},
    '@/context/ThemeContext':{useAppTheme:()=>({colors:{}})},
    '@/lib/auth':{provisionProfile:async()=>{throw new Error('Unexpected profile change');}},
    '@/lib/authRedirect':{completeAuthRedirect:async()=>{throw new Error('Unexpected callback exchange');}},
    '@/services/navigationState':{restoreDestination:async()=> '/(tabs)/chat'},
    '@/lib/supabase':{isSupabaseConfigured:true,supabase:{auth:{signInWithOAuth:async options=>{calls.push({type:'oauth',options});return {data:{url:'https://project.supabase.co/auth/v1/authorize'},error:null};}}}},
    'expo-router':{useRouter:()=>({replace(){}})},
    'expo-linking':{createURL:()=>redirect},
    'expo-web-browser':{maybeCompleteAuthSession(){},openAuthSessionAsync:async(url,callback)=>{calls.push({type:'system-auth',url,callback});return {type:'cancel'};}},
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    '../../TARS.png':0,
    '../../assets/icons/tars-dark.png':0, '../../assets/icons/tars-light.png':0,
  };
  const exports_={};
  const source=ts.transpileModule(fs.readFileSync('src/app/index.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
  vm.runInNewContext(source,{exports:exports_,React:react,require:id=>{assert.ok(id in imports,`Unexpected import ${id}`);return imports[id];}});
  const tree=exports_.default();
  const flatten=node=>node&&typeof node==='object'?[node,...(node.children||[]).flat(Infinity).flatMap(flatten)]:[];
  const button=flatten(tree).find(node=>node.type==='Pressable'&&node.props.accessibilityRole==='button');
  button.props.onPress();
  await new Promise(setImmediate);
  assert.equal(calls[0].options.provider,'google');
  assert.equal(calls[0].options.options.redirectTo,redirect);
  assert.equal(calls[0].options.options.skipBrowserRedirect,os!=='web');
  assert.equal(calls.filter(call=>call.type==='system-auth').length,os==='web'?0:1);
  if(os!=='web') assert.equal(calls[1].callback,redirect);
});

for (const os of ['web', 'ios']) test(`${os} auth client selects the intended flow and storage`, () => {
  let captured;
  const nativeStorage = {};
  const local = new Map();
  const exports_ = {};
  const source = ts.transpileModule(fs.readFileSync('src/lib/supabase.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, {
    exports: exports_, process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' } },
    localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
    require: id => {
      if (id === 'react-native') return { Platform: { OS: os } };
      if (id === '@react-native-async-storage/async-storage') return { __esModule: true, default: nativeStorage };
      if (id === '@supabase/supabase-js') return { createClient: (_url, _key, options) => { captured = options.auth; return {}; } };
      throw new Error(`Unexpected import ${id}`);
    },
  });
  assert.equal(captured.flowType, os === 'web' ? 'pkce' : 'implicit');
  assert.equal(captured.detectSessionInUrl, false);
  assert.equal(captured.persistSession, true);
  if (os === 'ios') assert.equal(captured.storage, nativeStorage);
  else assert.notEqual(captured.storage, nativeStorage);
});

test('web callback clears the address before exchanging the original one-use code', async () => {
  const events = [];
  const url = 'http://localhost:8081/auth/callback?code=test-one-use-code';
  const react = { createElement: () => ({}), useEffect: effect => effect(), useRef: value => ({ current: value }), useState: value => [value, () => {}] };
  const imports = {
    react, 'react-native': { Platform: { OS: 'web' }, StyleSheet: { create: x => x } },
    '@/context/ThemeContext': { useAppTheme: () => ({ colors: {} }) },
    '@/lib/authRedirect': { completeAuthRedirect: async received => { events.push(['exchange', received]); return { session: { user: { id: 'test-user', app_metadata: { provider: 'google' }, user_metadata: {} } } }; } },
    '@/lib/auth': { provisionProfile: async () => { events.push(['profile']); } },
    '@/services/navigationState': {restoreDestination:async()=> '/(tabs)/chat'},
    '@/lib/supabase': { supabase: { auth: {} } },
    'expo-router': { useRouter: () => ({ replace: path => events.push(['navigate', path]) }) },
    'expo-linking': { getInitialURL: async () => url, addEventListener: () => ({ remove() {} }) },
  };
  const exports_ = {};
  const source = ts.transpileModule(fs.readFileSync('src/app/auth/callback.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const pageDocument={title:'callback?code=test-one-use-code'};
  vm.runInNewContext(source, { exports: exports_, React: react, document:pageDocument, window: { location: { pathname: '/auth/callback' }, history: { state: {}, replaceState: (_state, _title, path) => events.push(['clean-address', path]) } }, require: id => { assert.ok(id in imports, `Unexpected import ${id}`); return imports[id]; } });
  exports_.default();
  await new Promise(setImmediate);
  assert.deepEqual(events, [['clean-address', '/auth/callback'], ['exchange', url], ['profile'], ['navigate', '/(tabs)/chat']]);
  assert.equal(pageDocument.title,'TARS');
});

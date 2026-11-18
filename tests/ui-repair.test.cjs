const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, URL, React: imports.react, require(id) { assert.ok(id in imports, `Unexpected import ${id}`); return imports[id]; } });
  return exports;
}

for (const os of ['ios', 'android', 'web']) test(`keyboard form uses bounded scrolling and a separate reachable footer on ${os}`, () => {
  const react = { createElement: (type, props, ...children) => ({ type, props, children }) };
  const rn = { KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', View: 'View', Platform: { OS: os }, StyleSheet: { create: value => value } };
  const animated = { View: 'AnimatedView' };
  const { KeyboardFormLayout } = load('src/components/common/KeyboardFormLayout.tsx', { react, 'react-native': rn, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
    'react-native-gesture-handler': { GestureHandlerRootView:'GestureRoot',GestureDetector:'GestureDetector',usePanGesture:config=>config },
    'react-native-worklets': { scheduleOnRN: callback => callback() },
    'react-native-reanimated': { __esModule:true,default:animated,useAnimatedStyle:callback=>callback(),useSharedValue:value=>({get:()=>value,set(){}}),withSpring:value=>value,runOnJS:callback=>callback },
    '@/context/MotionContext':{useMotionPreferences:()=>({reducedMotion:false})}, '@/context/ThemeContext':{useAppTheme:()=>({colors:{textMuted:'#888'}})},
  });
  const root = KeyboardFormLayout({ children: 'fields', footer: 'save-button' });
  const tree = root.children[0];
  assert.equal(tree.type, 'KeyboardAvoidingView');
  assert.equal(tree.props.behavior, os === 'ios' ? 'padding' : os === 'android' ? 'height' : undefined);
  const card = tree.children[0];
  assert.equal(card.props.style[0].maxHeight, '100%');
  assert.equal(card.props.style.find(style=>style?.paddingBottom!==undefined).paddingBottom, 34);
  const fields = card.children.find(child=>child?.type==='ScrollView');
  assert.equal(fields.props.keyboardShouldPersistTaps, 'handled');
  assert.equal(fields.children[0], 'fields');
  assert.equal(card.children.at(-1).children[0], 'save-button');
});

test('schedule/goals and agent editors use shared keyboard layout and synchronous save locks', () => {
  for (const [file, lock] of [['src/app/(tabs)/tasks.tsx', 'creatingRef'], ['src/components/common/EditAgentModal.tsx', 'savingRef'], ['src/app/(tabs)/ideas.tsx', 'savingRef']]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /<KeyboardFormLayout[\s\S]*footer=\{/);
    assert.match(source, new RegExp(`${lock}\\.current = true`));
    assert.match(source, new RegExp(`finally \\{ ${lock}\\.current = false`));
    assert.match(source, /catch[\s\S]*could not|catch[\s\S]*Could not/);
  }
});

test('profile dirty comparison trims values and validates names', () => {
  const { profileChanged, validateProfile } = load('src/lib/profileState.ts');
  const saved = { name: 'TARS', instructions: 'Read only' };
  assert.equal(profileChanged(saved, { name: ' TARS ', instructions: 'Read only ' }), false);
  assert.equal(profileChanged(saved, { ...saved, name: 'Ada' }), true);
  assert.ok(validateProfile({ name: ' ', instructions: '' }));
  assert.ok(validateProfile({ name: 'a'.repeat(81), instructions: '' }));
  assert.equal(validateProfile(saved), null);
});

test('all supported provider marks have distinct bundled SVGs and backend identifier aliases', () => {
  const { providerLogos } = load('src/constants/providerLogos.ts');
  const { providers, getProvider } = load('src/constants/providers.ts', { './providerLogos': { providerLogos } });
  const expected = ['Gmail', 'Slack', 'Google Calendar', 'Notion', 'Instagram', 'Reddit', 'GitHub', 'X (Twitter)', 'Trello', 'Jira'];
  assert.equal(Object.keys(providers).length, expected.length);
  assert.equal(new Set(Object.values(providerLogos)).size, expected.length);
  for (const [index, provider] of Object.values(providers).entries()) {
    assert.equal(provider.name, expected[index]);
    assert.match(provider.logo, /<svg/);
    assert.doesNotMatch(provider.logo, /<script|<foreignObject|\bon\w+=|(?:href|src)=["']https?:/i);
  }
  assert.equal(getProvider('google_calendar').name, 'Google Calendar');
  assert.equal(getProvider('x').name, 'X (Twitter)');
  assert.equal(getProvider('unknown', ' Gmail ').name, 'Gmail');
});

test('provider cards use contrasting theme names and preserve live-state action callbacks', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props, children }) };
  const rn = Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'ActivityIndicator'].map(name => [name, name]));
  rn.StyleSheet = { create: value => value };
  const { Colors, LightColors } = load('src/constants/colors.ts');
  const { providerLogos } = load('src/constants/providerLogos.ts');
  const registry = load('src/constants/providers.ts', { './providerLogos': { providerLogos } });
  const flatten = node => node && typeof node === 'object' ? [node, ...(node.children || []).flat(Infinity).flatMap(flatten)] : [];
  for (const colors of [Colors, LightColors]) {
    assert.ok(colors);
    const { ToolCard } = load('src/components/tools/ToolCard.tsx', { react, 'react-native': rn, '@hugeicons/react-native': { HugeiconsIcon: 'Icon' }, '@/constants/icons': { Settings02Icon: [] }, '@/context/ThemeContext': { useAppTheme: () => ({ colors }) }, '@/constants/providers': registry, './ProviderLogo': { ProviderLogo: 'ProviderLogo' } });
    for (const slug of Object.keys(registry.providers)) {
      let connected = false, disconnected = false;
      const tool = { id: slug, slug, toolkit_slug: slug, name: '', description: 'A long description '.repeat(30), status: 'disconnected', enabled: true };
      const tree = ToolCard({ tool, onConnect: () => { connected = true; } });
      assert.equal(tree.props.style.backgroundColor, colors.surface);
      const nodes = flatten(tree);
      const name = nodes.find(node => node.type === 'Text' && node.children.includes(registry.providers[slug].name));
      assert.equal(name.props.style.color, colors.textPrimary);
      assert.notEqual(name.props.style.color, tree.props.style.backgroundColor);
      nodes.find(node => node.type === 'TouchableOpacity').props.onPress();
      assert.equal(connected, true);
      const active = ToolCard({ tool: { ...tool, status: 'connected' }, onDisconnect: () => { disconnected = true; } });
      flatten(active).find(node => node.type === 'TouchableOpacity').props.onPress();
      assert.equal(disconnected, true);
    }
  }
});

test('avatar commits a new photo only after upload, preview and profile acknowledgment', async () => {
  const { commitAvatar } = load('src/lib/avatarPersistence.ts');
  const calls = [];
  const gateway = Object.fromEntries(['upload', 'signedUrl', 'updateProfile', 'referenced', 'remove'].map(key => [key, async () => { calls.push(key); return key === 'signedUrl' ? 'signed-url' : false; }]));
  assert.equal((await commitAvatar('owner/new-photo.png', gateway)).path, 'owner/new-photo.png');
  assert.deepEqual(calls, ['upload', 'signedUrl', 'updateProfile']);
  for (const stage of ['upload', 'signedUrl', 'updateProfile']) {
    calls.length = 0;
    await assert.rejects(commitAvatar('owner/new-photo.png', { ...gateway, [stage]: async () => { throw new Error('Failure'); } }), /Failure/);
    assert.equal(calls.at(-1), 'remove');
  }
  for (const referenced of [async () => true, async () => { throw new Error('Unknown write outcome'); }]) {
    calls.length = 0;
    await assert.rejects(commitAvatar('owner/new-photo.png', { ...gateway, updateProfile: async () => { throw new Error('Failure'); }, referenced }));
    assert.ok(!calls.includes('remove'));
  }
});

test('browser view requires an active, unexpired provider URL and rejects private source URLs', () => {
  const { availableBrowser, publicSourceUrl } = load('supabase/functions/_shared/execution.ts');
  const now = Date.now();
  const run = { status: 'running', metadata: { execution: { version: 1, activity: 'Reading', steps: [], browser: { available: true, expiresAt: new Date(now + 10000).toISOString(), liveUrl: 'https://www.browserbase.com/sessions/test' } } } };
  assert.ok(availableBrowser(run, now));
  assert.ok(availableBrowser({ ...run, status: 'completed' }, now));
  assert.equal(availableBrowser({ ...run, status: 'failed' }, now), null);
  assert.equal(availableBrowser(run, now + 20000), null);
  for (const value of ['invalid', '2020-01-01']) { run.metadata.execution.browser.expiresAt = value; assert.equal(availableBrowser(run, now), null); }
  for (const url of ['https://[::1]', 'https://127.0.0.1', 'https://localhost', 'file:///tmp/file', 'https://user:pass@example.com']) assert.equal(publicSourceUrl(url), null);
  assert.ok(publicSourceUrl('https://example.com'));
});

test('execution cards sort between the actual user message and final reply', () => {
  const { chatTimeline } = load('src/lib/chatTimeline.ts');
  const timeline = chatTimeline([{ id: 'user', createdAt: '2026-10-26T10:00:00Z' }, { id: 'reply', createdAt: '2026-10-26T10:00:03Z' }], [{ id: 'browser', created_at: '2026-10-26T10:00:01Z' }]);
  assert.equal(timeline.map(item => item.kind).join(','), 'message,execution,message');
});

test('assistant replies render lists, bold and code without enabling unsafe links or HTML', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props, children }) };
  const rn = { Text: 'Text', View: 'View', StyleSheet: { create: x => x }, Linking: { openURL: () => { throw new Error('No link should open during render'); } } };
  const { publicSourceUrl } = load('supabase/functions/_shared/execution.ts');
  const { AssistantText } = load('src/components/chat/AssistantText.tsx', { react, 'react-native': { ...rn, Platform: { OS: 'web' }, ScrollView: 'ScrollView', Pressable: 'Pressable' }, 'expo-clipboard': { setStringAsync: async () => {} }, '@/context/ThemeContext': { useAppTheme: () => ({ colors: {} }) }, '@/context/ToastContext': { showToast() {} }, '@/lib/responseBlocks': load('src/lib/responseBlocks.ts'), '@/types/execution': { publicSourceUrl } });
  const tree = AssistantText({text:'* **Reddit:** `false`\n[Docs](https://example.com)\n[bad](https://localhost)\n<script>alert(1)</script>\n*Emphasis*',color:'#fff',linkColor:'#abc'});
  const flatten = node => node && typeof node === 'object' ? [node, ...(node.children || []).flat(Infinity).flatMap(flatten)] : [];
  const nodes = flatten(tree);
  assert.ok(nodes.some(node => node.props?.style?.fontWeight === '700' && node.children[0] === 'Reddit:'));
  assert.ok(nodes.some(node => node.props?.style?.fontFamily === 'monospace' && node.children[0] === 'false'));
  const links = nodes.filter(node => node.props?.accessibilityRole === 'link');
  assert.equal(links.length, 1);
  assert.equal(links[0].children[0], 'Docs');
  assert.ok(JSON.stringify(tree).includes('<script>alert(1)</script>'));
  assert.ok(nodes.some(node => node.props?.style?.fontStyle === 'italic' && node.children[0] === 'Emphasis'));
});


test('native press feedback uses a supported timing function and respects reduced motion', () => {
  for(const reducedMotion of [false,true]) {
    const react={createElement:(type,props,...children)=>({type,props,children}),useState:()=>[true,()=>{}]};
    const {MotionPressable}=load('src/components/common/MotionPressable.tsx',{react,'react-native':{Pressable:'Pressable'},'react-native-reanimated':{__esModule:true,default:{View:'AnimatedView'}},'@/context/MotionContext':{useMotionPreferences:()=>({reducedMotion})},'@/lib/haptics':{selectionFeedback(){}}});
    const style=MotionPressable({children:'Button'}).props.style[1];
    assert.ok(['linear','ease','ease-in','ease-out','ease-in-out','step-start','step-end'].includes(style.transitionTimingFunction));
    assert.equal(style.transform[0].scale,reducedMotion?1:0.97);
  }
});


test('theme text and primary controls meet small-text contrast in both appearances', () => {
  const {Colors,LightColors}=load('src/constants/colors.ts');
  const lum=hex=>{const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
  const contrast=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);
  for(const colors of [Colors,LightColors])for(const [fg,bg] of [['textPrimary','surface'],['textSecondary','surface'],['textMuted','background'],['textLink','surface'],['textLink','primarySubtle'],['onPrimary','primary'],['chatBubbleUserText','chatBubbleUser']]) assert.ok(contrast(colors[fg],colors[bg])>=4.5,`${fg}/${bg}: ${contrast(colors[fg],colors[bg]).toFixed(2)}`);
});

test('iOS system tabs preserve all five product destinations with native symbols and labels', () => {
  const react={createElement:(type,props,...children)=>({type,props,children})};
  const Trigger=Object.assign(()=>{}, {Icon:'Icon',Label:'Label'});const NativeTabs=Object.assign(()=>{}, {Trigger});
  const {IOSTabs}=load('src/components/common/IOSTabs.tsx',{react,'expo-router/native-tabs':{NativeTabs},'@/context/ThemeContext':{useAppTheme:()=>({colors:{primary:'#0064D8'},resolved:'light'})},'@/context/MotionContext':{useMotionPreferences:()=>({reducedTransparency:true})},'@/lib/haptics':{selectionFeedback(){}}});
  const root=IOSTabs();assert.deepEqual(root.children.filter(child=>!child.props.hidden).map(child=>child.props.name),['chat','feed','ideas','tasks','settings']);assert.equal(root.props.blurEffect,'none');
});

test('completed execution cards collapse provider payloads while keeping live browser reachable',()=>{
  const react={createElement:(type,props,...children)=>({type,props,children}),useEffect(){},useState:value=>[typeof value==='function'?value():value,()=>{}]};
  const rn={ActivityIndicator:'Spinner',Linking:{openURL(){}},Pressable:'Button',Text:'Text',View:'View',StyleSheet:{hairlineWidth:1,create:value=>value}};
  const execution=load('supabase/functions/_shared/execution.ts');
  const preview=load('supabase/functions/_shared/servicePreview.ts',{'./execution.ts':execution});
  const {ExecutionCard}=load('src/components/chat/ExecutionCard.tsx',{react,'react-native':rn,'@/context/ThemeContext':{useAppTheme:()=>({colors:{}})},'@/types/execution':execution,'./RouteCard':{RouteCard:'RouteCard'},'./PlaceResults':{PlaceResults:'PlaceResults'},'./ServiceResultPreview':{ServiceResultPreview:'ServicePreview'},'../../../supabase/functions/_shared/servicePreview':preview,'./LiveBrowserView':{LiveBrowserView:'LiveBrowserView'},'@/lib/supabase':{supabase:{}}});
  const now=Date.parse('2026-11-02T12:00:00Z');const run={status:'completed',action_name:'browse_page',created_at:'2026-11-02T12:00:00Z',metadata:{provider:'browserbase',logId:'PRIVATE-LOG',execution:{version:1,phase:'completed',activity:'Read page',steps:[],result:{title:'Actual page',excerpt:'LONG PROVIDER EXCERPT'},browser:{available:true,liveUrl:'https://www.browserbase.com/test-view',expiresAt:'2026-11-02T12:00:45Z'}}}};
  const root=ExecutionCard({run,now});const rendered=JSON.stringify(root);assert.ok(!rendered.includes('LONG PROVIDER EXCERPT'));assert.ok(!rendered.includes('PRIVATE-LOG'));assert.ok(rendered.includes('Open Live Browser'));
});


test('iOS tab screens reserve native bottom safe area around fixed controls as well as scroll content',()=>{
 const react={createElement:(type,props,...children)=>({type,props,children})};
 for(const OS of ['ios','android','web']){
  const {TabScreen}=load('src/components/common/TabScreen.tsx',{react,'react-native':{Platform:{OS},View:'View'},'react-native-screens/experimental':{SafeAreaView:'NativeSafeArea'}});
  const root=TabScreen({children:'composer'});assert.equal(root.type,OS==='ios'?'NativeSafeArea':'View');if(OS==='ios')assert.equal(root.props.edges.bottom,true);
 }
 const source=fs.readFileSync('src/components/common/IOSTabs.tsx','utf8');assert.equal((source.match(/disableAutomaticContentInsets/g)||[]).length,6);
});

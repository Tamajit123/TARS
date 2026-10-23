import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Idea = { id: string; title: string; description: string; category: string; created_at: string; updated_at: string };
const LOCAL_IDEAS_KEY = 'tars:ideas:v1';

export default function IdeasScreen() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured) {
      setIdeas(JSON.parse(await AsyncStorage.getItem(LOCAL_IDEAS_KEY) || '[]') as Idea[]);
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIdeas([]); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from('ideas').select('id,title,description,category,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false });
    if (loadError) setError('Ideas could not be loaded. Try again later.');
    setIdeas((data || []) as Idea[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadIdeas(); }, [loadIdeas]);
  const filteredIdeas = useMemo(() => ideas.filter((idea) => `${idea.title} ${idea.description}`.toLowerCase().includes(search.toLowerCase())), [ideas, search]);

  const openEditor = (idea?: Idea) => {
    setEditing(idea || null);
    setTitle(idea?.title || '');
    setDescription(idea?.description || '');
    setError('');
    setEditorOpen(true);
  };

  const saveIdea = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) { setError('Give your idea a short title.'); return; }
    setSaving(true);
    try {
      if (!isSupabaseConfigured) {
        const now = new Date().toISOString();
        const next: Idea = editing ? { ...editing, title: cleanTitle, description: description.trim(), updated_at: now } : { id: `local-${Date.now()}`, title: cleanTitle, description: description.trim(), category: 'General', created_at: now, updated_at: now };
        const nextIdeas = editing ? ideas.map((idea) => idea.id === editing.id ? next : idea) : [next, ...ideas];
        setIdeas(nextIdeas);
        await AsyncStorage.setItem(LOCAL_IDEAS_KEY, JSON.stringify(nextIdeas));
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Sign in again to save ideas.');
        const result = editing
          ? await supabase.from('ideas').update({ title: cleanTitle, description: description.trim() }).eq('id', editing.id).eq('user_id', user.id).select().single()
          : await supabase.from('ideas').insert({ user_id: user.id, title: cleanTitle, description: description.trim() }).select().single();
        if (result.error) throw result.error;
        await loadIdeas();
      }
      setEditorOpen(false);
    } catch {
      setError('The idea could not be saved. Check your connection and try again.');
    } finally { setSaving(false); }
  };

  const deleteIdea = (idea: Idea) => Alert.alert('Delete this idea?', `“${idea.title}” will be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      if (!isSupabaseConfigured) {
        const nextIdeas = ideas.filter((item) => item.id !== idea.id);
        setIdeas(nextIdeas);
        await AsyncStorage.setItem(LOCAL_IDEAS_KEY, JSON.stringify(nextIdeas));
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: deleteError } = await supabase.from('ideas').delete().eq('id', idea.id).eq('user_id', user.id);
      if (deleteError) { setError('Could not delete that idea. Try again.'); return; }
      setIdeas((current) => current.filter((item) => item.id !== idea.id));
    })(); } },
  ]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}><View><Text style={styles.eyebrow}>KEEP THE SPARK</Text><Text style={styles.title}>Ideas</Text></View><Pressable onPress={() => openEditor()} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add idea"><Text style={styles.addText}>＋</Text></Pressable></View>
        <Text style={styles.subtitle}>A place for the thoughts you want to come back to.</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search your ideas" placeholderTextColor={Colors.textMuted} style={styles.search} accessibilityLabel="Search ideas" />
        {loading ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : error ? <Text style={styles.error}>{error}</Text> : filteredIdeas.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyEyebrow}>FIELD NOTES</Text><Text style={styles.emptyTitle}>{search ? 'No matching ideas' : 'A clear page'}</Text><Text style={styles.emptyBody}>{search ? 'Try another search.' : 'Capture a thought now. You can shape it into a plan later.'}</Text>{!search && <Pressable onPress={() => openEditor()} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Capture an idea</Text></Pressable>}</View>
        ) : filteredIdeas.map((idea, index) => <View key={idea.id} style={[styles.idea, index === 0 && styles.firstIdea]}><Pressable onPress={() => openEditor(idea)} style={styles.ideaBody}><Text style={styles.category}>{idea.category || 'GENERAL'} · {new Date(idea.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text><Text style={styles.ideaTitle}>{idea.title}</Text>{idea.description ? <Text style={styles.ideaDescription}>{idea.description}</Text> : null}</Pressable><Pressable onPress={() => deleteIdea(idea)} style={styles.deleteButton} accessibilityLabel={`Delete ${idea.title}`}><Text style={styles.deleteText}>···</Text></Pressable></View>)}
      </ScrollView>
      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.sheet}><Text style={styles.sheetEyebrow}>{editing ? 'REFINE YOUR NOTE' : 'CAPTURE A THOUGHT'}</Text><Text style={styles.sheetTitle}>{editing ? 'Edit idea' : 'New idea'}</Text><TextInput value={title} onChangeText={setTitle} placeholder="Give it a name" placeholderTextColor={Colors.textMuted} style={styles.modalInput} maxLength={160} accessibilityLabel="Idea title" /><TextInput value={description} onChangeText={setDescription} placeholder="Add a little context…" placeholderTextColor={Colors.textMuted} style={[styles.modalInput, styles.descriptionInput]} multiline textAlignVertical="top" maxLength={5000} accessibilityLabel="Idea details" />{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.modalActions}><Pressable onPress={() => setEditorOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={saveIdea} disabled={saving} style={styles.saveButton}>{saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.saveText}>Save idea</Text>}</Pressable></View></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 38 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: Colors.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: '700' }, title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 8 }, subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  addButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }, addText: { color: Colors.background, fontSize: 26, fontWeight: '400', marginTop: -3 },
  search: { height: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.surface, paddingHorizontal: 15, color: Colors.textPrimary, fontSize: 14, marginBottom: 20 }, loader: { marginTop: 54 }, error: { color: Colors.error, fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  empty: { alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 20, padding: 28, marginTop: 10 }, emptyEyebrow: { color: Colors.primary, letterSpacing: 2, fontSize: 10, fontWeight: '700' }, emptyTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '700', marginTop: 13 }, emptyBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 }, emptyButton: { marginTop: 20, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.primarySubtle }, emptyButtonText: { color: Colors.primaryLight, fontWeight: '700', fontSize: 13 },
  idea: { flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingVertical: 18 }, firstIdea: { borderTopColor: Colors.border }, ideaBody: { flex: 1 }, category: { color: Colors.primaryLight, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 }, ideaTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 8, lineHeight: 22 }, ideaDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 6 }, deleteButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, deleteText: { color: Colors.textMuted, fontSize: 22, marginTop: -11 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay }, sheet: { backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 34, borderWidth: 1, borderColor: Colors.border }, sheetEyebrow: { color: Colors.primaryLight, fontSize: 10, fontWeight: '700', letterSpacing: 1.7 }, sheetTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 18 }, modalInput: { minHeight: 50, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.textPrimary, borderRadius: 13, paddingHorizontal: 14, fontSize: 14, marginBottom: 12 }, descriptionInput: { height: 115, paddingTop: 13 }, modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 }, cancelButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 14 }, cancelText: { color: Colors.textPrimary, fontWeight: '700' }, saveButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 14 }, saveText: { color: Colors.background, fontWeight: '800' },
});

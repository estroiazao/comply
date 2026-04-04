import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, RefreshControl, Linking
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const API = 'https://comply.up.railway.app';

const C = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8', ink:'#1a1714',
  red:'#d94f3d', blue:'#2b5fc9', green:'#2a7d4f', yellow:'#c49a0a',
  purple:'#7c3aed', muted:'#8c7e6a', gold:'#c49a0a',
};

const CATEGORIES = [
  { key:'all',       label:'All',       icon:'📁' },
  { key:'tax',       label:'Tax',       icon:'🧾' },
  { key:'license',   label:'Licenses',  icon:'📋' },
  { key:'payroll',   label:'Payroll',   icon:'💰' },
  { key:'insurance', label:'Insurance', icon:'🛡️' },
  { key:'general',   label:'General',   icon:'📂' },
];

type Doc = {
  id: number;
  name: string;
  category: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  signed_url: string;
  deadline_id: number | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function fileIcon(fileType: string): string {
  if (fileType.includes('pdf'))   return '📄';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
  if (fileType.includes('word') || fileType.includes('document'))     return '📝';
  return '📎';
}

export default function DocumentsScreen() {
  const [docs, setDocs]               = useState<Doc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [totalSize, setTotalSize]     = useState(0);

  const loadDocs = async () => {
    try {
      const url = activeCategory === 'all'
        ? `${API}/api/documents`
        : `${API}/api/documents?category=${activeCategory}`;
      const res  = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocs(data);
        setTotalSize(data.reduce((sum: number, d: Doc) => sum + (d.file_size || 0), 0));
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadDocs(); }, [activeCategory]);

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      setUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri:  file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);
      formData.append('category', activeCategory === 'all' ? 'general' : activeCategory);

      const res = await fetch(`${API}/api/documents/upload`, {
        method:      'POST',
        credentials: 'include',
        body:        formData,
      });

      if (res.ok) {
        Alert.alert('Uploaded! ✅', `${file.name} has been saved.`);
        await loadDocs();
      } else {
        Alert.alert('Error', 'Upload failed. Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async (doc: Doc) => {
    try {
      if (doc.signed_url) {
        await Linking.openURL(doc.signed_url);
      } else {
        // Get fresh signed URL
        const res  = await fetch(`${API}/api/documents/${doc.id}/url`, { credentials: 'include' });
        const data = await res.json();
        if (data.url) await Linking.openURL(data.url);
      }
    } catch {
      Alert.alert('Error', 'Could not open file.');
    }
  };

  const deleteDoc = (doc: Doc) => {
    Alert.alert(
      'Delete document',
      `Delete "${doc.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API}/api/documents/${doc.id}`, {
                method: 'DELETE', credentials: 'include'
              });
              await loadDocs();
            } catch {
              Alert.alert('Error', 'Could not delete file.');
            }
          }
        }
      ]
    );
  };

  const usedMB   = (totalSize / 1024 / 1024).toFixed(1);
  const limitMB  = 500;
  const usedPct  = Math.min((totalSize / 1024 / 1024 / limitMB) * 100, 100);

  return (
    <View style={styles.flex}>

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📁 Documents</Text>
          <Text style={styles.headerSub}>Your compliance files, all in one place</Text>
        </View>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
          onPress={pickAndUpload}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator color={C.ink} size="small" />
            : <Text style={styles.uploadBtnText}>+ Upload</Text>
          }
        </TouchableOpacity>
      </View>

      {/* STORAGE BAR */}
      <View style={styles.storageBar}>
        <View style={styles.storageInfo}>
          <Text style={styles.storageText}>💾 {usedMB} MB used of {limitMB} MB</Text>
          <Text style={styles.storageText}>{docs.length} file{docs.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.storageTrack}>
          <View style={[styles.storageFill, { width: `${usedPct}%` as any }]} />
        </View>
      </View>

      {/* CATEGORY FILTER */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catChip, activeCategory === cat.key && styles.catChipActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={styles.catIcon}>{cat.icon}</Text>
            <Text style={[styles.catLabel, activeCategory === cat.key && styles.catLabelActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* DOCUMENTS LIST */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.ink} size="large" /></View>
      ) : (
        <ScrollView
          style={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDocs(); }} />}
        >
          {docs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptySub}>
                Upload your tax receipts, invoices, licenses and contracts — all in one secure place.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={pickAndUpload}>
                <Text style={styles.emptyBtnText}>Upload your first document →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Group by category */}
              {(activeCategory === 'all'
                ? [...new Set(docs.map(d => d.category))]
                : [activeCategory]
              ).map(cat => {
                const catDocs = docs.filter(d => d.category === cat);
                if (catDocs.length === 0) return null;
                const catInfo = CATEGORIES.find(c => c.key === cat) || { icon: '📂', label: cat };
                return (
                  <View key={cat} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupIcon}>{catInfo.icon}</Text>
                      <Text style={styles.groupLabel}>{catInfo.label}</Text>
                      <View style={styles.groupCount}>
                        <Text style={styles.groupCountText}>{catDocs.length}</Text>
                      </View>
                    </View>
                    {catDocs.map(doc => (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.docRow}
                        onPress={() => openDoc(doc)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.docIcon}>{fileIcon(doc.file_type)}</Text>
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                          <Text style={styles.docMeta}>
                            {formatSize(doc.file_size)} · {formatDate(doc.uploaded_at)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => deleteDoc(doc)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              <View style={{ height: 20 }} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:              { flex: 1, backgroundColor: C.bg },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header:            { backgroundColor: C.ink, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle:       { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub:         { fontSize: 11, color: '#555', marginTop: 2 },
  uploadBtn:         { backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText:     { color: C.ink, fontSize: 13, fontWeight: '700' },
  storageBar:        { backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.ruled },
  storageInfo:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  storageText:       { fontSize: 11, color: C.muted },
  storageTrack:      { height: 4, backgroundColor: C.ruled, borderRadius: 4, overflow: 'hidden' },
  storageFill:       { height: '100%', backgroundColor: C.green, borderRadius: 4 },
  catBar:            { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.ruled, paddingVertical: 10, paddingHorizontal: 12 },
  catChip:           { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: C.bg },
  catChipActive:     { backgroundColor: C.ink, borderColor: C.ink },
  catIcon:           { fontSize: 14 },
  catLabel:          { fontSize: 12, color: C.muted },
  catLabelActive:    { color: '#fff' },
  body:              { flex: 1, padding: 14 },
  emptyWrap:         { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon:         { fontSize: 52, marginBottom: 12 },
  emptyTitle:        { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8 },
  emptySub:          { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:          { backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 14 },
  emptyBtnText:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  group:             { marginBottom: 16 },
  groupHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupIcon:         { fontSize: 16 },
  groupLabel:        { fontSize: 13, fontWeight: '600', color: C.ink, flex: 1 },
  groupCount:        { backgroundColor: C.ink, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  groupCountText:    { color: '#fff', fontSize: 10 },
  docRow:            { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  docIcon:           { fontSize: 24 },
  docInfo:           { flex: 1 },
  docName:           { fontSize: 13, fontWeight: '500', color: C.ink, marginBottom: 2 },
  docMeta:           { fontSize: 11, color: C.muted },
  deleteBtn:         { padding: 4 },
  deleteBtnText:     { fontSize: 16 },
});
import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView,
  Platform, Switch, Alert, FlatList
} from 'react-native';

const API = 'https://comply.up.railway.app';

const C = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8', ink:'#1a1714',
  red:'#d94f3d', blue:'#2b5fc9', green:'#2a7d4f', yellow:'#c49a0a',
  purple:'#7c3aed', muted:'#8c7e6a', gold:'#c49a0a',
};

const SPECIALTIES = [
  'Tax Filing', 'VAT/GST', 'Payroll', 'Bookkeeping',
  'Company Formation', 'International Tax', 'Audit', 'Financial Planning',
];

type Accountant = {
  id: number;
  user_id: number;
  display_name: string;
  bio: string;
  country: string;
  languages: string;
  specialties: string;
  years_experience: number;
  certifications: string;
  price_month: number;
  contact_email: string;
  contact_whatsapp: string;
  verified: number;
  created_at: string;
};

type Message = {
  id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  created_at: string;
  read: number;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AccountantsScreen() {
  const [view, setView]                   = useState<'browse'|'chat'|'profile_form'|'inbox'>('browse');
  const [accountants, setAccountants]     = useState<Accountant[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<Accountant|null>(null);
  const [myProfile, setMyProfile]         = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number>(0);

  // Filters
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSpec, setFilterSpec]       = useState('');

  // Chat
  const [messages, setMessages]   = useState<Message[]>([]);
  const [msgInput, setMsgInput]   = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending]     = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Profile form
  const [form, setForm] = useState({
    display_name: '', bio: '', country: '', languages: '',
    specialties: '', years_experience: '', certifications: '',
    price_month: '', contact_email: '', contact_whatsapp: '',
  });
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAccountants = async () => {
    setLoading(true);
    try {
      let url = `${API}/api/accountants`;
      const params = [];
      if (filterCountry) params.push(`country=${encodeURIComponent(filterCountry)}`);
      if (filterSpec)    params.push(`specialty=${encodeURIComponent(filterSpec)}`);
      if (params.length) url += '?' + params.join('&');
      const res  = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) setAccountants(data);
    } catch {}
    finally { setLoading(false); }
  };

  const loadMyProfile = async () => {
    try {
      const res  = await fetch(`${API}/api/accountants/me`, { credentials: 'include' });
      const data = await res.json();
      setMyProfile(data);
      if (data.exists) {
        setForm({
          display_name:     data.display_name || '',
          bio:              data.bio || '',
          country:          data.country || '',
          languages:        data.languages || '',
          specialties:      data.specialties || '',
          years_experience: String(data.years_experience || ''),
          certifications:   data.certifications || '',
          price_month:      String(data.price_month || ''),
          contact_email:    data.contact_email || '',
          contact_whatsapp: data.contact_whatsapp || '',
        });
        setSelectedSpecs((data.specialties || '').split(',').map((s: string) => s.trim()).filter(Boolean));
      }
    } catch {}
  };

  const loadCurrentUser = async () => {
    try {
      const res  = await fetch(`${API}/api/me`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setCurrentUserId(data.id);
    } catch {}
  };

  const loadMessages = async (accountant: Accountant) => {
    setMsgLoading(true);
    try {
      const res  = await fetch(`${API}/api/accountants/${accountant.id}/messages`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch {}
    finally { setMsgLoading(false); }
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !selected) return;
    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');
    try {
      const res = await fetch(`${API}/api/accountants/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, data]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {}
    finally { setSending(false); }
  };

  const saveProfile = async () => {
    if (!form.display_name) { Alert.alert('Error', 'Display name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/accountants/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          specialties: selectedSpecs.join(', '),
          years_experience: parseInt(form.years_experience) || 0,
          price_month: parseFloat(form.price_month) || 0,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('Saved! 🎉', 'Your accountant profile is now live.');
        await loadMyProfile();
        await loadAccountants();
        setView('browse');
      }
    } catch { Alert.alert('Error', 'Could not save profile.'); }
    finally { setSaving(false); }
  };

  const toggleSpec = (spec: string) => {
    setSelectedSpecs(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  useEffect(() => {
    loadAccountants();
    loadMyProfile();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (filterCountry !== undefined) loadAccountants();
  }, [filterCountry, filterSpec]);

  const openChat = async (accountant: Accountant) => {
    setSelected(accountant);
    setView('chat');
    await loadMessages(accountant);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 300);
  };

  // ── BROWSE VIEW ────────────────────────────────────────────────────────────
  if (view === 'browse') {
    return (
      <View style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>👔 Find an Accountant</Text>
            <Text style={styles.headerSub}>Verified professionals for your business</Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setView('profile_form')}
          >
            <Text style={styles.headerBtnText}>
              {myProfile?.exists ? 'Edit Profile' : 'Join as Accountant'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <TextInput
            style={styles.filterInput}
            placeholder="🌍 Filter by country..."
            placeholderTextColor={C.muted}
            value={filterCountry}
            onChangeText={setFilterCountry}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specFilters}>
            {['All', ...SPECIALTIES].map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.specChip, filterSpec===(s==='All'?'':s) && styles.specChipActive]}
                onPress={() => setFilterSpec(s === 'All' ? '' : s)}
              >
                <Text style={[styles.specChipText, filterSpec===(s==='All'?'':s) && styles.specChipTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.ink} size="large" /></View>
        ) : accountants.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👔</Text>
            <Text style={styles.emptyTitle}>No accountants yet</Text>
            <Text style={styles.emptySub}>Be the first to list your services on COMPLY.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => setView('profile_form')}>
              <Text style={styles.btnText}>Join as Accountant →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.body}>
            {accountants.map(acc => (
              <TouchableOpacity
                key={acc.id}
                style={styles.accountantCard}
                onPress={() => openChat(acc)}
                activeOpacity={0.85}
              >
                {/* Avatar + verified */}
                <View style={styles.cardLeft}>
                  <View style={styles.accAvatar}>
                    <Text style={styles.accAvatarText}>
                      {acc.display_name[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  {acc.verified ? (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>✓</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.accName}>{acc.display_name}</Text>
                    <Text style={styles.accPrice}>
                      {acc.price_month > 0 ? `€${acc.price_month}/mo` : 'Contact for price'}
                    </Text>
                  </View>
                  <Text style={styles.accCountry}>📍 {acc.country} · {acc.years_experience}y exp</Text>
                  {acc.bio ? (
                    <Text style={styles.accBio} numberOfLines={2}>{acc.bio}</Text>
                  ) : null}
                  {/* Specialties */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specRow}>
                    {(acc.specialties || '').split(',').filter(Boolean).map(s => (
                      <View key={s} style={styles.specTag}>
                        <Text style={styles.specTagText}>{s.trim()}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  {/* Languages + certs */}
                  <View style={styles.cardMeta}>
                    {acc.languages ? <Text style={styles.metaText}>🗣 {acc.languages}</Text> : null}
                    {acc.certifications ? <Text style={styles.metaText}>🎓 {acc.certifications}</Text> : null}
                  </View>
                </View>

                {/* Chat arrow */}
                <View style={styles.chatArrow}>
                  <Text style={styles.chatArrowText}>💬</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>
    );
  }

  // ── CHAT VIEW ──────────────────────────────────────────────────────────────
  if (view === 'chat' && selected) {
    const isAccountant = selected.user_id === currentUserId;
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Chat header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setView('browse')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatAvatar}>
              <Text style={styles.chatAvatarText}>
                {selected.display_name[0]?.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.chatName}>{selected.display_name}</Text>
              <Text style={styles.chatSub}>
                📍 {selected.country} · {selected.years_experience}y exp
                {selected.price_month > 0 ? ` · €${selected.price_month}/mo` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile summary strip */}
        <View style={styles.chatProfileStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(selected.specialties||'').split(',').filter(Boolean).map(s => (
              <View key={s} style={styles.specTag}>
                <Text style={styles.specTagText}>{s.trim()}</Text>
              </View>
            ))}
          </ScrollView>
          {selected.certifications ? (
            <Text style={styles.stripCert}>🎓 {selected.certifications}</Text>
          ) : null}
        </View>

        {/* Messages */}
        {msgLoading ? (
          <View style={styles.center}><ActivityIndicator color={C.ink} /></View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messagesWrap}
            contentContainerStyle={{ padding: 14 }}
          >
            {messages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <Text style={styles.chatEmptyIcon}>💬</Text>
                <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
                <Text style={styles.chatEmptySub}>
                  Introduce your business and ask {selected.display_name} how they can help you.
                </Text>
              </View>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <View key={msg.id} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                      {!isMe && (
                        <Text style={styles.msgSender}>{msg.sender_name || selected.display_name}</Text>
                      )}
                      <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.message}</Text>
                      <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                        {timeAgo(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Pricing disclaimer */}
        {selected.price_month > 0 && (
          <View style={styles.pricingBanner}>
            <Text style={styles.pricingBannerText}>
              💼 This accountant charges €{selected.price_month}/month · Agree terms before starting
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.msgInput}
            placeholder="Type a message..."
            placeholderTextColor={C.muted}
            value={msgInput}
            onChangeText={setMsgInput}
            multiline
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!msgInput.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!msgInput.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnText}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── PROFILE FORM VIEW ──────────────────────────────────────────────────────
  if (view === 'profile_form') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setView('browse')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formHeaderTitle}>
            {myProfile?.exists ? 'Edit Your Profile' : 'Become an Accountant'}
          </Text>
        </View>

        {/* Simulated pricing banner */}
        <View style={styles.pricingCard}>
          <Text style={styles.pricingTitle}>💼 COMPLY Pro Accountant</Text>
          <Text style={styles.pricingPrice}>€29 / month</Text>
          <Text style={styles.pricingDesc}>
            Get listed to thousands of businesses · Unlimited client messages · Verified badge
          </Text>
          <View style={styles.pricingNote}>
            <Text style={styles.pricingNoteText}>
              🎉 Free during beta — Stripe billing coming soon
            </Text>
          </View>
        </View>

        <ScrollView style={styles.body}>
          <View style={styles.formCard}>
            <Field label="Display Name *" value={form.display_name} onChange={v => setForm(f => ({...f, display_name:v}))} placeholder="e.g. Maria Silva, CPA" />
            <Field label="Bio" value={form.bio} onChange={v => setForm(f => ({...f, bio:v}))} placeholder="Tell businesses what you do and your experience..." multiline />
            <Field label="Country" value={form.country} onChange={v => setForm(f => ({...f, country:v}))} placeholder="e.g. Portugal" />
            <Field label="Languages" value={form.languages} onChange={v => setForm(f => ({...f, languages:v}))} placeholder="e.g. Portuguese, English, Spanish" />
            <Field label="Years of Experience" value={form.years_experience} onChange={v => setForm(f => ({...f, years_experience:v}))} placeholder="e.g. 8" keyboardType="numeric" />
            <Field label="Certifications" value={form.certifications} onChange={v => setForm(f => ({...f, certifications:v}))} placeholder="e.g. CPA, ACCA, ROC Certified" />
            <Field label="Monthly Price (€)" value={form.price_month} onChange={v => setForm(f => ({...f, price_month:v}))} placeholder="e.g. 150" keyboardType="numeric" />
            <Field label="Contact Email" value={form.contact_email} onChange={v => setForm(f => ({...f, contact_email:v}))} placeholder="your@email.com" keyboardType="email-address" />
            <Field label="WhatsApp (optional)" value={form.contact_whatsapp} onChange={v => setForm(f => ({...f, contact_whatsapp:v}))} placeholder="+351 912 345 678" keyboardType="phone-pad" />

            <Text style={styles.label}>Specialties</Text>
            <View style={styles.specGrid}>
              {SPECIALTIES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.specOption, selectedSpecs.includes(s) && styles.specOptionSelected]}
                  onPress={() => toggleSpec(s)}
                >
                  <Text style={[styles.specOptionText, selectedSpecs.includes(s) && styles.specOptionTextSelected]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>
                    {myProfile?.exists ? 'Save Changes →' : 'Create Profile →'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

// ── FIELD COMPONENT ──────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, multiline, keyboardType }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:               { flex: 1, backgroundColor: C.bg },
  center:             { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  body:               { flex: 1, padding: 14 },

  // Header
  header:             { backgroundColor: C.ink, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle:        { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub:          { fontSize: 11, color: '#555', marginTop: 2 },
  headerBtn:          { backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  headerBtnText:      { color: C.ink, fontSize: 12, fontWeight: '700' },

  // Filters
  filters:            { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.ruled, padding: 12, gap: 8 },
  filterInput:        { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 8, padding: 10, fontSize: 13, color: C.ink },
  specFilters:        { marginTop: 4 },
  specChip:           { borderWidth: 1.5, borderColor: C.ruled, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: C.bg },
  specChipActive:     { backgroundColor: C.ink, borderColor: C.ink },
  specChipText:       { fontSize: 11, color: C.muted },
  specChipTextActive: { color: '#fff' },

  // Accountant card
  accountantCard:     { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', gap: 12 },
  cardLeft:           { alignItems: 'center' },
  accAvatar:          { width: 52, height: 52, borderRadius: 26, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  accAvatarText:      { color: C.gold, fontSize: 22, fontWeight: '900' },
  verifiedBadge:      { backgroundColor: C.green, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  verifiedText:       { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardInfo:           { flex: 1 },
  cardTopRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  accName:            { fontSize: 15, fontWeight: '700', color: C.ink, flex: 1 },
  accPrice:           { fontSize: 12, fontWeight: '700', color: C.green, marginLeft: 8 },
  accCountry:         { fontSize: 11, color: C.muted, marginBottom: 4 },
  accBio:             { fontSize: 12, color: C.muted, lineHeight: 17, marginBottom: 6 },
  specRow:            { marginBottom: 6 },
  specTag:            { backgroundColor: '#ede8da', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  specTagText:        { fontSize: 10, color: C.ink },
  cardMeta:           { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaText:           { fontSize: 10, color: C.muted },
  chatArrow:          { justifyContent: 'center' },
  chatArrowText:      { fontSize: 20 },

  // Empty state
  emptyWrap:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:          { fontSize: 52, marginBottom: 12 },
  emptyTitle:         { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8 },
  emptySub:           { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  // Chat
  chatHeader:         { backgroundColor: C.ink, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14 },
  backBtn:            { marginBottom: 8 },
  backBtnText:        { color: '#888', fontSize: 13 },
  chatHeaderInfo:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAvatar:         { width: 40, height: 40, borderRadius: 20, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText:     { color: C.ink, fontSize: 18, fontWeight: '900' },
  chatName:           { fontSize: 16, fontWeight: '700', color: '#fff' },
  chatSub:            { fontSize: 11, color: '#555', marginTop: 2 },
  chatProfileStrip:   { backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.ruled, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripCert:          { fontSize: 11, color: C.muted },
  messagesWrap:       { flex: 1 },
  chatEmpty:          { alignItems: 'center', paddingTop: 60 },
  chatEmptyIcon:      { fontSize: 40, marginBottom: 12 },
  chatEmptyTitle:     { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6 },
  chatEmptySub:       { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  msgRow:             { marginBottom: 10, alignItems: 'flex-start' },
  msgRowMe:           { alignItems: 'flex-end' },
  msgBubble:          { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 12, borderBottomLeftRadius: 2, padding: 12, maxWidth: '80%' },
  msgBubbleMe:        { backgroundColor: C.ink, borderColor: C.ink, borderBottomLeftRadius: 12, borderBottomRightRadius: 2 },
  msgSender:          { fontSize: 10, color: C.gold, fontWeight: '700', marginBottom: 4 },
  msgText:            { fontSize: 14, color: C.ink, lineHeight: 20 },
  msgTextMe:          { color: '#fff' },
  msgTime:            { fontSize: 10, color: C.muted, marginTop: 4 },
  msgTimeMe:          { color: '#888' },
  pricingBanner:      { backgroundColor: '#fff8ee', borderTopWidth: 1, borderTopColor: '#f5d9a0', paddingHorizontal: 16, paddingVertical: 8 },
  pricingBannerText:  { fontSize: 11, color: '#7a5500', textAlign: 'center' },
  inputRow:           { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.ruled, paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  msgInput:           { flex: 1, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 8, padding: 12, fontSize: 14, color: C.ink, maxHeight: 100 },
  sendBtn:            { backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:    { opacity: 0.4 },
  sendBtnText:        { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Profile form
  formHeader:         { backgroundColor: C.ink, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  formHeaderTitle:    { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 4 },
  pricingCard:        { backgroundColor: C.ink, margin: 14, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: C.gold },
  pricingTitle:       { fontSize: 14, color: C.gold, fontWeight: '700', marginBottom: 4 },
  pricingPrice:       { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  pricingDesc:        { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 10 },
  pricingNote:        { backgroundColor: 'rgba(196,154,10,0.15)', borderRadius: 6, padding: 8 },
  pricingNoteText:    { fontSize: 11, color: C.gold, textAlign: 'center' },
  formCard:           { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 12, padding: 20 },
  label:              { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, marginTop: 4 },
  input:              { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 8, padding: 12, fontSize: 14, color: C.ink, marginBottom: 14 },
  specGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  specOption:         { borderWidth: 1.5, borderColor: C.ruled, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  specOptionSelected: { backgroundColor: C.ink, borderColor: C.ink },
  specOptionText:     { fontSize: 12, color: C.muted },
  specOptionTextSelected: { color: '#fff' },
  btn:                { backgroundColor: C.ink, borderRadius: 8, padding: 14, alignItems: 'center' },
  btnDisabled:        { opacity: 0.4 },
  btnText:            { color: '#fff', fontSize: 15, fontWeight: '600' },
});
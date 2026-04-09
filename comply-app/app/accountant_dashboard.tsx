import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Modal, Linking
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

const API = 'https://comply.up.railway.app';

const C = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8', ink:'#1a1714',
  red:'#d94f3d', blue:'#2b5fc9', green:'#2a7d4f', yellow:'#c49a0a',
  purple:'#7c3aed', muted:'#8c7e6a', gold:'#c49a0a',
};

const SPECIALTIES = [
  'Tax Filing','VAT/GST','Payroll','Bookkeeping',
  'Company Formation','International Tax','Audit','Financial Planning',
];

const SCORE_COLOR = (s:number) => s>=80?C.green:s>=50?C.yellow:C.red;

function timeAgo(dateStr:string): string {
  const diff = Date.now()-new Date(dateStr).getTime();
  const mins = Math.floor(diff/60000);
  if (mins<1) return 'just now';
  if (mins<60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if (hrs<24) return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

function formatSize(bytes:number): string {
  if (!bytes) return '—';
  if (bytes<1024) return `${bytes} B`;
  if (bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function fileIcon(t:string): string {
  if (!t||t==='request') return '📋';
  if (t.includes('pdf'))   return '📄';
  if (t.includes('image')) return '🖼️';
  if (t.includes('excel')||t.includes('spreadsheet')) return '📊';
  if (t.includes('word')||t.includes('document'))     return '📝';
  return '📎';
}

type Client = {
  id:number; business_name:string; email:string;
  country:string; industry:string; compliance_score:number;
  urgent_deadlines:number; pending_deadlines:number; document_count:number;
};

type Doc = {
  id:number; name:string; category:string; file_type:string;
  file_size:number; uploaded_at:string; signed_url:string;
  requested:number; request_note:string;
};

type Message = {
  id:number; sender_id:number; sender_name:string;
  message:string; created_at:string;
};

type Screen = 'clients' | 'client_detail' | 'profile';

export default function AccountantDashboard() {
  const [screen, setScreen]               = useState<Screen>('clients');
  const [clientTab, setClientTab]         = useState<'chat'|'docs'>('chat');
  const [currentUserId, setCurrentUserId] = useState(0);
  const [myProfile, setMyProfile]         = useState<any>(null);
  const [clients, setClients]             = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client|null>(null);
  const [clientDocs, setClientDocs]       = useState<Doc[]>([]);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loading, setLoading]             = useState(true);
  const [generatedCode, setGeneratedCode] = useState('');
  const [msgInput, setMsgInput]           = useState('');
  const [sending, setSending]             = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [requestNote, setRequestNote]     = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Profile form
  const [form, setForm] = useState({
    display_name:'', bio:'', country:'', languages:'',
    years_experience:'', certifications:'', price_month:'',
    contact_email:'', contact_whatsapp:'',
  });
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [saving, setSaving]               = useState(false);

  // ── LOAD ──────────────────────────────────────────────────────────────────
  const loadCurrentUser = async () => {
    try {
      const res  = await fetch(`${API}/api/me`,{credentials:'include'});
      const data = await res.json();
      if (res.ok) setCurrentUserId(data.id);
    } catch {}
  };

  const loadMyProfile = async () => {
    try {
      const res  = await fetch(`${API}/api/accountants/me`,{credentials:'include'});
      const data = await res.json();
      setMyProfile(data);
      if (data.exists) {
        setForm({
          display_name:     data.display_name||'',
          bio:              data.bio||'',
          country:          data.country||'',
          languages:        data.languages||'',
          years_experience: String(data.years_experience||''),
          certifications:   data.certifications||'',
          price_month:      String(data.price_month||''),
          contact_email:    data.contact_email||'',
          contact_whatsapp: data.contact_whatsapp||'',
        });
        setSelectedSpecs((data.specialties||'').split(',').map((s:string)=>s.trim()).filter(Boolean));
      }
    } catch {}
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/accountants/clients`,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) setClients(data);
    } catch {}
    finally { setLoading(false); }
  };

  const loadClientDocs = async (clientId:number) => {
    try {
      const res  = await fetch(`${API}/api/accountants/clients/${clientId}/documents`,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) setClientDocs(data);
    } catch {}
  };

  const loadMessages = async (profileId:number) => {
    try {
      const res  = await fetch(`${API}/api/accountants/${profileId}/messages`,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),200);
      }
    } catch {}
  };

  useEffect(()=>{
    loadCurrentUser();
    loadMyProfile();
    loadClients();
  },[]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const openClient = async (client:Client) => {
    setSelectedClient(client);
    setClientTab('chat');
    setMessages([]);
    setClientDocs([]);
    setScreen('client_detail');
    if (myProfile?.id) await loadMessages(myProfile.id);
    await loadClientDocs(client.id);
  };

  const generateInvite = async () => {
    try {
      const res  = await fetch(`${API}/api/accountants/invite`,{method:'POST',credentials:'include'});
      const data = await res.json();
      if (data.code) setGeneratedCode(data.code);
      else Alert.alert('Error','Could not generate code. Make sure your profile is set up.');
    } catch { Alert.alert('Error','Could not generate invite code.'); }
  };

  const sendMessage = async () => {
    if (!msgInput.trim()||!selectedClient||!myProfile?.id) return;
    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');
    try {
      const res = await fetch(`${API}/api/accountants/${myProfile.id}/messages`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({message:text, receiver_id:selectedClient.id}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev=>[...prev,data]);
        setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),100);
      }
    } catch {}
    finally { setSending(false); }
  };

  const uploadForClient = async () => {
    if (!selectedClient) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append('file',{uri:file.uri,name:file.name,type:file.mimeType||'application/octet-stream'} as any);
      formData.append('category','general');
      const res = await fetch(`${API}/api/accountants/clients/${selectedClient.id}/upload`,{
        method:'POST', credentials:'include', body:formData,
      });
      if (res.ok) {
        Alert.alert('Uploaded ✅',`${file.name} saved.`);
        await loadClientDocs(selectedClient.id);
      } else Alert.alert('Error','Upload failed.');
    } catch { Alert.alert('Error','Could not upload.'); }
    finally { setUploading(false); }
  };

  const requestDoc = async () => {
    if (!requestNote.trim()||!selectedClient) return;
    try {
      const res = await fetch(`${API}/api/accountants/clients/${selectedClient.id}/request-doc`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({note:requestNote}),
      });
      if (res.ok) {
        setShowRequestModal(false);
        setRequestNote('');
        Alert.alert('Request sent ✅','The client will be notified.');
        await loadClientDocs(selectedClient.id);
      }
    } catch { Alert.alert('Error','Could not send request.'); }
  };

  const saveProfile = async () => {
    if (!form.display_name) { Alert.alert('Error','Display name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/accountants/profile`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({
          ...form,
          specialties: selectedSpecs.join(', '),
          years_experience: parseInt(form.years_experience)||0,
          price_month: parseFloat(form.price_month)||0,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('Saved! 🎉','Your profile is now live.');
        await loadMyProfile();
        setScreen('clients');
      }
    } catch { Alert.alert('Error','Could not save.'); }
    finally { setSaving(false); }
  };

  const toggleSpec = (s:string) =>
    setSelectedSpecs(prev=>prev.includes(s)?prev.filter(x=>x!==s):[...prev,s]);

  // ── SCREENS ───────────────────────────────────────────────────────────────

  // CLIENT DETAIL
  if (screen==='client_detail' && selectedClient) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>setScreen('clients')} style={styles.backRow}>
            <Text style={styles.backText}>← Clients</Text>
          </TouchableOpacity>
          <View style={styles.clientHeaderInfo}>
            <View style={styles.clientHeaderAvatar}>
              <Text style={styles.clientHeaderAvatarText}>
                {selectedClient.business_name?.[0]?.toUpperCase()||'?'}
              </Text>
            </View>
            <View>
              <Text style={styles.clientHeaderName}>{selectedClient.business_name||selectedClient.email}</Text>
              <Text style={styles.clientHeaderMeta}>
                {selectedClient.compliance_score}% compliant · {selectedClient.urgent_deadlines} urgent
              </Text>
            </View>
          </View>
        </View>

        {/* Sub-tabs */}
        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={[styles.subTab, clientTab==='chat'&&styles.subTabOn]}
            onPress={()=>setClientTab('chat')}
          >
            <Text style={[styles.subTabText, clientTab==='chat'&&styles.subTabTextOn]}>💬 Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, clientTab==='docs'&&styles.subTabOn]}
            onPress={()=>setClientTab('docs')}
          >
            <Text style={[styles.subTabText, clientTab==='docs'&&styles.subTabTextOn]}>
              📁 Documents {clientDocs.length>0?`(${clientDocs.length})`:''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── CHAT ── */}
        {clientTab==='chat' && (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.messagesArea}
              contentContainerStyle={{padding:16}}
            >
              {messages.length===0 ? (
                <View style={styles.chatEmpty}>
                  <Text style={styles.chatEmptyIcon}>💬</Text>
                  <Text style={styles.chatEmptyTitle}>No messages yet</Text>
                  <Text style={styles.chatEmptySub}>
                    Start the conversation with {selectedClient.business_name}.
                  </Text>
                </View>
              ) : messages.map(m=>{
                const isMe = m.sender_id===currentUserId;
                return (
                  <View key={m.id} style={[styles.msgWrap,isMe&&styles.msgWrapMe]}>
                    <View style={[styles.bubble,isMe&&styles.bubbleMe]}>
                      {!isMe&&<Text style={styles.bubbleSender}>{m.sender_name}</Text>}
                      <Text style={[styles.bubbleText,isMe&&styles.bubbleTextMe]}>{m.message}</Text>
                      <Text style={[styles.bubbleTime,isMe&&styles.bubbleTimeMe]}>{timeAgo(m.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.msgInput}
                placeholder="Type a message..."
                placeholderTextColor={C.muted}
                value={msgInput}
                onChangeText={setMsgInput}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn,(!msgInput.trim()||sending)&&styles.sendBtnOff]}
                onPress={sendMessage}
                disabled={!msgInput.trim()||sending}
              >
                {sending
                  ?<ActivityIndicator color="#fff" size="small"/>
                  :<Text style={styles.sendBtnText}>→</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── DOCS ── */}
        {clientTab==='docs' && (
          <>
            <View style={styles.docActions}>
              <TouchableOpacity
                style={[styles.docActionBtn,{backgroundColor:C.gold}]}
                onPress={uploadForClient}
                disabled={uploading}
              >
                {uploading
                  ?<ActivityIndicator color={C.ink} size="small"/>
                  :<Text style={styles.docActionText}>📤 Upload Document</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docActionBtn,{backgroundColor:C.surface,borderWidth:1.5,borderColor:C.ruled}]}
                onPress={()=>setShowRequestModal(true)}
              >
                <Text style={[styles.docActionText,{color:C.ink}]}>📋 Request Document</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body}>
              {clientDocs.length===0 ? (
                <View style={styles.docsEmpty}>
                  <Text style={styles.chatEmptyIcon}>📂</Text>
                  <Text style={styles.chatEmptyTitle}>No documents yet</Text>
                  <Text style={styles.chatEmptySub}>Upload a document or request one from the client.</Text>
                </View>
              ) : clientDocs.map(doc=>(
                <TouchableOpacity
                  key={doc.id}
                  style={[styles.docRow,!!doc.requested&&{borderColor:C.yellow,backgroundColor:'#fff8ee'}]}
                  onPress={()=>doc.signed_url&&!doc.requested?Linking.openURL(doc.signed_url):null}
                  activeOpacity={0.8}
                >
                  <Text style={styles.docIcon}>{fileIcon(doc.file_type)}</Text>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                    <Text style={styles.docMeta}>
                      {doc.requested
                        ?'⏳ Awaiting from client'
                        :`${formatSize(doc.file_size)} · ${new Date(doc.uploaded_at).toLocaleDateString()}`
                      }
                    </Text>
                  </View>
                  {!doc.requested&&<Text style={styles.docOpen}>↗</Text>}
                </TouchableOpacity>
              ))}
              <View style={{height:20}}/>
            </ScrollView>

            {/* Request doc modal */}
            <Modal visible={showRequestModal} animationType="slide" transparent onRequestClose={()=>setShowRequestModal(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <View style={styles.modalHandle}/>
                  <Text style={styles.modalTitle}>Request a Document</Text>
                  <Text style={styles.modalSub}>The client will see this in their Documents tab.</Text>
                  <TextInput
                    style={[styles.input,{height:80,textAlignVertical:'top',marginTop:12}]}
                    placeholder="e.g. Q1 2025 invoices, bank statement..."
                    placeholderTextColor={C.muted}
                    value={requestNote}
                    onChangeText={setRequestNote}
                    multiline
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.btn,!requestNote.trim()&&styles.btnOff]}
                    onPress={requestDoc}
                    disabled={!requestNote.trim()}
                  >
                    <Text style={styles.btnText}>Send Request →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={()=>setShowRequestModal(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </>
        )}
      </KeyboardAvoidingView>
    );
  }

  // PROFILE SCREEN
  if (screen==='profile') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>setScreen('clients')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {myProfile?.exists?'Edit Profile':'Create Profile'}
          </Text>
        </View>

        <View style={styles.pricingBanner}>
          <Text style={styles.pricingBannerTitle}>💼 COMPLY Pro · €29/month</Text>
          <Text style={styles.pricingBannerNote}>🎉 Free during beta</Text>
        </View>

        <ScrollView style={styles.body}>
          <View style={styles.formCard}>
            <F label="Display Name *" value={form.display_name} onChange={v=>setForm(f=>({...f,display_name:v}))} placeholder="e.g. Maria Silva, CPA"/>
            <F label="Bio" value={form.bio} onChange={v=>setForm(f=>({...f,bio:v}))} placeholder="Describe your experience..." multiline/>
            <F label="Country" value={form.country} onChange={v=>setForm(f=>({...f,country:v}))} placeholder="e.g. Portugal"/>
            <F label="Languages" value={form.languages} onChange={v=>setForm(f=>({...f,languages:v}))} placeholder="e.g. Portuguese, English"/>
            <F label="Years of Experience" value={form.years_experience} onChange={v=>setForm(f=>({...f,years_experience:v}))} placeholder="e.g. 8" keyboardType="numeric"/>
            <F label="Certifications" value={form.certifications} onChange={v=>setForm(f=>({...f,certifications:v}))} placeholder="e.g. CPA, ACCA"/>
            <F label="Monthly Price (€)" value={form.price_month} onChange={v=>setForm(f=>({...f,price_month:v}))} placeholder="e.g. 150" keyboardType="numeric"/>
            <F label="Contact Email" value={form.contact_email} onChange={v=>setForm(f=>({...f,contact_email:v}))} placeholder="your@email.com" keyboardType="email-address"/>
            <F label="WhatsApp" value={form.contact_whatsapp} onChange={v=>setForm(f=>({...f,contact_whatsapp:v}))} placeholder="+351 912 345 678" keyboardType="phone-pad"/>

            <Text style={styles.fieldLabel}>Specialties</Text>
            <View style={styles.specGrid}>
              {SPECIALTIES.map(s=>(
                <TouchableOpacity
                  key={s}
                  style={[styles.specChip,selectedSpecs.includes(s)&&styles.specChipOn]}
                  onPress={()=>toggleSpec(s)}
                >
                  <Text style={[styles.specChipText,selectedSpecs.includes(s)&&styles.specChipTextOn]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.btn,saving&&styles.btnOff]} onPress={saveProfile} disabled={saving}>
              {saving
                ?<ActivityIndicator color="#fff"/>
                :<Text style={styles.btnText}>{myProfile?.exists?'Save Changes →':'Create Profile →'}</Text>
              }
            </TouchableOpacity>
          </View>
          <View style={{height:40}}/>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // CLIENTS LIST (default)
  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👥 My Clients</Text>
          <Text style={styles.headerSubLine}>{clients.length} connected client{clients.length!==1?'s':''}</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={[styles.pill,{backgroundColor:C.gold,marginRight:8}]} onPress={generateInvite}>
            <Text style={styles.pillText}>+ Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill,{backgroundColor:'rgba(255,255,255,0.12)'}]} onPress={()=>setScreen('profile')}>
            <Text style={[styles.pillText,{color:'#ccc'}]}>⚙️ Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Invite code banner */}
      {generatedCode ? (
        <TouchableOpacity style={styles.codeBanner} onLongPress={()=>setGeneratedCode('')} activeOpacity={0.9}>
          <Text style={styles.codeBannerLabel}>Share this code with your client</Text>
          <Text style={styles.codeBannerCode}>{generatedCode}</Text>
          <Text style={styles.codeBannerSub}>Long press to dismiss</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.ink} size="large"/></View>
      ) : clients.length===0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No clients yet</Text>
          <Text style={styles.emptySub}>
            Tap "+ Invite" to generate a code and share it with your clients. They enter it in their app to connect with you.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={generateInvite}>
            <Text style={styles.btnText}>Generate Invite Code →</Text>
          </TouchableOpacity>
          {!myProfile?.exists&&(
            <TouchableOpacity style={[styles.btn,{backgroundColor:C.gold,marginTop:8}]} onPress={()=>setScreen('profile')}>
              <Text style={[styles.btnText,{color:C.ink}]}>Set Up Your Profile First →</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.body}>
          {clients.map(client=>(
            <TouchableOpacity
              key={client.id}
              style={styles.clientCard}
              onPress={()=>openClient(client)}
              activeOpacity={0.85}
            >
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>{client.business_name?.[0]?.toUpperCase()||'?'}</Text>
              </View>
              <View style={styles.clientBody}>
                <Text style={styles.clientName}>{client.business_name||client.email}</Text>
                <Text style={styles.clientMeta}>📍 {client.country||'—'} · {client.industry||'—'}</Text>
                <View style={styles.badges}>
                  {client.urgent_deadlines>0&&(
                    <View style={[styles.badge,{backgroundColor:'#fff0ee',borderColor:C.red}]}>
                      <Text style={[styles.badgeText,{color:C.red}]}>🚨 {client.urgent_deadlines} urgent</Text>
                    </View>
                  )}
                  <View style={[styles.badge,{backgroundColor:C.bg,borderColor:C.ruled}]}>
                    <Text style={[styles.badgeText,{color:C.muted}]}>📋 {client.pending_deadlines} pending</Text>
                  </View>
                  <View style={[styles.badge,{backgroundColor:C.bg,borderColor:C.ruled}]}>
                    <Text style={[styles.badgeText,{color:C.muted}]}>📁 {client.document_count}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.scoreRing,{borderColor:SCORE_COLOR(client.compliance_score)}]}>
                <Text style={[styles.scoreRingPct,{color:SCORE_COLOR(client.compliance_score)}]}>
                  {client.compliance_score}%
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{height:20}}/>
        </ScrollView>
      )}
    </View>
  );
}

// ── FORM FIELD ────────────────────────────────────────────────────────────────
function F({label,value,onChange,placeholder,multiline,keyboardType}:any) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input,multiline&&{height:80,textAlignVertical:'top'}]}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType||'default'}
        autoCapitalize="none"
      />
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:                { flex:1, backgroundColor:C.bg },
  body:                { flex:1, padding:14 },
  center:              { flex:1, alignItems:'center', justifyContent:'center', padding:40 },
  header:              { backgroundColor:C.ink, paddingHorizontal:20, paddingTop:58, paddingBottom:16, flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between' },
  headerTitle:         { fontSize:22, fontWeight:'900', color:'#fff' },
  headerSubLine:       { fontSize:11, color:'#666', marginTop:2 },
  headerBtns:          { flexDirection:'row', alignItems:'center' },
  backRow:             { marginBottom:8 },
  backText:            { color:'#888', fontSize:13 },
  clientHeaderInfo:    { flexDirection:'row', alignItems:'center', gap:10 },
  clientHeaderAvatar:  { width:40, height:40, borderRadius:20, backgroundColor:C.gold, alignItems:'center', justifyContent:'center' },
  clientHeaderAvatarText: { color:C.ink, fontSize:18, fontWeight:'900' },
  clientHeaderName:    { fontSize:16, fontWeight:'700', color:'#fff' },
  clientHeaderMeta:    { fontSize:11, color:'#666', marginTop:2 },
  pill:                { borderRadius:20, paddingHorizontal:14, paddingVertical:7 },
  pillText:            { color:C.ink, fontSize:12, fontWeight:'700' },
  codeBanner:          { backgroundColor:C.ink, padding:16, alignItems:'center', borderBottomWidth:2, borderBottomColor:C.gold },
  codeBannerLabel:     { fontSize:11, color:'#888', marginBottom:6 },
  codeBannerCode:      { fontSize:32, fontWeight:'900', color:C.gold, letterSpacing:8 },
  codeBannerSub:       { fontSize:10, color:'#555', marginTop:6 },
  clientCard:          { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:14, padding:14, marginBottom:10, flexDirection:'row', alignItems:'center', gap:12 },
  clientAvatar:        { width:50, height:50, borderRadius:25, backgroundColor:C.ink, alignItems:'center', justifyContent:'center', flexShrink:0 },
  clientAvatarText:    { color:C.gold, fontSize:22, fontWeight:'900' },
  clientBody:          { flex:1 },
  clientName:          { fontSize:15, fontWeight:'700', color:C.ink, marginBottom:2 },
  clientMeta:          { fontSize:11, color:C.muted, marginBottom:6 },
  badges:              { flexDirection:'row', gap:6, flexWrap:'wrap' },
  badge:               { borderWidth:1.5, borderRadius:20, paddingHorizontal:8, paddingVertical:3 },
  badgeText:           { fontSize:10, fontWeight:'600' },
  scoreRing:           { width:52, height:52, borderRadius:26, borderWidth:2.5, alignItems:'center', justifyContent:'center', flexShrink:0 },
  scoreRingPct:        { fontSize:13, fontWeight:'900' },
  emptyIcon:           { fontSize:52, marginBottom:12 },
  emptyTitle:          { fontSize:18, fontWeight:'700', color:C.ink, marginBottom:8, textAlign:'center' },
  emptySub:            { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20, marginBottom:20 },
  subTabBar:           { flexDirection:'row', backgroundColor:C.surface, borderBottomWidth:2, borderBottomColor:C.ruled },
  subTab:              { flex:1, paddingVertical:14, alignItems:'center', borderBottomWidth:2.5, borderBottomColor:'transparent' },
  subTabOn:            { borderBottomColor:C.ink },
  subTabText:          { fontSize:14, color:C.muted, fontWeight:'500' },
  subTabTextOn:        { color:C.ink, fontWeight:'700' },
  messagesArea:        { flex:1 },
  chatEmpty:           { alignItems:'center', paddingTop:60, paddingHorizontal:20 },
  chatEmptyIcon:       { fontSize:44, marginBottom:12 },
  chatEmptyTitle:      { fontSize:16, fontWeight:'700', color:C.ink, marginBottom:6 },
  chatEmptySub:        { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20 },
  docsEmpty:           { alignItems:'center', paddingTop:40, paddingHorizontal:20 },
  msgWrap:             { marginBottom:10, alignItems:'flex-start' },
  msgWrapMe:           { alignItems:'flex-end' },
  bubble:              { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:14, borderBottomLeftRadius:2, padding:12, maxWidth:'80%' },
  bubbleMe:            { backgroundColor:C.ink, borderColor:C.ink, borderBottomLeftRadius:14, borderBottomRightRadius:2 },
  bubbleSender:        { fontSize:10, color:C.gold, fontWeight:'700', marginBottom:4 },
  bubbleText:          { fontSize:14, color:C.ink, lineHeight:20 },
  bubbleTextMe:        { color:'#fff' },
  bubbleTime:          { fontSize:10, color:C.muted, marginTop:4 },
  bubbleTimeMe:        { color:'#888' },
  inputRow:            { flexDirection:'row', gap:8, padding:12, backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.ruled, paddingBottom:Platform.OS==='ios'?28:12 },
  msgInput:            { flex:1, backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, maxHeight:100 },
  sendBtn:             { backgroundColor:C.ink, borderRadius:8, paddingHorizontal:16, alignItems:'center', justifyContent:'center' },
  sendBtnOff:          { opacity:0.4 },
  sendBtnText:         { color:'#fff', fontSize:18, fontWeight:'700' },
  docActions:          { flexDirection:'row', gap:10, padding:14, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.ruled },
  docActionBtn:        { flex:1, borderRadius:8, padding:12, alignItems:'center' },
  docActionText:       { fontSize:13, fontWeight:'700', color:C.ink },
  docRow:              { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:10, padding:12, flexDirection:'row', alignItems:'center', gap:12, marginBottom:8 },
  docIcon:             { fontSize:26 },
  docInfo:             { flex:1 },
  docName:             { fontSize:13, fontWeight:'500', color:C.ink, marginBottom:2 },
  docMeta:             { fontSize:11, color:C.muted },
  docOpen:             { fontSize:20, color:C.muted },
  pricingBanner:       { backgroundColor:C.ink, padding:14, alignItems:'center', borderBottomWidth:1, borderBottomColor:C.gold },
  pricingBannerTitle:  { fontSize:14, color:C.gold, fontWeight:'700', marginBottom:2 },
  pricingBannerNote:   { fontSize:11, color:'#888' },
  formCard:            { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:14, padding:20 },
  fieldLabel:          { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, marginTop:4 },
  input:               { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, marginBottom:14 },
  specGrid:            { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:20 },
  specChip:            { borderWidth:1.5, borderColor:C.ruled, borderRadius:20, paddingHorizontal:12, paddingVertical:7 },
  specChipOn:          { backgroundColor:C.ink, borderColor:C.ink },
  specChipText:        { fontSize:12, color:C.muted },
  specChipTextOn:      { color:'#fff' },
  btn:                 { backgroundColor:C.ink, borderRadius:8, padding:14, alignItems:'center', marginBottom:10 },
  btnOff:              { opacity:0.4 },
  btnText:             { color:'#fff', fontSize:15, fontWeight:'600' },
  cancelBtn:           { alignItems:'center', padding:10 },
  cancelBtnText:       { color:C.muted, fontSize:14 },
  modalOverlay:        { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalCard:           { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:40 },
  modalHandle:         { width:40, height:4, backgroundColor:C.ruled, borderRadius:2, alignSelf:'center', marginBottom:16 },
  modalTitle:          { fontSize:20, fontWeight:'700', color:C.ink, marginBottom:4 },
  modalSub:            { fontSize:13, color:C.muted },
});
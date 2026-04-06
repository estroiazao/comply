import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, KeyboardAvoidingView,
  Platform, Alert, Switch, Linking
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
const SCORE_LABEL = (s:number) => s>=80?'Compliant ✅':s>=50?'At Risk ⚠️':'Critical 🚨';

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
  if (bytes<1024) return `${bytes} B`;
  if (bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function fileIcon(fileType:string): string {
  if (fileType?.includes('pdf'))   return '📄';
  if (fileType?.includes('image')) return '🖼️';
  if (fileType?.includes('excel')||fileType?.includes('spreadsheet')) return '📊';
  if (fileType?.includes('word')||fileType?.includes('document'))     return '📝';
  if (fileType === 'request') return '📋';
  return '📎';
}

type Accountant = {
  id:number; user_id:number; display_name:string; bio:string;
  country:string; languages:string; specialties:string;
  years_experience:number; certifications:string; price_month:number;
  contact_email:string; contact_whatsapp:string; verified:number;
};

type Message = {
  id:number; sender_id:number; sender_name:string;
  message:string; created_at:string;
};

type Client = {
  id:number; business_name:string; email:string; country:string;
  industry:string; compliance_score:number; urgent_deadlines:number;
  pending_deadlines:number; document_count:number;
};

type Doc = {
  id:number; name:string; category:string; file_type:string;
  file_size:number; uploaded_at:string; signed_url:string;
  requested:number; request_note:string;
};

export default function AccountantsScreen() {
  const [currentUserId, setCurrentUserId] = useState(0);
  const [myProfile, setMyProfile]         = useState<any>(null);
  const [accountType, setAccountType]     = useState('business');

  // Business views
  const [view, setView] = useState<'browse'|'chat'|'my_accountant'|'connect'>('browse');
  const [accountants, setAccountants]   = useState<Accountant[]>([]);
  const [selected, setSelected]         = useState<Accountant|null>(null);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [msgInput, setMsgInput]         = useState('');
  const [myAccountant, setMyAccountant] = useState<any>(null);
  const [inviteCode, setInviteCode]     = useState('');
  const [connecting, setConnecting]     = useState(false);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSpec, setFilterSpec]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Accountant views
  const [accView, setAccView] = useState<'clients'|'chat'|'profile_form'|'client_docs'>('clients');
  const [clients, setClients]               = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client|null>(null);
  const [clientDocs, setClientDocs]         = useState<Doc[]>([]);
  const [clientMessages, setClientMessages] = useState<Message[]>([]);
  const [generatedCode, setGeneratedCode]   = useState('');
  const [uploadingFor, setUploadingFor]     = useState(false);
  const [requestNote, setRequestNote]       = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Profile form
  const [form, setForm] = useState({
    display_name:'', bio:'', country:'', languages:'',
    specialties:'', years_experience:'', certifications:'',
    price_month:'', contact_email:'', contact_whatsapp:'',
  });
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadCurrentUser = async () => {
    try {
      const res  = await fetch(`${API}/api/me`,{credentials:'include'});
      const data = await res.json();
      if (res.ok) {
        setCurrentUserId(data.id);
        setAccountType(data.account_type || 'business');
      }
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
          specialties:      data.specialties||'',
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

  const loadAccountants = async () => {
    setLoading(true);
    try {
      let url = `${API}/api/accountants`;
      const params=[];
      if (filterCountry) params.push(`country=${encodeURIComponent(filterCountry)}`);
      if (filterSpec)    params.push(`specialty=${encodeURIComponent(filterSpec)}`);
      if (params.length) url += '?'+params.join('&');
      const res  = await fetch(url,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) setAccountants(data);
    } catch {}
    finally { setLoading(false); }
  };

  const loadMyAccountant = async () => {
    try {
      const res  = await fetch(`${API}/api/accountants/my-accountant`,{credentials:'include'});
      const data = await res.json();
      setMyAccountant(data);
    } catch {}
  };

  const loadClients = async () => {
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

  const loadMessages = async (accountant:Accountant) => {
    try {
      const res  = await fetch(`${API}/api/accountants/${accountant.id}/messages`,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch {}
  };

  const sendMessage = async () => {
    if (!msgInput.trim()||!selected) return;
    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');
    try {
      const res = await fetch(`${API}/api/accountants/${selected.id}/messages`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({message:text}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev=>[...prev,data]);
        setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),100);
      }
    } catch {}
    finally { setSending(false); }
  };

  const generateInvite = async () => {
    try {
      const res  = await fetch(`${API}/api/accountants/invite`,{method:'POST',credentials:'include'});
      const data = await res.json();
      if (data.code) setGeneratedCode(data.code);
    } catch { Alert.alert('Error','Could not generate invite code.'); }
  };

  const connectToAccountant = async () => {
    if (!inviteCode.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch(`${API}/api/accountants/connect`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({code:inviteCode.trim().toUpperCase()}),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Connected! 🎉',`You are now connected to ${data.accountant?.display_name||'your accountant'}.`);
        await loadMyAccountant();
        setView('my_accountant');
      } else {
        Alert.alert('Error', data.error||'Invalid code.');
      }
    } catch { Alert.alert('Error','Could not connect.'); }
    finally { setConnecting(false); }
  };

  const uploadForClient = async (clientId:number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
      if (result.canceled) return;
      const file = result.assets[0];
      setUploadingFor(true);
      const formData = new FormData();
      formData.append('file',{uri:file.uri,name:file.name,type:file.mimeType||'application/octet-stream'} as any);
      formData.append('category','general');
      const res = await fetch(`${API}/api/accountants/clients/${clientId}/upload`,{
        method:'POST', credentials:'include', body:formData,
      });
      if (res.ok) {
        Alert.alert('Uploaded ✅',`${file.name} saved for client.`);
        await loadClientDocs(clientId);
      } else {
        Alert.alert('Error','Upload failed.');
      }
    } catch { Alert.alert('Error','Could not upload.'); }
    finally { setUploadingFor(false); }
  };

  const requestDoc = async (clientId:number) => {
    if (!requestNote.trim()) return;
    try {
      await fetch(`${API}/api/accountants/clients/${clientId}/request-doc`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({note:requestNote}),
      });
      setShowRequestModal(false);
      setRequestNote('');
      Alert.alert('Request sent ✅','The client has been notified.');
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
        setAccView('clients');
      }
    } catch { Alert.alert('Error','Could not save.'); }
    finally { setSaving(false); }
  };

  const toggleSpec = (spec:string) => {
    setSelectedSpecs(prev=>prev.includes(spec)?prev.filter(s=>s!==spec):[...prev,spec]);
  };

  const openChat = async (accountant:Accountant) => {
    // Don't allow chatting with yourself
    if (accountant.user_id === currentUserId) {
      Alert.alert('This is you!','You cannot chat with your own profile.');
      return;
    }
    setSelected(accountant);
    setView('chat');
    await loadMessages(accountant);
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),300);
  };

  useEffect(()=>{
    loadCurrentUser();
    loadMyProfile();
  },[]);

  useEffect(()=>{
    if (accountType==='accountant') {
      loadClients();
    } else {
      loadAccountants();
      loadMyAccountant();
    }
  },[accountType]);

  // ── ACCOUNTANT VIEWS ────────────────────────────────────────────────────────
  if (accountType === 'accountant') {

    // Client docs view
    if (accView === 'client_docs' && selectedClient) {
      return (
        <View style={styles.flex}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={()=>setAccView('clients')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.chatName}>📁 {selectedClient.business_name}</Text>
          </View>
          <View style={styles.clientDocActions}>
            <TouchableOpacity
              style={[styles.docActionBtn,{backgroundColor:C.gold}]}
              onPress={()=>uploadForClient(selectedClient.id)}
              disabled={uploadingFor}
            >
              {uploadingFor
                ? <ActivityIndicator color={C.ink} size="small"/>
                : <Text style={styles.docActionBtnText}>📤 Upload Document</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.docActionBtn,{backgroundColor:C.surface,borderWidth:1.5,borderColor:C.ruled}]}
              onPress={()=>setShowRequestModal(true)}
            >
              <Text style={[styles.docActionBtnText,{color:C.ink}]}>📋 Request Document</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body}>
            {clientDocs.length===0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyTitle}>No documents yet</Text>
                <Text style={styles.emptySub}>Upload the first document for this client.</Text>
              </View>
            ) : clientDocs.map(doc=>(
              <TouchableOpacity
                key={doc.id}
                style={[styles.docRow, doc.requested&&{borderColor:C.yellow,backgroundColor:'#fff8ee'}]}
                onPress={()=>doc.signed_url&&!doc.requested?Linking.openURL(doc.signed_url):null}
                activeOpacity={0.7}
              >
                <Text style={styles.docIcon}>{fileIcon(doc.file_type)}</Text>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.docMeta}>
                    {doc.requested ? '⏳ Pending from client' : `${formatSize(doc.file_size)} · ${new Date(doc.uploaded_at).toLocaleDateString()}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Request doc modal */}
          <Modal visible={showRequestModal} animationType="slide" transparent onRequestClose={()=>setShowRequestModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalStrip} />
                <Text style={styles.modalTitle}>Request a Document</Text>
                <Text style={styles.modalDate}>The client will be notified to upload this.</Text>
                <TextInput
                  style={[styles.input,{height:80,textAlignVertical:'top',marginTop:12}]}
                  placeholder="e.g. Q1 2025 invoices, bank statement March..."
                  placeholderTextColor={C.muted}
                  value={requestNote}
                  onChangeText={setRequestNote}
                  multiline
                  autoFocus
                />
                <TouchableOpacity style={styles.btn} onPress={()=>requestDoc(selectedClient.id)}>
                  <Text style={styles.btnText}>Send Request →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={()=>setShowRequestModal(false)}>
                  <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      );
    }

    // Profile form
    if (accView === 'profile_form') {
      return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={()=>setAccView('clients')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>{myProfile?.exists?'Edit Profile':'Create Profile'}</Text>
          </View>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTitle}>💼 COMPLY Pro Accountant</Text>
            <Text style={styles.pricingPrice}>€29 / month</Text>
            <Text style={styles.pricingDesc}>Get listed · Unlimited clients · Verified badge</Text>
            <View style={styles.pricingNote}>
              <Text style={styles.pricingNoteText}>🎉 Free during beta</Text>
            </View>
          </View>
          <ScrollView style={styles.body}>
            <View style={styles.formCard}>
              <Field label="Display Name *" value={form.display_name} onChange={v=>setForm(f=>({...f,display_name:v}))} placeholder="e.g. Maria Silva, CPA" />
              <Field label="Bio" value={form.bio} onChange={v=>setForm(f=>({...f,bio:v}))} placeholder="Describe your experience..." multiline />
              <Field label="Country" value={form.country} onChange={v=>setForm(f=>({...f,country:v}))} placeholder="e.g. Portugal" />
              <Field label="Languages" value={form.languages} onChange={v=>setForm(f=>({...f,languages:v}))} placeholder="e.g. Portuguese, English" />
              <Field label="Years of Experience" value={form.years_experience} onChange={v=>setForm(f=>({...f,years_experience:v}))} placeholder="e.g. 8" keyboardType="numeric" />
              <Field label="Certifications" value={form.certifications} onChange={v=>setForm(f=>({...f,certifications:v}))} placeholder="e.g. CPA, ACCA" />
              <Field label="Monthly Price (€)" value={form.price_month} onChange={v=>setForm(f=>({...f,price_month:v}))} placeholder="e.g. 150" keyboardType="numeric" />
              <Field label="Contact Email" value={form.contact_email} onChange={v=>setForm(f=>({...f,contact_email:v}))} placeholder="your@email.com" keyboardType="email-address" />
              <Field label="WhatsApp (optional)" value={form.contact_whatsapp} onChange={v=>setForm(f=>({...f,contact_whatsapp:v}))} placeholder="+351 912 345 678" keyboardType="phone-pad" />
              <Text style={styles.label}>Specialties</Text>
              <View style={styles.specGrid}>
                {SPECIALTIES.map(s=>(
                  <TouchableOpacity key={s} style={[styles.specOption,selectedSpecs.includes(s)&&styles.specOptionSelected]} onPress={()=>toggleSpec(s)}>
                    <Text style={[styles.specOptionText,selectedSpecs.includes(s)&&styles.specOptionTextSelected]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.btn,saving&&styles.btnDisabled]} onPress={saveProfile} disabled={saving}>
                {saving?<ActivityIndicator color="#fff"/>:<Text style={styles.btnText}>{myProfile?.exists?'Save Changes →':'Create Profile →'}</Text>}
              </TouchableOpacity>
            </View>
            <View style={{height:40}}/>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    // Clients dashboard (default accountant view)
    return (
      <View style={styles.flex}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>👔 My Clients</Text>
            <Text style={styles.headerSub}>{clients.length} active client{clients.length!==1?'s':''}</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={[styles.headerBtn,{backgroundColor:C.gold,marginRight:8}]} onPress={generateInvite}>
              <Text style={styles.headerBtnText}>+ Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={()=>setAccView('profile_form')}>
              <Text style={styles.headerBtnText}>⚙️ Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invite code display */}
        {generatedCode ? (
          <View style={styles.inviteBanner}>
            <Text style={styles.inviteBannerLabel}>Share this code with your client:</Text>
            <Text style={styles.inviteBannerCode}>{generatedCode}</Text>
            <Text style={styles.inviteBannerSub}>Code expires in 24h · tap to copy</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.ink} size="large"/></View>
        ) : clients.length===0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No clients yet</Text>
            <Text style={styles.emptySub}>Generate an invite code and share it with your clients to connect.</Text>
            <TouchableOpacity style={styles.btn} onPress={generateInvite}>
              <Text style={styles.btnText}>Generate Invite Code →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.body}>
            {clients.map(client=>(
              <TouchableOpacity
                key={client.id}
                style={styles.clientCard}
                onPress={()=>{ setSelectedClient(client); loadClientDocs(client.id); setAccView('client_docs'); }}
                activeOpacity={0.85}
              >
                <View style={styles.clientCardTop}>
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{client.business_name?.[0]?.toUpperCase()||'?'}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{client.business_name||client.email}</Text>
                    <Text style={styles.clientMeta}>📍 {client.country||'—'} · {client.industry||'—'}</Text>
                  </View>
                  <View style={[styles.scoreRing,{borderColor:SCORE_COLOR(client.compliance_score)}]}>
                    <Text style={[styles.scoreRingText,{color:SCORE_COLOR(client.compliance_score)}]}>
                      {client.compliance_score}%
                    </Text>
                  </View>
                </View>
                <View style={styles.clientStats}>
                  {client.urgent_deadlines>0 ? (
                    <View style={[styles.statBadge,{backgroundColor:'#fff0ee',borderColor:C.red}]}>
                      <Text style={[styles.statBadgeText,{color:C.red}]}>🚨 {client.urgent_deadlines} urgent</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statBadge,{backgroundColor:'#f0f8ff',borderColor:C.blue}]}>
                    <Text style={[styles.statBadgeText,{color:C.blue}]}>📋 {client.pending_deadlines} pending</Text>
                  </View>
                  <View style={[styles.statBadge,{backgroundColor:C.bg,borderColor:C.ruled}]}>
                    <Text style={[styles.statBadgeText,{color:C.muted}]}>📁 {client.document_count} docs</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{height:20}}/>
          </ScrollView>
        )}
      </View>
    );
  }

  // ── BUSINESS VIEWS ───────────────────────────────────────────────────────────

  // Chat view
  if (view==='chat' && selected) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={()=>setView('browse')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatAvatar}>
              <Text style={styles.chatAvatarText}>{selected.display_name[0]?.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.chatName}>{selected.display_name}</Text>
              <Text style={styles.chatSub}>📍 {selected.country} · {selected.years_experience}y exp{selected.price_month>0?` · €${selected.price_month}/mo`:''}</Text>
            </View>
          </View>
        </View>
        <ScrollView ref={scrollRef} style={styles.messagesWrap} contentContainerStyle={{padding:14}}>
          {messages.length===0 ? (
            <View style={styles.chatEmpty}>
              <Text style={styles.chatEmptyIcon}>💬</Text>
              <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
              <Text style={styles.chatEmptySub}>Introduce your business and ask how {selected.display_name} can help.</Text>
            </View>
          ) : messages.map(msg=>{
            const isMe = msg.sender_id===currentUserId;
            return (
              <View key={msg.id} style={[styles.msgRow,isMe&&styles.msgRowMe]}>
                <View style={[styles.msgBubble,isMe&&styles.msgBubbleMe]}>
                  {!isMe&&<Text style={styles.msgSender}>{msg.sender_name||selected.display_name}</Text>}
                  <Text style={[styles.msgText,isMe&&styles.msgTextMe]}>{msg.message}</Text>
                  <Text style={[styles.msgTime,isMe&&styles.msgTimeMe]}>{timeAgo(msg.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        {selected.price_month>0&&(
          <View style={styles.pricingBanner}>
            <Text style={styles.pricingBannerText}>💼 €{selected.price_month}/month · Agree terms before starting</Text>
          </View>
        )}
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
            style={[styles.sendBtn,(!msgInput.trim()||sending)&&styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!msgInput.trim()||sending}
          >
            {sending?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.sendBtnText}>→</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Connect via code
  if (view==='connect') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={()=>setView('browse')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.chatName}>Connect to Accountant</Text>
        </View>
        <View style={styles.connectWrap}>
          <Text style={styles.connectIcon}>🔗</Text>
          <Text style={styles.connectTitle}>Enter Invite Code</Text>
          <Text style={styles.connectSub}>Ask your accountant to generate a code in their COMPLY app and enter it below.</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="e.g. A1B2C3D4"
            placeholderTextColor={C.muted}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.btn,(!inviteCode.trim()||connecting)&&styles.btnDisabled]}
            onPress={connectToAccountant}
            disabled={!inviteCode.trim()||connecting}
          >
            {connecting?<ActivityIndicator color="#fff"/>:<Text style={styles.btnText}>Connect →</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // My accountant view
  if (view==='my_accountant' && myAccountant?.connected) {
    const acc = myAccountant;
    return (
      <View style={styles.flex}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>👔 My Accountant</Text>
            <Text style={styles.headerSub}>Your connected professional</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={()=>setView('browse')}>
            <Text style={styles.headerBtnText}>Find Another</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.body}>
          <View style={styles.accountantCard}>
            <View style={styles.cardLeft}>
              <View style={styles.accAvatar}>
                <Text style={styles.accAvatarText}>{acc.display_name?.[0]?.toUpperCase()||'?'}</Text>
              </View>
              {acc.verified?<View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>:null}
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardTopRow}>
                <Text style={styles.accName}>{acc.display_name}</Text>
                <Text style={styles.accPrice}>{acc.price_month>0?`€${acc.price_month}/mo`:'Free'}</Text>
              </View>
              <Text style={styles.accCountry}>📍 {acc.country} · {acc.years_experience}y exp</Text>
              {acc.bio?<Text style={styles.accBio} numberOfLines={3}>{acc.bio}</Text>:null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specRow}>
                {(acc.specialties||'').split(',').filter(Boolean).map((s:string)=>(
                  <View key={s} style={styles.specTag}><Text style={styles.specTagText}>{s.trim()}</Text></View>
                ))}
              </ScrollView>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn,{marginHorizontal:0}]}
            onPress={()=>{ setSelected(acc); setView('chat'); loadMessages(acc); }}
          >
            <Text style={styles.btnText}>💬 Message {acc.display_name} →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Browse accountants (default business view)
  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👔 Find an Accountant</Text>
          <Text style={styles.headerSub}>Verified professionals for your business</Text>
        </View>
        <View style={styles.headerBtns}>
          {myAccountant?.connected && (
            <TouchableOpacity style={[styles.headerBtn,{marginRight:8,backgroundColor:C.green}]} onPress={()=>setView('my_accountant')}>
              <Text style={styles.headerBtnText}>My Accountant</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.headerBtn,{backgroundColor:C.gold}]} onPress={()=>setView('connect')}>
            <Text style={styles.headerBtnText}>🔗 Connect</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filters}>
        <TextInput
          style={styles.filterInput}
          placeholder="🌍 Filter by country..."
          placeholderTextColor={C.muted}
          value={filterCountry}
          onChangeText={setFilterCountry}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specFilters}>
          {['All',...SPECIALTIES].map(s=>(
            <TouchableOpacity
              key={s}
              style={[styles.specChip,filterSpec===(s==='All'?'':s)&&styles.specChipActive]}
              onPress={()=>setFilterSpec(s==='All'?'':s)}
            >
              <Text style={[styles.specChipText,filterSpec===(s==='All'?'':s)&&styles.specChipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.ink} size="large"/></View>
      ) : accountants.length===0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>👔</Text>
          <Text style={styles.emptyTitle}>No accountants yet</Text>
          <Text style={styles.emptySub}>Be the first to list your services on COMPLY.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body}>
          {accountants
            .filter(a=>a.user_id!==currentUserId) // hide own profile
            .map(acc=>(
            <TouchableOpacity key={acc.id} style={styles.accountantCard} onPress={()=>openChat(acc)} activeOpacity={0.85}>
              <View style={styles.cardLeft}>
                <View style={styles.accAvatar}>
                  <Text style={styles.accAvatarText}>{acc.display_name[0]?.toUpperCase()||'?'}</Text>
                </View>
                {acc.verified?<View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>:null}
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.accName}>{acc.display_name}</Text>
                  <Text style={styles.accPrice}>{acc.price_month>0?`€${acc.price_month}/mo`:'Contact'}</Text>
                </View>
                <Text style={styles.accCountry}>📍 {acc.country} · {acc.years_experience}y exp</Text>
                {acc.bio?<Text style={styles.accBio} numberOfLines={2}>{acc.bio}</Text>:null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specRow}>
                  {(acc.specialties||'').split(',').filter(Boolean).map(s=>(
                    <View key={s} style={styles.specTag}><Text style={styles.specTagText}>{s.trim()}</Text></View>
                  ))}
                </ScrollView>
                <View style={styles.cardMeta}>
                  {acc.languages?<Text style={styles.metaText}>🗣 {acc.languages}</Text>:null}
                  {acc.certifications?<Text style={styles.metaText}>🎓 {acc.certifications}</Text>:null}
                </View>
              </View>
              <View style={styles.chatArrow}><Text style={styles.chatArrowText}>💬</Text></View>
            </TouchableOpacity>
          ))}
          <View style={{height:20}}/>
        </ScrollView>
      )}
    </View>
  );
}

function Field({label,value,onChange,placeholder,multiline,keyboardType}:any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
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

const styles = StyleSheet.create({
  flex:                { flex:1, backgroundColor:C.bg },
  center:              { flex:1, alignItems:'center', justifyContent:'center', padding:40 },
  body:                { flex:1, padding:14 },
  header:              { backgroundColor:C.ink, paddingHorizontal:20, paddingTop:60, paddingBottom:16, flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between' },
  headerTitle:         { fontSize:20, fontWeight:'900', color:'#fff' },
  headerSub:           { fontSize:11, color:'#555', marginTop:2 },
  headerBtns:          { flexDirection:'row' },
  headerBtn:           { backgroundColor:C.gold, borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  headerBtnText:       { color:C.ink, fontSize:12, fontWeight:'700' },
  filters:             { backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.ruled, padding:12, gap:8 },
  filterInput:         { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:10, fontSize:13, color:C.ink },
  specFilters:         { marginTop:4 },
  specChip:            { borderWidth:1.5, borderColor:C.ruled, borderRadius:20, paddingHorizontal:12, paddingVertical:6, marginRight:8, backgroundColor:C.bg },
  specChipActive:      { backgroundColor:C.ink, borderColor:C.ink },
  specChipText:        { fontSize:11, color:C.muted },
  specChipTextActive:  { color:'#fff' },
  accountantCard:      { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:14, marginBottom:12, flexDirection:'row', gap:12 },
  cardLeft:            { alignItems:'center' },
  accAvatar:           { width:52, height:52, borderRadius:26, backgroundColor:C.ink, alignItems:'center', justifyContent:'center' },
  accAvatarText:       { color:C.gold, fontSize:22, fontWeight:'900' },
  verifiedBadge:       { backgroundColor:C.green, borderRadius:10, width:18, height:18, alignItems:'center', justifyContent:'center', marginTop:4 },
  verifiedText:        { color:'#fff', fontSize:10, fontWeight:'700' },
  cardInfo:            { flex:1 },
  cardTopRow:          { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:2 },
  accName:             { fontSize:15, fontWeight:'700', color:C.ink, flex:1 },
  accPrice:            { fontSize:12, fontWeight:'700', color:C.green, marginLeft:8 },
  accCountry:          { fontSize:11, color:C.muted, marginBottom:4 },
  accBio:              { fontSize:12, color:C.muted, lineHeight:17, marginBottom:6 },
  specRow:             { marginBottom:6 },
  specTag:             { backgroundColor:'#ede8da', borderRadius:20, paddingHorizontal:8, paddingVertical:3, marginRight:6 },
  specTagText:         { fontSize:10, color:C.ink },
  cardMeta:            { flexDirection:'row', gap:10, flexWrap:'wrap' },
  metaText:            { fontSize:10, color:C.muted },
  chatArrow:           { justifyContent:'center' },
  chatArrowText:       { fontSize:20 },
  emptyWrap:           { flex:1, alignItems:'center', justifyContent:'center', padding:40 },
  emptyIcon:           { fontSize:52, marginBottom:12 },
  emptyTitle:          { fontSize:18, fontWeight:'700', color:C.ink, marginBottom:8 },
  emptySub:            { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20, marginBottom:20 },
  chatHeader:          { backgroundColor:C.ink, paddingHorizontal:16, paddingTop:56, paddingBottom:14 },
  backBtn:             { marginBottom:8 },
  backBtnText:         { color:'#888', fontSize:13 },
  chatHeaderInfo:      { flexDirection:'row', alignItems:'center', gap:12 },
  chatAvatar:          { width:40, height:40, borderRadius:20, backgroundColor:C.gold, alignItems:'center', justifyContent:'center' },
  chatAvatarText:      { color:C.ink, fontSize:18, fontWeight:'900' },
  chatName:            { fontSize:16, fontWeight:'700', color:'#fff' },
  chatSub:             { fontSize:11, color:'#555', marginTop:2 },
  messagesWrap:        { flex:1 },
  chatEmpty:           { alignItems:'center', paddingTop:60 },
  chatEmptyIcon:       { fontSize:40, marginBottom:12 },
  chatEmptyTitle:      { fontSize:16, fontWeight:'700', color:C.ink, marginBottom:6 },
  chatEmptySub:        { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20 },
  msgRow:              { marginBottom:10, alignItems:'flex-start' },
  msgRowMe:            { alignItems:'flex-end' },
  msgBubble:           { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, borderBottomLeftRadius:2, padding:12, maxWidth:'80%' },
  msgBubbleMe:         { backgroundColor:C.ink, borderColor:C.ink, borderBottomLeftRadius:12, borderBottomRightRadius:2 },
  msgSender:           { fontSize:10, color:C.gold, fontWeight:'700', marginBottom:4 },
  msgText:             { fontSize:14, color:C.ink, lineHeight:20 },
  msgTextMe:           { color:'#fff' },
  msgTime:             { fontSize:10, color:C.muted, marginTop:4 },
  msgTimeMe:           { color:'#888' },
  pricingBanner:       { backgroundColor:'#fff8ee', borderTopWidth:1, borderTopColor:'#f5d9a0', paddingHorizontal:16, paddingVertical:8 },
  pricingBannerText:   { fontSize:11, color:'#7a5500', textAlign:'center' },
  inputRow:            { flexDirection:'row', gap:8, padding:12, backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.ruled, paddingBottom:Platform.OS==='ios'?28:12 },
  msgInput:            { flex:1, backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, maxHeight:100 },
  sendBtn:             { backgroundColor:C.ink, borderRadius:8, paddingHorizontal:16, alignItems:'center', justifyContent:'center' },
  sendBtnDisabled:     { opacity:0.4 },
  sendBtnText:         { color:'#fff', fontSize:18, fontWeight:'700' },
  connectWrap:         { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  connectIcon:         { fontSize:52, marginBottom:12 },
  connectTitle:        { fontSize:22, fontWeight:'700', color:C.ink, marginBottom:8 },
  connectSub:          { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20, marginBottom:24 },
  codeInput:           { width:'100%', backgroundColor:C.surface, borderWidth:2, borderColor:C.ink, borderRadius:12, padding:16, fontSize:24, fontWeight:'700', color:C.ink, textAlign:'center', letterSpacing:6, marginBottom:20 },
  inviteBanner:        { backgroundColor:C.ink, padding:16, alignItems:'center' },
  inviteBannerLabel:   { fontSize:11, color:'#888', marginBottom:6 },
  inviteBannerCode:    { fontSize:28, fontWeight:'900', color:C.gold, letterSpacing:6 },
  inviteBannerSub:     { fontSize:10, color:'#555', marginTop:4 },
  clientCard:          { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:14, marginBottom:12 },
  clientCardTop:       { flexDirection:'row', alignItems:'center', gap:12, marginBottom:10 },
  clientAvatar:        { width:44, height:44, borderRadius:22, backgroundColor:C.ink, alignItems:'center', justifyContent:'center' },
  clientAvatarText:    { color:C.gold, fontSize:18, fontWeight:'900' },
  clientInfo:          { flex:1 },
  clientName:          { fontSize:14, fontWeight:'700', color:C.ink },
  clientMeta:          { fontSize:11, color:C.muted, marginTop:2 },
  scoreRing:           { width:48, height:48, borderRadius:24, borderWidth:2.5, alignItems:'center', justifyContent:'center' },
  scoreRingText:       { fontSize:12, fontWeight:'900' },
  clientStats:         { flexDirection:'row', gap:8, flexWrap:'wrap' },
  statBadge:           { borderWidth:1.5, borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  statBadgeText:       { fontSize:11, fontWeight:'600' },
  clientDocActions:    { flexDirection:'row', gap:10, padding:14, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.ruled },
  docActionBtn:        { flex:1, borderRadius:8, padding:12, alignItems:'center' },
  docActionBtnText:    { fontSize:12, fontWeight:'700', color:C.ink },
  docRow:              { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:10, padding:12, flexDirection:'row', alignItems:'center', gap:12, marginBottom:8 },
  docIcon:             { fontSize:24 },
  docInfo:             { flex:1 },
  docName:             { fontSize:13, fontWeight:'500', color:C.ink, marginBottom:2 },
  docMeta:             { fontSize:11, color:C.muted },
  formHeader:          { backgroundColor:C.ink, paddingHorizontal:20, paddingTop:56, paddingBottom:16 },
  formHeaderTitle:     { fontSize:20, fontWeight:'900', color:'#fff', marginTop:4 },
  pricingCard:         { backgroundColor:C.ink, margin:14, borderRadius:12, padding:16, borderWidth:1.5, borderColor:C.gold },
  pricingTitle:        { fontSize:14, color:C.gold, fontWeight:'700', marginBottom:4 },
  pricingPrice:        { fontSize:28, fontWeight:'900', color:'#fff', marginBottom:4 },
  pricingDesc:         { fontSize:12, color:'#888', lineHeight:18, marginBottom:10 },
  pricingNote:         { backgroundColor:'rgba(196,154,10,0.15)', borderRadius:6, padding:8 },
  pricingNoteText:     { fontSize:11, color:C.gold, textAlign:'center' },
  formCard:            { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:20 },
  label:               { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, marginTop:4 },
  input:               { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, marginBottom:14 },
  specGrid:            { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:20 },
  specOption:          { borderWidth:1.5, borderColor:C.ruled, borderRadius:20, paddingHorizontal:12, paddingVertical:7 },
  specOptionSelected:  { backgroundColor:C.ink, borderColor:C.ink },
  specOptionText:      { fontSize:12, color:C.muted },
  specOptionTextSelected: { color:'#fff' },
  btn:                 { backgroundColor:C.ink, borderRadius:8, padding:14, alignItems:'center' },
  btnDisabled:         { opacity:0.4 },
  btnText:             { color:'#fff', fontSize:15, fontWeight:'600' },
  modalOverlay:        { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalCard:           { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:40 },
  modalStrip:          { height:4, borderRadius:2, width:60, alignSelf:'center', marginBottom:16, backgroundColor:C.ruled },
  modalTitle:          { fontSize:20, fontWeight:'700', color:C.ink, marginBottom:4 },
  modalDate:           { fontSize:14, color:C.muted, marginBottom:4 },
  closeBtn:            { marginTop:12, alignItems:'center' },
  closeBtnText:        { color:C.muted, fontSize:13 },
});
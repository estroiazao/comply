import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert
} from 'react-native';

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

function timeAgo(dateStr:string): string {
  const diff = Date.now()-new Date(dateStr).getTime();
  const mins = Math.floor(diff/60000);
  if (mins<1) return 'just now';
  if (mins<60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if (hrs<24) return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

type Accountant = {
  id:number; user_id:number; display_name:string; bio:string;
  country:string; languages:string; specialties:string;
  years_experience:number; certifications:string; price_month:number;
  verified:number;
};

type Message = {
  id:number; sender_id:number; sender_name:string;
  message:string; created_at:string;
};

export default function AccountantsScreen() {
  const [page, setPage]                   = useState<'browse'|'chat'|'my_accountant'|'connect'>('browse');
  const [accountants, setAccountants]     = useState<Accountant[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<Accountant|null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [msgInput, setMsgInput]           = useState('');
  const [sending, setSending]             = useState(false);
  const [myAccountant, setMyAccountant]   = useState<any>(null);
  const [inviteCode, setInviteCode]       = useState('');
  const [connecting, setConnecting]       = useState(false);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterSpec, setFilterSpec]       = useState('');
  const [currentUserId, setCurrentUserId] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const loadCurrentUser = async () => {
    try {
      const res  = await fetch(`${API}/api/me`,{credentials:'include'});
      const data = await res.json();
      if (res.ok) setCurrentUserId(data.id);
    } catch {}
  };

  const loadAccountants = async () => {
    setLoading(true);
    try {
      let url = `${API}/api/accountants`;
      const params=[];
      if (filterCountry) params.push(`country=${encodeURIComponent(filterCountry)}`);
      if (filterSpec)    params.push(`specialty=${encodeURIComponent(filterSpec)}`);
      if (params.length) url+='?'+params.join('&');
      const res  = await fetch(url,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) setAccountants(data.filter((a:Accountant)=>a.user_id!==currentUserId));
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

  const loadMessages = async (acc:Accountant) => {
    try {
      const res  = await fetch(`${API}/api/accountants/${acc.id}/messages`,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
        setTimeout(()=>scrollRef.current?.scrollToEnd({animated:false}),200);
      }
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
        setPage('my_accountant');
      } else {
        Alert.alert('Error',data.error||'Invalid code.');
      }
    } catch { Alert.alert('Error','Could not connect.'); }
    finally { setConnecting(false); }
  };

  const openChat = async (acc:Accountant) => {
    setSelected(acc);
    setPage('chat');
    await loadMessages(acc);
  };

  useEffect(()=>{ loadCurrentUser(); loadMyAccountant(); },[]);
  useEffect(()=>{ if (currentUserId>0) loadAccountants(); },[currentUserId,filterCountry,filterSpec]);

  // ── CHAT ───────────────────────────────────────────────────────────────────
  if (page==='chat' && selected) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>setPage('browse')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerAvatarRow}>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarLgText}>{selected.display_name[0]?.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.headerName}>{selected.display_name}</Text>
              <Text style={styles.headerSub}>
                📍 {selected.country} · {selected.years_experience}y exp
                {selected.price_month>0?` · €${selected.price_month}/mo`:''}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView ref={scrollRef} style={styles.messagesArea} contentContainerStyle={{padding:16}}>
          {messages.length===0 ? (
            <View style={styles.chatEmpty}>
              <Text style={styles.chatEmptyIcon}>💬</Text>
              <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
              <Text style={styles.chatEmptySub}>
                Introduce your business and ask {selected.display_name} how they can help.
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

        {selected.price_month>0&&(
          <View style={styles.pricingNote}>
            <Text style={styles.pricingNoteText}>💼 €{selected.price_month}/month · Agree terms before starting</Text>
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
            style={[styles.sendBtn,(!msgInput.trim()||sending)&&styles.sendBtnOff]}
            onPress={sendMessage}
            disabled={!msgInput.trim()||sending}
          >
            {sending?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.sendBtnText}>→</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── CONNECT VIA CODE ────────────────────────────────────────────────────────
  if (page==='connect') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>setPage('browse')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connect to Accountant</Text>
        </View>
        <View style={styles.connectBody}>
          <Text style={styles.connectIcon}>🔗</Text>
          <Text style={styles.connectTitle}>Enter Invite Code</Text>
          <Text style={styles.connectSub}>
            Ask your accountant to generate a code in their COMPLY app and enter it below.
          </Text>
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
            style={[styles.btn,(!inviteCode.trim()||connecting)&&styles.btnOff]}
            onPress={connectToAccountant}
            disabled={!inviteCode.trim()||connecting}
          >
            {connecting?<ActivityIndicator color="#fff"/>:<Text style={styles.btnText}>Connect →</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── MY ACCOUNTANT ──────────────────────────────────────────────────────────
  if (page==='my_accountant' && myAccountant?.connected) {
    const acc = myAccountant;
    return (
      <View style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>setPage('browse')} style={styles.backRow}>
            <Text style={styles.backText}>← Browse</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Accountant</Text>
        </View>
        <ScrollView style={styles.body}>
          <View style={styles.accCard}>
            <View style={styles.accCardTop}>
              <View style={styles.accAvatar}>
                <Text style={styles.accAvatarText}>{acc.display_name?.[0]?.toUpperCase()||'?'}</Text>
              </View>
              {acc.verified?<View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>:null}
            </View>
            <Text style={styles.accName}>{acc.display_name}</Text>
            <Text style={styles.accMeta}>📍 {acc.country} · {acc.years_experience} years experience</Text>
            {acc.price_month>0&&<Text style={styles.accPrice}>€{acc.price_month}/month</Text>}
            {acc.bio?<Text style={styles.accBio}>{acc.bio}</Text>:null}
            {acc.certifications?<Text style={styles.accCert}>🎓 {acc.certifications}</Text>:null}
            {acc.languages?<Text style={styles.accLang}>🗣 {acc.languages}</Text>:null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:10}}>
              {(acc.specialties||'').split(',').filter(Boolean).map((s:string)=>(
                <View key={s} style={styles.specTag}><Text style={styles.specTagText}>{s.trim()}</Text></View>
              ))}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.btn} onPress={()=>{ setSelected(acc); setPage('chat'); loadMessages(acc); }}>
            <Text style={styles.btnText}>💬 Message {acc.display_name} →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={()=>setPage('browse')}>
            <Text style={styles.btnOutlineText}>Find a different accountant</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── BROWSE ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👔 Find an Accountant</Text>
        <Text style={styles.headerSubSmall}>Verified professionals for your business</Text>
        <View style={styles.headerActions}>
          {myAccountant?.connected&&(
            <TouchableOpacity style={[styles.pill,{backgroundColor:C.green,marginRight:8}]} onPress={()=>setPage('my_accountant')}>
              <Text style={styles.pillText}>My Accountant ✓</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.pill,{backgroundColor:C.gold}]} onPress={()=>setPage('connect')}>
            <Text style={styles.pillText}>🔗 Have a code?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.filterInput}
          placeholder="🌍 Country..."
          placeholderTextColor={C.muted}
          value={filterCountry}
          onChangeText={setFilterCountry}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:8}}>
          {['All',...SPECIALTIES].map(s=>(
            <TouchableOpacity
              key={s}
              style={[styles.specChip,filterSpec===(s==='All'?'':s)&&styles.specChipOn]}
              onPress={()=>setFilterSpec(s==='All'?'':s)}
            >
              <Text style={[styles.specChipText,filterSpec===(s==='All'?'':s)&&styles.specChipTextOn]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.ink} size="large"/></View>
      ) : accountants.length===0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👔</Text>
          <Text style={styles.emptyTitle}>No accountants found</Text>
          <Text style={styles.emptySub}>Try a different filter or connect via invite code.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body}>
          {accountants.map(acc=>(
            <TouchableOpacity key={acc.id} style={styles.accCard} onPress={()=>openChat(acc)} activeOpacity={0.85}>
              <View style={styles.accCardTop}>
                <View style={styles.accAvatar}>
                  <Text style={styles.accAvatarText}>{acc.display_name[0]?.toUpperCase()}</Text>
                </View>
                {acc.verified?<View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>:null}
              </View>
              <View style={styles.accCardBody}>
                <View style={styles.accCardTitleRow}>
                  <Text style={styles.accName}>{acc.display_name}</Text>
                  <Text style={styles.accPrice}>{acc.price_month>0?`€${acc.price_month}/mo`:'Contact'}</Text>
                </View>
                <Text style={styles.accMeta}>📍 {acc.country} · {acc.years_experience}y exp</Text>
                {acc.bio?<Text style={styles.accBio} numberOfLines={2}>{acc.bio}</Text>:null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:6}}>
                  {(acc.specialties||'').split(',').filter(Boolean).map(s=>(
                    <View key={s} style={styles.specTag}><Text style={styles.specTagText}>{s.trim()}</Text></View>
                  ))}
                </ScrollView>
                {acc.languages?<Text style={styles.accLang}>🗣 {acc.languages}</Text>:null}
              </View>
              <Text style={styles.chatIcon}>💬</Text>
            </TouchableOpacity>
          ))}
          <View style={{height:20}}/>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:             { flex:1, backgroundColor:C.bg },
  body:             { flex:1, padding:14 },
  center:           { flex:1, alignItems:'center', justifyContent:'center', padding:40 },
  header:           { backgroundColor:C.ink, paddingHorizontal:20, paddingTop:58, paddingBottom:16 },
  headerTitle:      { fontSize:22, fontWeight:'900', color:'#fff', marginBottom:2 },
  headerSubSmall:   { fontSize:11, color:'#666', marginBottom:10 },
  headerSub:        { fontSize:11, color:'#666', marginTop:2 },
  headerName:       { fontSize:16, fontWeight:'700', color:'#fff' },
  headerActions:    { flexDirection:'row', marginTop:4 },
  backRow:          { marginBottom:8 },
  backText:         { color:'#888', fontSize:13 },
  headerAvatarRow:  { flexDirection:'row', alignItems:'center', gap:12 },
  avatarLg:         { width:44, height:44, borderRadius:22, backgroundColor:C.gold, alignItems:'center', justifyContent:'center' },
  avatarLgText:     { color:C.ink, fontSize:20, fontWeight:'900' },
  pill:             { borderRadius:20, paddingHorizontal:14, paddingVertical:7 },
  pillText:         { color:C.ink, fontSize:12, fontWeight:'700' },
  filterBar:        { backgroundColor:C.surface, padding:12, borderBottomWidth:1, borderBottomColor:C.ruled },
  filterInput:      { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:10, fontSize:13, color:C.ink },
  specChip:         { borderWidth:1.5, borderColor:C.ruled, borderRadius:20, paddingHorizontal:12, paddingVertical:5, marginRight:8, backgroundColor:C.bg },
  specChipOn:       { backgroundColor:C.ink, borderColor:C.ink },
  specChipText:     { fontSize:11, color:C.muted },
  specChipTextOn:   { color:'#fff' },
  accCard:          { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:14, padding:16, marginBottom:12, flexDirection:'row', gap:12, alignItems:'flex-start' },
  accCardTop:       { alignItems:'center' },
  accCardBody:      { flex:1 },
  accCardTitleRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:2 },
  accAvatar:        { width:52, height:52, borderRadius:26, backgroundColor:C.ink, alignItems:'center', justifyContent:'center' },
  accAvatarText:    { color:C.gold, fontSize:22, fontWeight:'900' },
  verifiedBadge:    { backgroundColor:C.green, borderRadius:10, width:18, height:18, alignItems:'center', justifyContent:'center', marginTop:4 },
  verifiedText:     { color:'#fff', fontSize:10, fontWeight:'700' },
  accName:          { fontSize:15, fontWeight:'700', color:C.ink, flex:1 },
  accPrice:         { fontSize:12, fontWeight:'700', color:C.green },
  accMeta:          { fontSize:11, color:C.muted, marginBottom:4 },
  accBio:           { fontSize:12, color:C.muted, lineHeight:17, marginBottom:4 },
  accCert:          { fontSize:11, color:C.muted, marginTop:4 },
  accLang:          { fontSize:11, color:C.muted, marginTop:4 },
  specTag:          { backgroundColor:'#ede8da', borderRadius:20, paddingHorizontal:8, paddingVertical:3, marginRight:6 },
  specTagText:      { fontSize:10, color:C.ink },
  chatIcon:         { fontSize:22, alignSelf:'center' },
  emptyIcon:        { fontSize:48, marginBottom:12 },
  emptyTitle:       { fontSize:18, fontWeight:'700', color:C.ink, marginBottom:8 },
  emptySub:         { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20 },
  messagesArea:     { flex:1 },
  chatEmpty:        { alignItems:'center', paddingTop:60 },
  chatEmptyIcon:    { fontSize:40, marginBottom:12 },
  chatEmptyTitle:   { fontSize:16, fontWeight:'700', color:C.ink, marginBottom:6 },
  chatEmptySub:     { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20 },
  msgWrap:          { marginBottom:10, alignItems:'flex-start' },
  msgWrapMe:        { alignItems:'flex-end' },
  bubble:           { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:14, borderBottomLeftRadius:2, padding:12, maxWidth:'80%' },
  bubbleMe:         { backgroundColor:C.ink, borderColor:C.ink, borderBottomLeftRadius:14, borderBottomRightRadius:2 },
  bubbleSender:     { fontSize:10, color:C.gold, fontWeight:'700', marginBottom:4 },
  bubbleText:       { fontSize:14, color:C.ink, lineHeight:20 },
  bubbleTextMe:     { color:'#fff' },
  bubbleTime:       { fontSize:10, color:C.muted, marginTop:4 },
  bubbleTimeMe:     { color:'#888' },
  pricingNote:      { backgroundColor:'#fff8ee', borderTopWidth:1, borderTopColor:'#f5d9a0', padding:10 },
  pricingNoteText:  { fontSize:11, color:'#7a5500', textAlign:'center' },
  inputRow:         { flexDirection:'row', gap:8, padding:12, backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.ruled, paddingBottom:Platform.OS==='ios'?28:12 },
  msgInput:         { flex:1, backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, maxHeight:100 },
  sendBtn:          { backgroundColor:C.ink, borderRadius:8, paddingHorizontal:16, alignItems:'center', justifyContent:'center' },
  sendBtnOff:       { opacity:0.4 },
  sendBtnText:      { color:'#fff', fontSize:18, fontWeight:'700' },
  connectBody:      { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  connectIcon:      { fontSize:52, marginBottom:12 },
  connectTitle:     { fontSize:22, fontWeight:'700', color:C.ink, marginBottom:8 },
  connectSub:       { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20, marginBottom:24 },
  codeInput:        { width:'100%', backgroundColor:C.surface, borderWidth:2, borderColor:C.ink, borderRadius:12, padding:16, fontSize:24, fontWeight:'700', color:C.ink, textAlign:'center', letterSpacing:6, marginBottom:20 },
  btn:              { backgroundColor:C.ink, borderRadius:8, padding:14, alignItems:'center', marginBottom:10 },
  btnOff:           { opacity:0.4 },
  btnText:          { color:'#fff', fontSize:15, fontWeight:'600' },
  btnOutline:       { borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:14, alignItems:'center' },
  btnOutlineText:   { color:C.muted, fontSize:14 },
});
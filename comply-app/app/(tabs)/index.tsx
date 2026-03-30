import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
  Alert, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const API = 'https://comply.up.railway.app';

const C = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8', ink:'#1a1714',
  red:'#d94f3d', blue:'#2b5fc9', green:'#2a7d4f', yellow:'#c49a0a',
  purple:'#7c3aed', muted:'#8c7e6a', gold:'#c49a0a',
};

const TAG_COLOR: Record<string,string> = {
  tax:C.red, license:C.blue, payroll:C.purple, insurance:C.green, filing:C.yellow
};

type Deadline = {
  id:number; title:string; month:string; day:string;
  category:string; status:string; description:string; penalty:string; done:boolean;
  due_date:string;
};

const AI_ANSWERS: Record<string,string> = {
  'iva':       'Em Portugal, o IVA trimestral é entregue até ao dia 15 do 2.º mês seguinte ao trimestre. Entrega no Portal das Finanças AT.',
  'irs':       'A declaração de IRS deve ser entregue entre Abril e Junho no Portal das Finanças. Coima por atraso: €200 a €2.500.',
  'sales tax': 'In the US, sales tax is filed quarterly. California: 15th of month after quarter. Texas: 20th. Florida: 19th.',
  'payroll':   'Payroll taxes (Form 941) are filed quarterly: Apr 30, Jul 31, Oct 31, Jan 31. In Portugal, Segurança Social is due monthly by the 10th.',
  'penalty':   'Missing tax deadlines: Portugal — €200–€2.500. US — 5%/month up to 25%. UK — £100 + daily penalties. Always file even if you cannot pay.',
  'vat':       'UK VAT returns are due 1 month and 7 days after the end of your VAT period. File via HMRC Making Tax Digital.',
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

async function registerForPushNotifications() {
  if (!Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('Notifications', 'Enable notifications in Settings to get deadline reminders.');
  }
}

async function scheduleDeadlineReminder(deadline: Deadline) {
  if (deadline.done || !deadline.due_date) return;
  const dueDate = new Date(deadline.due_date);
  const remind7 = new Date(dueDate);
  const remind1 = new Date(dueDate);
  remind7.setDate(remind7.getDate() - 7);
  remind1.setDate(remind1.getDate() - 1);
  const now = new Date();

  if (remind7 > now) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `deadline-7-${deadline.id}`,
        content: {
          title: '⚠️ Deadline in 7 days',
          body:  `${deadline.title} is due on ${deadline.month} ${deadline.day}`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remind7 },
      });
    } catch {}
  }

  if (remind1 > now) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `deadline-1-${deadline.id}`,
        content: {
          title: '🚨 Deadline TOMORROW',
          body:  `${deadline.title} is due tomorrow! Don't miss it.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remind1 },
      });
    } catch {}
  }
}

async function scheduleAllReminders(deadlines: Deadline[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const d of deadlines) {
    if (!d.done) await scheduleDeadlineReminder(d);
  }
}

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [tab, setTab]               = useState<'deadlines'|'add'|'ai'>('deadlines');
  const [deadlines, setDeadlines]   = useState<Deadline[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName]     = useState('');
  const [showMenu, setShowMenu]     = useState(false);

  const [title, setTitle]       = useState('');
  const [date, setDate]         = useState('');
  const [category, setCategory] = useState('tax');
  const [desc, setDesc]         = useState('');
  const [penalty, setPenalty]   = useState('');
  const [adding, setAdding]     = useState(false);
  const [addMsg, setAddMsg]     = useState('');

  const [aiInput, setAiInput]       = useState('');
  const [aiMessages, setAiMessages] = useState([
    { who:'bot', text:'Hi! Ask me anything about taxes, licenses, payroll, or deadlines.' }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selected, setSelected]   = useState<Deadline|null>(null);

  const notifListener = useRef<any>();

  const load = async () => {
    try {
      const res = await fetch(`${API}/deadlines`, { credentials:'include' });
      if (res.status === 401) { router.replace('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) {
        setDeadlines(data);
        await scheduleAllReminders(data);
      }
    } catch { Alert.alert('Error', 'Could not load deadlines.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadUser = async () => {
    try {
      const res  = await fetch(`${API}/api/me`, { credentials:'include' });
      const data = await res.json();
      if (res.ok) setUserName(data.business_name || data.email || 'My Business');
    } catch {}
  };

  // ── TEST NOTIFICATION (fires in 5 seconds) ──────────────────────────────────
  const testNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 COMPLY Test',
          body:  'Notifications are working! You will get reminders before deadlines.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
      });
      setShowMenu(false);
      Alert.alert('Test sent! 🎉', 'Lock your phone — you will get a notification in 5 seconds.');
    } catch (e) {
      Alert.alert('Error', 'Could not send test notification.');
    }
  };

  useEffect(() => {
    load();
    loadUser();
    registerForPushNotifications();

    notifListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      setTab('deadlines');
    });

    return () => {
      if (notifListener.current) notifListener.current.remove();
    };
  }, []);

  const toggle = async (id:number) => {
    await fetch(`${API}/deadlines/${id}/toggle`, { method:'PATCH', credentials:'include' });
    load();
  };

  const addDeadline = async () => {
    if (!title || !date) { setAddMsg('Please fill in a title and due date.'); return; }
    setAdding(true); setAddMsg('');
    try {
      const parts  = date.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const month  = months[parseInt(parts[1])-1] || '';
      const day    = parts[2] || '';
      const res    = await fetch(`${API}/deadlines`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ title, due_date:date, month, day, category, description:desc, penalty }),
      });
      if (res.ok) {
        setAddMsg('✓ Deadline saved!');
        setTitle(''); setDate(''); setDesc(''); setPenalty('');
        setTimeout(() => { setTab('deadlines'); load(); setAddMsg(''); }, 1000);
      }
    } catch { setAddMsg('Something went wrong.'); }
    finally { setAdding(false); }
  };

  const logout = async () => {
    setShowMenu(false);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await fetch(`${API}/api/logout`, { method:'POST', credentials:'include' });
    await SecureStore.deleteItemAsync('comply_email');
    await SecureStore.deleteItemAsync('comply_password');
    router.replace('/login');
  };

  const sendAI = () => {
    if (!aiInput.trim()) return;
    const q = aiInput.trim();
    setAiMessages(prev => [...prev, { who:'user', text:q }]);
    setAiInput('');
    setAiLoading(true);
    setTimeout(() => {
      const lower = q.toLowerCase();
      let reply = 'Keep all filings for 7 years, set reminders 2 weeks before each deadline, and consult a local accountant for penalties over €500.';
      for (const [k,v] of Object.entries(AI_ANSWERS)) {
        if (lower.includes(k)) { reply = v; break; }
      }
      setAiMessages(prev => [...prev, { who:'bot', text:reply }]);
      setAiLoading(false);
    }, 700);
  };

  const urgent   = deadlines.filter(d => d.status === 'urgent');
  const upcoming = deadlines.filter(d => d.status === 'upcoming');
  const done     = deadlines.filter(d => d.status === 'done');
  const pct      = deadlines.length > 0 ? Math.round((done.length/deadlines.length)*100) : 0;
  const initials = userName ? userName[0].toUpperCase() : '?';
  const CATS     = ['tax','license','payroll','insurance','filing'];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={styles.flex}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>COM<Text style={styles.logoAccent}>PLY</Text></Text>
            <Text style={styles.logoSub}>Business Deadline Planner</Text>
          </View>
          <TouchableOpacity style={styles.userBtn} onPress={() => setShowMenu(true)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.scoreTxt}>{pct}%</Text>
          </TouchableOpacity>
        </View>

        {/* ALERT */}
        {urgent.length > 0 && (
          <View style={styles.alertStrip}>
            <View style={styles.alertDot} />
            <Text style={styles.alertText}>
              {urgent.length} urgent deadline{urgent.length>1?'s':''} this week
            </Text>
          </View>
        )}

        {/* TABS */}
        <View style={styles.tabBar}>
          {(['deadlines','add','ai'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab===t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab===t && styles.tabTextActive]}>
                {t==='deadlines'?'📋 Deadlines':t==='add'?'➕ Add':'🤖 AI'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── DEADLINES TAB ── */}
        {tab === 'deadlines' && (
          <ScrollView
            style={styles.body}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          >
            {loading ? (
              <View style={styles.center}><ActivityIndicator color={C.ink} size="large" /></View>
            ) : (
              <>
                <View style={styles.progressWrap}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Compliance Progress</Text>
                    <Text style={styles.progressLabel}>{pct}%</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {width:`${pct}%` as any}]} />
                  </View>
                </View>

                <Block title="🔴 Urgent" count={urgent.length}>
                  {urgent.length===0 ? <Empty text="No urgent deadlines 🎉" /> : urgent.map(d =>
                    <DeadlineRow key={d.id} d={d} onToggle={toggle} onPress={() => setSelected(d)} />
                  )}
                </Block>

                <Block title="🟡 Upcoming" count={upcoming.length}>
                  {upcoming.length===0 ? <Empty text="No upcoming deadlines." /> : upcoming.map(d =>
                    <DeadlineRow key={d.id} d={d} onToggle={toggle} onPress={() => setSelected(d)} />
                  )}
                </Block>

                <Block title="✅ Done" count={done.length}>
                  {done.length===0 ? <Empty text="Nothing completed yet." /> : done.map(d =>
                    <DeadlineRow key={d.id} d={d} onToggle={toggle} onPress={() => setSelected(d)} />
                  )}
                </Block>
              </>
            )}
          </ScrollView>
        )}

        {/* ── ADD TAB ── */}
        {tab === 'add' && (
          <ScrollView style={styles.body}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Add a New Deadline</Text>

              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. IVA Trimestral" placeholderTextColor={C.muted} value={title} onChangeText={setTitle} />

              <Text style={styles.label}>Due Date * (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="e.g. 2025-07-15" placeholderTextColor={C.muted} value={date} onChangeText={setDate} />

              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {CATS.map(c => (
                  <TouchableOpacity key={c} style={[styles.catBtn, category===c && styles.catBtnSelected]} onPress={() => setCategory(c)}>
                    <Text style={[styles.catText, category===c && styles.catTextSelected]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="e.g. Portal das Finanças AT" placeholderTextColor={C.muted} value={desc} onChangeText={setDesc} />

              <Text style={styles.label}>Penalty if missed</Text>
              <TextInput style={styles.input} placeholder="e.g. Coima de €200" placeholderTextColor={C.muted} value={penalty} onChangeText={setPenalty} />

              {addMsg ? <Text style={[styles.feedback, addMsg.startsWith('✓') && {color:C.green}]}>{addMsg}</Text> : null}

              <TouchableOpacity style={[styles.btn, adding && styles.btnDisabled]} onPress={addDeadline} disabled={adding}>
                {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Add Deadline →</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── AI TAB ── */}
        {tab === 'ai' && (
          <View style={styles.aiWrap}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIcon}><Text style={{fontSize:16}}>🤖</Text></View>
              <View>
                <Text style={styles.aiName}>COMPLY Assistant</Text>
                <Text style={styles.aiSub}>Ask anything about compliance</Text>
              </View>
            </View>

            <ScrollView style={styles.aiMessages}>
              {aiMessages.map((m,i) => (
                <View key={i} style={[styles.aiMsg, m.who==='user' && styles.aiMsgUser]}>
                  <Text style={[styles.aiMsgText, m.who==='user' && styles.aiMsgTextUser]}>{m.text}</Text>
                </View>
              ))}
              {aiLoading && <View style={styles.aiMsg}><Text style={styles.aiMsgText}>...</Text></View>}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions}>
              {['IVA Portugal?','IRS penalty?','Payroll taxes?','Sales tax US?'].map(q => (
                <TouchableOpacity key={q} style={styles.suggestion} onPress={() => setAiInput(q)}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder="Ask anything..."
                placeholderTextColor="#444"
                value={aiInput}
                onChangeText={setAiInput}
                onSubmitEditing={sendAI}
              />
              <TouchableOpacity style={styles.aiSendBtn} onPress={sendAI}>
                <Text style={styles.aiSendText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* BOTTOM NAV */}
        <View style={styles.bottomNav}>
          {(['deadlines','add','ai'] as const).map(t => (
            <TouchableOpacity key={t} style={styles.navItem} onPress={() => setTab(t)}>
              <Text style={styles.navIcon}>{t==='deadlines'?'📋':t==='add'?'➕':'🤖'}</Text>
              <Text style={[styles.navLabel, tab===t && styles.navLabelActive]}>
                {t==='deadlines'?'Deadlines':t==='add'?'Add':'AI'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── USER MENU MODAL ── */}
        <Modal visible={showMenu} animationType="fade" transparent onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowMenu(false)} activeOpacity={1}>
            <View style={styles.menuCard}>
              <View style={styles.menuHeader}>
                <View style={styles.menuAvatar}>
                  <Text style={styles.menuAvatarText}>{initials}</Text>
                </View>
                <View>
                  <Text style={styles.menuName}>{userName}</Text>
                  <Text style={styles.menuScore}>Compliance Score: {pct}%</Text>
                </View>
              </View>

              <View style={styles.menuDivider} />

              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); router.push('/onboard'); }}>
                <Text style={styles.menuItemIcon}>⚙️</Text>
                <Text style={styles.menuItemText}>Change my profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={testNotification}>
                <Text style={styles.menuItemIcon}>🔔</Text>
                <Text style={styles.menuItemText}>Test notifications</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity style={styles.menuItem} onPress={logout}>
                <Text style={styles.menuItemIcon}>🚪</Text>
                <Text style={[styles.menuItemText, {color:C.red}]}>Log out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── DEADLINE DETAIL MODAL ── */}
        <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {selected && (
                <>
                  <View style={[styles.modalStrip, {backgroundColor: selected.status==='urgent'?C.red:selected.status==='done'?C.ruled:C.yellow}]} />
                  <Text style={styles.modalTitle}>{selected.title}</Text>
                  <Text style={styles.modalDate}>{selected.month} {selected.day}</Text>
                  <View style={[styles.tag, {borderColor: TAG_COLOR[selected.category]||C.muted, marginBottom:12}]}>
                    <Text style={[styles.tagText, {color: TAG_COLOR[selected.category]||C.muted}]}>{selected.category}</Text>
                  </View>
                  {selected.description ? <Text style={styles.modalDesc}>{selected.description}</Text> : null}
                  {selected.penalty ? (
                    <View style={styles.penaltyBox}>
                      <Text style={styles.penaltyLabel}>⚠️ Penalty if missed</Text>
                      <Text style={styles.penaltyText}>{selected.penalty}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.btn} onPress={() => { toggle(selected.id); setSelected(null); }}>
                    <Text style={styles.btnText}>{selected.done ? 'Mark as Not Done' : 'Mark as Done ✓'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function Block({ title, count, children }: any) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockTitle}>{title}</Text>
        <View style={styles.blockCount}><Text style={styles.blockCountText}>{count}</Text></View>
      </View>
      <View style={styles.blockBody}>{children}</View>
    </View>
  );
}

function DeadlineRow({ d, onToggle, onPress }: { d:Deadline; onToggle:(id:number)=>void; onPress:()=>void }) {
  const stripColor = d.status==='urgent'?C.red:d.status==='done'?C.ruled:C.yellow;
  const color      = TAG_COLOR[d.category]||C.muted;
  return (
    <TouchableOpacity style={[styles.row, {borderLeftColor:stripColor}]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.dueBox}>
        <Text style={styles.dueMonth}>{d.month}</Text>
        <Text style={[styles.dueDay, d.status==='urgent'&&{color:C.red}, d.status==='done'&&{color:C.ruled}]}>{d.day}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, d.done&&styles.rowTitleDone]} numberOfLines={1}>{d.title}</Text>
        <View style={[styles.tag, {borderColor:color}]}>
          <Text style={[styles.tagText, {color}]}>{d.category}</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.checkBtn, d.done&&styles.checkBtnDone]} onPress={() => onToggle(d.id)}>
        <Text style={{color:d.done?'#fff':'transparent', fontSize:12}}>✓</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function Empty({ text }: { text:string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:            { flex:1, backgroundColor:C.bg },
  center:          { padding:40, alignItems:'center' },
  header:          { backgroundColor:C.ink, paddingHorizontal:20, paddingTop:60, paddingBottom:14, flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between' },
  logo:            { fontSize:26, fontWeight:'900', color:'#fff' },
  logoAccent:      { color:'#c49a0a' },
  logoSub:         { fontSize:8, color:'#555', letterSpacing:2, textTransform:'uppercase', marginTop:2 },
  userBtn:         { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  avatar:          { width:24, height:24, borderRadius:12, backgroundColor:'#c49a0a', alignItems:'center', justifyContent:'center' },
  avatarText:      { color:C.ink, fontSize:11, fontWeight:'700' },
  scoreTxt:        { color:'#c49a0a', fontSize:11 },
  alertStrip:      { backgroundColor:'#fff8e6', borderBottomWidth:1, borderBottomColor:'#ddb830', flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:8, gap:8 },
  alertDot:        { width:7, height:7, borderRadius:4, backgroundColor:C.red },
  alertText:       { fontSize:11, color:'#7a5500', flex:1 },
  tabBar:          { flexDirection:'row', backgroundColor:C.bg, borderBottomWidth:2, borderBottomColor:C.ruled },
  tabBtn:          { flex:1, paddingVertical:12, alignItems:'center', borderBottomWidth:2.5, borderBottomColor:'transparent' },
  tabBtnActive:    { borderBottomColor:C.ink },
  tabText:         { fontSize:12, color:C.muted },
  tabTextActive:   { color:C.ink, fontWeight:'700' },
  body:            { flex:1, padding:14 },
  progressWrap:    { marginBottom:14 },
  progressLabels:  { flexDirection:'row', justifyContent:'space-between', marginBottom:4 },
  progressLabel:   { fontSize:11, color:C.muted },
  progressBar:     { height:6, backgroundColor:C.ruled, borderRadius:10, overflow:'hidden' },
  progressFill:    { height:'100%', backgroundColor:C.green, borderRadius:10 },
  block:           { marginBottom:14 },
  blockHeader:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#ede8da', borderWidth:1.5, borderColor:C.ruled, borderBottomWidth:0, borderTopLeftRadius:8, borderTopRightRadius:8, paddingHorizontal:12, paddingVertical:7 },
  blockTitle:      { fontSize:12, color:C.muted, fontWeight:'500' },
  blockCount:      { backgroundColor:C.ink, borderRadius:20, paddingHorizontal:7, paddingVertical:2 },
  blockCountText:  { color:'#fff', fontSize:9 },
  blockBody:       { borderWidth:1.5, borderColor:C.ruled, borderBottomLeftRadius:8, borderBottomRightRadius:8, overflow:'hidden', backgroundColor:C.surface },
  row:             { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.ruled, borderLeftWidth:3.5, gap:10 },
  dueBox:          { alignItems:'center', width:40 },
  dueMonth:        { fontSize:8, textTransform:'uppercase', letterSpacing:1, color:C.muted },
  dueDay:          { fontSize:22, fontWeight:'700', color:C.ink, lineHeight:24 },
  rowInfo:         { flex:1 },
  rowTitle:        { fontSize:13, fontWeight:'500', color:C.ink, marginBottom:3 },
  rowTitleDone:    { textDecorationLine:'line-through', color:C.muted },
  tag:             { borderWidth:1.5, borderRadius:20, paddingHorizontal:6, paddingVertical:2, alignSelf:'flex-start' },
  tagText:         { fontSize:9, textTransform:'uppercase', letterSpacing:1 },
  checkBtn:        { width:28, height:28, borderRadius:14, borderWidth:2, borderColor:C.ruled, alignItems:'center', justifyContent:'center' },
  checkBtnDone:    { backgroundColor:C.green, borderColor:C.green },
  empty:           { padding:16, alignItems:'center' },
  emptyText:       { fontSize:12, color:C.muted },
  formCard:        { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:20 },
  formTitle:       { fontSize:20, fontWeight:'700', color:C.ink, marginBottom:16 },
  label:           { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:6 },
  input:           { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, marginBottom:14 },
  catRow:          { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 },
  catBtn:          { borderWidth:1.5, borderColor:C.ruled, borderRadius:20, paddingHorizontal:12, paddingVertical:6 },
  catBtnSelected:  { backgroundColor:C.ink, borderColor:C.ink },
  catText:         { fontSize:12, color:C.muted, textTransform:'uppercase' },
  catTextSelected: { color:'#fff' },
  feedback:        { fontSize:13, color:C.red, textAlign:'center', marginBottom:10 },
  btn:             { backgroundColor:C.ink, borderRadius:8, padding:14, alignItems:'center' },
  btnDisabled:     { opacity:0.4 },
  btnText:         { color:'#fff', fontSize:15, fontWeight:'600' },
  aiWrap:          { flex:1, backgroundColor:C.ink, padding:16, paddingBottom:0 },
  aiHeader:        { flexDirection:'row', alignItems:'center', gap:10, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)', marginBottom:12 },
  aiIcon:          { width:36, height:36, backgroundColor:'#8a6a00', borderRadius:8, alignItems:'center', justifyContent:'center' },
  aiName:          { fontSize:15, color:'#fff', fontWeight:'600' },
  aiSub:           { fontSize:11, color:'#555' },
  aiMessages:      { flex:1, marginBottom:8 },
  aiMsg:           { backgroundColor:'rgba(255,255,255,0.07)', borderRadius:10, padding:12, marginBottom:8, maxWidth:'85%', alignSelf:'flex-start' },
  aiMsgUser:       { backgroundColor:'#c49a0a', alignSelf:'flex-end' },
  aiMsgText:       { fontSize:13, color:'#ccc', lineHeight:20 },
  aiMsgTextUser:   { color:C.ink },
  suggestions:     { marginBottom:8 },
  suggestion:      { backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderRadius:20, paddingHorizontal:12, paddingVertical:6, marginRight:8 },
  suggestionText:  { color:'#888', fontSize:11 },
  aiInputRow:      { flexDirection:'row', gap:8, paddingBottom:16 },
  aiInput:         { flex:1, backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', borderRadius:8, padding:12, color:'#ddd', fontSize:13 },
  aiSendBtn:       { backgroundColor:'#c49a0a', borderRadius:8, paddingHorizontal:16, alignItems:'center', justifyContent:'center' },
  aiSendText:      { color:C.ink, fontSize:18, fontWeight:'700' },
  bottomNav:       { flexDirection:'row', backgroundColor:C.ink, borderTopWidth:1, borderTopColor:'#2a2520', paddingBottom:Platform.OS==='ios'?20:8 },
  navItem:         { flex:1, alignItems:'center', paddingVertical:10 },
  navIcon:         { fontSize:20, marginBottom:2 },
  navLabel:        { fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:1 },
  navLabelActive:  { color:'#c49a0a' },
  menuOverlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  menuCard:        { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:40 },
  menuHeader:      { flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 },
  menuAvatar:      { width:48, height:48, borderRadius:24, backgroundColor:'#c49a0a', alignItems:'center', justifyContent:'center' },
  menuAvatarText:  { color:C.ink, fontSize:20, fontWeight:'700' },
  menuName:        { fontSize:16, fontWeight:'600', color:C.ink },
  menuScore:       { fontSize:12, color:C.muted, marginTop:2 },
  menuDivider:     { height:1, backgroundColor:C.ruled, marginVertical:8 },
  menuItem:        { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12 },
  menuItemIcon:    { fontSize:20, width:28 },
  menuItemText:    { fontSize:15, color:C.ink },
  modalOverlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalCard:       { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:40 },
  modalStrip:      { height:4, borderRadius:2, width:60, alignSelf:'center', marginBottom:16 },
  modalTitle:      { fontSize:20, fontWeight:'700', color:C.ink, marginBottom:4 },
  modalDate:       { fontSize:14, color:C.muted, marginBottom:12 },
  modalDesc:       { fontSize:13, color:C.muted, lineHeight:20, marginBottom:12 },
  penaltyBox:      { backgroundColor:'#fff0ee', borderWidth:1.5, borderColor:'#f5c0b8', borderRadius:8, padding:12, marginBottom:16 },
  penaltyLabel:    { fontSize:11, color:C.red, fontWeight:'600', marginBottom:4 },
  penaltyText:     { fontSize:13, color:'#7a2a20' },
  closeBtn:        { marginTop:12, alignItems:'center' },
  closeBtnText:    { color:C.muted, fontSize:13 },
});
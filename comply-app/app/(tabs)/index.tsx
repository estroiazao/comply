import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
  Alert, KeyboardAvoidingView, Platform, Modal, Switch
} from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

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
  category:string; status:string; description:string; penalty:string;
  done:boolean; due_date:string;
};

type FeedPost = {
  id:number; score:number; country:string; industry:string;
  anonymous:number; likes:number; created_at:string; display_name:string;
};

const AI_ANSWERS: Record<string,string> = {
  'iva':       'Em Portugal, o IVA trimestral é entregue até ao dia 15 do 2.º mês seguinte ao trimestre. Entrega no Portal das Finanças AT.',
  'irs':       'A declaração de IRS deve ser entregue entre Abril e Junho no Portal das Finanças. Coima por atraso: €200 a €2.500.',
  'sales tax': 'In the US, sales tax is filed quarterly. California: 15th of month after quarter. Texas: 20th. Florida: 19th.',
  'payroll':   'Payroll taxes (Form 941) are filed quarterly: Apr 30, Jul 31, Oct 31, Jan 31. In Portugal, Segurança Social is due monthly by the 10th.',
  'penalty':   'Missing tax deadlines: Portugal — €200–€2.500. US — 5%/month up to 25%. UK — £100 + daily penalties. Always file even if you cannot pay.',
  'vat':       'UK VAT returns are due 1 month and 7 days after the end of your VAT period. File via HMRC Making Tax Digital.',
};

const PENALTY_CAP = 50000;

const INDUSTRY_EMOJI: Record<string,string> = {
  food:'🍕', retail:'🛍️', services:'✂️', construction:'🔨', freelance:'💻', other:'📦',
};

const SCORE_COLOR = (s: number) => s >= 80 ? C.green : s >= 50 ? C.yellow : C.red;
const SCORE_LABEL = (s: number) => s >= 80 ? 'Compliant ✅' : s >= 50 ? 'At Risk ⚠️' : 'Critical 🚨';

// ── PENALTY CALCULATOR ───────────────────────────────────────────────────────
function calcPenalty(category: string, monthlyRevenue: number, dueDate: string, done: boolean): {
  fixed:number; rate:number; daysLate:number;
  totalPenalty:number; isOverdue:boolean; currency:string;
} {
  const now      = new Date();
  const due      = new Date(dueDate);
  const daysLate = done ? 0 : Math.max(0, Math.floor((now.getTime()-due.getTime())/(1000*60*60*24)));
  const isOverdue = !done && now > due;
  const quarterly = monthlyRevenue * 3;
  const formulas: Record<string,{fixed:number;rate:number;currency:string}> = {
    tax:      {fixed:200, rate:0.10, currency:'€'},
    license:  {fixed:250, rate:0.00, currency:'€'},
    payroll:  {fixed:500, rate:0.05, currency:'€'},
    insurance:{fixed:0,   rate:0.00, currency:'€'},
    filing:   {fixed:150, rate:0.02, currency:'€'},
  };
  const f           = formulas[category] || formulas.tax;
  const basePenalty = f.fixed + (quarterly * f.rate);
  const dailyRate   = basePenalty / 30;
  const rawPenalty  = isOverdue ? basePenalty + (dailyRate * daysLate) : basePenalty;
  return {
    fixed: f.fixed, rate: f.rate, daysLate,
    totalPenalty: Math.min(Math.round(rawPenalty), PENALTY_CAP),
    isOverdue, currency: f.currency,
  };
}

function formatMoney(amount:number, currency:string) {
  return currency + new Intl.NumberFormat('en',{maximumFractionDigits:0}).format(amount);
}

function timeAgo(dateStr:string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff/60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({shouldShowAlert:true,shouldPlaySound:true,shouldSetBadge:true}),
});

async function registerForPushNotifications() {
  if (!Device.isDevice) return;
  const {status:existing} = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const {status} = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') Alert.alert('Notifications','Enable notifications in Settings to get deadline reminders.');
}

async function scheduleDeadlineReminder(deadline:Deadline) {
  if (deadline.done || !deadline.due_date) return;
  const dueDate = new Date(deadline.due_date);
  const remind7 = new Date(dueDate); remind7.setDate(remind7.getDate()-7);
  const remind1 = new Date(dueDate); remind1.setDate(remind1.getDate()-1);
  const now = new Date();
  if (remind7>now) try { await Notifications.scheduleNotificationAsync({
    identifier:`deadline-7-${deadline.id}`,
    content:{title:'⚠️ Deadline in 7 days',body:`${deadline.title} is due on ${deadline.month} ${deadline.day}`},
    trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:remind7},
  }); } catch {}
  if (remind1>now) try { await Notifications.scheduleNotificationAsync({
    identifier:`deadline-1-${deadline.id}`,
    content:{title:'🚨 Deadline TOMORROW',body:`${deadline.title} is due tomorrow! Don't miss it.`},
    trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:remind1},
  }); } catch {}
}

async function scheduleAllReminders(deadlines:Deadline[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const d of deadlines) { if (!d.done) await scheduleDeadlineReminder(d); }
}

// ── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [tab, setTab]               = useState<'deadlines'|'feed'|'add'|'ai'>('deadlines');
  const [accountType, setAccountType] = useState('business');
  const [deadlines, setDeadlines]   = useState<Deadline[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName]     = useState('');
  const [monthlyRevenue, setMonthlyRevenue] = useState(5000);
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
    {who:'bot', text:'Hi! Ask me anything about taxes, licenses, payroll, or deadlines.'}
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  // AI state managed in ComplyAI component
  const [selected, setSelected]   = useState<Deadline|null>(null);
  const [livePenalty, setLivePenalty] = useState(0);
  const penaltyTimer = useRef<any>(null);
  const notifListener = useRef<any>();

  // Feed state
  const [feedPosts, setFeedPosts]           = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading]       = useState(false);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareAnon, setShareAnon]           = useState(false);
  const [sharing, setSharing]               = useState(false);
  const [likedPosts, setLikedPosts]         = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      const res = await fetch(`${API}/deadlines`,{credentials:'include'});
      if (res.status===401) { router.replace('/login'); return; }
      const data = await res.json();
      if (Array.isArray(data)) { setDeadlines(data); await scheduleAllReminders(data); }
    } catch { Alert.alert('Error','Could not load deadlines.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadUser = async () => {
    try {
      const res  = await fetch(`${API}/api/me`,{credentials:'include'});
      const data = await res.json();
      if (res.ok) {
        setUserName(data.business_name || data.email || 'My Business');
        setMonthlyRevenue(data.monthly_revenue || 5000);
        setAccountType(data.account_type || 'business');
      }
    } catch {}
  };

  const loadFeed = async () => {
    setFeedLoading(true);
    try {
      const res  = await fetch(`${API}/api/feed`,{credentials:'include'});
      const data = await res.json();
      if (Array.isArray(data)) setFeedPosts(data);
    } catch {}
    finally { setFeedLoading(false); setFeedRefreshing(false); }
  };

  const shareScore = async () => {
    setSharing(true);
    try {
      const res = await fetch(`${API}/api/feed/post`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({score:pct, anonymous:shareAnon}),
      });
      if (res.ok) {
        setShowShareModal(false);
        setTab('feed');
        await loadFeed();
        Alert.alert('Posted! 🎉','Your compliance score is now on the community feed.');
      } else {
        Alert.alert('Error','Could not post. Please try again.');
      }
    } catch { Alert.alert('Error','Could not connect to server.'); }
    finally { setSharing(false); }
  };

  const likePost = async (postId:number) => {
    if (likedPosts.has(postId)) return;
    setLikedPosts(prev => new Set([...prev, postId]));
    try {
      const res  = await fetch(`${API}/api/feed/${postId}/like`,{method:'PATCH',credentials:'include'});
      const data = await res.json();
      setFeedPosts(prev => prev.map(p => p.id===postId ? {...p, likes:data.likes} : p));
    } catch {
      setLikedPosts(prev => { const s=new Set(prev); s.delete(postId); return s; });
    }
  };

  const testNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content:{title:'🔔 COMPLY Test',body:'Notifications are working! You will get reminders before deadlines.'},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5,repeats:false},
      });
      setShowMenu(false);
      Alert.alert('Test sent! 🎉','Lock your phone — you will get a notification in 5 seconds.');
    } catch { Alert.alert('Error','Could not send test notification.'); }
  };

  useEffect(() => {
    load(); loadUser(); registerForPushNotifications();
    notifListener.current = Notifications.addNotificationResponseReceivedListener(() => setTab('deadlines'));
    return () => { if (notifListener.current) notifListener.current.remove(); };
  }, []);

  useEffect(() => {
    if (tab === 'feed' && feedPosts.length === 0) loadFeed();
  }, [tab]);

  useEffect(() => {
    if (selected && selected.due_date && !selected.done) {
      const calc = calcPenalty(selected.category, monthlyRevenue, selected.due_date, selected.done);
      setLivePenalty(calc.totalPenalty);
      if (calc.isOverdue) {
        const basePenalty = calc.fixed + (monthlyRevenue * 3 * calc.rate);
        const secondRate  = (basePenalty/30) / 86400;
        penaltyTimer.current = setInterval(() => {
          setLivePenalty(prev => Math.min(Math.round((prev+secondRate)*100)/100, PENALTY_CAP));
        }, 1000);
      }
    } else { setLivePenalty(0); }
    return () => { if (penaltyTimer.current) clearInterval(penaltyTimer.current); };
  }, [selected]);

  const toggle = async (id:number) => {
    await fetch(`${API}/deadlines/${id}/toggle`,{method:'PATCH',credentials:'include'});
    setSelected(null); load();
  };

  const addDeadline = async () => {
    if (!title||!date) { setAddMsg('Please fill in a title and due date.'); return; }
    setAdding(true); setAddMsg('');
    try {
      const parts  = date.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const res = await fetch(`${API}/deadlines`,{
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({title,due_date:date,month:months[parseInt(parts[1])-1]||'',day:parts[2]||'',category,description:desc,penalty}),
      });
      if (res.ok) {
        setAddMsg('✔ Deadline saved!');
        setTitle(''); setDate(''); setDesc(''); setPenalty('');
        setTimeout(()=>{ setTab('deadlines'); load(); setAddMsg(''); },1000);
      }
    } catch { setAddMsg('Something went wrong.'); }
    finally { setAdding(false); }
  };

  const logout = async () => {
    setShowMenu(false);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await fetch(`${API}/api/logout`,{method:'POST',credentials:'include'});
    await SecureStore.deleteItemAsync('comply_email');
    await SecureStore.deleteItemAsync('comply_password');
    router.replace('/login');
  };

  const sendAI = () => {
    if (!aiInput.trim()) return;
    const q = aiInput.trim();
    setAiMessages(prev=>[...prev,{who:'user',text:q}]);
    setAiInput(''); setAiLoading(true);
    setTimeout(()=>{
      const lower = q.toLowerCase();
      let reply = 'Keep all filings for 7 years, set reminders 2 weeks before each deadline, and consult a local accountant for penalties over €500.';
      for (const [k,v] of Object.entries(AI_ANSWERS)) { if (lower.includes(k)) { reply=v; break; } }
      setAiMessages(prev=>[...prev,{who:'bot',text:reply}]);
      setAiLoading(false);
    },700);
  };

  const urgent   = deadlines.filter(d => d.status==='urgent');
  const upcoming = deadlines.filter(d => d.status==='upcoming');
  const done     = deadlines.filter(d => d.status==='done');
  const pct      = deadlines.length > 0 ? Math.round((done.length/deadlines.length)*100) : 0;

  const rawTotalAtRisk = deadlines
    .filter(d=>!d.done&&d.due_date)
    .reduce((sum,d)=>sum+calcPenalty(d.category,monthlyRevenue,d.due_date,d.done).totalPenalty,0);
  const totalAtRisk  = Math.min(rawTotalAtRisk, PENALTY_CAP);
  const atRiskCapped = rawTotalAtRisk >= PENALTY_CAP;

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
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <Text style={styles.scoreTxt}>{pct}%</Text>
          </TouchableOpacity>
        </View>

        {/* MONEY AT RISK BANNER */}
        {totalAtRisk > 0 && (
          <View style={styles.riskBanner}>
            <Text style={styles.riskText}>💸 Total at risk if you miss everything:</Text>
            <Text style={styles.riskAmount}>{atRiskCapped?'>':''}{formatMoney(totalAtRisk,'€')}</Text>
          </View>
        )}

        {/* ALERT */}
        {urgent.length > 0 && (
          <View style={styles.alertStrip}>
            <View style={styles.alertDot} />
            <Text style={styles.alertText}>{urgent.length} urgent deadline{urgent.length>1?'s':''} this week</Text>
          </View>
        )}

        {/* TABS */}
        <View style={styles.tabBar}>
          {(['deadlines','feed','add','ai'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab===t&&styles.tabBtnActive]} onPress={()=>setTab(t)}>
              <Text style={styles.tabIcon}>{t==='deadlines'?'📋':t==='feed'?'🌍':t==='add'?'➕':'🤖'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── DEADLINES TAB ── */}
        {tab==='deadlines' && (
          <ScrollView style={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} />}>
            {loading ? (
              <View style={styles.center}><ActivityIndicator color={C.ink} size="large" /></View>
            ) : (
              <>
                <View style={styles.scoreCard}>
                  <View>
                    <Text style={styles.scoreCardLabel}>Your Compliance Score</Text>
                    <Text style={[styles.scoreCardPct, {color:SCORE_COLOR(pct)}]}>{pct}%</Text>
                    <Text style={[styles.scoreCardStatus, {color:SCORE_COLOR(pct)}]}>{SCORE_LABEL(pct)}</Text>
                  </View>
                  <View style={styles.scoreCardRight}>
                    <TouchableOpacity style={styles.shareScoreBtn} onPress={()=>setShowShareModal(true)}>
                      <Text style={styles.shareScoreBtnText}>Share 🌍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.expertBtn} onPress={()=>router.push('/accountants')}>
                      <Text style={styles.expertBtnText}>Find Expert 👔</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.progressWrap}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressLabel}>{done.length}/{deadlines.length} done</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill,{width:`${pct}%` as any}]} />
                  </View>
                </View>

                <Block title="🔴 Urgent" count={urgent.length}>
                  {urgent.length===0?<Empty text="No urgent deadlines 🎉"/>:urgent.map(d=>
                    <DeadlineRow key={d.id} d={d} monthlyRevenue={monthlyRevenue} onToggle={toggle} onPress={()=>setSelected(d)} />
                  )}
                </Block>
                <Block title="🟡 Upcoming" count={upcoming.length}>
                  {upcoming.length===0?<Empty text="No upcoming deadlines."/>:upcoming.map(d=>
                    <DeadlineRow key={d.id} d={d} monthlyRevenue={monthlyRevenue} onToggle={toggle} onPress={()=>setSelected(d)} />
                  )}
                </Block>
                <Block title="✅ Done" count={done.length}>
                  {done.length===0?<Empty text="Nothing completed yet."/>:done.map(d=>
                    <DeadlineRow key={d.id} d={d} monthlyRevenue={monthlyRevenue} onToggle={toggle} onPress={()=>setSelected(d)} />
                  )}
                </Block>
              </>
            )}
          </ScrollView>
        )}

        {/* ── FEED TAB ── */}
        {tab==='feed' && (
          <View style={styles.flex}>
            <View style={styles.feedHeader}>
              <View>
                <Text style={styles.feedTitle}>🌍 Community Feed</Text>
                <Text style={styles.feedSub}>See how other businesses are doing</Text>
              </View>
              <TouchableOpacity style={styles.feedShareBtn} onPress={()=>setShowShareModal(true)}>
                <Text style={styles.feedShareBtnText}>Share mine</Text>
              </TouchableOpacity>
            </View>
            {feedLoading && feedPosts.length===0 ? (
              <View style={styles.center}><ActivityIndicator color={C.ink} size="large" /></View>
            ) : (
              <ScrollView
                style={styles.body}
                refreshControl={<RefreshControl refreshing={feedRefreshing} onRefresh={()=>{setFeedRefreshing(true);loadFeed();}} />}
              >
                {feedPosts.length===0 ? (
                  <View style={styles.feedEmpty}>
                    <Text style={styles.feedEmptyIcon}>🌍</Text>
                    <Text style={styles.feedEmptyTitle}>Be the first to share!</Text>
                    <Text style={styles.feedEmptySub}>Post your compliance score and see how you compare to other businesses worldwide.</Text>
                    <TouchableOpacity style={styles.btn} onPress={()=>setShowShareModal(true)}>
                      <Text style={styles.btnText}>Share My Score →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  feedPosts.map(post => (
                    <View key={post.id} style={styles.feedCard}>
                      <View style={[styles.feedScoreRing, {borderColor:SCORE_COLOR(post.score)}]}>
                        <Text style={[styles.feedScorePct, {color:SCORE_COLOR(post.score)}]}>{post.score}%</Text>
                      </View>
                      <View style={styles.feedCardInfo}>
                        <Text style={styles.feedCardName} numberOfLines={1}>{post.display_name}</Text>
                        <View style={styles.feedCardMeta}>
                          {post.country ? <Text style={styles.feedMeta}>{post.country}</Text> : null}
                          {post.industry ? <Text style={styles.feedMeta}>{INDUSTRY_EMOJI[post.industry]||'📦'} {post.industry}</Text> : null}
                        </View>
                        <Text style={[styles.feedCardStatus, {color:SCORE_COLOR(post.score)}]}>{SCORE_LABEL(post.score)}</Text>
                        <Text style={styles.feedCardTime}>{timeAgo(post.created_at)}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.likeBtn, likedPosts.has(post.id)&&styles.likeBtnActive]}
                        onPress={()=>likePost(post.id)}
                      >
                        <Text style={styles.likeIcon}>👏</Text>
                        <Text style={[styles.likeCount, likedPosts.has(post.id)&&styles.likeCountActive]}>{post.likes}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
                <View style={{height:20}} />
              </ScrollView>
            )}
          </View>
        )}

        {/* ── ADD TAB ── */}
        {tab==='add' && (
          <ScrollView style={styles.body}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Add a New Deadline</Text>
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. IVA Trimestral" placeholderTextColor={C.muted} value={title} onChangeText={setTitle} />
              <Text style={styles.label}>Due Date * (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="e.g. 2025-07-15" placeholderTextColor={C.muted} value={date} onChangeText={setDate} />
              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {CATS.map(c=>(
                  <TouchableOpacity key={c} style={[styles.catBtn,category===c&&styles.catBtnSelected]} onPress={()=>setCategory(c)}>
                    <Text style={[styles.catText,category===c&&styles.catTextSelected]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="e.g. Portal das Finanças AT" placeholderTextColor={C.muted} value={desc} onChangeText={setDesc} />
              <Text style={styles.label}>Penalty if missed</Text>
              <TextInput style={styles.input} placeholder="e.g. Coima de €200" placeholderTextColor={C.muted} value={penalty} onChangeText={setPenalty} />
              {addMsg?<Text style={[styles.feedback,addMsg.startsWith('✔')&&{color:C.green}]}>{addMsg}</Text>:null}
              <TouchableOpacity style={[styles.btn,adding&&styles.btnDisabled]} onPress={addDeadline} disabled={adding}>
                {adding?<ActivityIndicator color="#fff"/>:<Text style={styles.btnText}>Add Deadline →</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── AI TAB ── */}
        {tab==='ai' && (
          <ComplyAI monthlyRevenue={monthlyRevenue} userName={userName} />
        )}

        {/* BOTTOM NAV */}
        <View style={styles.bottomNav}>
          {(['deadlines','feed','add','ai'] as const).map(t=>(
            <TouchableOpacity key={t} style={styles.navItem} onPress={()=>setTab(t)}>
              <Text style={styles.navIcon}>{t==='deadlines'?'📋':t==='feed'?'🌍':t==='add'?'➕':'🤖'}</Text>
              <Text style={[styles.navLabel,tab===t&&styles.navLabelActive]}>
                {t==='deadlines'?'Deadlines':t==='feed'?'Feed':t==='add'?'Add':'AI'}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.navItem} onPress={()=>router.push('/documents')}>
            <Text style={styles.navIcon}>📁</Text>
            <Text style={styles.navLabel}>Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={()=>router.push(accountType==='accountant'?'/accountant_dashboard':'/accountants')}>
            <Text style={styles.navIcon}>👔</Text>
            <Text style={styles.navLabel}>{accountType==='accountant'?'Dashboard':'Experts'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── SHARE SCORE MODAL ── */}
        <Modal visible={showShareModal} animationType="slide" transparent onRequestClose={()=>setShowShareModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={[styles.modalStrip,{backgroundColor:SCORE_COLOR(pct)}]} />
              <Text style={styles.modalTitle}>Share to Community Feed</Text>
              <Text style={styles.modalDate}>Your score will appear in the global feed.</Text>
              <View style={[styles.sharePreview, {borderColor:SCORE_COLOR(pct)}]}>
                <Text style={[styles.sharePreviewPct, {color:SCORE_COLOR(pct)}]}>{pct}%</Text>
                <Text style={[styles.sharePreviewStatus, {color:SCORE_COLOR(pct)}]}>{SCORE_LABEL(pct)}</Text>
                <Text style={styles.sharePreviewName}>{shareAnon ? 'Anonymous Business' : userName}</Text>
              </View>
              <View style={styles.anonRow}>
                <View>
                  <Text style={styles.anonLabel}>Post anonymously</Text>
                  <Text style={styles.anonSub}>Hides your business name</Text>
                </View>
                <Switch value={shareAnon} onValueChange={setShareAnon} trackColor={{false:C.ruled,true:C.ink}} thumbColor={shareAnon?C.gold:'#fff'} />
              </View>
              <TouchableOpacity style={[styles.btn,sharing&&styles.btnDisabled]} onPress={shareScore} disabled={sharing}>
                {sharing?<ActivityIndicator color="#fff"/>:<Text style={styles.btnText}>Post to Feed 🌍</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={()=>setShowShareModal(false)}>
                <Text style={styles.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── USER MENU ── */}
        <Modal visible={showMenu} animationType="fade" transparent onRequestClose={()=>setShowMenu(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={()=>setShowMenu(false)} activeOpacity={1}>
            <View style={styles.menuCard}>
              <View style={styles.menuHeader}>
                <View style={styles.menuAvatar}><Text style={styles.menuAvatarText}>{initials}</Text></View>
                <View>
                  <Text style={styles.menuName}>{userName}</Text>
                  <Text style={styles.menuScore}>Compliance Score: {pct}%</Text>
                </View>
              </View>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={()=>{setShowMenu(false);router.push('/onboard');}}>
                <Text style={styles.menuItemIcon}>⚙️</Text>
                <Text style={styles.menuItemText}>Change my profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={()=>{setShowMenu(false);router.push('/accountants');}}>
                <Text style={styles.menuItemIcon}>👔</Text>
                <Text style={styles.menuItemText}>Find an Accountant</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={testNotification}>
                <Text style={styles.menuItemIcon}>🔔</Text>
                <Text style={styles.menuItemText}>Test notifications</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={logout}>
                <Text style={styles.menuItemIcon}>🚪</Text>
                <Text style={[styles.menuItemText,{color:C.red}]}>Log out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── DEADLINE DETAIL MODAL ── */}
        <Modal visible={!!selected} animationType="slide" transparent onRequestClose={()=>setSelected(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {selected&&(()=>{
                const calc = calcPenalty(selected.category,monthlyRevenue,selected.due_date,selected.done);
                const penaltyCapped = calc.totalPenalty>=PENALTY_CAP;
                return (
                  <>
                    <View style={[styles.modalStrip,{backgroundColor:selected.status==='urgent'?C.red:selected.status==='done'?C.ruled:C.yellow}]} />
                    <Text style={styles.modalTitle}>{selected.title}</Text>
                    <Text style={styles.modalDate}>{selected.month} {selected.day}</Text>
                    <View style={[styles.tag,{borderColor:TAG_COLOR[selected.category]||C.muted,marginBottom:12}]}>
                      <Text style={[styles.tagText,{color:TAG_COLOR[selected.category]||C.muted}]}>{selected.category}</Text>
                    </View>
                    {selected.description?<Text style={styles.modalDesc}>{selected.description}</Text>:null}
                    {!selected.done&&(
                      <View style={calc.isOverdue?styles.penaltyBoxDanger:styles.penaltyBox}>
                        {calc.isOverdue?(
                          <>
                            <Text style={styles.penaltyLabelDanger}>🚨 OVERDUE — Fine accumulating now</Text>
                            <Text style={styles.penaltyCounterDanger}>{penaltyCapped?'>':''}{formatMoney(livePenalty,'€')}</Text>
                            <Text style={styles.penaltySubDanger}>{calc.daysLate} day{calc.daysLate!==1?'s':''} late · {penaltyCapped?'Cap reached':'Growing every second'}</Text>
                          </>
                        ):(
                          <>
                            <Text style={styles.penaltyLabel}>⚠️ Estimated penalty if missed</Text>
                            <Text style={styles.penaltyCounter}>{penaltyCapped?'>':''}{formatMoney(calc.totalPenalty,'€')}</Text>
                            <Text style={styles.penaltySub}>Based on your €{monthlyRevenue.toLocaleString()}/month revenue</Text>
                          </>
                        )}
                        <Text style={styles.penaltyDisclaimer}>
                          ⓘ Estimates only. Actual penalties vary by jurisdiction and circumstances. Consult a qualified accountant or tax advisor for advice specific to your situation.
                        </Text>
                      </View>
                    )}
                    {!selected.done && (
                      <TouchableOpacity style={styles.findExpertBtn} onPress={()=>{ setSelected(null); router.push('/accountants'); }}>
                        <Text style={styles.findExpertBtnText}>👔 Need help? Find an accountant</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.btn} onPress={()=>toggle(selected.id)}>
                      <Text style={styles.btnText}>{selected.done?'Mark as Not Done':'✔ Mark as Done — Stop the fine'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.closeBtn} onPress={()=>setSelected(null)}>
                      <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

// ── COMPLY AI COMPONENT ──────────────────────────────────────────────────────
const API = 'https://comply.up.railway.app';

function ComplyAI({ monthlyRevenue, userName }: { monthlyRevenue:number; userName:string }) {
  const [messages, setMessages]   = useState<{role:string;content:string;actions?:any[]}[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [usage, setUsage]         = useState(0);
  const [limit, setLimit]         = useState(10);
  const [limitReached, setLimitReached] = useState(false);
  const scrollRef = useRef<any>(null);

  const SUGGESTIONS = [
    'What deadlines do I have this month?',
    'How much IVA do I owe?',
    'Am I at risk of any fines?',
    'What taxes do I need to pay?',
    'Do I need an accountant?',
  ];

  useEffect(()=>{
    // Load usage
    fetch(`${API}/api/ai/usage`,{credentials:'include'})
      .then(r=>r.json())
      .then(d=>{ setUsage(d.usage||0); setLimit(d.limit||10); })
      .catch(()=>{});
    // Welcome message
    setMessages([{
      role:'assistant',
      content:`Hi ${userName ? userName.split(' ')[0] : 'there'}! 👋 I'm COMPLY AI — I know your deadlines, your country, and your business. Ask me anything about taxes, compliance, or what you owe.`,
    }]);
  },[]);

  const send = async (text?:string) => {
    const q = (text||input).trim();
    if (!q||loading) return;
    setInput('');
    const newMessages = [...messages, {role:'user',content:q}];
    setMessages(newMessages);
    setLoading(true);
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),100);

    try {
      const res = await fetch(`${API}/api/ai/chat`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({
          message: q,
          history: newMessages.slice(-10).map(m=>({role:m.role,content:m.content})),
        }),
      });
      const data = await res.json();

      if (res.status===429) {
        setLimitReached(true);
        setMessages(prev=>[...prev,{role:'assistant',content:data.message||'Monthly limit reached. Upgrade to Pro for unlimited access.'}]);
      } else if (data.reply) {
        setMessages(prev=>[...prev,{role:'assistant',content:data.reply,actions:data.actions||[]}]);
        setUsage(data.usage||0);
        setLimit(data.limit||10);
      } else {
        setMessages(prev=>[...prev,{role:'assistant',content:'Sorry, I had trouble with that. Please try again.'}]);
      }
    } catch (e:any) {
      setMessages(prev=>[...prev,{role:'assistant',content:`Network error: ${e?.message || String(e)}`}]);
    } finally {
      setLoading(false);
      setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),100);
    }
  };

  const handleAction = async (action:any) => {
    if (action.type==='CREATE_DEADLINE') {
      try {
        const parts = action.date.split('-');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        await fetch(`${API}/deadlines`,{
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
          body: JSON.stringify({
            title: action.title,
            due_date: action.date,
            month: months[parseInt(parts[1])-1]||'',
            day: parts[2]||'',
            category: 'tax',
            description: 'Created by COMPLY AI',
            penalty: '',
          }),
        });
        setMessages(prev=>[...prev,{role:'assistant',content:`✅ Deadline "${action.title}" created for ${action.date}!`}]);
      } catch {
        setMessages(prev=>[...prev,{role:'assistant',content:'Could not create deadline. Please add it manually.'}]);
      }
    } else if (action.type==='FIND_ACCOUNTANT') {
      setMessages(prev=>[...prev,{role:'assistant',content:'Go to the 👔 Experts tab to find a qualified accountant in your country.'}]);
    } else if (action.type==='UPLOAD_DOC') {
      setMessages(prev=>[...prev,{role:'assistant',content:'Go to the 📁 Docs tab to upload your documents securely.'}]);
    }
  };

  return (
    <View style={aiStyles.flex}>
      {/* Header */}
      <View style={aiStyles.header}>
        <View style={aiStyles.headerLeft}>
          <View style={aiStyles.aiAvatar}>
            <Text style={aiStyles.aiAvatarText}>✦</Text>
          </View>
          <View>
            <Text style={aiStyles.aiName}>COMPLY AI</Text>
            <Text style={aiStyles.aiSub}>Your compliance assistant</Text>
          </View>
        </View>
        <View style={aiStyles.usageChip}>
          <Text style={aiStyles.usageText}>{Math.max(0,limit-usage)} left</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={aiStyles.messages}
        contentContainerStyle={{padding:16}}
      >
        {messages.map((m,i)=>(
          <View key={i} style={[aiStyles.msgWrap,m.role==='user'&&aiStyles.msgWrapUser]}>
            <View style={[aiStyles.bubble,m.role==='user'&&aiStyles.bubbleUser]}>
              <Text style={[aiStyles.bubbleText,m.role==='user'&&aiStyles.bubbleTextUser]}>
                {m.content}
              </Text>
            </View>
            {/* Action buttons */}
            {m.actions&&m.actions.length>0&&(
              <View style={aiStyles.actions}>
                {m.actions.map((a,j)=>(
                  <TouchableOpacity key={j} style={aiStyles.actionBtn} onPress={()=>handleAction(a)}>
                    <Text style={aiStyles.actionBtnText}>
                      {a.type==='CREATE_DEADLINE'?`➕ Add "${a.title}"`
                       :a.type==='FIND_ACCOUNTANT'?'👔 Find Accountant'
                       :'📁 Upload Document'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
        {loading&&(
          <View style={aiStyles.msgWrap}>
            <View style={aiStyles.bubble}>
              <View style={aiStyles.typingDots}>
                <ActivityIndicator color={C.muted} size="small"/>
                <Text style={aiStyles.typingText}>COMPLY AI is thinking...</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Suggestions (only show when no messages beyond welcome) */}
      {messages.length<=1&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={aiStyles.suggestions}>
          {SUGGESTIONS.map(s=>(
            <TouchableOpacity key={s} style={aiStyles.suggestionChip} onPress={()=>send(s)}>
              <Text style={aiStyles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Usage bar */}
      {usage>0&&(
        <View style={aiStyles.usageBar}>
          <View style={[aiStyles.usageFill,{width:`${Math.min((usage/limit)*100,100)}%` as any, backgroundColor: usage>=limit?C.red:C.green}]}/>
        </View>
      )}

      {/* Input */}
      {limitReached ? (
        <View style={aiStyles.limitBox}>
          <Text style={aiStyles.limitText}>🔒 You've used all {limit} free questions this month.</Text>
          <Text style={aiStyles.limitSub}>Upgrade to Pro for unlimited COMPLY AI access.</Text>
        </View>
      ) : (
        <View style={aiStyles.inputRow}>
          <TextInput
            style={aiStyles.input}
            placeholder="Ask about your taxes, deadlines, compliance..."
            placeholderTextColor={C.muted}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={()=>send()}
          />
          <TouchableOpacity
            style={[aiStyles.sendBtn,(!input.trim()||loading)&&aiStyles.sendBtnOff]}
            onPress={()=>send()}
            disabled={!input.trim()||loading}
          >
            <Text style={aiStyles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const C_AI = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8', ink:'#1a1714',
  red:'#d94f3d', green:'#2a7d4f', yellow:'#c49a0a', muted:'#8c7e6a', gold:'#c49a0a',
};

const aiStyles = StyleSheet.create({
  flex:            { flex:1, backgroundColor:'#0f0f0f' },
  header:          { backgroundColor:'#0f0f0f', paddingHorizontal:20, paddingTop:0, paddingBottom:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:'#1a1a1a' },
  headerLeft:      { flexDirection:'row', alignItems:'center', gap:10 },
  aiAvatar:        { width:38, height:38, borderRadius:19, backgroundColor:C_AI.gold, alignItems:'center', justifyContent:'center' },
  aiAvatarText:    { color:'#000', fontSize:18, fontWeight:'900' },
  aiName:          { fontSize:16, fontWeight:'700', color:'#fff' },
  aiSub:           { fontSize:11, color:'#555' },
  usageChip:       { backgroundColor:'#1a1a1a', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  usageText:       { fontSize:11, color:'#888' },
  messages:        { flex:1 },
  msgWrap:         { marginBottom:12, alignItems:'flex-start' },
  msgWrapUser:     { alignItems:'flex-end' },
  bubble:          { backgroundColor:'#1a1a1a', borderRadius:16, borderBottomLeftRadius:2, padding:14, maxWidth:'85%' },
  bubbleUser:      { backgroundColor:C_AI.gold, borderBottomLeftRadius:16, borderBottomRightRadius:2 },
  bubbleText:      { fontSize:14, color:'#ddd', lineHeight:22 },
  bubbleTextUser:  { color:'#000' },
  actions:         { marginTop:8, gap:6 },
  actionBtn:       { backgroundColor:'#1a1a1a', borderWidth:1, borderColor:C_AI.gold, borderRadius:8, paddingHorizontal:14, paddingVertical:10 },
  actionBtnText:   { color:C_AI.gold, fontSize:13, fontWeight:'600' },
  typingDots:      { flexDirection:'row', alignItems:'center', gap:8 },
  typingText:      { fontSize:13, color:'#555' },
  suggestions:     { paddingHorizontal:16, paddingVertical:10, borderTopWidth:1, borderTopColor:'#1a1a1a' },
  suggestionChip:  { backgroundColor:'#1a1a1a', borderWidth:1, borderColor:'#2a2a2a', borderRadius:20, paddingHorizontal:14, paddingVertical:8, marginRight:8 },
  suggestionText:  { color:'#888', fontSize:12 },
  usageBar:        { height:2, backgroundColor:'#1a1a1a', marginHorizontal:0 },
  usageFill:       { height:'100%' },
  limitBox:        { backgroundColor:'#1a0505', borderTopWidth:1, borderTopColor:C_AI.red, padding:16, alignItems:'center' },
  limitText:       { color:'#ff9999', fontSize:13, fontWeight:'600', marginBottom:4 },
  limitSub:        { color:'#ff6666', fontSize:12 },
  inputRow:        { flexDirection:'row', gap:8, padding:12, backgroundColor:'#0f0f0f', borderTopWidth:1, borderTopColor:'#1a1a1a', paddingBottom:Platform.OS==='ios'?28:12 },
  input:           { flex:1, backgroundColor:'#1a1a1a', borderWidth:1, borderColor:'#2a2a2a', borderRadius:12, padding:12, fontSize:14, color:'#ddd', maxHeight:100 },
  sendBtn:         { backgroundColor:C_AI.gold, borderRadius:12, paddingHorizontal:16, alignItems:'center', justifyContent:'center' },
  sendBtnOff:      { opacity:0.3 },
  sendBtnText:     { color:'#000', fontSize:18, fontWeight:'900' },
});

// ── COMPONENTS ───────────────────────────────────────────────────────────────
function Block({title,count,children}:any) {
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

function DeadlineRow({d,monthlyRevenue,onToggle,onPress}:{d:Deadline;monthlyRevenue:number;onToggle:(id:number)=>void;onPress:()=>void}) {
  const stripColor = d.status==='urgent'?C.red:d.status==='done'?C.ruled:C.yellow;
  const color      = TAG_COLOR[d.category]||C.muted;
  const calc       = d.due_date&&!d.done ? calcPenalty(d.category,monthlyRevenue,d.due_date,d.done) : null;
  return (
    <TouchableOpacity style={[styles.row,{borderLeftColor:stripColor}]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.dueBox}>
        <Text style={styles.dueMonth}>{d.month}</Text>
        <Text style={[styles.dueDay,d.status==='urgent'&&{color:C.red},d.status==='done'&&{color:C.ruled}]}>{d.day}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle,d.done&&styles.rowTitleDone]} numberOfLines={1}>{d.title}</Text>
        <View style={styles.rowBottom}>
          <View style={[styles.tag,{borderColor:color}]}>
            <Text style={[styles.tagText,{color}]}>{d.category}</Text>
          </View>
          {calc&&calc.totalPenalty>0&&(
            <Text style={[styles.rowPenalty,calc.isOverdue&&styles.rowPenaltyDanger]}>
              {calc.isOverdue?'🚨':'⚠️'} {calc.totalPenalty>=PENALTY_CAP?'>':''}{formatMoney(calc.totalPenalty,'€')}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={[styles.checkBtn,d.done&&styles.checkBtnDone]} onPress={()=>onToggle(d.id)}>
        <Text style={{color:d.done?'#fff':'transparent',fontSize:12}}>✔</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function Empty({text}:{text:string}) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:                { flex:1, backgroundColor:C.bg },
  center:              { padding:40, alignItems:'center' },
  header:              { backgroundColor:C.ink, paddingHorizontal:20, paddingTop:60, paddingBottom:14, flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between' },
  logo:                { fontSize:26, fontWeight:'900', color:'#fff' },
  logoAccent:          { color:'#c49a0a' },
  logoSub:             { fontSize:8, color:'#555', letterSpacing:2, textTransform:'uppercase', marginTop:2 },
  userBtn:             { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  avatar:              { width:24, height:24, borderRadius:12, backgroundColor:'#c49a0a', alignItems:'center', justifyContent:'center' },
  avatarText:          { color:C.ink, fontSize:11, fontWeight:'700' },
  scoreTxt:            { color:'#c49a0a', fontSize:11 },
  riskBanner:          { backgroundColor:'#1a0a0a', flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:10 },
  riskText:            { fontSize:11, color:'#ff9999', flex:1 },
  riskAmount:          { fontSize:15, fontWeight:'900', color:C.red },
  alertStrip:          { backgroundColor:'#fff8e6', borderBottomWidth:1, borderBottomColor:'#ddb830', flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:8, gap:8 },
  alertDot:            { width:7, height:7, borderRadius:4, backgroundColor:C.red },
  alertText:           { fontSize:11, color:'#7a5500', flex:1 },
  tabBar:              { flexDirection:'row', backgroundColor:C.bg, borderBottomWidth:2, borderBottomColor:C.ruled },
  tabBtn:              { flex:1, paddingVertical:12, alignItems:'center', borderBottomWidth:2.5, borderBottomColor:'transparent' },
  tabBtnActive:        { borderBottomColor:C.ink },
  tabIcon:             { fontSize:20 },
  body:                { flex:1, padding:14 },
  scoreCard:           { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  scoreCardLabel:      { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:2 },
  scoreCardPct:        { fontSize:32, fontWeight:'900' },
  scoreCardStatus:     { fontSize:11, fontWeight:'600', marginTop:2 },
  scoreCardRight:      { gap:8, alignItems:'flex-end' },
  shareScoreBtn:       { backgroundColor:C.ink, borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  shareScoreBtnText:   { color:'#fff', fontSize:12, fontWeight:'600' },
  expertBtn:           { backgroundColor:C.gold, borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  expertBtnText:       { color:C.ink, fontSize:12, fontWeight:'600' },
  progressWrap:        { marginBottom:14 },
  progressLabels:      { flexDirection:'row', justifyContent:'space-between', marginBottom:4 },
  progressLabel:       { fontSize:11, color:C.muted },
  progressBar:         { height:6, backgroundColor:C.ruled, borderRadius:10, overflow:'hidden' },
  progressFill:        { height:'100%', backgroundColor:C.green, borderRadius:10 },
  block:               { marginBottom:14 },
  blockHeader:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#ede8da', borderWidth:1.5, borderColor:C.ruled, borderBottomWidth:0, borderTopLeftRadius:8, borderTopRightRadius:8, paddingHorizontal:12, paddingVertical:7 },
  blockTitle:          { fontSize:12, color:C.muted, fontWeight:'500' },
  blockCount:          { backgroundColor:C.ink, borderRadius:20, paddingHorizontal:7, paddingVertical:2 },
  blockCountText:      { color:'#fff', fontSize:9 },
  blockBody:           { borderWidth:1.5, borderColor:C.ruled, borderBottomLeftRadius:8, borderBottomRightRadius:8, overflow:'hidden', backgroundColor:C.surface },
  row:                 { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.ruled, borderLeftWidth:3.5, gap:10 },
  dueBox:              { alignItems:'center', width:40 },
  dueMonth:            { fontSize:8, textTransform:'uppercase', letterSpacing:1, color:C.muted },
  dueDay:              { fontSize:22, fontWeight:'700', color:C.ink, lineHeight:24 },
  rowInfo:             { flex:1 },
  rowTitle:            { fontSize:13, fontWeight:'500', color:C.ink, marginBottom:3 },
  rowTitleDone:        { textDecorationLine:'line-through', color:C.muted },
  rowBottom:           { flexDirection:'row', alignItems:'center', gap:8 },
  tag:                 { borderWidth:1.5, borderRadius:20, paddingHorizontal:6, paddingVertical:2 },
  tagText:             { fontSize:9, textTransform:'uppercase', letterSpacing:1 },
  rowPenalty:          { fontSize:10, color:C.yellow, fontWeight:'600' },
  rowPenaltyDanger:    { color:C.red },
  checkBtn:            { width:28, height:28, borderRadius:14, borderWidth:2, borderColor:C.ruled, alignItems:'center', justifyContent:'center' },
  checkBtnDone:        { backgroundColor:C.green, borderColor:C.green },
  empty:               { padding:16, alignItems:'center' },
  emptyText:           { fontSize:12, color:C.muted },
  feedHeader:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.ruled, backgroundColor:C.surface },
  feedTitle:           { fontSize:16, fontWeight:'700', color:C.ink },
  feedSub:             { fontSize:11, color:C.muted, marginTop:2 },
  feedShareBtn:        { backgroundColor:C.ink, borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  feedShareBtnText:    { color:'#fff', fontSize:12, fontWeight:'600' },
  feedEmpty:           { alignItems:'center', padding:40 },
  feedEmptyIcon:       { fontSize:48, marginBottom:12 },
  feedEmptyTitle:      { fontSize:18, fontWeight:'700', color:C.ink, marginBottom:8 },
  feedEmptySub:        { fontSize:13, color:C.muted, textAlign:'center', lineHeight:20, marginBottom:20 },
  feedCard:            { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:14, marginBottom:10, flexDirection:'row', alignItems:'center', gap:12 },
  feedScoreRing:       { width:56, height:56, borderRadius:28, borderWidth:3, alignItems:'center', justifyContent:'center', flexShrink:0 },
  feedScorePct:        { fontSize:16, fontWeight:'900' },
  feedCardInfo:        { flex:1 },
  feedCardName:        { fontSize:14, fontWeight:'600', color:C.ink, marginBottom:2 },
  feedCardMeta:        { flexDirection:'row', gap:8, marginBottom:2 },
  feedMeta:            { fontSize:11, color:C.muted },
  feedCardStatus:      { fontSize:11, fontWeight:'600', marginBottom:2 },
  feedCardTime:        { fontSize:10, color:C.muted },
  likeBtn:             { alignItems:'center', padding:8, borderRadius:8, borderWidth:1.5, borderColor:C.ruled, minWidth:44 },
  likeBtnActive:       { backgroundColor:'#fff8ee', borderColor:C.gold },
  likeIcon:            { fontSize:18 },
  likeCount:           { fontSize:10, color:C.muted, marginTop:2 },
  likeCountActive:     { color:C.gold, fontWeight:'700' },
  findExpertBtn:       { backgroundColor:'#fff8ee', borderWidth:1.5, borderColor:C.gold, borderRadius:8, padding:12, alignItems:'center', marginBottom:12 },
  findExpertBtnText:   { fontSize:13, color:'#7a5500', fontWeight:'600' },
  formCard:            { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:12, padding:20 },
  formTitle:           { fontSize:20, fontWeight:'700', color:C.ink, marginBottom:16 },
  label:               { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:6 },
  input:               { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, marginBottom:14 },
  catRow:              { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 },
  catBtn:              { borderWidth:1.5, borderColor:C.ruled, borderRadius:20, paddingHorizontal:12, paddingVertical:6 },
  catBtnSelected:      { backgroundColor:C.ink, borderColor:C.ink },
  catText:             { fontSize:12, color:C.muted, textTransform:'uppercase' },
  catTextSelected:     { color:'#fff' },
  feedback:            { fontSize:13, color:C.red, textAlign:'center', marginBottom:10 },
  sharePreview:        { borderWidth:2, borderRadius:12, padding:20, alignItems:'center', marginVertical:16 },
  sharePreviewPct:     { fontSize:40, fontWeight:'900' },
  sharePreviewStatus:  { fontSize:14, fontWeight:'600', marginTop:4 },
  sharePreviewName:    { fontSize:12, color:C.muted, marginTop:6 },
  anonRow:             { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:C.bg, borderRadius:10, padding:14, marginBottom:16 },
  anonLabel:           { fontSize:14, color:C.ink, fontWeight:'500' },
  anonSub:             { fontSize:11, color:C.muted, marginTop:2 },
  aiWrap:              { flex:1, backgroundColor:C.ink, padding:16, paddingBottom:0 },
  aiHeader:            { flexDirection:'row', alignItems:'center', gap:10, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)', marginBottom:12 },
  aiIcon:              { width:36, height:36, backgroundColor:'#8a6a00', borderRadius:8, alignItems:'center', justifyContent:'center' },
  aiName:              { fontSize:15, color:'#fff', fontWeight:'600' },
  aiSub:               { fontSize:11, color:'#555' },
  aiMessages:          { flex:1, marginBottom:8 },
  aiMsg:               { backgroundColor:'rgba(255,255,255,0.07)', borderRadius:10, padding:12, marginBottom:8, maxWidth:'85%', alignSelf:'flex-start' },
  aiMsgUser:           { backgroundColor:'#c49a0a', alignSelf:'flex-end' },
  aiMsgText:           { fontSize:13, color:'#ccc', lineHeight:20 },
  aiMsgTextUser:       { color:C.ink },
  suggestions:         { marginBottom:8 },
  suggestion:          { backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderRadius:20, paddingHorizontal:12, paddingVertical:6, marginRight:8 },
  suggestionText:      { color:'#888', fontSize:11 },
  aiInputRow:          { flexDirection:'row', gap:8, paddingBottom:16 },
  aiInput:             { flex:1, backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', borderRadius:8, padding:12, color:'#ddd', fontSize:13 },
  aiSendBtn:           { backgroundColor:'#c49a0a', borderRadius:8, paddingHorizontal:16, alignItems:'center', justifyContent:'center' },
  aiSendText:          { color:C.ink, fontSize:18, fontWeight:'700' },
  bottomNav:           { flexDirection:'row', backgroundColor:C.ink, borderTopWidth:1, borderTopColor:'#2a2520', paddingBottom:Platform.OS==='ios'?20:8 },
  navItem:             { flex:1, alignItems:'center', paddingVertical:10 },
  navIcon:             { fontSize:20, marginBottom:2 },
  navLabel:            { fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:1 },
  navLabelActive:      { color:'#c49a0a' },
  menuOverlay:         { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  menuCard:            { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:40 },
  menuHeader:          { flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 },
  menuAvatar:          { width:48, height:48, borderRadius:24, backgroundColor:'#c49a0a', alignItems:'center', justifyContent:'center' },
  menuAvatarText:      { color:C.ink, fontSize:20, fontWeight:'700' },
  menuName:            { fontSize:16, fontWeight:'600', color:C.ink },
  menuScore:           { fontSize:12, color:C.muted, marginTop:2 },
  menuDivider:         { height:1, backgroundColor:C.ruled, marginVertical:8 },
  menuItem:            { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12 },
  menuItemIcon:        { fontSize:20, width:28 },
  menuItemText:        { fontSize:15, color:C.ink },
  modalOverlay:        { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalCard:           { backgroundColor:C.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:40 },
  modalStrip:          { height:4, borderRadius:2, width:60, alignSelf:'center', marginBottom:16 },
  modalTitle:          { fontSize:20, fontWeight:'700', color:C.ink, marginBottom:4 },
  modalDate:           { fontSize:14, color:C.muted, marginBottom:12 },
  modalDesc:           { fontSize:13, color:C.muted, lineHeight:20, marginBottom:12 },
  penaltyBox:          { backgroundColor:'#fff8ee', borderWidth:1.5, borderColor:'#f5d9a0', borderRadius:10, padding:16, marginBottom:16, alignItems:'center' },
  penaltyLabel:        { fontSize:12, color:'#7a5500', marginBottom:6 },
  penaltyCounter:      { fontSize:32, fontWeight:'900', color:C.yellow },
  penaltySub:          { fontSize:11, color:'#7a5500', marginTop:4, textAlign:'center' },
  penaltyDisclaimer:   { fontSize:10, color:'#9a8a70', marginTop:10, textAlign:'center', lineHeight:14, paddingHorizontal:4, fontStyle:'italic' },
  penaltyBoxDanger:    { backgroundColor:'#1a0505', borderWidth:1.5, borderColor:C.red, borderRadius:10, padding:16, marginBottom:16, alignItems:'center' },
  penaltyLabelDanger:  { fontSize:12, color:'#ff9999', marginBottom:6 },
  penaltyCounterDanger:{ fontSize:36, fontWeight:'900', color:C.red },
  penaltySubDanger:    { fontSize:11, color:'#ff9999', marginTop:4, textAlign:'center' },
  btn:                 { backgroundColor:C.ink, borderRadius:8, padding:14, alignItems:'center' },
  btnDisabled:         { opacity:0.4 },
  btnText:             { color:'#fff', fontSize:15, fontWeight:'600' },
  closeBtn:            { marginTop:12, alignItems:'center' },
  closeBtnText:        { color:C.muted, fontSize:13 },
});
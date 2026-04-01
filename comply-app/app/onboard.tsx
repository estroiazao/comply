import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform
} from 'react-native';
import { router } from 'expo-router';

const API = 'https://comply.up.railway.app';

const C = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8',
  ink:'#1a1714', red:'#d94f3d', green:'#2a7d4f',
  muted:'#8c7e6a', gold:'#c49a0a',
};

const COUNTRIES = [
  {code:'AF',name:'Afghanistan',flag:'🇦🇫'},{code:'AL',name:'Albania',flag:'🇦🇱'},{code:'DZ',name:'Algeria',flag:'🇩🇿'},
  {code:'AD',name:'Andorra',flag:'🇦🇩'},{code:'AO',name:'Angola',flag:'🇦🇴'},{code:'AR',name:'Argentina',flag:'🇦🇷'},
  {code:'AM',name:'Armenia',flag:'🇦🇲'},{code:'AU',name:'Australia',flag:'🇦🇺'},{code:'AT',name:'Austria',flag:'🇦🇹'},
  {code:'AZ',name:'Azerbaijan',flag:'🇦🇿'},{code:'BS',name:'Bahamas',flag:'🇧🇸'},{code:'BH',name:'Bahrain',flag:'🇧🇭'},
  {code:'BD',name:'Bangladesh',flag:'🇧🇩'},{code:'BE',name:'Belgium',flag:'🇧🇪'},{code:'BR',name:'Brazil',flag:'🇧🇷'},
  {code:'BG',name:'Bulgaria',flag:'🇧🇬'},{code:'CA',name:'Canada',flag:'🇨🇦'},{code:'CL',name:'Chile',flag:'🇨🇱'},
  {code:'CN',name:'China',flag:'🇨🇳'},{code:'CO',name:'Colombia',flag:'🇨🇴'},{code:'HR',name:'Croatia',flag:'🇭🇷'},
  {code:'CY',name:'Cyprus',flag:'🇨🇾'},{code:'CZ',name:'Czech Republic',flag:'🇨🇿'},{code:'DK',name:'Denmark',flag:'🇩🇰'},
  {code:'EG',name:'Egypt',flag:'🇪🇬'},{code:'EE',name:'Estonia',flag:'🇪🇪'},{code:'FI',name:'Finland',flag:'🇫🇮'},
  {code:'FR',name:'France',flag:'🇫🇷'},{code:'DE',name:'Germany',flag:'🇩🇪'},{code:'GH',name:'Ghana',flag:'🇬🇭'},
  {code:'GR',name:'Greece',flag:'🇬🇷'},{code:'HU',name:'Hungary',flag:'🇭🇺'},{code:'IS',name:'Iceland',flag:'🇮🇸'},
  {code:'IN',name:'India',flag:'🇮🇳'},{code:'ID',name:'Indonesia',flag:'🇮🇩'},{code:'IE',name:'Ireland',flag:'🇮🇪'},
  {code:'IL',name:'Israel',flag:'🇮🇱'},{code:'IT',name:'Italy',flag:'🇮🇹'},{code:'JP',name:'Japan',flag:'🇯🇵'},
  {code:'JO',name:'Jordan',flag:'🇯🇴'},{code:'KZ',name:'Kazakhstan',flag:'🇰🇿'},{code:'KE',name:'Kenya',flag:'🇰🇪'},
  {code:'KR',name:'Korea (South)',flag:'🇰🇷'},{code:'KW',name:'Kuwait',flag:'🇰🇼'},{code:'LV',name:'Latvia',flag:'🇱🇻'},
  {code:'LB',name:'Lebanon',flag:'🇱🇧'},{code:'LT',name:'Lithuania',flag:'🇱🇹'},{code:'LU',name:'Luxembourg',flag:'🇱🇺'},
  {code:'MY',name:'Malaysia',flag:'🇲🇾'},{code:'MT',name:'Malta',flag:'🇲🇹'},{code:'MX',name:'Mexico',flag:'🇲🇽'},
  {code:'MD',name:'Moldova',flag:'🇲🇩'},{code:'MA',name:'Morocco',flag:'🇲🇦'},{code:'NL',name:'Netherlands',flag:'🇳🇱'},
  {code:'NZ',name:'New Zealand',flag:'🇳🇿'},{code:'NG',name:'Nigeria',flag:'🇳🇬'},{code:'NO',name:'Norway',flag:'🇳🇴'},
  {code:'OM',name:'Oman',flag:'🇴🇲'},{code:'PK',name:'Pakistan',flag:'🇵🇰'},{code:'PE',name:'Peru',flag:'🇵🇪'},
  {code:'PH',name:'Philippines',flag:'🇵🇭'},{code:'PL',name:'Poland',flag:'🇵🇱'},{code:'PT',name:'Portugal',flag:'🇵🇹'},
  {code:'QA',name:'Qatar',flag:'🇶🇦'},{code:'RO',name:'Romania',flag:'🇷🇴'},{code:'RU',name:'Russia',flag:'🇷🇺'},
  {code:'SA',name:'Saudi Arabia',flag:'🇸🇦'},{code:'SG',name:'Singapore',flag:'🇸🇬'},{code:'SK',name:'Slovakia',flag:'🇸🇰'},
  {code:'SI',name:'Slovenia',flag:'🇸🇮'},{code:'ZA',name:'South Africa',flag:'🇿🇦'},{code:'ES',name:'Spain',flag:'🇪🇸'},
  {code:'SE',name:'Sweden',flag:'🇸🇪'},{code:'CH',name:'Switzerland',flag:'🇨🇭'},{code:'TW',name:'Taiwan',flag:'🇹🇼'},
  {code:'TH',name:'Thailand',flag:'🇹🇭'},{code:'TN',name:'Tunisia',flag:'🇹🇳'},{code:'TR',name:'Turkey',flag:'🇹🇷'},
  {code:'UA',name:'Ukraine',flag:'🇺🇦'},{code:'AE',name:'United Arab Emirates',flag:'🇦🇪'},
  {code:'UK',name:'United Kingdom',flag:'🇬🇧'},{code:'US',name:'United States',flag:'🇺🇸'},
  {code:'UY',name:'Uruguay',flag:'🇺🇾'},{code:'VN',name:'Vietnam',flag:'🇻🇳'},{code:'OTHER',name:'Other Country',flag:'🌍'},
];

const INDUSTRIES = [
  {value:'food',label:'Food & Drink',icon:'🍕'},
  {value:'retail',label:'Retail',icon:'🛍️'},
  {value:'services',label:'Services',icon:'✂️'},
  {value:'construction',label:'Construction',icon:'🔨'},
  {value:'freelance',label:'Freelance',icon:'💻'},
  {value:'other',label:'Other',icon:'📦'},
];

const EMPLOYEES = [
  {value:'solo',label:'Just me'},
  {value:'2-5',label:'2–5'},
  {value:'6-20',label:'6–20'},
  {value:'20+',label:'20+'},
];

export default function OnboardScreen() {
  const [step, setStep]             = useState(1);
  const [search, setSearch]         = useState('');
  const [country, setCountry]       = useState<any>(null);
  const [industry, setIndustry]     = useState('');
  const [employees, setEmployees]   = useState('');
  const [revenueText, setRevenueText] = useState('');
  const [loading, setLoading]       = useState(false);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const revenueNum = parseInt(revenueText.replace(/[^0-9]/g, '')) || 0;

  // Live penalty preview based on entered revenue
  const estimatedPenalty = revenueNum > 0
    ? Math.round((revenueNum * 3) * 0.10 + 200)
    : 0;

  const finish = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/onboard`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          country:         country?.code,
          region:          'national',
          industry,
          employees,
          monthly_revenue: revenueNum || 5000,
        }),
      });
      if (res.ok) router.replace('/(tabs)');
      else alert('Something went wrong. Please try again.');
    } catch {
      alert('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>COM<Text style={styles.gold}>PLY</Text></Text>
          <View style={styles.dots}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[
                styles.dot,
                step === i && styles.dotActive,
                step > i  && styles.dotDone
              ]} />
            ))}
          </View>
          <Text style={styles.stepLabel}>Step {step} of 4</Text>
        </View>

        {/* ── STEP 1: COUNTRY ── */}
        {step === 1 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>Where is your business?</Text>
            <Text style={styles.stepSub}>We'll load the right deadlines for your country automatically.</Text>

            {country ? (
              <View style={styles.selectedCountry}>
                <Text style={styles.selectedText}>{country.flag}  {country.name}</Text>
                <TouchableOpacity onPress={() => { setCountry(null); setSearch(''); }}>
                  <Text style={styles.changeBtn}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.search}
                  placeholder="🔍 Search your country..."
                  placeholderTextColor={C.muted}
                  value={search}
                  onChangeText={setSearch}
                />
                <FlatList
                  data={filtered.slice(0, 50)}
                  keyExtractor={item => item.code}
                  style={styles.countryList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.countryItem}
                      onPress={() => { setCountry(item); setSearch(''); }}
                    >
                      <Text style={styles.countryFlag}>{item.flag}</Text>
                      <Text style={styles.countryName}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.btn, !country && styles.btnDisabled]}
              onPress={() => country && setStep(2)}
              disabled={!country}
            >
              <Text style={styles.btnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: INDUSTRY ── */}
        {step === 2 && (
          <ScrollView style={styles.stepWrap}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>What kind of business?</Text>
            <Text style={styles.stepSub}>We'll add the specific permits your industry needs.</Text>

            <View style={styles.optionsGrid}>
              {INDUSTRIES.map(ind => (
                <TouchableOpacity
                  key={ind.value}
                  style={[styles.option, industry === ind.value && styles.optionSelected]}
                  onPress={() => setIndustry(ind.value)}
                >
                  <Text style={styles.optionIcon}>{ind.icon}</Text>
                  <Text style={[styles.optionLabel, industry === ind.value && styles.optionLabelSelected]}>
                    {ind.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, !industry && styles.btnDisabled]}
              onPress={() => industry && setStep(3)}
              disabled={!industry}
            >
              <Text style={styles.btnText}>Next →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── STEP 3: EMPLOYEES ── */}
        {step === 3 && (
          <View style={styles.stepWrap}>
            <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>How many employees?</Text>
            <Text style={styles.stepSub}>This determines which payroll deadlines apply to you.</Text>

            <View style={styles.empRow}>
              {EMPLOYEES.map(e => (
                <TouchableOpacity
                  key={e.value}
                  style={[styles.empOption, employees === e.value && styles.empOptionSelected]}
                  onPress={() => setEmployees(e.value)}
                >
                  <Text style={[styles.empLabel, employees === e.value && styles.empLabelSelected]}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, !employees && styles.btnDisabled]}
              onPress={() => employees && setStep(4)}
              disabled={!employees}
            >
              <Text style={styles.btnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 4: REVENUE ── */}
        {step === 4 && (
          <ScrollView style={styles.stepWrap}>
            <TouchableOpacity onPress={() => setStep(3)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>Monthly revenue?</Text>
            <Text style={styles.stepSub}>
              We use this to calculate your exact penalty if you miss a deadline. Your data is private and never shared.
            </Text>

            {/* Revenue input */}
            <View style={styles.revenueInputWrap}>
              <Text style={styles.currencySymbol}>€</Text>
              <TextInput
                style={styles.revenueInput}
                placeholder="e.g. 8500"
                placeholderTextColor={C.muted}
                value={revenueText}
                onChangeText={setRevenueText}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.revenueUnit}>/month</Text>
            </View>

            {/* Live penalty preview */}
            {revenueNum > 0 && (
              <View style={styles.penaltyPreview}>
                <Text style={styles.penaltyPreviewTitle}>⚠️ If you miss a quarterly tax filing:</Text>
                <Text style={styles.penaltyPreviewAmount}>
                  ~€{estimatedPenalty.toLocaleString()}
                </Text>
                <Text style={styles.penaltyPreviewSub}>
                  Based on €{revenueNum.toLocaleString()}/month · 10% of quarterly revenue + fixed fine
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, (!revenueNum || loading) && styles.btnDisabled]}
              onPress={finish}
              disabled={!revenueNum || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Set Up My Deadlines →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => { setRevenueText('5000'); setTimeout(finish, 100); }}>
              <Text style={styles.skipBtnText}>Skip this step</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:                { flex:1, backgroundColor:C.bg },
  container:           { flex:1, backgroundColor:C.bg },
  header:              { backgroundColor:C.ink, paddingTop:60, paddingBottom:20, paddingHorizontal:24, alignItems:'center' },
  logo:                { fontSize:28, fontWeight:'900', color:'#fff', marginBottom:12 },
  gold:                { color:'#c49a0a' },
  dots:                { flexDirection:'row', gap:6, marginBottom:6 },
  dot:                 { width:8, height:8, borderRadius:4, backgroundColor:'#333' },
  dotActive:           { backgroundColor:'#fff', transform:[{scale:1.3}] },
  dotDone:             { backgroundColor:C.green },
  stepLabel:           { fontSize:11, color:'#555', letterSpacing:1 },
  stepWrap:            { flex:1, padding:24 },
  stepTitle:           { fontSize:22, fontWeight:'700', color:C.ink, marginBottom:6, marginTop:8 },
  stepSub:             { fontSize:13, color:C.muted, marginBottom:20, lineHeight:20 },
  search:              { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:12, fontSize:14, color:C.ink, marginBottom:8 },
  countryList:         { maxHeight:280, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, marginBottom:16 },
  countryItem:         { flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:C.ruled, gap:10 },
  countryFlag:         { fontSize:20 },
  countryName:         { fontSize:14, color:C.ink },
  selectedCountry:     { backgroundColor:C.ink, borderRadius:8, padding:14, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  selectedText:        { color:'#fff', fontSize:14 },
  changeBtn:           { color:C.gold, fontSize:12 },
  optionsGrid:         { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:20 },
  option:              { width:'47%', backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:10, padding:14, alignItems:'center' },
  optionSelected:      { backgroundColor:C.ink, borderColor:C.ink },
  optionIcon:          { fontSize:24, marginBottom:6 },
  optionLabel:         { fontSize:12, color:C.muted, textAlign:'center' },
  optionLabelSelected: { color:'#fff' },
  empRow:              { flexDirection:'row', gap:10, marginBottom:24 },
  empOption:           { flex:1, backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:10, padding:14, alignItems:'center' },
  empOptionSelected:   { backgroundColor:C.ink, borderColor:C.ink },
  empLabel:            { fontSize:13, color:C.muted },
  empLabelSelected:    { color:'#fff' },
  revenueInputWrap:    { flexDirection:'row', alignItems:'center', backgroundColor:C.surface, borderWidth:2, borderColor:C.ink, borderRadius:12, paddingHorizontal:16, paddingVertical:4, marginBottom:20 },
  currencySymbol:      { fontSize:28, fontWeight:'700', color:C.ink, marginRight:6 },
  revenueInput:        { flex:1, fontSize:32, fontWeight:'700', color:C.ink, paddingVertical:12 },
  revenueUnit:         { fontSize:14, color:C.muted },
  penaltyPreview:      { backgroundColor:'#fff0ee', borderWidth:1.5, borderColor:'#f5c0b8', borderRadius:10, padding:16, marginBottom:20, alignItems:'center' },
  penaltyPreviewTitle: { fontSize:12, color:'#7a2a20', marginBottom:6 },
  penaltyPreviewAmount:{ fontSize:32, fontWeight:'900', color:C.red },
  penaltyPreviewSub:   { fontSize:11, color:'#7a2a20', marginTop:4, textAlign:'center', lineHeight:16 },
  backBtn:             { marginBottom:8 },
  backBtnText:         { fontSize:13, color:C.muted },
  btn:                 { backgroundColor:C.ink, borderRadius:8, padding:16, alignItems:'center' },
  btnDisabled:         { opacity:0.4 },
  btnText:             { color:'#fff', fontSize:15, fontWeight:'600' },
  skipBtn:             { marginTop:12, alignItems:'center', padding:8 },
  skipBtnText:         { fontSize:13, color:C.muted },
});
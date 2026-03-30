import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';

const API = 'https://comply.up.railway.app';

const C = {
  bg: '#f2ece0', surface: '#faf6ef', ruled: '#e0d8c8',
  ink: '#1a1714', red: '#d94f3d', green: '#2a7d4f',
  muted: '#8c7e6a', gold: '#c49a0a',
};

export default function RegisterScreen() {
  const [business, setBusiness] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const register = async () => {
    if (!email || !password) { setError('Please fill in email and password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, business_name: business }),
      });
      const data = await res.json();
      if (res.ok) {
        router.replace('/onboard');
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch (e) {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>

        <View style={styles.logoWrap}>
          <Text style={styles.logo}>COM<Text style={styles.logoAccent}>PLY</Text></Text>
          <Text style={styles.logoSub}>Create your free account</Text>
        </View>

        {/* PERKS */}
        <View style={styles.perks}>
          {['Never miss a tax or license deadline', 'Auto-loaded deadlines for 195 countries', 'Free to get started'].map(p => (
            <View key={p} style={styles.perkRow}>
              <View style={styles.perkDot} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sunrise Roasters LLC"
            placeholderTextColor={C.muted}
            value={business}
            onChangeText={setBusiness}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="you@yourbusiness.com"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text style={styles.hint}>At least 6 characters</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={register} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create Account →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.switchWrap}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Log in</Text></Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: C.bg },
  container:  { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap:   { alignItems: 'center', marginBottom: 20 },
  logo:       { fontSize: 36, fontWeight: '900', color: '#1a1714' },
  logoAccent: { color: '#c49a0a' },
  logoSub:    { fontSize: 10, color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  perks:      { marginBottom: 20 },
  perkRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  perkDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  perkText:   { fontSize: 13, color: C.muted },
  card:       { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 16, padding: 24 },
  label:      { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  input:      { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.ruled, borderRadius: 8, padding: 14, fontSize: 14, color: C.ink, marginBottom: 16 },
  hint:       { fontSize: 11, color: C.muted, marginTop: -10, marginBottom: 16 },
  error:      { color: C.red, fontSize: 12, marginBottom: 12, textAlign: 'center' },
  btn:        { backgroundColor: C.ink, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#fff', fontSize: 15, fontWeight: '600' },
  switchWrap: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 13, color: C.muted },
  switchLink: { color: C.ink, fontWeight: '600' },
});
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const API = 'https://comply.up.railway.app';

const C = {
  bg:'#f2ece0', surface:'#faf6ef', ruled:'#e0d8c8',
  ink:'#1a1714', red:'#d94f3d', green:'#2a7d4f',
  muted:'#8c7e6a', gold:'#c49a0a',
};

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // On app open — check if credentials are saved and auto-login
  useEffect(() => {
    autoLogin();
  }, []);

  const autoLogin = async () => {
    try {
      const savedEmail    = await SecureStore.getItemAsync('comply_email');
      const savedPassword = await SecureStore.getItemAsync('comply_password');

      if (savedEmail && savedPassword) {
        // Try to log in automatically
        const res = await fetch(`${API}/api/login`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: savedEmail, password: savedPassword }),
        });

        if (res.ok) {
          // Auto-login worked — go straight to app
          router.replace('/(tabs)');
          return;
        }
      }
    } catch {}
    // No saved credentials or auto-login failed — show login screen
    setLoading(false);
  };

  const login = async () => {
    if (!email || !password) { setError('Please fill in both fields.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/api/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        // Save credentials securely on the phone
        await SecureStore.setItemAsync('comply_email',    email);
        await SecureStore.setItemAsync('comply_password', password);
        router.replace('/(tabs)');
      } else {
        setError(data.error || 'Login failed.');
        setLoading(false);
      }
    } catch {
      setError('Could not connect to server.');
      setLoading(false);
    }
  };

  // Show loading spinner while checking saved credentials
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingLogo}>COM<Text style={styles.loadingAccent}>PLY</Text></Text>
        <ActivityIndicator color={C.ink} style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>Signing you in...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={styles.container}>

        <View style={styles.logoWrap}>
          <Text style={styles.logo}>COM<Text style={styles.logoAccent}>PLY</Text></Text>
          <Text style={styles.logoSub}>Business Deadline Planner</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to your account</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@yourbusiness.com"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={login} disabled={loading}>
            <Text style={styles.btnText}>Log In →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.switchWrap}>
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchLink}>Sign up free</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:          { flex:1, backgroundColor:C.bg },
  loadingWrap:   { flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' },
  loadingLogo:   { fontSize:40, fontWeight:'900', color:C.ink },
  loadingAccent: { color:'#c49a0a' },
  loadingText:   { fontSize:13, color:C.muted, marginTop:12 },
  container:     { flexGrow:1, justifyContent:'center', padding:24 },
  logoWrap:      { alignItems:'center', marginBottom:32 },
  logo:          { fontSize:36, fontWeight:'900', color:C.ink },
  logoAccent:    { color:C.gold },
  logoSub:       { fontSize:10, color:C.muted, letterSpacing:2, textTransform:'uppercase', marginTop:4 },
  card:          { backgroundColor:C.surface, borderWidth:1.5, borderColor:C.ruled, borderRadius:16, padding:24 },
  title:         { fontSize:22, fontWeight:'700', color:C.ink, marginBottom:4 },
  subtitle:      { fontSize:13, color:C.muted, marginBottom:24 },
  label:         { fontSize:10, color:C.muted, textTransform:'uppercase', letterSpacing:1.5, marginBottom:6 },
  input:         { backgroundColor:C.bg, borderWidth:1.5, borderColor:C.ruled, borderRadius:8, padding:14, fontSize:14, color:C.ink, marginBottom:16 },
  error:         { color:C.red, fontSize:12, marginBottom:12, textAlign:'center' },
  btn:           { backgroundColor:C.ink, borderRadius:8, padding:16, alignItems:'center', marginTop:4 },
  btnText:       { color:'#fff', fontSize:15, fontWeight:'600' },
  switchWrap:    { marginTop:20, alignItems:'center' },
  switchText:    { fontSize:13, color:C.muted },
  switchLink:    { color:C.ink, fontWeight:'600' },
});
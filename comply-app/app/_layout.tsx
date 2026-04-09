import { Stack } from 'expo-router';
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboard" />
      <Stack.Screen name="accountants" />
      <Stack.Screen name="accountant_dashboard" />
      <Stack.Screen name="documents" />
    </Stack>
  );
}
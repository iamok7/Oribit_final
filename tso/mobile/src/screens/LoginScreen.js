import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  
  txtMain:  '#020617', // Slate 950
  txtMuted: '#1E293B', // Slate 800
  txtFaint: '#475569', // Slate 600

  p100:     '#DBEAFE',
  p200:     '#BFDBFE',
  p300:     '#93C5FD',
  p400:     '#60A5FA',
  p500:     '#3B82F6',
  p600:     '#2563EB',
  p700:     '#1D4ED8',
  p800:     '#1E40AF',
  p900:     '#1E3A8A',
  
  white:    '#FFFFFF',
  red:      '#DC2626',
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter your username');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    setIsSubmitting(true);
    const result = await login(username.trim(), password);
    setIsSubmitting(false);
    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />

      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.p300 }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: '#A5F3FC', transform: [{ scale: 1.2 }] }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo & Title ── */}
          <View style={styles.titleSection}>
            <View style={styles.logoCircle}>
              <LinearGradient colors={[G.p500, G.p700]} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <Text style={styles.logoText}>TSO</Text>
            </View>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to manage your workspace</Text>
          </View>

          {/* ── Form Card (Glassmorphic) ── */}
          <View style={styles.shadowWrap}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              
              <View style={styles.cardInner}>
                
                {/* Username Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Username</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="person" size={18} color={G.p700} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your username"
                      placeholderTextColor={G.txtFaint}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      returnKeyType="next"
                      selectionColor={G.p600}
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="lock-closed" size={18} color={G.p700} />
                    </View>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Enter your password"
                      placeholderTextColor={G.txtFaint}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      selectionColor={G.p600}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color={G.txtFaint} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity
                  style={[styles.signInButton, isSubmitting && styles.signInButtonDisabled]}
                  onPress={handleLogin}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={G.white} />
                  ) : (
                    <>
                      <Text style={styles.signInButtonText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={18} color={G.white} />
                    </>
                  )}
                </TouchableOpacity>

              </View>
            </View>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>TSO Project Management System</Text>
            <Text style={styles.footerVersion}>v1.0.0</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  flex1: { flex: 1 },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  titleSection: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 24, ...liquidShadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25 },
  logoText: { fontSize: 28, fontWeight: '900', color: G.white, letterSpacing: 2 },
  welcomeTitle: { fontSize: 32, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  welcomeSubtitle: { fontSize: 16, color: G.txtFaint, fontWeight: '700', textAlign: 'center' },

  // ── Glass Bento Card ──
  shadowWrap: { width: '100%', ...liquidShadow },
  glassLight: { borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardInner: { padding: 24 },

  // ── Form Inputs ──
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '900', color: G.txtMain, marginBottom: 8, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16, borderWidth: 2, borderColor: G.p200,
    overflow: 'hidden',
  },
  inputIconContainer: {
    width: 48, height: 52, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1.5, borderRightColor: G.p200,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  input: {
    flex: 1, height: 52, paddingHorizontal: 16,
    fontSize: 16, color: G.txtMain, fontWeight: '800',
  },
  passwordInput: { paddingRight: 0 },
  eyeButton: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },

  // ── Submit Button ──
  signInButton: {
    backgroundColor: G.p700, borderRadius: 20, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 10, gap: 10,
    ...liquidShadow, shadowOffset: { width: 0, height: 6 },
  },
  signInButtonDisabled: { opacity: 0.6 },
  signInButtonText: { fontSize: 16, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Footer ──
  footer: { alignItems: 'center', marginTop: 40 },
  footerText: { fontSize: 13, color: G.txtFaint, fontWeight: '800' },
  footerVersion: { fontSize: 11, color: G.txtFaint, fontWeight: '800', marginTop: 4, opacity: 0.7 },
});
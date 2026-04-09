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

const G = {
  bgLight:  '#F0F6FF',
  bgMid:    '#E0F2FE',
  bgDark:   '#F8FAFC',
  txtMain:  '#020617',
  txtMuted: '#1E293B',
  txtFaint: '#475569',
  p100:     '#DBEAFE',
  p200:     '#BFDBFE',
  p300:     '#93C5FD',
  p500:     '#3B82F6',
  p600:     '#2563EB',
  p700:     '#1D4ED8',
  p800:     '#1E40AF',
  p900:     '#1E3A8A',
  white:    '#FFFFFF',
  red:      '#DC2626',
  green:    '#059669',
};

const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

export default function SignupScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignup = async () => {
    if (!firstName.trim()) return Alert.alert('Error', 'First name is required');
    if (!lastName.trim()) return Alert.alert('Error', 'Last name is required');
    if (!email.trim() || !email.includes('@')) return Alert.alert('Error', 'Enter a valid email address');
    if (password.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters');
    if (password !== confirmPassword) return Alert.alert('Error', 'Passwords do not match');

    setIsSubmitting(true);
    const result = await signup({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      user_type: 'individual',
    });
    setIsSubmitting(false);

    if (!result.success) {
      Alert.alert('Sign Up Failed', result.error || 'Please try again.');
    }
    // On success, AuthContext updates user → AppNavigator routes to Main automatically
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />

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
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 16 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={G.p700} />
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.titleSection}>
            <View style={styles.logoCircle}>
              <LinearGradient colors={[G.p500, G.p700]} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <Text style={styles.logoText}>TSO</Text>
            </View>
            <Text style={styles.welcomeTitle}>Create Account</Text>
            <Text style={styles.welcomeSubtitle}>Your personal task manager</Text>
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="person-circle-outline" size={18} color={G.p700} />
            <Text style={styles.infoText}>Use TaskOrbit as a personal task manager. Your tasks are private.</Text>
          </View>

          {/* Form */}
          <View style={styles.shadowWrap}>
            <View style={styles.glassLight}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />

              <View style={styles.cardInner}>

                {/* Name row */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>First Name</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="First"
                        placeholderTextColor={G.txtFaint}
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        editable={!isSubmitting}
                        selectionColor={G.p600}
                      />
                    </View>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Last Name</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Last"
                        placeholderTextColor={G.txtFaint}
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        editable={!isSubmitting}
                        selectionColor={G.p600}
                      />
                    </View>
                  </View>
                </View>

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="mail" size={18} color={G.p700} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={G.txtFaint}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      selectionColor={G.p600}
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="lock-closed" size={18} color={G.p700} />
                    </View>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Min 6 characters"
                      placeholderTextColor={G.txtFaint}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      selectionColor={G.p600}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color={G.txtFaint} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={[styles.inputWrapper, confirmPassword && password !== confirmPassword && styles.inputWrapperError]}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="lock-closed" size={18} color={G.p700} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Repeat password"
                      placeholderTextColor={G.txtFaint}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      selectionColor={G.p600}
                    />
                  </View>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.signInButton, isSubmitting && styles.signInButtonDisabled]}
                  onPress={handleSignup}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={G.white} />
                  ) : (
                    <>
                      <Text style={styles.signInButtonText}>Create Account</Text>
                      <Ionicons name="arrow-forward" size={18} color={G.white} />
                    </>
                  )}
                </TouchableOpacity>

              </View>
            </View>
          </View>

          {/* Sign In link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  flex1: { flex: 1 },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4 },

  backBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24 },

  titleSection: { alignItems: 'center', marginBottom: 28, marginTop: 60 },
  logoCircle: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16, ...liquidShadow },
  logoText: { fontSize: 22, fontWeight: '900', color: G.white, letterSpacing: 2 },
  welcomeTitle: { fontSize: 28, fontWeight: '900', color: G.txtMain, marginBottom: 6, letterSpacing: -0.5 },
  welcomeSubtitle: { fontSize: 14, color: G.txtFaint, fontWeight: '700', textAlign: 'center' },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: G.p200,
    padding: 4,
    marginBottom: 16,
    width: '100%',
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toggleBtnActive: { backgroundColor: G.p700 },
  toggleText: { fontSize: 14, fontWeight: '800', color: G.txtFaint, textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleTextActive: { color: G.white },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: G.p100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: G.p200,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  infoText: { flex: 1, fontSize: 13, color: G.txtMuted, fontWeight: '700', lineHeight: 18 },

  // Glass card
  shadowWrap: { width: '100%', ...liquidShadow },
  glassLight: { borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardInner: { padding: 20 },

  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain, marginBottom: 6, paddingLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14, borderWidth: 2, borderColor: G.p200,
    overflow: 'hidden',
  },
  inputWrapperValid: { borderColor: '#059669' },
  inputWrapperError: { borderColor: G.red },
  inputIconContainer: {
    width: 44, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1.5, borderRightColor: G.p200,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  input: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15, color: G.txtMain, fontWeight: '700' },
  passwordInput: { paddingRight: 0 },
  eyeButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },

  codeValid: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  codeStatusText: { fontSize: 13, fontWeight: '800' },
  hintText: { fontSize: 11, color: G.txtFaint, fontWeight: '700', marginTop: 4, paddingLeft: 2 },

  signInButton: {
    backgroundColor: G.p700, borderRadius: 18, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 8, gap: 10, ...liquidShadow, shadowOffset: { width: 0, height: 6 },
  },
  signInButtonDisabled: { opacity: 0.6 },
  signInButtonText: { fontSize: 16, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  footerText: { fontSize: 14, color: G.txtFaint, fontWeight: '700' },
  footerLink: { fontSize: 14, color: G.p700, fontWeight: '900' },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { createExpense } from '../services/api';
import { useAuth } from '../context/AuthContext';

const GUTTER = 16;
const GAP = 14;

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
  
  green:    '#059669',
  greenBg:  '#D1FAE5',
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
  purple:   '#7C3AED',
  purpleBg: '#EDE9FE',
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
};

const CATEGORIES = [
  { key: 'travel',    label: 'Travel',          icon: 'airplane' },
  { key: 'food',      label: 'Food & Drinks',   icon: 'fast-food' },
  { key: 'office',    label: 'Office Supplies', icon: 'briefcase' },
  { key: 'equipment', label: 'Equipment',       icon: 'construct' },
  { key: 'software',  label: 'Software',        icon: 'laptop' },
  { key: 'training',  label: 'Training',        icon: 'school' },
  { key: 'other',     label: 'Other',           icon: 'ellipsis-horizontal' },
];

const BentoBox = ({ children, style }) => (
  <View style={[styles.shadowWrap, { marginBottom: GAP }, style]}>
    <View style={styles.glassLight}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.glassHighlight} />
      {children}
    </View>
  </View>
);

export default function AddExpenseScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Enter a valid amount';
    }
    if (!category) newErrors.category = 'Category is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await createExpense({
        title: title.trim(),
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        created_by_id: user?.id,
      });
      Alert.alert('Success', 'Expense submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit expense');
    } finally {
      setIsSubmitting(false);
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
        style={[styles.flex1, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 10 : 20 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Expense</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.saveBtnText}>Submit</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Amount Hero ── */}
          <BentoBox>
            <View style={styles.amountCardInner}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <View style={styles.amountInputRow}>
                <Text style={[styles.currencySymbol, errors.amount && { color: G.red }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, errors.amount && { color: G.red }]}
                  placeholder="0.00"
                  placeholderTextColor={G.p300}
                  value={amount}
                  onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: null })); }}
                  keyboardType="decimal-pad"
                  selectionColor={G.p600}
                />
              </View>
              {errors.amount && <Text style={styles.errorMsgCenter}>{errors.amount}</Text>}
            </View>
          </BentoBox>

          {/* ── Details ── */}
          <BentoBox>
            <View style={styles.cardPadding}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Title <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder="e.g. Team lunch, Business travel"
                  placeholderTextColor={G.txtFaint}
                  value={title}
                  onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: null })); }}
                />
                {errors.title && <Text style={styles.errorMsg}>{errors.title}</Text>}
              </View>

              <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Add more details about this expense..."
                  placeholderTextColor={G.txtFaint}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </BentoBox>

          {/* ── Category ── */}
          <BentoBox>
            <View style={styles.cardPadding}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Category <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity
                  style={[styles.picker, errors.category && styles.inputError]}
                  onPress={() => setShowCategoryPicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerLeft}>
                    {category ? (
                      <>
                        <View style={[styles.categoryIconWrap, { backgroundColor: G.p100 }]}>
                          <Ionicons name={CATEGORIES.find((c) => c.key === category)?.icon || 'receipt'} size={16} color={G.p700} />
                        </View>
                        <Text style={styles.pickerText}>{categoryLabel}</Text>
                      </>
                    ) : (
                      <>
                        <View style={[styles.categoryIconWrap, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                          <Ionicons name="grid" size={16} color={G.txtFaint} />
                        </View>
                        <Text style={styles.pickerPlaceholder}>Select a category</Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={20} color={G.txtFaint} />
                </TouchableOpacity>
                {errors.category && <Text style={styles.errorMsg}>{errors.category}</Text>}
              </View>

              <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
                <Text style={styles.fieldLabel}>Quick Select</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const isActive = category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.categoryChip,
                          isActive && styles.categoryChipActive,
                          isActive && { shadowColor: G.p900, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }
                        ]}
                        onPress={() => {
                          setCategory(cat.key);
                          setCategoryLabel(cat.label);
                          setErrors((e) => ({ ...e, category: null }));
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={cat.icon} size={16} color={isActive ? G.white : G.txtFaint} />
                        <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </BentoBox>

          {/* ── Info & Submit ── */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={G.p700} />
            <Text style={styles.infoText}>
              Your expense will be submitted for approval. You will be notified once it is reviewed.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={G.white} />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color={G.white} />
                <Text style={styles.submitButtonText}>Submit Expense</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Category Picker Modal (Liquid Glass) ── */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.modalOption, isActive && styles.modalOptionActive]}
                  onPress={() => {
                    setCategory(cat.key);
                    setCategoryLabel(cat.label);
                    setErrors((e) => ({ ...e, category: null }));
                    setShowCategoryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modalOptionIcon, isActive && { backgroundColor: G.p100 }]}>
                    <Ionicons name={cat.icon} size={18} color={isActive ? G.p700 : G.txtFaint} />
                  </View>
                  <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                    {cat.label}
                  </Text>
                  {isActive && <Ionicons name="checkmark-circle" size={22} color={G.p700} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  flex1: { flex: 1 },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '900', color: G.txtMain, textAlign: 'center', letterSpacing: -0.5 },
  saveBtn: { backgroundColor: G.p700, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, minWidth: 80, alignItems: 'center', ...liquidShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2 },
  saveBtnText: { fontSize: 14, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Glass Bento Boxes
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardPadding: { padding: 20 },

  // ── Amount Hero
  amountCardInner: { padding: 30, alignItems: 'center', justifyContent: 'center' },
  amountLabel: { fontSize: 12, color: G.txtFaint, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  currencySymbol: { fontSize: 42, fontWeight: '900', color: G.p700, marginRight: 6 },
  amountInput: { fontSize: 56, fontWeight: '900', color: G.txtMain, minWidth: 140, textAlign: 'center', letterSpacing: -1 },

  // ── Form Fields
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },
  required: { color: G.red },
  
  input: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '800', color: G.txtMain,
    borderWidth: 2, borderColor: G.p200,
  },
  inputError: { borderColor: '#FCA5A5', backgroundColor: G.redBg },
  textArea: { minHeight: 100, paddingTop: 14 },
  
  errorMsg: { fontSize: 12, color: G.red, fontWeight: '800', marginTop: 6, paddingLeft: 4 },
  errorMsgCenter: { fontSize: 13, color: G.red, fontWeight: '800', marginTop: 10, textAlign: 'center' },

  // ── Category Picker
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerText: { fontSize: 15, color: G.txtMain, fontWeight: '900' },
  pickerPlaceholder: { fontSize: 15, color: G.txtFaint, fontWeight: '800' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: G.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 2, borderColor: G.p200,
  },
  categoryChipActive: { backgroundColor: G.p700, borderColor: G.p900 },
  categoryChipText: { fontSize: 13, color: G.txtFaint, fontWeight: '900', letterSpacing: 0.5 },
  categoryChipTextActive: { color: G.white },

  // ── Info & Submit
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 16, padding: 16, gap: 12, marginBottom: 24, borderWidth: 1, borderColor: G.p200 },
  infoText: { flex: 1, fontSize: 13, color: G.txtFaint, fontWeight: '800', lineHeight: 20 },
  
  submitButton: {
    backgroundColor: G.p700, borderRadius: 24, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    ...liquidShadow, shadowOffset: { width: 0, height: 6 },
  },
  submitButtonText: { fontSize: 16, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, marginBottom: 16, letterSpacing: -0.5 },
  
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, marginBottom: 8, gap: 14 },
  modalOptionActive: { backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 2, borderColor: G.white },
  modalOptionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  modalOptionText: { flex: 1, fontSize: 16, color: G.txtMain, fontWeight: '800' },
  modalOptionTextActive: { color: G.p800, fontWeight: '900' },
});

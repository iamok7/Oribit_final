import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Image, Modal,
  Pressable, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { postRequirement } from '../services/api';

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
  
  amber:    '#D97706',
  amberBg:  '#FEF3C7',
  err:      '#DC2626',
  purple:   '#7C3AED',
  pink:     '#DB2777',
  teal:     '#0D9488',
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

const CATEGORIES = [
  { key: 'manpower',  label: 'Manpower',  icon: 'people',      color: G.purple },
  { key: 'machinery', label: 'Machinery', icon: 'construct',   color: G.amber },
  { key: 'uniforms',  label: 'Uniforms',  icon: 'shirt',       color: G.pink },
  { key: 'shoes',     label: 'Shoes',     icon: 'footsteps',   color: G.teal },
  { key: 'other',     label: 'Other',     icon: 'apps',        color: G.p700 },
];

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatDisplay(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ─── Inline Calendar Picker ──────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }) {
  const today = new Date();
  const initDate = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const selectedKey = value || '';

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const toKey = (d) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${viewYear}-${m}-${dd}`;
  };

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return (
    <View style={cal.container}>
      <View style={cal.nav}>
        <TouchableOpacity style={cal.navBtn} onPress={prevMonth} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={G.p800} />
        </TouchableOpacity>
        <Text style={cal.navTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={nextMonth} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={G.p800} />
        </TouchableOpacity>
      </View>

      <View style={cal.weekRow}>
        {DAYS.map(d => <Text key={d} style={cal.weekDay}>{d}</Text>)}
      </View>

      {chunk(cells, 7).map((week, wi) => (
        <View key={wi} style={cal.weekRow}>
          {week.map((d, di) => {
            const key = d ? toKey(d) : null;
            const isSelected = key === selectedKey;
            const isToday    = key === todayKey;
            return (
              <TouchableOpacity
                key={di}
                style={[
                  cal.dayCell,
                  isSelected && cal.dayCellSelected,
                  isToday && !isSelected && cal.dayCellToday,
                ]}
                onPress={() => { if (d) { onChange(toKey(d)); onClose(); } }}
                activeOpacity={d ? 0.7 : 1}
                disabled={!d}
              >
                <Text style={[
                  cal.dayText,
                  isSelected && cal.dayTextSelected,
                  isToday && !isSelected && cal.dayTextToday,
                  !d && { opacity: 0 },
                ]}>
                  {d || ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {selectedKey ? (
        <TouchableOpacity style={cal.clearBtn} onPress={() => { onChange(''); onClose(); }} activeOpacity={0.8}>
          <Text style={cal.clearText}>Clear Date</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function PostRequirementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [category,     setCategory]     = useState('');
  const [quantity,     setQuantity]     = useState('');
  const [deadline,     setDeadline]     = useState('');
  const [showPicker,   setShowPicker]   = useState(false);
  const [attachment,   setAttachment]   = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAttachment(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!category)     { Alert.alert('Required', 'Please select a category.'); return; }

    setIsSubmitting(true);
    try {
      await postRequirement({
        title:       title.trim(),
        description: description.trim() || null,
        category,
        quantity:    quantity ? parseInt(quantity, 10) : null,
        deadline:    deadline || null,
        attachment:  attachment || null,
      });
      Alert.alert('Posted!', 'Your requirement has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to post requirement');
    } finally { setIsSubmitting(false); }
  };

  const isReady = title.trim() && category && !isSubmitting;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.amberBg }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: G.p300, transform: [{ scale: 1.2 }] }]} />
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
          <View style={styles.headerCenter}>
            <Ionicons name="clipboard" size={20} color={G.amber} />
            <Text style={styles.headerTitle} numberOfLines={1}>Post Requirement</Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, !isReady && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!isReady}
            activeOpacity={0.8}
          >
            {isSubmitting ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.submitBtnText}>Submit</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Bento: Title ── */}
          <View style={styles.bentoBox}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            <View style={styles.bentoInner}>
              <Text style={styles.fieldLabel}>Title <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Need 5 workers for night shift"
                placeholderTextColor={G.txtFaint}
                value={title}
                onChangeText={setTitle}
                maxLength={200}
                selectionColor={G.p600}
              />
            </View>
          </View>

          {/* ── Bento: Category ── */}
          <View style={styles.bentoBox}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            <View style={styles.bentoInner}>
              <Text style={styles.fieldLabel}>Category <Text style={styles.required}>*</Text></Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => {
                  const isActive = category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.catChip,
                        { borderColor: isActive ? cat.color : cat.color + '40' },
                        isActive && { backgroundColor: cat.color, shadowColor: cat.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
                      ]}
                      onPress={() => setCategory(cat.key)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={cat.icon} size={18} color={isActive ? G.white : cat.color} />
                      <Text style={[styles.catChipText, { color: isActive ? G.white : cat.color }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── Bento Row: Quantity & Deadline ── */}
          <View style={styles.bentoRow}>
            {/* Quantity */}
            <View style={[styles.bentoBox, styles.bentoItem]}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <View style={styles.bentoInnerSquare}>
                <Text style={styles.fieldLabel}>Quantity <Text style={styles.optional}>(opt)</Text></Text>
                <View style={styles.inputRow}>
                  <Ionicons name="layers" size={20} color={quantity ? G.p700 : G.txtFaint} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="e.g. 5"
                    placeholderTextColor={G.txtFaint}
                    value={quantity}
                    onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    maxLength={6}
                    selectionColor={G.p600}
                  />
                </View>
              </View>
            </View>

            {/* Deadline */}
            <View style={[styles.bentoBox, styles.bentoItem]}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              <View style={styles.bentoInnerSquare}>
                <Text style={styles.fieldLabel}>Deadline <Text style={styles.optional}>(opt)</Text></Text>
                <TouchableOpacity style={styles.inputRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                  <Ionicons name="calendar" size={20} color={deadline ? G.p700 : G.txtFaint} style={styles.inputIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deadlinePlaceholder, deadline && styles.deadlineValue]} numberOfLines={1} adjustsFontSizeToFit>
                      {deadline ? formatDisplay(deadline) : 'Date'}
                    </Text>
                  </View>
                  {deadline && (
                    <TouchableOpacity onPress={() => setDeadline('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={18} color={G.txtFaint} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Bento: Description ── */}
          <View style={styles.bentoBox}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            <View style={styles.bentoInner}>
              <Text style={styles.fieldLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Add more details about this requirement..."
                placeholderTextColor={G.txtFaint}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={1000}
                textAlignVertical="top"
                selectionColor={G.p600}
              />
              <Text style={styles.charCount}>{description.length}/1000</Text>
            </View>
          </View>

          {/* ── Bento: Attachment ── */}
          <View style={styles.bentoBox}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            <View style={styles.bentoInner}>
              <Text style={styles.fieldLabel}>Attachment <Text style={styles.optional}>(optional)</Text></Text>
              {attachment ? (
                <View style={styles.attachPreview}>
                  <Image source={{ uri: attachment }} style={styles.attachThumb} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeAttach} onPress={() => setAttachment(null)} activeOpacity={0.8}>
                    <Ionicons name="close-circle" size={28} color={G.red} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.7}>
                  <Ionicons name="image" size={28} color={G.p700} />
                  <Text style={styles.attachBtnText}>Add Image</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Calendar Picker Modal (Liquid Glass) ── */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          
          <View style={styles.pickerSheetWrapper}>
            <View style={styles.pickerSheet}>
              <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']} style={StyleSheet.absoluteFill} />
              <View style={styles.glassHighlight} />
              
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Deadline</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={G.txtMuted} />
                </TouchableOpacity>
              </View>
              <CalendarPicker value={deadline} onChange={setDeadline} onClose={() => setShowPicker(false)} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Calendar Styles ────────────────────────────────────────────────────────
const CELL = 42;
const cal = StyleSheet.create({
  container:       { padding: 20 },
  nav:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  navBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: G.p200, alignItems: 'center', justifyContent: 'center' },
  navTitle:        { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  weekRow:         { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDay:         { width: CELL, textAlign: 'center', fontSize: 11, fontWeight: '900', color: G.txtFaint, paddingVertical: 4 },
  dayCell:         { width: CELL, height: CELL, borderRadius: CELL / 2, alignItems: 'center', justifyContent: 'center' },
  dayCellSelected: { backgroundColor: G.p700, shadowColor: G.p900, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  dayCellToday:    { borderWidth: 2, borderColor: G.p500 },
  dayText:         { fontSize: 15, fontWeight: '800', color: G.txtMain },
  dayTextSelected: { color: G.white, fontWeight: '900' },
  dayTextToday:    { color: G.p700, fontWeight: '900' },
  clearBtn:        { marginTop: 16, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, backgroundColor: G.redBg, borderWidth: 1, borderColor: '#FECACA' },
  clearText:       { fontSize: 13, fontWeight: '900', color: G.red, textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Main Styles ────────────────────────────────────────────────────────────
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
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  submitBtn: { backgroundColor: G.p700, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, minWidth: 80, alignItems: 'center', ...liquidShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2 },
  submitBtnText: { fontSize: 14, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Content
  content: { paddingHorizontal: GUTTER, paddingTop: 16 },

  // ── Bento Boxes
  bentoBox: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: GAP,
    ...liquidShadow,
  },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  bentoInner: { padding: 20 },
  bentoInnerSquare: { padding: 18, flex: 1, justifyContent: 'center' },
  
  bentoRow: { flexDirection: 'row', gap: GAP },
  bentoItem: { flex: 1, height: 110, marginBottom: GAP }, // Fixed height to make them perfect squares/rectangles side by side

  // ── Forms
  fieldLabel: { fontSize: 12, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingLeft: 4 },
  required: { color: G.red },
  optional: { color: G.txtFaint, fontWeight: '700', textTransform: 'lowercase', letterSpacing: 0 },
  
  input: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '800', color: G.txtMain,
    borderWidth: 2, borderColor: G.p200,
  },
  inputMulti: { minHeight: 100, paddingTop: 14 },
  charCount: { fontSize: 11, color: G.txtFaint, textAlign: 'right', marginTop: 8, fontWeight: '800' },
  
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200, paddingHorizontal: 14, height: 50,
  },
  inputIcon: { marginRight: 8 },
  inputFlex: { flex: 1, fontSize: 15, fontWeight: '800', color: G.txtMain },
  
  deadlinePlaceholder: { fontSize: 15, color: G.txtFaint, fontWeight: '800' },
  deadlineValue: { color: G.txtMain, fontWeight: '900' },

  // ── Category Grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 2,
  },
  catChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },

  // ── Attachment
  attachPreview: { position: 'relative', alignSelf: 'flex-start', marginTop: 4 },
  attachThumb: { width: 140, height: 140, borderRadius: 16, borderWidth: 2, borderColor: G.p200 },
  removeAttach: { position: 'absolute', top: -10, right: -10, backgroundColor: G.white, borderRadius: 16 },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    borderWidth: 2, borderColor: G.p200, borderStyle: 'dashed',
    paddingVertical: 24, marginTop: 4,
  },
  attachBtnText: { fontSize: 15, fontWeight: '900', color: G.p700 },

  // ── Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: GUTTER },
  pickerSheetWrapper: { width: '100%', maxWidth: 380, ...liquidShadow, shadowOpacity: 0.3, shadowRadius: 30, elevation: 20 },
  pickerSheet: { backgroundColor: G.white, borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
});
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Alert, ScrollView, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getRequirements, updateRequirementStatus } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

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
  green:    '#059669',
  greenBg:  '#D1FAE5',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
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
  { key: 'all',       label: 'All',       icon: 'apps',               color: G.p700  },
  { key: 'manpower',  label: 'Manpower',  icon: 'people',             color: G.purple },
  { key: 'machinery', label: 'Machinery', icon: 'construct',          color: G.amber },
  { key: 'uniforms',  label: 'Uniforms',  icon: 'shirt',              color: G.pink },
  { key: 'shoes',     label: 'Shoes',     icon: 'footsteps',          color: G.teal },
  { key: 'other',     label: 'Other',     icon: 'ellipsis-horizontal',color: G.txtFaint },
];

const STATUSES = [
  { key: 'all',       label: 'All',       color: G.p700  },
  { key: 'open',      label: 'Open',      color: G.amber },
  { key: 'in_review', label: 'In Review', color: G.p600  },
  { key: 'resolved',  label: 'Resolved',  color: G.green },
];

const getCatCfg = (k) => CATEGORIES.find(c => c.key === k) || CATEGORIES[CATEGORIES.length - 1];
const getStatCfg = (k) => STATUSES.find(s => s.key === k) || STATUSES[0];

const relTime = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function RequirementsScreen({ navigation }) {
  const { user, isManager, isSupervisor } = useAuth();
  const insets = useSafeAreaInsets();
  const [requirements, setRequirements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const canPost = !isManager();

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      if (activeStatus !== 'all') params.status = activeStatus;
      const data = await getRequirements(params);
      setRequirements(Array.isArray(data) ? data : []);
    } catch {}
    finally { setIsLoading(false); setIsRefreshing(false); }
  }, [activeCategory, activeStatus]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const fmtDeadline = (iso) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return null; }
  };

  const isDeadlinePast = (iso) => iso && new Date(iso) < new Date();

  const renderCard = ({ item }) => {
    const catCfg = getCatCfg(item.category);
    const statCfg = getStatCfg(item.status);
    const deadlinePast = isDeadlinePast(item.deadline);
    const deadlineColor = deadlinePast ? G.red : G.p700;

    return (
      <TouchableOpacity
        style={[styles.shadowWrap, { marginBottom: GAP }]}
        onPress={() => navigation.navigate('RequirementDetail', { requirement: item })}
        activeOpacity={0.8}
      >
        <View style={styles.glassLight}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />
          
          {/* Edge Accent */}
          <View style={[styles.cardAccent, { backgroundColor: catCfg.color }]} />

          <View style={styles.cardPadding}>
            <View style={styles.cardRow}>
              <View style={[styles.catBadge, { backgroundColor: catCfg.color + '15', borderColor: catCfg.color + '40' }]}>
                <Ionicons name={catCfg.icon} size={12} color={catCfg.color} />
                <Text style={[styles.catBadgeText, { color: catCfg.color }]}>{catCfg.label}</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: statCfg.color + '15', borderColor: statCfg.color + '40' }]}>
                <View style={[styles.statDot, { backgroundColor: statCfg.color }]} />
                <Text style={[styles.statBadgeText, { color: statCfg.color }]}>{item.status.replace('_', ' ')}</Text>
              </View>
              <Text style={styles.timeText}>{relTime(item.created_at)}</Text>
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

            {!!item.description && (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            )}

            {(item.quantity || item.deadline) && (
              <View style={styles.metaRow}>
                {!!item.quantity && (
                  <View style={[styles.metaChip, { backgroundColor: G.purple + '15', borderColor: G.purple + '40' }]}>
                    <Ionicons name="layers" size={14} color={G.purple} />
                    <Text style={[styles.metaChipText, { color: G.purple }]}>{item.quantity} needed</Text>
                  </View>
                )}
                {!!item.deadline && (
                  <View style={[styles.metaChip, { borderColor: deadlineColor + '40', backgroundColor: deadlineColor + '15' }]}>
                    <Ionicons name={deadlinePast ? 'alert-circle' : 'calendar'} size={14} color={deadlineColor} />
                    <Text style={[styles.metaChipText, { color: deadlineColor }]}>
                      {deadlinePast ? 'Overdue · ' : ''}{fmtDeadline(item.deadline)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.cardFooter}>
              <View style={styles.posterChip}>
                <Ionicons name="person-circle" size={18} color={G.txtFaint} />
                <Text style={styles.posterText}>{item.poster?.username}</Text>
                {item.dept && <Text style={styles.deptText}>· {item.dept.name}</Text>}
              </View>

              <View style={styles.footerRight}>
                {!!item.attachment && <Ionicons name="image" size={16} color={G.p400} style={{ marginRight: 6 }} />}
                <Ionicons name="chevron-forward" size={16} color={G.p400} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Loading requirements..." />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={G.bgDark} />
      
      {/* ── Stable Background ── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[G.bgLight, G.bgMid, G.bgDark]} style={StyleSheet.absoluteFill} />
        <View style={[styles.ambientOrb, { top: -80, right: -60, backgroundColor: G.amberBg }]} />
        <View style={[styles.ambientOrb, { bottom: 100, left: -60, backgroundColor: G.p300, transform: [{ scale: 1.2 }] }]} />
      </View>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={G.p800} />
            </TouchableOpacity>
            <View>
              <View style={styles.titlePill}>
                <Ionicons name="clipboard" size={16} color={G.amber} />
                <Text style={styles.headerTitle}>Requirements</Text>
              </View>
              <Text style={styles.headerSubtitle}>{requirements.filter(r => r.status === 'open').length} open requests</Text>
            </View>
          </View>

          {canPost && (
            <TouchableOpacity style={styles.postBtn} onPress={() => navigation.navigate('PostRequirement')} activeOpacity={0.8}>
              <LinearGradient colors={[G.p500, G.p700]} style={StyleSheet.absoluteFill} />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <Ionicons name="add" size={20} color={G.white} />
              <Text style={styles.postBtnText}>Post</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filters ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.filterChip,
                  { borderColor: isActive ? cat.color : G.p200 },
                  isActive && { backgroundColor: cat.color, shadowColor: cat.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
                ]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon} size={16} color={isActive ? G.white : cat.color} />
                <Text style={[styles.filterChipText, { color: isActive ? G.white : G.txtFaint }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={[styles.filterContent, { paddingTop: 0 }]}>
          {STATUSES.map(s => {
            const isActive = activeStatus === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.statChip,
                  { borderColor: isActive ? s.color : G.p200 },
                  isActive && { backgroundColor: s.color, shadowColor: s.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
                ]}
                onPress={() => setActiveStatus(s.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statChipText, { color: isActive ? G.white : G.txtFaint }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ── */}
      {requirements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="clipboard" size={48} color={G.amber} />
          </View>
          <Text style={styles.emptyTitle}>No requirements found</Text>
          <Text style={styles.emptySubtitle}>{canPost ? 'Post a requirement to get started.' : 'No requirements match your filters.'}</Text>
          {canPost && (
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('PostRequirement')} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color={G.white} />
              <Text style={styles.emptyBtnText}>Post Requirement</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={requirements}
          keyExtractor={item => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchData(); }} tintColor={G.p700} />}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.amberBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1.5, borderColor: '#FDE68A', alignSelf: 'flex-start', marginBottom: 4 },
  headerTitle: { fontSize: 14, fontWeight: '900', color: G.amber, letterSpacing: 0.5, textTransform: 'uppercase' },
  headerSubtitle: { fontSize: 13, color: G.txtFaint, fontWeight: '800', paddingLeft: 4 },
  
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, overflow: 'hidden', ...liquidShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2 },
  postBtnText: { fontSize: 14, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Filters
  filterScroll: { flexGrow: 0 },
  filterContent: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 10, gap: 10, flexDirection: 'row', alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  filterChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  statChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  statChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  // ── List & Empty State
  listContent: { paddingHorizontal: GUTTER, paddingTop: 16 },
  
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 40 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: G.amberBg, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...liquidShadow, shadowOpacity: 0.1 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle: { fontSize: 15, color: G.txtFaint, textAlign: 'center', fontWeight: '700', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G.p700, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 14, ...liquidShadow },
  emptyBtnText: { fontSize: 15, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Requirement Card (Bento Glass)
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, zIndex: 6 },
  cardPadding: { padding: 20, paddingLeft: 24 }, // extra left padding to clear the accent bar

  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5 },
  catBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeText: { fontSize: 12, color: G.txtFaint, fontWeight: '800', marginLeft: 'auto' },

  cardTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, marginBottom: 6, lineHeight: 26, letterSpacing: -0.5 },
  cardDesc: { fontSize: 14, color: G.txtFaint, fontWeight: '700', lineHeight: 22, marginBottom: 14 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  metaChipText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12 },
  posterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  posterText: { fontSize: 13, fontWeight: '800', color: G.txtFaint },
  deptText: { fontSize: 13, color: G.txtFaint, fontWeight: '700' },
  footerRight: { flexDirection: 'row', alignItems: 'center' },
});
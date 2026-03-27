import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { getExpenses, approveExpense, rejectExpense, updateFinanceStatus } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const { width, height } = Dimensions.get('window');
const GUTTER = 16;
const GAP = 14;

// ─── Liquid Glass High Contrast Palette ──────────────────────────────────────
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
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ─── Status Configurations ───────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: G.amberBg,  text: G.amber,  border: '#FDE68A', icon: 'time' },
  approved: { label: 'Approved', bg: G.greenBg,  text: G.green,  border: '#A7F3D0', icon: 'checkmark-circle' },
  rejected: { label: 'Rejected', bg: G.redBg,    text: G.red,    border: '#FECACA', icon: 'close-circle' },
  paid:     { label: 'Paid',     bg: G.purpleBg, text: G.purple, border: '#DDD6FE', icon: 'card' },
};

const getCategoryIcon = (category) => {
  const map = {
    travel: 'airplane',
    food: 'fast-food',
    office: 'briefcase',
    equipment: 'construct',
    software: 'laptop',
    training: 'school',
    other: 'ellipsis-horizontal',
  };
  return map[(category || '').toLowerCase()] || 'receipt';
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ExpensesScreen({ navigation }) {
  const { user, isFinance, isManager, isSupervisor } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [error, setError] = useState(null);
  
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      setError(null);
      const data = await getExpenses();
      const list = Array.isArray(data) ? data : data?.expenses || [];
      setExpenses(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchExpenses();
  };

  const handleApprove = async (expense) => {
    const label = isManager() ? 'Final Approve' : 'Approve';
    const msg = isManager()
      ? `Final approval for "${expense.title}" — ₹${expense.amount}?`
      : `Approve "${expense.title}" — ₹${expense.amount}? It will still need manager sign-off.`;
    
    Alert.alert('Approve Expense', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'default', onPress: async () => {
          try {
            setIsProcessing(true);
            const res = await approveExpense(expense.id);
            fetchExpenses();
            Alert.alert('Success', res.message || 'Expense approved');
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to approve');
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  const handleMarkPaid = async (expense) => {
    Alert.alert('Mark as Paid', `Mark "${expense.title}" as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', style: 'default', onPress: async () => {
          try {
            setIsProcessing(true);
            await updateFinanceStatus(expense.id, 'Paid');
            fetchExpenses();
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update');
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    try {
      setIsProcessing(true);
      if (isFinance()) {
        await updateFinanceStatus(rejectModal.id, 'Rejected', rejectReason);
      } else {
        await rejectExpense(rejectModal.id, rejectReason);
      }
      fetchExpenses();
      setRejectModal(null);
      setRejectReason('');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to reject');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (activeFilter === 'All') return true;
    return (e.status || '').toLowerCase() === activeFilter.toLowerCase();
  });

  const pendingList   = expenses.filter((e) => e.status === 'Pending');
  const approvedList  = expenses.filter((e) => e.status === 'Approved');
  const rejectedList  = expenses.filter((e) => e.status === 'Rejected');
  const paidList      = expenses.filter((e) => e.payment_status === 'Paid');

  const totalPending  = pendingList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalApproved = approvedList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalRejected = rejectedList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalPaid     = paidList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading expenses..." />;
  }

  const renderExpenseItem = ({ item }) => {
    const statusKey = item.status?.toLowerCase();
    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
    const isPending = item.status === 'Pending';
    const isApproved = item.status === 'Approved';
    const approvalLvl = item.approval_level || 0;

    const canSupervisorAct = isSupervisor() && isPending && approvalLvl === 0 && item.creator !== user?.username;
    const canManagerAct = isManager() && isPending;
    const canFinanceAct = isFinance() && isApproved && approvalLvl >= 2 && item.payment_status !== 'Paid';

    return (
      <View style={[styles.shadowWrap, { marginBottom: GAP }]}>
        <View style={styles.glassLight}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
          <View style={styles.glassHighlight} />
          
          <View style={styles.cardInner}>
            <View style={styles.expenseTop}>
              <View style={styles.expenseLeft}>
                <View style={[styles.expenseCategoryIcon, { backgroundColor: G.p100 }]}>
                  <Ionicons name={getCategoryIcon(item.category)} size={20} color={G.p700} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseTitle} numberOfLines={1}>{item.title || 'Untitled Expense'}</Text>
                  <Text style={styles.expenseCategory}>{item.category || 'General'}</Text>
                </View>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>₹{parseFloat(item.amount || 0).toFixed(2)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                  <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
                </View>
              </View>
            </View>

            {item.description ? <Text style={styles.expenseDesc} numberOfLines={2}>{item.description}</Text> : null}

            {isPending && approvalLvl === 1 && (
              <View style={styles.progressBadge}>
                <Ionicons name="checkmark-circle" size={14} color={G.green} />
                <Text style={styles.progressBadgeText}>Supervisor approved — awaiting manager</Text>
              </View>
            )}

            {item.rejection_reason ? (
              <View style={styles.rejectionWrap}>
                <Text style={styles.rejectionNote}>Reason: {item.rejection_reason}</Text>
              </View>
            ) : null}

            <View style={styles.expenseMeta}>
              <View style={styles.expenseMetaLeft}>
                {item.creator && <Text style={styles.expenseMetaText}>By: {item.creator}</Text>}
                {item.created_at && (
                  <Text style={styles.expenseMetaText}>
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                )}
              </View>

              {(canSupervisorAct || canManagerAct) && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: G.green }]} onPress={() => handleApprove(item)} activeOpacity={0.8} disabled={isProcessing}>
                    <Ionicons name="checkmark" size={16} color={G.white} />
                    <Text style={styles.actionBtnText}>{isManager() ? 'Final Approve' : 'Approve'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: G.redBg, borderWidth: 1, borderColor: '#FECACA' }]} onPress={() => setRejectModal(item)} activeOpacity={0.8} disabled={isProcessing}>
                    <Ionicons name="close" size={16} color={G.red} />
                    <Text style={[styles.actionBtnText, { color: G.red }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {canFinanceAct && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: G.purple }]} onPress={() => handleMarkPaid(item)} activeOpacity={0.8} disabled={isProcessing}>
                    <Ionicons name="card" size={16} color={G.white} />
                    <Text style={styles.actionBtnText}>Mark Paid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: G.redBg, borderWidth: 1, borderColor: '#FECACA' }]} onPress={() => setRejectModal(item)} activeOpacity={0.8} disabled={isProcessing}>
                    <Ionicons name="close" size={16} color={G.red} />
                    <Text style={[styles.actionBtnText, { color: G.red }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
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

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={G.p800} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Expenses</Text>
            <Text style={styles.headerSubtitle}>{expenses.length} records</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={() => navigation.navigate('AddExpense')} activeOpacity={0.85}>
          <Ionicons name="add" size={24} color={G.white} />
        </TouchableOpacity>
      </View>

      {/* ── Summary Cards (Horizontal Scroll) ── */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll}
          contentContainerStyle={styles.summaryScrollContent}
        >
          {[
            { label: 'All', count: expenses.length, amount: null, color: G.p700, bg: 'rgba(255,255,255,0.6)', filter: 'All', icon: 'albums' },
            { label: 'Pending', count: pendingList.length, amount: totalPending, color: G.amber, bg: G.amberBg, filter: 'Pending', icon: 'time' },
            { label: 'Approved', count: approvedList.length, amount: totalApproved, color: G.green, bg: G.greenBg, filter: 'Approved', icon: 'checkmark-circle' },
            { label: 'Paid', count: paidList.length, amount: totalPaid, color: G.purple, bg: G.purpleBg, filter: 'Paid', icon: 'card' },
            { label: 'Rejected', count: rejectedList.length, amount: totalRejected, color: G.red, bg: G.redBg, filter: 'Rejected', icon: 'close-circle' },
          ].map((card) => {
            const isActive = activeFilter === card.filter;
            return (
              <TouchableOpacity
                key={card.filter}
                style={[
                  styles.summaryCard,
                  { backgroundColor: card.bg, borderColor: isActive ? card.color : 'rgba(255,255,255,0.4)' },
                  isActive && { shadowColor: card.color, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
                ]}
                onPress={() => setActiveFilter(card.filter)}
                activeOpacity={0.75}
              >
                <View style={styles.summaryCardTop}>
                  <View style={[styles.summaryIconWrap, { backgroundColor: card.color + '20' }]}>
                    <Ionicons name={card.icon} size={18} color={card.color} />
                  </View>
                  <View style={[styles.summaryCountBadge, { backgroundColor: card.color }]}>
                    <Text style={styles.summaryCountText}>{card.count}</Text>
                  </View>
                </View>
                <Text style={[styles.summaryLabel, { color: card.color }]}>{card.label}</Text>
                {card.amount !== null && (
                  <Text style={[styles.summaryAmount, { color: card.color }]} numberOfLines={1} adjustsFontSizeToFit>
                    ₹{card.amount.toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.filterLabelRow}>
        <Text style={styles.filterLabelText}>
          {activeFilter === 'All' ? 'All expenses' : `${activeFilter} expenses`}
        </Text>
        <Text style={styles.filterCountText}>{filteredExpenses.length} record{filteredExpenses.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* ── Error Banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color={G.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchExpenses}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ── */}
      {filteredExpenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="receipt" size={48} color={G.p400} />
          </View>
          <Text style={styles.emptyTitle}>No expenses found</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} expenses match your view.` : 'You have not submitted any expenses yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderExpenseItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={G.p700} />}
        />
      )}

      {/* ── Reject Reason Modal (Liquid Glass) ── */}
      <Modal visible={!!rejectModal} transparent animationType="slide" onRequestClose={() => setRejectModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRejectModal(null)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
            
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reject Expense</Text>
            <Text style={styles.modalSubtitle}>
              {rejectModal?.title} — ₹{parseFloat(rejectModal?.amount || 0).toFixed(2)}
            </Text>
            
            <Text style={styles.modalLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Enter reason for rejection..."
              placeholderTextColor={G.txtFaint}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRejectModal(null); setRejectReason(''); }} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmRejectBtn, isProcessing && { opacity: 0.6 }]} onPress={handleRejectSubmit} disabled={isProcessing} activeOpacity={0.8}>
                {isProcessing ? <ActivityIndicator size="small" color={G.white} /> : <Text style={styles.confirmRejectBtnText}>Reject</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bgDark },
  ambientOrb: { position: 'absolute', width: 350, height: 350, borderRadius: 175, opacity: 0.4, filter: [{ blur: 50 }] },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.9)',
    ...liquidShadow, zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: G.white, borderWidth: 2, borderColor: G.p200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: G.p900, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  addHeaderBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: G.p700, alignItems: 'center', justifyContent: 'center', ...liquidShadow, shadowOffset: { width: 0, height: 4 } },

  // ── Summary Cards
  summaryScroll: { maxHeight: 150, marginBottom: 10, marginTop: 10 },
  summaryScrollContent: { paddingHorizontal: GUTTER, paddingVertical: 10, gap: 12 },
  summaryCard: { width: 140, height: 110, borderRadius: 24, padding: 16, borderWidth: 2, ...liquidShadow, shadowOpacity: 0.08 },
  summaryCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryCountBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  summaryCountText: { fontSize: 13, fontWeight: '900', color: G.white },
  summaryLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryAmount: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },

  // ── Filters & Errors
  filterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: GUTTER, marginBottom: 10 },
  filterLabelText: { fontSize: 14, fontWeight: '900', color: G.txtMain, textTransform: 'uppercase', letterSpacing: 1.2 },
  filterCountText: { fontSize: 13, color: G.txtFaint, fontWeight: '800' },
  
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: G.redBg, borderRadius: 16, padding: 14, marginHorizontal: GUTTER, marginBottom: 10, gap: 10, borderWidth: 2, borderColor: '#FCA5A5' },
  errorText: { flex: 1, fontSize: 14, color: G.red, fontWeight: '800' },
  retryText: { fontSize: 14, color: G.red, fontWeight: '900' },

  // ── Layout
  listContent: { paddingHorizontal: GUTTER, paddingTop: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: G.p100, borderWidth: 2, borderColor: G.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...liquidShadow, shadowOpacity: 0.1 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle: { fontSize: 15, color: G.txtFaint, textAlign: 'center', fontWeight: '700', lineHeight: 22 },

  // ── Expense Cards (Bento)
  shadowWrap: { ...liquidShadow },
  glassLight: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: G.white, zIndex: 5 },
  cardInner: { padding: 20 },
  
  expenseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  expenseCategoryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  expenseInfo: { flex: 1 },
  expenseTitle: { fontSize: 18, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5, marginBottom: 2 },
  expenseCategory: { fontSize: 12, color: G.txtFaint, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  expenseRight: { alignItems: 'flex-end', gap: 6 },
  expenseAmount: { fontSize: 20, fontWeight: '900', color: G.txtMain, letterSpacing: -0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  expenseDesc: { fontSize: 14, color: G.txtFaint, fontWeight: '700', lineHeight: 20, marginBottom: 12 },
  progressBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: G.greenBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#A7F3D0' },
  progressBadgeText: { fontSize: 11, color: G.green, fontWeight: '900' },
  
  rejectionWrap: { backgroundColor: G.redBg, borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  rejectionNote: { fontSize: 12, color: G.red, fontWeight: '800', fontStyle: 'italic' },

  expenseMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1.5, borderTopColor: 'rgba(0,0,0,0.05)' },
  expenseMetaLeft: { gap: 4 },
  expenseMetaText: { fontSize: 12, color: G.txtFaint, fontWeight: '800' },
  
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '900', color: G.white, letterSpacing: 0.5 },

  // ── Reject Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', shadowColor: G.p900, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20 },
  modalHandle: { width: 48, height: 6, borderRadius: 3, backgroundColor: G.p200, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: G.txtMain, marginBottom: 4, letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, color: G.txtFaint, fontWeight: '700', marginBottom: 24 },
  modalLabel: { fontSize: 13, fontWeight: '900', color: G.txtMain, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  rejectInput: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 16, fontSize: 15, fontWeight: '800', color: G.txtMain, borderWidth: 2, borderColor: G.p200, minHeight: 100, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: G.white, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: G.p200 },
  cancelBtnText: { fontSize: 15, fontWeight: '900', color: G.txtFaint },
  confirmRejectBtn: { flex: 1, backgroundColor: G.red, borderRadius: 16, paddingVertical: 14, alignItems: 'center', ...liquidShadow, shadowColor: G.red, shadowOpacity: 0.3 },
  confirmRejectBtnText: { fontSize: 15, fontWeight: '900', color: G.white, letterSpacing: 0.5 },
});

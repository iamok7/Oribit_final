import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

import LoginScreen      from '../screens/LoginScreen';
import HomeScreen       from '../screens/HomeScreen';
import TasksScreen      from '../screens/TasksScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import AddTaskScreen    from '../screens/AddTaskScreen';
import ProgressScreen   from '../screens/ProgressScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import ExpensesScreen   from '../screens/ExpensesScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import DepartmentsScreen from '../screens/DepartmentsScreen';
import UsersScreen      from '../screens/UsersScreen';
import CalendarScreen          from '../screens/CalendarScreen';
import DailyPlannerScreen     from '../screens/DailyPlannerScreen';
import MessagingScreen        from '../screens/MessagingScreen';
import ChatScreen             from '../screens/ChatScreen';
import CreateGroupScreen      from '../screens/CreateGroupScreen';
import RequirementsScreen     from '../screens/RequirementsScreen';
import PostRequirementScreen      from '../screens/PostRequirementScreen';
import RequirementDetailScreen    from '../screens/RequirementDetailScreen';
import PerformanceChartScreen     from '../screens/PerformanceChartScreen';
import NotificationsScreen        from '../screens/NotificationsScreen';
import UserPerformanceScreen      from '../screens/UserPerformanceScreen';
import TeamDashboardScreen        from '../screens/TeamDashboardScreen';
import DepartmentDashboardScreen  from '../screens/DepartmentDashboardScreen';
import GroupInfoScreen            from '../screens/GroupInfoScreen';
import UserProfileScreen          from '../screens/UserProfileScreen';
import LoadingSpinner          from '../components/LoadingSpinner';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

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
  amber:    '#D97706',
  red:      '#DC2626',
  purple:   '#7C3AED',
};

// Native fluid shadow
const liquidShadow = {
  shadowColor: G.p900,
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ── Centre FAB (Add Task) ────────────────────────────────────────────────────
const FABButton = ({ onPress }) => (
  <TouchableOpacity style={styles.fabButton} onPress={onPress} activeOpacity={0.85}>
    <LinearGradient colors={[G.p500, G.p700]} style={StyleSheet.absoluteFill} />
    <View style={styles.fabHighlight} />
    <Ionicons name="add" size={32} color={G.white} />
  </TouchableOpacity>
);

// ── Placeholder screen for the More tab (never rendered) ────────────────────
const BlankScreen = () => <View style={{ flex: 1, backgroundColor: G.bgDark }} />;

// ── More tab button — self-contained with Modal ──────────────────────────────
function MoreTabButton({ navigation, role }) {
  const insets  = useSafeAreaInsets();
  const [show, setShow]   = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    if (show) {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true })
        .start(() => setShow(false));
    } else {
      setShow(true);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [show, anim]);

  const go = (screen, params) => {
    toggle();
    // Small delay so the sheet can close before navigating
    setTimeout(() => navigation.navigate(screen, params), 100);
  };

  // ── Role-based action lists ────────────────────────────────────────────────
  const ACTIONS = {
    manager: [
      { icon: 'people',              label: 'Team',           color: G.red,    screen: 'UsersStack' },
      { icon: 'business',            label: 'Dept',   color: G.amber,  screen: 'DepartmentsStack' },
      { icon: 'wallet',              label: 'Expenses',       color: G.green,  screen: 'ExpensesStack' },
      { icon: 'calendar',            label: 'Calendar',       color: G.purple, screen: 'CalendarStack' },
      { icon: 'bar-chart',           label: 'My Stats',       color: G.p600,   screen: 'Progress' },
      { icon: 'receipt',             label: 'Add Expense',    color: G.p700,   screen: 'AddExpense' },
      // { icon: 'add-circle',          label: 'Add Task',       color: G.txtMain,screen: 'AddTask', params: { task: null } },
      { icon: 'chatbubble-ellipses', label: 'Messages',       color: G.p500,   screen: 'Messaging' },
      { icon: 'clipboard',           label: 'Req Team',       color: G.amber,  screen: 'Requirements' },
      { icon: 'clipboard-outline',   label: 'Post Need',      color: '#8B5CF6',screen: 'PostRequirement' },
    ],
    supervisor: [
      { icon: 'people',              label: 'Team',           color: G.red,    screen: 'UsersStack' },
      // { icon: 'business',            label: 'Departments',    color: G.amber,  screen: 'DepartmentsStack' },
      { icon: 'wallet',              label: 'Expenses',       color: G.green,  screen: 'ExpensesStack' },
      { icon: 'calendar',            label: 'Calendar',       color: G.purple, screen: 'CalendarStack' },
      { icon: 'bar-chart',           label: 'My Stats',       color: G.p600,   screen: 'Progress' },
      { icon: 'receipt',             label: 'Add Expense',    color: G.p700,   screen: 'AddExpense' },
      // { icon: 'add-circle',          label: 'Add Task',       color: G.txtMain,screen: 'AddTask', params: { task: null } },
      { icon: 'chatbubble-ellipses', label: 'Messages',       color: G.p500,   screen: 'Messaging' },
      { icon: 'clipboard',           label: 'Requirements',   color: G.amber,  screen: 'Requirements' },
      { icon: 'clipboard-outline',   label: 'Post Need',      color: '#8B5CF6',screen: 'PostRequirement' },
    ],
    employee: [
      { icon: 'wallet',              label: 'My Expenses',    color: G.green,  screen: 'ExpensesStack' },
      { icon: 'receipt',             label: 'Add Expense',    color: G.p700,   screen: 'AddExpense' },
      { icon: 'trending-up',         label: 'My Dashboard',   color: G.p600,   screen: 'Progress' },
      { icon: 'chatbubble-ellipses', label: 'Messages',       color: G.p500,   screen: 'Messaging' },
      { icon: 'clipboard',           label: 'Post Need',      color: G.amber,  screen: 'PostRequirement' },
    ],
    finance: [
      { icon: 'wallet',              label: 'Expenses',       color: G.green,  screen: 'ExpensesStack' },
      { icon: 'receipt',             label: 'Add Expense',    color: G.p700,   screen: 'AddExpense' },
      { icon: 'bar-chart',           label: 'Reports',        color: G.p600,   screen: 'Progress' },
      { icon: 'calendar',            label: 'Calendar',       color: G.purple, screen: 'CalendarStack' },
      { icon: 'chatbubble-ellipses', label: 'Messages',       color: G.p500,   screen: 'Messaging' },
    ],
  };

  const actions = ACTIONS[role] || [];

  return (
    <>
      {/* Tab bar button */}
      <TouchableOpacity
        style={styles.moreTabBtn}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Animated.View
          style={{
            transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }],
          }}
        >
          <Ionicons name="grid" size={24} color={show ? G.p700 : G.txtFaint} />
        </Animated.View>
        <Text style={[styles.moreTabLabel, show && { color: G.p700 }]}>More</Text>
      </TouchableOpacity>

      {/* Action sheet modal (Liquid Glass) */}
      <Modal visible={show} transparent animationType="none" onRequestClose={toggle}>
        <Pressable style={styles.overlay} onPress={toggle}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              styles.actionSheet,
              { bottom: (Platform.OS === 'ios' ? 95 : 75) + insets.bottom },
              {
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
              },
            ]}
          >
            <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />

            {/* Handle */}
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              {actions.map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.actionItem}
                  onPress={() => go(action.screen, action.params)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionCircle, { backgroundColor: action.color + '15', borderColor: action.color + '40' }]}>
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Main tab navigator ───────────────────────────────────────────────────────
function MainTabs({ navigation }) {
  const { user } = useAuth();
  const role = user?.role;

  // 4th tab: role-specific screen OR More button
  const getFourthTab = () => {
    if (role === 'employee') {
      return (
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          }}
        />
      );
    }

    return (
      <Tab.Screen
        name="MoreTab"
        component={BlankScreen}
        options={{
          headerShown: false,
          tabBarLabel: () => null,
          tabBarButton: () => <MoreTabButton navigation={navigation} role={role} />,
        }}
      />
    );
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: G.p700,
        tabBarInactiveTintColor: G.txtFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarShowLabel: true,
        // Fluid Glass Tab Bar Background
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.6)']} style={StyleSheet.absoluteFill} />
            <View style={styles.glassHighlight} />
          </View>
        ),
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={size} color={color} />,
        }}
      />
      {/* Centre FAB */}
      <Tab.Screen
        name="AddTaskTab"
        component={AddTaskScreen}
        options={{
          headerShown: false,
          tabBarLabel: '',
          tabBarButton: () => <FABButton onPress={() => navigation.navigate('AddTask', { task: null })} />,
        }}
      />
      {getFourthTab()}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: G.bgDark } }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main"             component={MainTabs} />
          <Stack.Screen name="TaskDetail"       component={TaskDetailScreen} />
          <Stack.Screen name="AddTask"          component={AddTaskScreen} />
          <Stack.Screen name="AddExpense"       component={AddExpenseScreen} />
          <Stack.Screen name="ExpensesStack"    component={ExpensesScreen} />
          <Stack.Screen name="DepartmentsStack" component={DepartmentsScreen} />
          <Stack.Screen name="UsersStack"       component={UsersScreen} />
          <Stack.Screen name="CalendarStack"    component={CalendarScreen} />
          <Stack.Screen name="Progress"         component={ProgressScreen} />
          <Stack.Screen name="DailyPlanner"       component={DailyPlannerScreen} />
          <Stack.Screen name="Messaging"         component={MessagingScreen} />
          <Stack.Screen name="Chat"              component={ChatScreen} />
          <Stack.Screen name="CreateGroup"       component={CreateGroupScreen} />
          <Stack.Screen name="Requirements"      component={RequirementsScreen} />
          <Stack.Screen name="PostRequirement"    component={PostRequirementScreen} />
          <Stack.Screen name="RequirementDetail" component={RequirementDetailScreen} />
          <Stack.Screen name="PerformanceChart"  component={PerformanceChartScreen} />
          <Stack.Screen name="Notifications"     component={NotificationsScreen} />
          <Stack.Screen name="UserPerformance"  component={UserPerformanceScreen} />
          <Stack.Screen name="TeamDashboard"        component={TeamDashboardScreen} />
          <Stack.Screen name="DepartmentDashboard" component={DepartmentDashboardScreen} />
          <Stack.Screen name="GroupInfo"            component={GroupInfoScreen} />
          <Stack.Screen name="UserProfile"          component={UserProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.6)',
    elevation: 0, // Remove default Android shadow to let custom shadow show
    height: Platform.OS === 'ios' ? 85 : 70,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 8,
    ...liquidShadow, shadowOffset: { width: 0, height: -4 },
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: G.white, zIndex: 5 },

  // Centre FAB
  fabButton: {
    top: -24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    ...liquidShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
  },
  fabHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.3)' },

  // More tab button
  moreTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 2,
  },
  moreTabLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: G.txtFaint,
    marginTop: 2,
  },

  // Action sheet (Liquid Glass)
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSheet: {
    position: 'absolute',
    left: 16, right: 16,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    padding: 24,
    overflow: 'hidden',
    shadowColor: G.p900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: G.p200,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: G.txtMain,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  actionItem: {
    width: 80,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: G.txtMain,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
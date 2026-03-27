export const Colors = {
  background: '#EDE9F8',
  primary: '#7C6FCD',
  primaryDark: '#5B4FAE',
  primaryLight: '#A89FE0',
  cardBg: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B8A',
  accent: '#F5A67D',
  tabBar: '#FFFFFF',
  activeChip: '#1A1A2E',
  inactiveChip: '#F0EEF8',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  border: '#E8E4F4',
  inputBg: '#F5F3FC',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#7C6FCD',
  statusPending: '#FF9800',
  statusApproved: '#4CAF50',
  statusRejected: '#F44336',
  statusInProgress: '#2196F3',
  statusCompleted: '#4CAF50',
  statusOnHold: '#FF9800',
  statusPastDue: '#F44336',
  statusTodo: '#7C6FCD',
};

export const Typography = {
  fontSizeXS: 10,
  fontSizeSM: 12,
  fontSizeMD: 14,
  fontSizeLG: 16,
  fontSizeXL: 18,
  fontSizeXXL: 22,
  fontSizeTitle: 28,
  fontSizeHero: 32,

  fontWeightLight: '300',
  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightSemiBold: '600',
  fontWeightBold: '700',
  fontWeightExtraBold: '800',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 50,
  circle: 999,
};

export const Shadows = {
  small: {
    shadowColor: '#7C6FCD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: '#7C6FCD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  large: {
    shadowColor: '#7C6FCD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
};

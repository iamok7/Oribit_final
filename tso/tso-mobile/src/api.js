import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://taskorbit.nexvitech.in';

const api = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('token');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

export default api;

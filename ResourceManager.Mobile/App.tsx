import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ThemeProvider } from './src/theme/ThemeContext';
import AccountLockedScreen from './src/screens/AccountLockedScreen';
import './src/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function AppContent() {
  const { isAuthenticated, loading, accountLocked } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (accountLocked) {
    return <AccountLockedScreen />;
  }

  return <AppNavigator isSignedIn={isAuthenticated} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider style={{ backgroundColor: '#000000' }}>
        <StatusBar style="light" backgroundColor="#000000" translucent={false} />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

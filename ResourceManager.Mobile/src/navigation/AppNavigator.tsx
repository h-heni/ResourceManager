import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';
import { authApi } from '../api';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import CompanySetupScreen from '../screens/CompanySetupScreen';
import CompanyInitScreen from '../screens/CompanyInitScreen';
import DashboardScreen from '../screens/DashboardScreen';
import InvoicesListScreen from '../screens/InvoicesListScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import InvoiceCreateScreen from '../screens/InvoiceCreateScreen';
import QuotesListScreen from '../screens/QuotesListScreen';
import QuoteDetailScreen from '../screens/QuoteDetailScreen';
import QuoteCreateScreen from '../screens/QuoteCreateScreen';
import DeliveryNotesListScreen from '../screens/DeliveryNotesListScreen';
import DeliveryNoteDetailScreen from '../screens/DeliveryNoteDetailScreen';
import DeliveryNoteCreateScreen from '../screens/DeliveryNoteCreateScreen';
import ScanInvoiceScreen from '../screens/ScanInvoiceScreen';
import ConfirmSupplierInvoiceScreen from '../screens/ConfirmSupplierInvoiceScreen';
import SupplierInvoicesListScreen from '../screens/SupplierInvoicesListScreen';
import SupplierInvoiceDetailScreen from '../screens/SupplierInvoiceDetailScreen';
import SuppliersListScreen from '../screens/SuppliersListScreen';
import ExpensesListScreen from '../screens/ExpensesListScreen';
import MoreMenuScreen from '../screens/MoreMenuScreen';
import ClientsListScreen from '../screens/ClientsListScreen';
import ProductsListScreen from '../screens/ProductsListScreen';
import InventoryListScreen from '../screens/InventoryListScreen';
import PurchaseOrdersScreen from '../screens/PurchaseOrdersScreen';
import InventoryReportsScreen from '../screens/InventoryReportsScreen';
import StockAlertsScreen from '../screens/StockAlertsScreen';
import UsersScreen from '../screens/UsersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EmailComposerScreen from '../screens/EmailComposerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Dashboard Stack ──
function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
    </Stack.Navigator>
  );
}

// ── Sales Stack ──
function SalesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InvoicesList" component={InvoicesListScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <Stack.Screen name="InvoiceCreate" component={InvoiceCreateScreen} />
      <Stack.Screen name="QuotesList" component={QuotesListScreen} />
      <Stack.Screen name="QuoteDetail" component={QuoteDetailScreen} />
      <Stack.Screen name="QuoteCreate" component={QuoteCreateScreen} />
      <Stack.Screen name="DeliveryNotesList" component={DeliveryNotesListScreen} />
      <Stack.Screen name="DeliveryNoteDetail" component={DeliveryNoteDetailScreen} />
      <Stack.Screen name="DeliveryNoteCreate" component={DeliveryNoteCreateScreen} />
      <Stack.Screen name="EmailComposer" component={EmailComposerScreen} />
    </Stack.Navigator>
  );
}

// ── Scan Stack ──
function ScanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanInvoice" component={ScanInvoiceScreen} />
      <Stack.Screen name="ConfirmSupplierInvoice" component={ConfirmSupplierInvoiceScreen} />
    </Stack.Navigator>
  );
}

// ── Purchases Stack ──
function PurchasesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierInvoicesList" component={SupplierInvoicesListScreen} />
      <Stack.Screen name="SupplierInvoiceDetail" component={SupplierInvoiceDetailScreen} />
      <Stack.Screen name="SuppliersList" component={SuppliersListScreen} />
      <Stack.Screen name="ExpensesList" component={ExpensesListScreen} />
    </Stack.Navigator>
  );
}

// ── More Stack ──
function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="ClientsList" component={ClientsListScreen} />
      <Stack.Screen name="ProductsList" component={ProductsListScreen} />
      <Stack.Screen name="InventoryList" component={InventoryListScreen} />
      <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
      <Stack.Screen name="InventoryReports" component={InventoryReportsScreen} />
      <Stack.Screen name="StockAlerts" component={StockAlertsScreen} />
      <Stack.Screen name="Users" component={UsersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CompanySetup" component={CompanySetupScreen} />
    </Stack.Navigator>
  );
}

// ── Custom Scan FAB Button ──
function ScanTabButton({ onPress }: { onPress?: (...args: any[]) => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity style={styles.scanFabOuter} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.scanFab, { backgroundColor: colors.primary }]}>
        <Ionicons name="scan-outline" size={28} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Tabs ──
function MainTabs() {
  const { colors, typography } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 10);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.light,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.small,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('DashboardTab', { screen: 'DashboardHome' });
          },
        })}
      />
      <Tab.Screen
        name="SalesTab"
        component={SalesStack}
        options={{
          tabBarLabel: t('nav.sales'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('SalesTab', { screen: 'InvoicesList' });
          },
        })}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanStack}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => <ScanTabButton onPress={props.onPress} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('ScanTab', { screen: 'ScanInvoice' });
          },
        })}
      />
      <Tab.Screen
        name="PurchasesTab"
        component={PurchasesStack}
        options={{
          tabBarLabel: t('nav.purchases'),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('PurchasesTab', { screen: 'SupplierInvoicesList' });
          },
        })}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{
          tabBarLabel: t('nav.more'),
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('MoreTab', { screen: 'MoreMenu' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

// ── Auth Stack ──
function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="CompanyInit" component={CompanyInitScreen} />
    </Stack.Navigator>
  );
}

// ── Root ──
function AppNavigator({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <NavigationContainer>
      {isSignedIn ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

export function useAuthCheck() {
  const [isSignedIn, setIsSignedIn] = React.useState(false);
  React.useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await authApi.isAuthenticated();
      setIsSignedIn(authenticated);
    };
    checkAuth();
  }, []);
  return { isSignedIn };
}

const styles = StyleSheet.create({
  scanFabOuter: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
});

export default AppNavigator;

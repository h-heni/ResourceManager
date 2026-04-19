import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { useInvoice, useRecordPayment } from '../hooks/useInvoice';
import { invoicesApi } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import { PaymentRecordModal } from '../components';

export default function InvoiceDetailScreen({ route, navigation }: any) {
  const { invoiceId } = route.params;
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const paymentMutation = useRecordPayment();

  const getStatusType = (status: string): any => {
    const map: Record<string, any> = { Paid: 'success', PartiallyPaid: 'warning', Pending: 'warning', Overdue: 'error', Archived: 'default' };
    return map[status] || 'default';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      const pdfUrl = invoicesApi.getPdfUrl(invoice.id);
      const fileUri = FileSystem.documentDirectory + `invoice_${invoice.number}.pdf`;
      const token = await AsyncStorage.getItem('@auth_token');
      const { uri } = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        // iOS: use Sharing as fallback since IntentLauncher is Android-only
        const Sharing = await import('expo-sharing');
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch {
      Alert.alert(t('common.error'), t('invoice.pdfError'));
    }
  };

  const handleRecordPayment = (data: { amount: number; paymentDate: string; notes?: string; isScheduled?: boolean }) => {
    paymentMutation.mutate({ invoiceId, data: { amount: data.amount, paymentDate: data.paymentDate, notes: data.notes } }, {
      onSuccess: () => setShowPayment(false),
    });
  };

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  if (!invoice) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={{ color: colors.text.secondary, marginTop: spacing.lg, textAlign: 'center' }}>{t('invoice.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remainingAmount = invoice.remainingAmount || 0;
  const isFullyPaid = remainingAmount === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.headerSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.invoiceNumber, { color: colors.text.primary }]}>#{invoice.number}</Text>
          <StatusBadge status={getStatusType(invoice.status)} text={invoice.status} />
        </View>

        {/* Client Info */}
        <Card style={{ margin: spacing.md }}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="business-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.text.tertiary }}>{t('invoice.client')}</Text>
              <Text style={{ color: colors.text.secondary, fontWeight: '500' }}>{invoice.client?.name || '-'}</Text>
              {invoice.client?.email && <Text style={{ fontSize: 12, color: colors.text.light }}>{invoice.client.email}</Text>}
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.text.tertiary }}>{t('invoice.date')}</Text>
              <Text style={{ color: colors.text.secondary, fontWeight: '500' }}>{formatDate(invoice.date)}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.text.tertiary }}>{t('invoice.dueDate')}</Text>
              <Text style={{ color: colors.text.secondary, fontWeight: '500' }}>{formatDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </Card>

        {/* Amount Card */}
        <Card style={{ margin: spacing.md, backgroundColor: colors.primaryLight, borderWidth: 0 }}>
          <Text style={{ textAlign: 'center', color: colors.primary }}>{t('invoice.totalAmount')}</Text>
          <Text style={{ textAlign: 'center', fontSize: 28, fontWeight: '700', color: colors.primary, marginVertical: spacing.sm }}>
            {invoice.totalAmount?.toLocaleString()} {invoice.currencySymbol || 'TND'}
          </Text>
          {!isFullyPaid && (
            <>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: colors.text.secondary }}>{t('invoice.amountPaid')}</Text>
                <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{invoice.amountPaid?.toLocaleString() || '0'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: colors.text.secondary }}>{t('invoice.remaining')}</Text>
                <Text style={{ color: colors.warning, fontWeight: '700' }}>{remainingAmount.toLocaleString()}</Text>
              </View>
            </>
          )}
          {isFullyPaid && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            </View>
          )}
        </Card>

        {/* Items */}
        {invoice.items && invoice.items.length > 0 && (
          <Card style={{ margin: spacing.md }} padding="md">
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md }}>{t('invoice.lineItems')}</Text>
            {invoice.items.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.secondary }}>{item.description}</Text>
                  <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>x {item.quantity}</Text>
                </View>
                <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{(item.totalItemHT || (item.quantity * item.price)).toLocaleString()}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Action Buttons — inside a Card so they stay within the scrollable content */}
        <Card style={{ margin: spacing.md }} padding="md">
          {!isFullyPaid && (
            <Button
              title={t('invoice.recordPayment')}
              variant="primary"
              onPress={() => setShowPayment(true)}
              icon={<Ionicons name="cash-outline" size={20} color="#FFF" />}
              style={{ marginBottom: spacing.sm }}
            />
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Button
              title={t('invoice.sendEmail')}
              variant="secondary"
              onPress={() => navigation.navigate('EmailComposer', { invoice })}
              icon={<Ionicons name="mail-outline" size={20} color={colors.text.secondary} />}
              style={{ flex: 1 }}
            />
            <Button
              title={t('invoice.downloadPdf')}
              variant="secondary"
              onPress={handleDownloadPdf}
              icon={<Ionicons name="download-outline" size={20} color={colors.text.secondary} />}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <PaymentRecordModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSubmit={handleRecordPayment}
        loading={paymentMutation.isPending}
        maxAmount={remainingAmount}
        currency={invoice.currencySymbol || 'TND'}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  invoiceNumber: { fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
});

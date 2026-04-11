import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { supplierInvoicesApi, type SupplierInvoice } from '../api/supplierInvoices';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import { PaymentRecordModal } from '../components';

export default function SupplierInvoiceDetailScreen({ route, navigation }: any) {
  const { invoiceId } = route.params;
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice, isLoading, isError } = useQuery<SupplierInvoice>({
    queryKey: ['supplier-invoice', invoiceId],
    queryFn: () => supplierInvoicesApi.getById(invoiceId),
  });

  const getStatusType = (status: string): any => {
    const map: Record<string, any> = { Paid: 'success', PartiallyPaid: 'warning', Pending: 'warning' };
    return map[status] || 'default';
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
  const formatAmount = (n?: number) => (n ?? 0).toLocaleString();

  const handleViewFile = async () => {
    try {
      const fileUrl = supplierInvoicesApi.getFileUrl(invoiceId);
      if (fileUrl) Linking.openURL(fileUrl);
    } catch {
      Alert.alert(t('common.error'), t('supplierInvoice.fileError'));
    }
  };

  if (isLoading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  if (isError || !invoice) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={{ color: colors.text.secondary, marginTop: spacing.md }}>{t('common.errorLoading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.text.primary, fontWeight: '500', flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }, shadows.card]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.invNumber, { color: colors.primary }]}>#{invoice.invoiceNumber}</Text>
              <Text style={{ color: colors.text.secondary, marginTop: 2 }}>{invoice.supplierName || t('supplier.unknown')}</Text>
            </View>
            <StatusBadge status={getStatusType(invoice.paymentStatus)} text={invoice.paymentStatus} />
          </View>
          {invoice.confidenceScore != null && (
            <View style={[styles.confidenceRow, { backgroundColor: colors.surface }]}>
              <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 12, marginLeft: 4 }}>{t('supplierInvoice.confidence')}: {(invoice.confidenceScore * 100).toFixed(0)}%</Text>
            </View>
          )}
        </View>

        {/* Amounts */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('supplierInvoice.amounts')}</Text>
          <InfoRow label={t('supplierInvoice.totalHT')} value={`${formatAmount(invoice.totalHT)} ${invoice.currencySymbol || 'TND'}`} />
          <InfoRow label={t('supplierInvoice.tva')} value={`${formatAmount(invoice.TVA)} ${invoice.currencySymbol || 'TND'}`} />
          <InfoRow label={t('supplierInvoice.totalTTC')} value={`${formatAmount(invoice.totalTTC)} ${invoice.currencySymbol || 'TND'}`} />
          <InfoRow label={t('supplierInvoice.amountPaid')} value={`${formatAmount(invoice.amountPaid)} ${invoice.currencySymbol || 'TND'}`} />
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small, flex: 1 }}>{t('supplierInvoice.remaining')}</Text>
            <Text style={{ color: invoice.remainingAmount > 0 ? colors.error : colors.success, fontWeight: '700', flex: 2, textAlign: 'right' }}>
              {formatAmount(invoice.remainingAmount)} {invoice.currencySymbol || 'TND'}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('supplierInvoice.details')}</Text>
          <InfoRow label={t('supplierInvoice.invoiceDate')} value={formatDate(invoice.invoiceDate)} />
          <InfoRow label={t('supplierInvoice.dueDate')} value={formatDate(invoice.dueDate)} />
          <InfoRow label={t('supplierInvoice.extraction')} value={invoice.extractionStatus} />
          <InfoRow label={t('supplierInvoice.currency')} value={invoice.currency || 'TND'} />
        </View>

        {/* Actions */}
        <View style={{ gap: spacing.sm, marginBottom: 32 }}>
          {invoice.remainingAmount > 0 && (
            <Button
              title={t('supplierInvoice.recordPayment')}
              variant="primary"
              onPress={() => setShowPayment(true)}
              icon={<Ionicons name="cash-outline" size={20} color="#FFF" />}
            />
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleViewFile}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>{t('supplierInvoice.viewFile')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PaymentRecordModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        onSubmit={() => setShowPayment(false)}
        loading={false}
        maxAmount={invoice.remainingAmount}
        currency={invoice.currencySymbol || 'TND'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { padding: 20, borderWidth: 1, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invNumber: { fontSize: 22, fontWeight: '700' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  card: { borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  actionBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, gap: 8, marginTop: 4, marginBottom: 32 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

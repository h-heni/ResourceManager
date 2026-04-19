import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supplierInvoicesApi, type ConfirmSupplierInvoiceRequest } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import StatusBadge from '../components/StatusBadge';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';
import { theme } from '../theme';

export default function ConfirmSupplierInvoiceScreen({ route, navigation }: any) {
  const {
    extractedData,
    tempFilePath,
    fileName,
    fileType,
  } = route.params;

  const { t } = useTranslation();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const [loading, setLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(extractedData?.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(
    extractedData?.invoiceDate || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    extractedData?.dueDate || ''
  );
  const [totalHT, setTotalHT] = useState(
    extractedData?.totalHT?.toString() || ''
  );
  const [totalTTC, setTotalTTC] = useState(
    extractedData?.totalTTC?.toString() || ''
  );
  const [TVA, setTVA] = useState(
    extractedData?.TVA?.toString() || ''
  );
  const [supplierName, setSupplierName] = useState(extractedData?.supplierName || '');
  const [supplierAddress, setSupplierAddress] = useState(extractedData?.address || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!invoiceNumber) {
      newErrors.invoiceNumber = t('scan.invoiceNumberRequired');
    }

    if (!invoiceDate) {
      newErrors.invoiceDate = t('scan.invoiceDateRequired');
    }

    if (!totalTTC) {
      newErrors.totalTTC = t('scan.totalRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const requestData: ConfirmSupplierInvoiceRequest = {
        fileName,
        tempFilePath,
        fileType,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        totalHT: totalHT ? parseFloat(totalHT) : undefined,
        totalTTC: totalTTC ? parseFloat(totalTTC) : undefined,
        TVA: TVA ? parseFloat(TVA) : undefined,
        supplierName: supplierName || undefined,
        supplierAddress: supplierAddress || undefined,
        rawExtractedText: '',
        confidenceScore: 0,
        currency: extractedData?.currency,
        currencySymbol: extractedData?.currency,
        items: extractedData?.lineItems?.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      };

      await supplierInvoicesApi.confirmNew(requestData);

      Alert.alert(
        t('common.success'),
        t('scan.saveSuccess'),
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset the ScanStack so pressing ScanTab again shows fresh ScanInvoice
              navigation.reset({
                index: 0,
                routes: [{ name: 'ScanInvoice' }],
              });
              // Then switch to PurchasesTab
              navigation.navigate('PurchasesTab', { screen: 'SupplierInvoicesList' });
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error'), (error as Error).message || t('scan.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await supplierInvoicesApi.discard(tempFilePath);
      Alert.alert(
        t('scan.discardedTitle'),
        t('scan.discardedMessage'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      // If discard fails, just go back
      navigation.goBack();
    }
  };

  const formatCurrency = (value?: number): string => {
    return value ? value.toLocaleString() : '0.00';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('scan.confirmTitle')}</Text>
        <TouchableOpacity onPress={handleDiscard}>
          <Ionicons name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Card style={styles.card} padding="lg">
          {/* Scan Status */}
          <View style={styles.statusSection}>
            <View style={[styles.statusIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="scan-outline" size={24} color="#FFF" />
            </View>
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: colors.primary }]}>{t('scan.scanComplete')}</Text>
              <Text style={[styles.statusMessage, { color: colors.text.secondary }]}>
                {t('scan.confirmSubtitle')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Invoice Details */}
        <Card style={styles.card} padding="md">
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('scan.invoiceDetails')}</Text>

          <Input
            label={t('scan.invoiceNumber')}
            placeholder="INV-001"
            value={invoiceNumber}
            onChangeText={(text) => {
              setInvoiceNumber(text);
              if (errors.invoiceNumber) { const { invoiceNumber: _omit, ...rest } = errors; setErrors(rest); }
            }}
            error={errors.invoiceNumber}
          />

          <Input
            label={t('scan.invoiceDate')}
            placeholder={t('scan.selectDate')}
            value={invoiceDate}
            onChangeText={(text) => {
              setInvoiceDate(text);
              if (errors.invoiceDate) { const { invoiceDate: _omit, ...rest } = errors; setErrors(rest); }
            }}
            error={errors.invoiceDate}
          />

          <Input
            label={t('scan.dueDateOptional')}
            placeholder={t('scan.selectDueDate')}
            value={dueDate}
            onChangeText={setDueDate}
          />

          <Input
            label={t('scan.totalHT')}
            placeholder="0.00"
            value={totalHT}
            onChangeText={setTotalHT}
            keyboardType="decimal-pad"
            leftIcon={<Ionicons name="pricetag-outline" size={20} color={colors.text.light} />}
          />

          <Input
            label={t('scan.totalTTC')}
            placeholder="0.00"
            value={totalTTC}
            onChangeText={(text) => {
              setTotalTTC(text);
              if (errors.totalTTC) { const { totalTTC: _omit, ...rest } = errors; setErrors(rest); }
            }}
            error={errors.totalTTC}
            keyboardType="decimal-pad"
            leftIcon={<Ionicons name="wallet-outline" size={20} color={colors.text.light} />}
          />

          <Input
            label={t('scan.tva')}
            placeholder="0.00"
            value={TVA}
            onChangeText={setTVA}
            keyboardType="decimal-pad"
          />
        </Card>

        {/* Supplier Details */}
        <Card style={styles.card} padding="md">
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('scan.supplierDetails')}</Text>

          <Input
            label={t('scan.supplierName')}
            placeholder={t('scan.supplierNamePlaceholder')}
            value={supplierName}
            onChangeText={setSupplierName}
            leftIcon={<Ionicons name="business-outline" size={20} color={colors.text.light} />}
          />

          <Input
            label={t('scan.addressOptional')}
            placeholder={t('scan.addressPlaceholder')}
            value={supplierAddress}
            onChangeText={setSupplierAddress}
            leftIcon={<Ionicons name="location-outline" size={20} color={colors.text.light} />}
          />
        </Card>

        {/* Line Items Preview */}
        {extractedData?.lineItems && extractedData.lineItems.length > 0 && (
          <Card style={styles.card} padding="md">
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('scan.lineItems')}</Text>
            {extractedData.lineItems.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                  <Text style={[styles.itemQty, { color: colors.text.tertiary }]}>
                    {t('common.qty')}: {item.quantity}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>
                  {formatCurrency(item.unitPrice)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Actions */}
        <Card style={{ margin: spacing.md }} padding="md">
          <Button
            title={t('scan.saveInvoice')}
            variant="primary"
            onPress={handleConfirm}
            disabled={loading}
            loading={loading}
            fullWidth
            icon={<Ionicons name="checkmark" size={20} color="#FFF" />}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSize.h1,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: theme.spacing.md,
    marginBottom: 0,
  },
  statusSection: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: theme.typography.fontSize.h3,
    fontWeight: theme.typography.fontWeight.semiBold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statusMessage: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.h3,
    fontWeight: theme.typography.fontWeight.semiBold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  itemInfo: {
    flex: 1,
  },
  itemDesc: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  itemQty: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
  itemPrice: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semiBold,
    color: theme.colors.text.primary,
  },
  actions: {
    padding: theme.spacing.lg,
  },
  saveButton: {
    minHeight: 52,
  },
});

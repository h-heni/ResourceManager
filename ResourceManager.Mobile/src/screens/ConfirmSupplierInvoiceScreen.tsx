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
import { theme } from '../theme';

export default function ConfirmSupplierInvoiceScreen({ route, navigation }: any) {
  const {
    extractedData,
    tempFilePath,
    fileName,
    fileType,
  } = route.params;

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
      newErrors.invoiceNumber = 'Invoice number is required';
    }

    if (!invoiceDate) {
      newErrors.invoiceDate = 'Invoice date is required';
    }

    if (!totalTTC) {
      newErrors.totalTTC = 'Total amount is required';
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
        'Success',
        'Supplier invoice saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Invoices' }),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to save invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await supplierInvoicesApi.discard(tempFilePath);
      Alert.alert(
        'Discarded',
        'Invoice scan has been discarded.',
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Invoice</Text>
        <TouchableOpacity onPress={handleDiscard}>
          <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Card style={styles.card} padding="lg">
          {/* Scan Status */}
          <View style={styles.statusSection}>
            <View style={styles.statusIcon}>
              <Ionicons name="scan-outline" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>Scan Complete</Text>
              <Text style={styles.statusMessage}>
                Please review and confirm the extracted data
              </Text>
            </View>
          </View>
        </Card>

        {/* Invoice Details */}
        <Card style={styles.card} padding="md">
          <Text style={styles.sectionTitle}>Invoice Details</Text>

          <Input
            label="Invoice Number"
            placeholder="INV-001"
            value={invoiceNumber}
            onChangeText={(text) => {
              setInvoiceNumber(text);
              if (errors.invoiceNumber) setErrors({ ...errors, invoiceNumber: undefined });
            }}
            error={errors.invoiceNumber}
          />

          <Input
            label="Invoice Date"
            placeholder="Select date"
            value={invoiceDate}
            onChangeText={(text) => {
              setInvoiceDate(text);
              if (errors.invoiceDate) setErrors({ ...errors, invoiceDate: undefined });
            }}
            error={errors.invoiceDate}
          />

          <Input
            label="Due Date (Optional)"
            placeholder="Select due date"
            value={dueDate}
            onChangeText={setDueDate}
          />

          <Input
            label="Total HT"
            placeholder="0.00"
            value={totalHT}
            onChangeText={setTotalHT}
            keyboardType="decimal-pad"
            leftIcon={<Ionicons name="pricetag-outline" size={20} color={theme.colors.text.light} />}
          />

          <Input
            label="Total TTC"
            placeholder="0.00"
            value={totalTTC}
            onChangeText={(text) => {
              setTotalTTC(text);
              if (errors.totalTTC) setErrors({ ...errors, totalTTC: undefined });
            }}
            error={errors.totalTTC}
            keyboardType="decimal-pad"
            leftIcon={<Ionicons name="wallet-outline" size={20} color={theme.colors.text.light} />}
          />

          <Input
            label="TVA"
            placeholder="0.00"
            value={TVA}
            onChangeText={setTVA}
            keyboardType="decimal-pad"
          />
        </Card>

        {/* Supplier Details */}
        <Card style={styles.card} padding="md">
          <Text style={styles.sectionTitle}>Supplier Details</Text>

          <Input
            label="Supplier Name"
            placeholder="Enter supplier name"
            value={supplierName}
            onChangeText={setSupplierName}
            leftIcon={<Ionicons name="business-outline" size={20} color={theme.colors.text.light} />}
          />

          <Input
            label="Address (Optional)"
            placeholder="Enter address"
            value={supplierAddress}
            onChangeText={setSupplierAddress}
            leftIcon={<Ionicons name="location-outline" size={20} color={theme.colors.text.light} />}
          />
        </Card>

        {/* Line Items Preview */}
        {extractedData?.lineItems && extractedData.lineItems.length > 0 && (
          <Card style={styles.card} padding="md">
            <Text style={styles.sectionTitle}>Line Items</Text>
            {extractedData.lineItems.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                  <Text style={styles.itemQty}>
                    Qty: {item.quantity}
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
        <View style={styles.actions}>
          <Button
            title="Save Invoice"
            variant="primary"
            onPress={handleConfirm}
            disabled={loading}
            loading={loading}
            style={styles.saveButton}
            fullWidth
            icon={<Ionicons name="checkmark" size={20} color={theme.colors.white} />}
          />
        </View>
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

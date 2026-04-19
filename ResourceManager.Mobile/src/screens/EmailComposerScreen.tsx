import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { invoicesApi, type SendEmailRequest } from '../api';
import Button from '../components/Button';
import Card from '../components/Card';
import { theme } from '../theme';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/ThemeContext';

export default function EmailComposerScreen({ route, navigation }: any) {
  const { invoice } = route.params;
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [to, setTo] = useState(invoice?.clientEmail || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-fill email template when component mounts
    if (invoice) {
      const defaultSubject = `Invoice #${invoice.number} - ${invoice.clientName}`;
      const defaultBody = `Dear ${invoice.clientName},\n\nPlease find attached invoice #${invoice.number} dated ${new Date(invoice.date).toLocaleDateString()}.\n\nTotal Amount: ${invoice.totalAmount?.toLocaleString()} ${invoice.currencySymbol || 'TND'}\n\nThank you for your business.\n\nBest regards,\nYour Company`;

      setSubject(defaultSubject);
      setBody(defaultBody);
      setLoading(false);
    }
  }, [invoice]);

  const handleSend = async () => {
    if (!to) {
      Alert.alert(t('common.error'), t('email.recipientRequired'));
      return;
    }

    if (!subject) {
      Alert.alert(t('common.error'), t('email.subjectRequired'));
      return;
    }

    setSending(true);
    try {
      const emailData: SendEmailRequest = {
        recipientEmail: to,
        subject,
        body,
        attachPdf,
      };

      await invoicesApi.sendEmail(invoice.id, emailData);

      Alert.alert(
        t('common.success'),
        t('email.sentSuccess'),
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      const errorMessage = (error as Error).message || t('email.sendFailed');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatCurrency = (value?: number): string => {
    return value ? value.toLocaleString() : '0.00';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('email.sendInvoice')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Invoice Preview Card */}
        <Card style={styles.previewCard} padding="lg">
          <View style={styles.invoicePreview}>
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceNumber}>#{invoice?.number || 'INV-001'}</Text>
                <Text style={styles.invoiceDate}>
                  {new Date(invoice?.date || new Date()).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.invoiceAmount}>
                {formatCurrency(invoice?.totalAmount)} {invoice?.currencySymbol || 'TND'}
              </Text>
            </View>
            <Text style={styles.clientName}>{invoice?.clientName || 'Client Name'}</Text>

            {invoice?.status !== 'Paid' && (
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentLabel}>Paid:</Text>
                <Text style={styles.paymentValue}>
                  {formatCurrency(invoice?.amountPaid)}
                </Text>
                <Text style={styles.paymentLabel}> | Remaining:</Text>
                <Text style={[styles.paymentValue, styles.remaining]}>
                  {formatCurrency(invoice?.remainingAmount)}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Email Fields Card */}
        <Card style={styles.card} padding="lg">
          <Text style={styles.sectionTitle}>{t('email.compose')}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('email.to')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder="recipient@email.com"
              value={to}
              onChangeText={setTo}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={theme.colors.text.light}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('email.subject')}</Text>
            <TextInput
              style={[styles.textInput, styles.subjectInput]}
              placeholder="Enter subject"
              value={subject}
              onChangeText={setSubject}
              placeholderTextColor={theme.colors.text.light}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('email.message')}</Text>
            <TextInput
              style={[styles.textInput, styles.bodyInput]}
              placeholder="Enter your message..."
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              placeholderTextColor={theme.colors.text.light}
            />
          </View>

          {/* Attachment Toggle */}
          <TouchableOpacity
            style={styles.attachmentToggle}
            onPress={() => setAttachPdf(!attachPdf)}
          >
            <View style={[
              styles.checkbox,
              attachPdf && styles.checkboxChecked
            ]}>
              {attachPdf && (
                <Ionicons name="checkmark" size={14} color={theme.colors.white} />
              )}
            </View>
            <Text style={styles.attachmentText}>{t('email.attachPdf')}</Text>
            <Text style={styles.attachmentNote}>
              ({attachPdf ? 'Yes' : 'No'})
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Send Button */}
        <View style={styles.actions}>
          <Button
            title={t('email.send')}
            variant="primary"
            onPress={handleSend}
            disabled={sending}
            loading={sending}
            style={styles.sendButton}
            fullWidth
            icon={<Ionicons name="send" size={20} color={theme.colors.white} />}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  scrollView: {
    flex: 1,
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
  placeholder: {
    width: 24,
  },
  previewCard: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0,
    marginBottom: theme.spacing.md,
  },
  invoicePreview: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  invoiceNumber: {
    fontSize: theme.typography.fontSize.h3,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
  },
  invoiceDate: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.tertiary,
  },
  invoiceAmount: {
    fontSize: theme.typography.fontSize.h2,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  clientName: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  paymentLabel: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.tertiary,
  },
  paymentValue: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semiBold,
    color: theme.colors.text.primary,
  },
  remaining: {
    color: theme.colors.warning,
  },
  card: {
    margin: theme.spacing.md,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.h3,
    fontWeight: theme.typography.fontWeight.semiBold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  textInput: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.input.border,
    borderRadius: theme.borderRadius.xs,
    padding: theme.spacing.sm,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.primary,
  },
  subjectInput: {
    fontWeight: theme.typography.fontWeight.medium,
  },
  bodyInput: {
    height: 150,
    paddingTop: theme.spacing.sm,
  },
  attachmentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  attachmentText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  attachmentNote: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.text.tertiary,
  },
  actions: {
    padding: theme.spacing.lg,
  },
  sendButton: {
    minHeight: 52,
  },
});

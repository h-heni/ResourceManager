import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../theme/ThemeContext';
import { useDeliveryNoteDetail, useDeleteDeliveryNote } from '../hooks/useSales';
import { deliveryNotesApi } from '../api/deliveryNotes';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import { ConfirmDeleteModal } from '../components';

export default function DeliveryNoteDetailScreen({ route, navigation }: any) {
  const { noteId } = route.params;
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const { t } = useTranslation();
  const [showDelete, setShowDelete] = useState(false);

  const { data: note, isLoading } = useDeliveryNoteDetail(noteId);
  const deleteMutation = useDeleteDeliveryNote();

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  const handleDelete = () => {
    deleteMutation.mutate(noteId, {
      onSuccess: () => { setShowDelete(false); navigation.goBack(); },
    });
  };

  const handleDownloadPdf = async () => {
    if (!note) return;
    try {
      const pdfUrl = deliveryNotesApi.getPdfUrl(note.id);
      const fileUri = FileSystem.documentDirectory + `dn_${note.number}.pdf`;
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
        const Sharing = await import('expo-sharing');
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch {
      Alert.alert(t('common.error'), t('deliveryNote.pdfError'));
    }
  };

  if (isLoading || !note) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md }}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.lg }, shadows.card]}>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8 }}>
              <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.number, { color: colors.primary, flex: 1 }]}>#{note.number}</Text>
            <StatusBadge status={note.status === 'Delivered' ? 'success' : 'warning'} text={note.status} />
          </View>
          <View style={styles.infoGrid}>
            <InfoItem label={t('deliveryNote.client')} value={note.clientName} colors={colors} typography={typography} />
            <InfoItem label={t('deliveryNote.date')} value={formatDate(note.date)} colors={colors} typography={typography} />
            <InfoItem label={t('deliveryNote.total')} value={`${note.totalAmount.toLocaleString()} ${note.currencySymbol || 'TND'}`} colors={colors} typography={typography} highlight />
          </View>
        </View>

        <Text style={[styles.section, { color: colors.text.primary, fontSize: typography.fontSize.h3 }]}>{t('deliveryNote.items')}</Text>
        {(note.items ?? []).map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: borderRadius.md }, shadows.card]}>
            <Text style={{ color: colors.text.primary, fontWeight: '500' }}>{item.description}</Text>
            <View style={[styles.row, { marginTop: 8, marginBottom: 0 }]}>
              <Text style={{ color: colors.text.tertiary, fontSize: 13 }}>{t('common.qty')}: {item.quantity} x {item.price.toLocaleString()}</Text>
              <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{item.totalItemHT.toLocaleString()}</Text>
            </View>
          </View>
        ))}

        {/* Actions */}
        <Card style={{ marginTop: spacing.md }} padding="md">
          <Button
            title={t('deliveryNote.downloadPdf')}
            variant="secondary"
            onPress={handleDownloadPdf}
            icon={<Ionicons name="download-outline" size={20} color={colors.text.secondary} />}
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            title={t('common.delete')}
            variant="danger"
            onPress={() => setShowDelete(true)}
            icon={<Ionicons name="trash-outline" size={20} color="#FFF" />}
          />
        </Card>
      </ScrollView>

      <ConfirmDeleteModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title={t('deliveryNote.deleteTitle')}
        message={t('deliveryNote.deleteMessage')}
      />
    </SafeAreaView>
  );
}

function InfoItem({ label, value, colors, typography, highlight }: any) {
  return (
    <View style={styles.infoItem}>
      <Text style={{ color: colors.text.tertiary, fontSize: typography.fontSize.small }}>{label}</Text>
      <Text style={{ color: highlight ? colors.primary : colors.text.primary, fontWeight: highlight ? '700' : '500', fontSize: highlight ? 18 : 14 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  number: { fontSize: 20, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 16 },
  infoItem: { width: '45%' },
  section: { fontWeight: '600', marginTop: 8, marginBottom: 8 },
});

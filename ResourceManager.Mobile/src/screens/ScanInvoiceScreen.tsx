import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supplierInvoicesApi } from '../api';
import Button from '../components/Button';
import { theme } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';

export default function ScanInvoiceScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('scan.permissionRequired'),
        t('scan.permissionMessage')
      );
      return;
    }

    try {
      // Capture full-resolution image — no cropping, no resize.
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setScannedImage(uri);

        // Run on-device OCR in background — don't block the user.
        // If it finishes before they tap "Process", the text is sent along;
        // otherwise the backend uses Gemini/Tesseract as fallback.
        TextRecognition.recognize(uri)
          .then((mlResult) => setRecognizedText(mlResult?.text ?? ''))
          .catch(() => setRecognizedText(''));
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      Alert.alert(t('scan.cameraError'), error?.message || t('scan.cameraErrorMessage'));
    }
  };

  const handleRetake = () => {
    setScannedImage(null);
    setRecognizedText('');
  };

  const handleUpload = async () => {
    if (!scannedImage) return;

    setProcessing(true);
    try {
      // Get filename from URI
      const fileName = `invoice_${Date.now()}.jpg`;

      // Upload original image bytes + on-device OCR text.
      // Backend will skip Tesseract when extractedText is provided.
      const response = await supplierInvoicesApi.upload(
        scannedImage,
        fileName,
        'image/jpeg',
        undefined,
        recognizedText
      );

      if (response.success) {
        navigation.navigate('ConfirmSupplierInvoice', {
          extractedData: response.extractedData,
          tempFilePath: response.tempFilePath,
          fileName: response.fileName,
          fileType: response.fileType,
        });
      } else {
        Alert.alert(
          t('scan.scanFailed'),
          response.message || t('scan.scanFailedMessage')
        );
      }
    } catch (error) {
      Alert.alert(t('scan.uploadFailed'), (error as Error).message || t('scan.tryAgain'));
    } finally {
      setProcessing(false);
    }
  };

  const handleDiscard = async () => {
    if (!scannedImage) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      t('scan.discardScanTitle'),
      t('scan.discardScanMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('scan.discard'),
          style: 'destructive',
          onPress: () => {
            setScannedImage(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('scan.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!scannedImage ? (
        <ScrollView contentContainerStyle={styles.cameraContainer}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="camera-outline" size={64} color={theme.colors.primary} />
          </View>
          <Text style={styles.placeholderText}>{t('scan.captureInvoiceTitle')}</Text>
          <Text style={styles.placeholderSub}>{t('scan.captureInvoiceSub')}</Text>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>{t('scan.tips.title')}</Text>
            <View style={styles.tipRow}>
              <Ionicons name="sunny-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.tipText}>{t('scan.tips.lighting')}</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.tipText}>{t('scan.tips.flat')}</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="scan-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.tipText}>{t('scan.tips.fullFrame')}</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.tipText}>{t('scan.tips.steady')}</Text>
            </View>
          </View>

          <Button
            title={t('scan.openCamera')}
            variant="primary"
            onPress={handleCapture}
            style={styles.captureButton}
            fullWidth
            icon={<Ionicons name="camera" size={20} color={theme.colors.white} />}
          />
        </ScrollView>
      ) : (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: scannedImage }}
            style={styles.previewImage}
            resizeMode="contain"
          />

          <View style={styles.actions}>
            <Button
              title={t('scan.retake')}
              variant="secondary"
              onPress={handleRetake}
              style={styles.retakeButton}
              icon={<Ionicons name="refresh" size={20} color={theme.colors.text.secondary} />}
            />
            <Button
              title={t('scan.processInvoice')}
              variant="primary"
              onPress={handleUpload}
              disabled={processing}
              style={styles.uploadButton}
              icon={<Ionicons name="checkmark" size={20} color={theme.colors.white} />}
            />
            <TouchableOpacity
              style={styles.discardButton}
              onPress={handleDiscard}
            >
              <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
            </TouchableOpacity>
          </View>

          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.processingText}>{t('scan.processing')}</Text>
            </View>
          )}
        </View>
      )}
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
  headerSpacer: {
    width: 24,
  },
  cameraContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  heroIconWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  placeholderText: {
    fontSize: theme.typography.fontSize.h3,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  tipsBox: {
    width: '100%',
    backgroundColor: theme.colors.offWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tipsTitle: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tipText: {
    flex: 1,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  captureButton: {
    minHeight: 52,
  },
  previewContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  retakeButton: {
    flex: 1,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    },
  discardButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
});

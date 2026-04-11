import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { supplierInvoicesApi } from '../api';
import Button from '../components/Button';
import { theme } from '../theme';

export default function ScanInvoiceScreen({ route, navigation }: any) {
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleCapture = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is needed to scan invoices'
        );
        return;
      }
    }

    try {
      // Capture image using camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Compress/optimize image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1200, height: 900 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        setScannedImage(manipulatedImage.uri);
      }
    } catch (error) {
      Alert.alert('Camera Error', 'Could not capture image. Please try again.');
    }
  };

  const handleRetake = () => {
    setScannedImage(null);
  };

  const handleUpload = async () => {
    if (!scannedImage) return;

    setProcessing(true);
    try {
      // Get filename from URI
      const fileName = `invoice_${Date.now()}.jpg`;

      // Upload to existing API
      const response = await supplierInvoicesApi.upload(
        scannedImage,
        fileName,
        'image/jpeg'
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
          'Scan Failed',
          response.message || 'Could not process invoice. Please try again.'
        );
      }
    } catch (error) {
      Alert.alert('Upload Failed', (error as Error).message || 'Please try again.');
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
      'Discard Scan',
      'Are you sure you want to discard this scan?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setScannedImage(null);
          },
        },
      ]
    );
  };

  if (permission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Scan Invoice</Text>
        <View style={styles.placeholder} />
      </View>

      {!scannedImage ? (
        <View style={styles.cameraContainer}>
          <View style={styles.placeholder}>
            <Ionicons name="camera-outline" size={64} color={theme.colors.text.light} />
            <Text style={styles.placeholderText}>
              Capture invoice image
            </Text>
            <Text style={styles.placeholderSub}>
              Position the invoice within the frame
            </Text>
          </View>

          <Button
            title="Open Camera"
            variant="primary"
            onPress={handleCapture}
            style={styles.captureButton}
            fullWidth
            icon={<Ionicons name="camera" size={20} color={theme.colors.white} />}
          />
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: scannedImage }}
            style={styles.previewImage}
            resizeMode="contain"
          />

          <View style={styles.actions}>
            <Button
              title="Retake"
              variant="secondary"
              onPress={handleRetake}
              style={styles.retakeButton}
              icon={<Ionicons name="refresh" size={20} color={theme.colors.text.secondary} />}
            />
            <Button
              title="Process Invoice"
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
              <Text style={styles.processingText}>Processing invoice...</Text>
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
  placeholder: {
    width: 24,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  placeholder: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
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

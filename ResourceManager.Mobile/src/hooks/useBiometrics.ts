import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from '../api/secureStorage';

const BIOMETRIC_ENABLED_KEY = 'biometrics_enabled';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricsState {
  /** True if the device has biometric hardware. */
  available: boolean;
  /** True if at least one biometric is enrolled on the device. */
  enrolled: boolean;
  /** Best type of biometric the device supports. */
  type: BiometricType;
}

/** Query device hardware and enrolled biometrics. */
async function checkSupport(): Promise<BiometricsState> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { available: false, enrolled: false, type: 'none' };

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();

  let type: BiometricType = 'none';
  if (supported.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    type = 'facial';
  } else if (supported.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    type = 'fingerprint';
  } else if (supported.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    type = 'iris';
  }

  return { available: true, enrolled: isEnrolled, type };
}

/** Returns true if the user has opted in to biometric login on this device. */
async function isEnabled(): Promise<boolean> {
  const val = await secureStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return val === 'true';
}

/** Persist (or clear) the biometric-enabled flag in encrypted storage. */
async function setEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await secureStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    await secureStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
}

/**
 * Trigger the native biometric prompt.
 * @returns true if the user authenticated successfully.
 */
async function authenticate(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    // Allow PIN / pattern as a fallback so the user is never fully locked out
    disableDeviceFallback: false,
    requireConfirmation: false,
  });
  return result.success;
}

export const biometricAuth = {
  checkSupport,
  isEnabled,
  setEnabled,
  authenticate,
};

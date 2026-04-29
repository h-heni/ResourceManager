import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Secure storage wrapper.
 *
 * - On native (iOS / Android): uses expo-secure-store, which on iOS uses the Keychain
 *   (kSecAttrAccessibleAfterFirstUnlock by default) and on Android uses the AndroidKeyStore
 *   + EncryptedSharedPreferences. Tokens are encrypted at rest.
 * - On web: falls back to AsyncStorage (which is just localStorage). SecureStore is not
 *   available on web, and this is only used during local dev preview.
 *
 * SecureStore values must be strings <= 2 KB. JWTs and 64-byte refresh tokens fit easily.
 */

const isWeb = Platform.OS === 'web';

// SecureStore keys may not contain '@'. Convert AsyncStorage-style keys ('@auth_token')
// to a SecureStore-safe form ('auth_token').
const normalizeKey = (key: string) => key.replace(/^@/, '').replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
    async getItem(key: string): Promise<string | null> {
        if (isWeb) return AsyncStorage.getItem(key);
        try {
            return await SecureStore.getItemAsync(normalizeKey(key));
        } catch {
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        if (isWeb) {
            await AsyncStorage.setItem(key, value);
            return;
        }
        await SecureStore.setItemAsync(normalizeKey(key), value, {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
    },
    async removeItem(key: string): Promise<void> {
        if (isWeb) {
            await AsyncStorage.removeItem(key);
            return;
        }
        try {
            await SecureStore.deleteItemAsync(normalizeKey(key));
        } catch {
            // ignore — already absent
        }
    },
    async multiRemove(keys: string[]): Promise<void> {
        await Promise.all(keys.map((k) => this.removeItem(k)));
    },
};

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SettingsScreen() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Settings screen coming soon</Text>
      <Text style={styles.hint}>
        Full screens are ready in src/screens/ folder
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshButtonText}>Refresh App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#7C3AED',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#EDE9FE',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#EDE9FE',
    textAlign: 'center',
    marginTop: 20,
  },
  refreshButton: {
    marginTop: 30,
    backgroundColor: '#EDE9FE',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function InvoicesScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invoices</Text>
      <Text style={styles.subtitle}>Invoice management coming soon</Text>
      <Text style={styles.hint}>
        Full screens are ready in src/screens/ folder
      </Text>
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
});

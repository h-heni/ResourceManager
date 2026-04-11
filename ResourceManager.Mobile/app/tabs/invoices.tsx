import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function InvoicesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invoices</Text>
      <Text style={styles.subtitle}>
        Invoice management screen - coming soon
      </Text>
      <Text style={styles.hint}>
        Full implementation ready in src/screens/InvoicesListScreen.tsx
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
    marginBottom: 20,
  },
  hint: {
    fontSize: 14,
    color: '#EDE9FE',
    textAlign: 'center',
    marginTop: 20,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resource Manager Mobile</Text>
      <Text style={styles.subtitle}>
        App is running successfully!
      </Text>
      <Text style={styles.hint}>
        Ready to build full features:
      </Text>
      <Text style={styles.feature}>- Invoice Management</Text>
      <Text style={styles.feature}>- Email Sending</Text>
      <Text style={styles.feature}>- Invoice Scanning</Text>
      <Text style={styles.feature}>- Figma Design System</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#EDE9FE',
    textAlign: 'center',
    marginBottom: 10,
  },
  feature: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 5,
  },
});

import { Link } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Industrial Design Tokens
const COLORS = {
  charcoal: '#121212',
  orange: '#FF5722',
  bone: '#F5F5F0',
  white: '#FFFFFF',
  gray: '#2A2A2A',
  textSecondary: '#A0A0A0',
};

export default function Index() {
  useEffect(() => {
    // Ensure we are authenticated for Firestore rules
    signInAnonymously(auth).catch(err => console.error('Auth error:', err));
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.hero}>
          <Text style={styles.title}>TEMPLE_TR</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>PRECISION_MEASUREMENT_SYSTEM</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SYSTEM_STATUS</Text>
            <Text style={styles.statValue}>READY</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>LOCAL_CACHE</Text>
            <Text style={styles.statValue}>ENCRYPTED</Text>
          </View>
        </View>

        <Link href="/new-job" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>INITIATE_NEW_SESSION</Text>
          </TouchableOpacity>
        </Link>

        <Text style={styles.version}>VER_10.4.2_STABLE</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.charcoal,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 30,
    justifyContent: 'center',
  },
  hero: {
    marginBottom: 60,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.bone,
    letterSpacing: 4,
  },
  divider: {
    height: 4,
    width: 80,
    backgroundColor: COLORS.orange,
    marginVertical: 15,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.orange,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 60,
  },
  statBox: {
    flex: 0.45,
    borderLeftWidth: 1,
    borderLeftColor: '#333',
    paddingLeft: 15,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    color: COLORS.bone,
    fontWeight: '900',
    letterSpacing: 1,
  },
  button: {
    backgroundColor: 'transparent',
    padding: 25,
    alignItems: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.orange,
  },
  buttonText: {
    color: COLORS.orange,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  version: {
    marginTop: 40,
    color: '#333',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 1,
  },
});

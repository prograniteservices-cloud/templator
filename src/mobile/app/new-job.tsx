import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as Network from 'expo-network';

// Industrial Design Tokens
const COLORS = {
    charcoal: '#121212',
    orange: '#FF5722',
    bone: '#F5F5F0',
    white: '#FFFFFF',
    gray: '#2A2A2A',
    textSecondary: '#A0A0A0',
};

export default function NewJobScreen() {
    const [customerName, setCustomerName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleStartMeasurement = async () => {
        if (!customerName.trim()) {
            Alert.alert(
                'VALIDATION_ERROR',
                'Please enter a customer name to proceed.',
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }

        setIsCreating(true);
        try {
            // Check network connectivity
            const networkState = await Network.getNetworkStateAsync();
            const isOnline = networkState.isConnected && networkState.isInternetReachable;

            // Create job in Firestore with offline fallback
            const jobData = {
                customerName: customerName.trim(),
                status: 'capturing',
                // Use serverTimestamp() when online, Date.now() when offline
                createdAt: isOnline ? serverTimestamp() : Date.now(),
                updatedAt: isOnline ? serverTimestamp() : Date.now(),
                measurements: null,
                blueprintData: null,
                offlineCreated: !isOnline, // Flag for offline-created jobs
            };

            const docRef = await addDoc(collection(db, 'jobs'), jobData);
            console.log('Job created with ID:', docRef.id, isOnline ? '(online)' : '(offline)');

            // Show offline warning if applicable
            if (!isOnline) {
                Alert.alert(
                    'OFFLINE_MODE',
                    'Job created in offline mode. Data will sync when connection is restored.',
                    [{ text: 'PROCEED', style: 'default' }]
                );
            }

            // Navigate to camera with job ID
            router.push({
                pathname: '/camera',
                params: { jobId: docRef.id, customerName: customerName.trim() }
            });
        } catch (error: any) {
            console.error('Error creating job:', error);

            // Provide specific error feedback
            const errorMessage = error.code === 'unavailable'
                ? 'Firebase service unavailable. Please check your connection and try again.'
                : error.code === 'permission-denied'
                    ? 'Permission denied. Please check Firebase authentication.'
                    : `Failed to create job: ${error.message || 'Unknown error'}`;

            Alert.alert(
                'JOB_CREATION_FAILED',
                errorMessage,
                [
                    { text: 'RETRY', onPress: handleStartMeasurement, style: 'default' },
                    { text: 'CANCEL', style: 'cancel' }
                ]
            );
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>NEW_JOB</Text>
                    <View style={styles.divider} />
                    <Text style={styles.subtitle}>ESTABLISHING_SESSION_PARAMETERS</Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>CUSTOMER_IDENTIFIER</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ENTER_NAME..."
                        placeholderTextColor="#666"
                        value={customerName}
                        onChangeText={setCustomerName}
                        autoFocus
                    />

                    <Text style={styles.infoText}>
                        SESSION_ID: AUTO_GENERATED
                        {'\n'}LOCATION_DATA: ACQUIRED
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, isCreating && styles.buttonDisabled]}
                    onPress={handleStartMeasurement}
                    disabled={isCreating}
                >
                    <Text style={styles.buttonText}>
                        {isCreating ? 'INITIALIZING...' : 'START_CAPTURE_SEQUENCE'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.backButtonText}>CANCEL_SESSION</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
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
    header: {
        marginBottom: 60,
    },
    title: {
        fontSize: 42,
        fontWeight: '900',
        color: COLORS.bone,
        letterSpacing: 4,
    },
    divider: {
        height: 4,
        width: 60,
        backgroundColor: COLORS.orange,
        marginVertical: 10,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.orange,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    form: {
        marginBottom: 40,
    },
    label: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: 'bold',
        marginBottom: 15,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: COLORS.gray,
        borderWidth: 1,
        borderColor: '#333',
        padding: 20,
        color: COLORS.white,
        fontSize: 20,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        borderRadius: 2,
    },
    infoText: {
        marginTop: 20,
        color: '#666',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 16,
    },
    button: {
        backgroundColor: COLORS.orange,
        padding: 25,
        alignItems: 'center',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: COLORS.orange,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: COLORS.charcoal,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2,
    },
    backButton: {
        marginTop: 20,
        padding: 15,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});

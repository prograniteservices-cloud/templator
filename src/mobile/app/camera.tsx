import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, Platform, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { extractFrames, ExtractedFrame } from '../lib/video-processing';
import { analyzeFrames, TemplateAnalysis } from '../lib/gemini';
import { Accelerometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Design Tokens (Industrial Precision)
const COLORS = {
  charcoal: '#121212',
  orange: '#FF5722',
  bone: '#F5F5F0',
  black: '#000000',
  error: '#D32F2F',
  success: '#388E3C',
};

export default function CameraScreen() {
  const { jobId, customerName } = useLocalSearchParams();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<TemplateAnalysis | null>(null);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [accelerometerData, setAccelerometerData] = useState({ x: 0, y: 0, z: 0 });
  const [isLevel, setIsLevel] = useState(true);

  useEffect(() => {
    let subscription: any;
    const subscribe = async () => {
      subscription = Accelerometer.addListener(data => {
        setAccelerometerData(data);
        const tilt = Math.sqrt(data.x * data.x + data.y * data.y);
        setIsLevel(tilt < 0.15);
      });
      Accelerometer.setUpdateInterval(100);
    };

    subscribe();
    return () => subscription && subscription.remove();
  }, []);

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 1 minute max for MVP
        });
        if (video) {
          console.log('Recording finished:', video.uri);
          setRecordingUri(video.uri);

          // Update Status in Firestore
          try {
            if (typeof jobId === 'string') {
              await updateDoc(doc(db, 'jobs', jobId), {
                status: 'processing',
                updatedAt: serverTimestamp(),
              });
            }
          } catch (firestoreError: any) {
            console.error('Firestore update error:', firestoreError);
            // Non-critical error, continue processing
          }

          // Trigger Frame Extraction
          try {
            setIsProcessing(true);
            setProcessingStatus('EXTRACTING_GEOMETRY...');
            const extracted = await extractFrames(video.uri);

            if (!extracted || extracted.length === 0) {
              throw new Error('No frames could be extracted from the video');
            }

            setFrames(extracted);
            console.log('Extracted', extracted.length, 'frames');
          } catch (extractError: any) {
            console.error('Frame extraction error:', extractError);
            setIsProcessing(false);

            Alert.alert(
              'FRAME_EXTRACTION_FAILED',
              `Unable to extract frames from video: ${extractError.message || 'Unknown error'}`,
              [
                { text: 'RETRY', onPress: () => startRecording(), style: 'default' },
                { text: 'CANCEL', onPress: () => router.back(), style: 'cancel' }
              ]
            );
            return;
          }

          // AI Analysis
          try {
            setProcessingStatus('AI_ANALYSIS_IN_PROGRESS...');
            const analysis = await analyzeFrames(frames);

            if (!analysis) {
              throw new Error('AI analysis returned no results');
            }

            setAnalysisResult(analysis);
            console.log('Analysis complete:', analysis);

            // Update Final Results in Firestore
            try {
              if (typeof jobId === 'string') {
                await updateDoc(doc(db, 'jobs', jobId), {
                  status: analysis.isValid ? 'complete' : 'error',
                  measurements: analysis.squareFootage || null,
                  confidence: analysis.confidence,
                  notes: analysis.notes,
                  blueprintData: analysis.blueprintData || null,
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (firestoreError: any) {
              console.error('Firestore update error:', firestoreError);
              // Show warning but don't block completion
              Alert.alert(
                'SYNC_WARNING',
                'Analysis complete but failed to sync with server. Data saved locally.',
                [{ text: 'OK', style: 'default' }]
              );
            }

            setIsProcessing(false);
            setProcessingStatus('');

            // Show results to user
            if (analysis.isValid) {
              Alert.alert(
                'ANALYSIS_COMPLETE',
                `Square Footage: ${analysis.squareFootage?.toFixed(2) || 'N/A'}\nConfidence: ${(analysis.confidence * 100).toFixed(0)}%`,
                [{ text: 'CONTINUE', onPress: () => router.replace('/'), style: 'default' }]
              );
            } else {
              Alert.alert(
                'ANALYSIS_INCOMPLETE',
                `Analysis failed: ${analysis.notes || 'Unable to determine measurements'}\n\nPlease retry with better lighting and ensure calibration stick is visible.`,
                [
                  { text: 'RETRY', onPress: () => router.back(), style: 'default' },
                  { text: 'VIEW_JOBS', onPress: () => router.replace('/'), style: 'cancel' }
                ]
              );
            }
          } catch (analysisError: any) {
            console.error('AI analysis error:', analysisError);
            setIsProcessing(false);

            // Update job status to error
            try {
              if (typeof jobId === 'string') {
                await updateDoc(doc(db, 'jobs', jobId), {
                  status: 'error',
                  notes: `Processing failed: ${analysisError.message || 'Unknown error'}`,
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (firestoreError) {
              console.error('Failed to update error status:', firestoreError);
            }

            Alert.alert(
              'AI_PROCESSING_FAILED',
              `Analysis error: ${analysisError.message || 'Unknown error'}\n\nPossible causes:\n• Poor lighting conditions\n• Calibration stick not visible\n• Network connectivity issues\n• AI service unavailable`,
              [
                { text: 'RETRY_CAPTURE', onPress: () => router.back(), style: 'default' },
                { text: 'VIEW_JOBS', onPress: () => router.replace('/'), style: 'cancel' }
              ]
            );
            return;
          }
        }
      } catch (error: any) {
        console.error('Failed to record video:', error);
        setIsRecording(false);
        setIsProcessing(false);

        Alert.alert(
          'RECORDING_FAILED',
          `Unable to record video: ${error.message || 'Unknown error'}\n\nPlease check camera permissions and try again.`,
          [
            { text: 'RETRY', onPress: () => startRecording(), style: 'default' },
            { text: 'EXIT', onPress: () => router.back(), style: 'cancel' }
          ]
        );
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handlePermissions = async () => {
    await requestCameraPermission();
    await requestMicPermission();
  };

  if (!cameraPermission || !micPermission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.title}>SYSTEM_ACCESS_REQUIRED</Text>
          <Text style={styles.message}>
            Camera and Microphone permissions are required for precision measurement capture.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handlePermissions}>
            <Text style={styles.buttonText}>GRANT_PERMISSIONS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>EXIT_SYSTEM</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        mode="video"
        facing="back"
      >
        {/* Safe Zone Overlay */}
        <View style={styles.safeZoneOverlay}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        {/* Level Indicator */}
        <View style={styles.levelIndicatorContainer}>
          <View style={[
            styles.levelBubble,
            {
              transform: [
                { translateX: accelerometerData.x * 50 },
                { translateY: -accelerometerData.y * 50 }
              ],
              backgroundColor: isLevel ? COLORS.orange : 'rgba(255,255,255,0.2)'
            }
          ]} />
          <View style={[styles.levelTarget, isLevel && styles.levelTargetActive]} />
          <Text style={[styles.levelText, isLevel && { color: COLORS.orange }]}>
            {isLevel ? 'PROPER_ALIGNMENT' : 'ADJUST_STABILITY'}
          </Text>
        </View>

        {/* Instruction Card */}
        {showInstructions && (
          <View style={styles.instructionOverlay}>
            <View style={styles.instructionCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>CAPTURE_GUIDE_V5</Text>
                <TouchableOpacity onPress={() => setShowInstructions(false)}>
                  <Ionicons name="close-circle-outline" size={32} color={COLORS.orange} />
                </TouchableOpacity>
              </View>

              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>01</Text>
                <Text style={styles.stepText}>PLACE_CALIBRATION_STICK_ON_COUNTERTOP</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>02</Text>
                <Text style={styles.stepText}>ENSURE_ENTIRE_SURFACE_IS_VISIBLE</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>03</Text>
                <Text style={styles.stepText}>RECORD_SLOW_360_PAN_AROUND_OBJECT</Text>
              </View>

              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => setShowInstructions(false)}
              >
                <Text style={styles.cardButtonText}>ACKNOWLEDGE_PROCEDURES</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Technical Overlays */}
        <View style={styles.topOverlay}>
          <Text style={styles.systemStatus}>CAPTURE_MODE: ACTIVE</Text>
          <View style={styles.divider} />
          <Text style={styles.instruction}>
            POSITION CALIBRATION STICK IN FRAME
          </Text>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.crosshairH} />
          <View style={styles.crosshairV} />
        </View>

        <View style={styles.controls}>
          <View style={styles.statusPanel}>
            <Text style={styles.statusLabel}>REC_TIME</Text>
            <Text style={styles.statusValue}>{isRecording ? 'RECORDING' : 'READY'}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.recordButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <View style={[styles.recordIndicator, isRecording && styles.recordingIndicator]} />
          </TouchableOpacity>

          <View style={styles.metaPanel}>
            <Text style={styles.statusLabel}>COORD_LOCK</Text>
            <Text style={styles.statusValue}>ESTABLISHING...</Text>
          </View>
        </View>
      </CameraView>

      {/* Processing Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={styles.processingText}>{processingStatus}</Text>
          <Text style={styles.processingSubtext}>ESTABLISHING DIMENSIONAL PARAMETERS</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  camera: {
    flex: 1,
  },
  permissionBox: {
    padding: 30,
    backgroundColor: COLORS.charcoal,
    borderWidth: 2,
    borderColor: COLORS.orange,
    margin: 20,
    borderRadius: 0,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.orange,
  },
  systemStatus: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(245, 245, 240, 0.2)',
    marginVertical: 8,
  },
  instruction: {
    color: COLORS.bone,
    fontSize: 14,
    fontWeight: '300',
  },
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 60,
    height: 1,
    backgroundColor: 'rgba(245, 245, 240, 0.5)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: 60,
    backgroundColor: 'rgba(245, 245, 240, 0.5)',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(18, 18, 18, 0.9)',
    borderTopWidth: 2,
    borderTopColor: 'rgba(245, 245, 240, 0.1)',
  },
  statusPanel: {
    width: 100,
  },
  metaPanel: {
    width: 100,
    alignItems: 'flex-end',
  },
  statusLabel: {
    color: 'rgba(245, 245, 240, 0.5)',
    fontSize: 10,
    letterSpacing: 1,
  },
  statusValue: {
    color: COLORS.bone,
    fontSize: 12,
    fontWeight: '600',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.bone,
  },
  recordingButton: {
    borderColor: COLORS.orange,
  },
  recordIndicator: {
    width: 60,
    height: 60,
    borderRadius: 0,
    backgroundColor: COLORS.bone,
  },
  recordingIndicator: {
    width: 30,
    height: 30,
    backgroundColor: COLORS.orange,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.orange,
    marginBottom: 10,
    letterSpacing: 1,
  },
  message: {
    fontSize: 14,
    color: COLORS.bone,
    marginBottom: 30,
    lineHeight: 20,
  },
  button: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 0,
    marginVertical: 5,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.bone,
  },
  buttonText: {
    color: COLORS.bone,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  secondaryButtonText: {
    color: COLORS.bone,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: COLORS.orange,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    letterSpacing: 2,
  },
  processingSubtext: {
    color: COLORS.bone,
    fontSize: 12,
    marginTop: 10,
    opacity: 0.6,
    letterSpacing: 1,
  },
  safeZoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
    margin: 40,
  },
  cornerCommon: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: COLORS.orange,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.orange,
  },
  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.orange,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.orange,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.orange,
  },
  levelIndicatorContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  levelTarget: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  levelTargetActive: {
    borderColor: COLORS.orange,
  },
  levelBubble: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  levelText: {
    position: 'absolute',
    bottom: -30,
    fontSize: 8,
    color: '#666',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  instructionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 30,
    zIndex: 100,
  },
  instructionCard: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: COLORS.orange,
    padding: 30,
    borderRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.bone,
    letterSpacing: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  stepNum: {
    fontSize: 24,
    color: COLORS.orange,
    fontWeight: '900',
    marginRight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#A0A0A0',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardButton: {
    backgroundColor: COLORS.orange,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  cardButtonText: {
    color: COLORS.charcoal,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';

export interface ExtractedFrame {
    uri: string;
    timestamp: number;
}

/**
 * Extracts a specific number of frames from a video file at regular intervals.
 * @param videoUri The local URI of the video file.
 * @param frameCount Number of frames to extract (default 10).
 * @returns Promise resolving to an array of ExtractedFrame objects.
 */
export async function extractFrames(
    videoUri: string,
    frameCount: number = 10
): Promise<ExtractedFrame[]> {
    const frames: ExtractedFrame[] = [];

    try {
        // Note: We don't have total duration easily without expo-av or similar,
        // so we'll assume a standard 10s-30s capture and try to extract 
        // at 1s intervals starting from 1s.
        // Future improvement: Get duration from video metadata.

        for (let i = 1; i <= frameCount; i++) {
            const time = i * 1000; // time in milliseconds
            const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
                time: time,
                quality: 0.8,
            });

            frames.push({ uri, timestamp: time });
        }
    } catch (e) {
        console.warn('Frame extraction error:', e);
    }

    return frames;
}

/**
 * Cleans up temporary frame files.
 * @param frames Array of ExtractedFrame objects to delete.
 */
export async function cleanupFrames(frames: ExtractedFrame[]): Promise<void> {
    for (const frame of frames) {
        try {
            await FileSystem.deleteAsync(frame.uri, { idempotent: true });
        } catch (e) {
            console.warn('Failed to delete frame:', frame.uri, e);
        }
    }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';
import { ExtractedFrame } from './video-processing';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface TemplateAnalysis {
    isValid: boolean;
    squareFootage?: number;
    confidence: number;
    notes: string;
    blueprintData?: string; // SVG path or JSON of coordinates
}

/**
 * Analyzes video frames using Gemini Pro Vision 1.5.
 * @param frames Array of extracted frames from the video.
 * @returns Promise resolving to a TemplateAnalysis object.
 */
export async function analyzeFrames(frames: ExtractedFrame[]): Promise<TemplateAnalysis> {
    if (!API_KEY) {
        throw new Error('GEMINI_API_KEY_MISSING');
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Convert frames to the format required by Gemini
        const imageParts = await Promise.all(
            frames.map(async (frame) => {
                const base64 = await FileSystem.readAsStringAsync(frame.uri, {
                    encoding: 'base64',
                });
                return {
                    inlineData: {
                        data: base64,
                        mimeType: 'image/jpeg',
                    },
                };
            })
        );

        const prompt = `
      You are an expert countertop templating assistant. 
      Analyze these frames from a video capture of a countertop measurement session.
      
      Tasks:
      1. Identify the calibration stick (it should be a known length, likely 12 inches or 1 meter).
      2. Calculate the pixels-per-inch (PPI) based on the calibration stick.
      3. Extract the dimensional boundaries of the countertop.
      4. Estimate the approximate square footage.
      5. Generate a simplified 2D blueprint representation.
      
      Return a STRICT JSON object with:
      {
         "isValid": boolean,
         "squareFootage": number,
         "confidence": number (0-1),
         "notes": "technical feedback",
         "blueprintData": "SVG path data (d attribute) representing the countertop outline"
      }
    `;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Attempt to parse JSON from response
        try {
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const jsonString = text.substring(jsonStart, jsonEnd);
            return JSON.parse(jsonString) as TemplateAnalysis;
        } catch (e) {
            console.warn('Failed to parse Gemini JSON, returning fallback', text);
            return {
                isValid: false,
                confidence: 0,
                notes: "ANALYSIS_PARSE_FAILURE: Review video manually."
            };
        }
    } catch (error) {
        console.error('Gemini analysis failed:', error);
        throw error;
    }
}

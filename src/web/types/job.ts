import { Timestamp } from 'firebase/firestore';

export type JobStatus = 'capturing' | 'processing' | 'complete' | 'failed';

export interface BlueprintDataObject {
  edges: Array<{ x: number; y: number }>;
  dimensions: { width: number; height: number };
  scale: number;
}

export type BlueprintData = string | BlueprintDataObject | null;

export interface Job {
  id: string;
  customerName: string;
  status: JobStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  measurements: number | null;
  confidence: number | null;
  notes: string | null;
  blueprintData: BlueprintData;
  videoFilePath: string | null;
}

export interface JobFilters {
  status: JobStatus | 'all';
}

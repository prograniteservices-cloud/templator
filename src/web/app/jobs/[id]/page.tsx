"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/ui/button';
import { Job, JobStatus } from '@/types/job';
import BlueprintVisualization from '@/components/BlueprintVisualization';
import type { BlueprintData } from '@/types/job';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

function formatTimestamp(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return '-';
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return String(timestamp);
}

function getStatusConfig(status: JobStatus) {
  switch (status) {
    case 'capturing':
      return {
        color: '#3B82F6',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        icon: Clock,
        label: 'Capturing',
        description: 'Video capture in progress',
      };
    case 'processing':
      return {
        color: '#F59E0B',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        icon: RefreshCw,
        label: 'Processing',
        description: 'AI analysis running',
      };
    case 'complete':
      return {
        color: '#10B981',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        icon: CheckCircle2,
        label: 'Complete',
        description: 'Analysis finished',
      };
    case 'failed':
      return {
        color: '#EF4444',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: AlertCircle,
        label: 'Failed',
        description: 'Processing error occurred',
      };
    default:
      return {
        color: '#6B7280',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/30',
        icon: Clock,
        label: status,
        description: 'Unknown status',
      };
  }
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [measurements, setMeasurements] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!params.id) return;

    setLoading(true);
    setError(null);

    const jobRef = doc(db, 'jobs', params.id);
    const unsubscribe = onSnapshot(
      jobRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const jobData = { id: docSnap.id, ...docSnap.data() } as Job;
          setJob(jobData);
          setMeasurements(jobData.measurements?.toString() || '');
        } else {
          setError('Job not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching job:', err);
        setError('Failed to load job');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#FF5722] animate-spin mx-auto mb-4" />
          <p className="text-[#F5F5F0]/70 font-mono text-sm tracking-wider">LOADING JOB DATA...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#F5F5F0] mb-2">Error Loading Job</h1>
          <p className="text-[#F5F5F0]/70 mb-6">{error || 'Job not found'}</p>
          <Link href="/">
            <Button variant="outline" className="border-[#F5F5F0]/20 text-[#F5F5F0] hover:bg-[#F5F5F0]/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;
  const confidencePercent = job.confidence ? Math.round(job.confidence * 100) : null;

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Header */}
      <header className="border-b border-[#F5F5F0]/10 bg-[#121212]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-[#F5F5F0]/70 hover:text-[#F5F5F0] hover:bg-[#F5F5F0]/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-[#F5F5F0]/20" />
              <div>
                <h1 className="text-lg font-bold text-[#F5F5F0] tracking-tight">
                  {job.customerName}
                </h1>
                <p className="text-xs text-[#F5F5F0]/50 font-mono">
                  JOB-{job.id.slice(-8).toUpperCase()}
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-none border ${statusConfig.borderColor} ${statusConfig.bgColor}`}>
              <StatusIcon className="w-4 h-4" style={{ color: statusConfig.color }} />
              <span className="text-sm font-medium" style={{ color: statusConfig.color }}>
                {statusConfig.label.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Blueprint Visualization */}
            <section className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
              <div className="border-b border-[#F5F5F0]/10 px-6 py-4">
                <h2 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FF5722]" />
                  Blueprint Visualization
                </h2>
              </div>
              <div className="p-6">
                <BlueprintVisualization blueprintData={job.blueprintData as BlueprintData} jobStatus={job.status} />
              </div>
            </section>

            {/* Measurements */}
            <section className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
              <div className="border-b border-[#F5F5F0]/10 px-6 py-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase">
                  Measurements
                </h2>
                {!editing && job.status === 'complete' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setEditing(true)}
                    className="border-[#F5F5F0]/20 text-[#F5F5F0] hover:bg-[#F5F5F0]/10 rounded-none"
                  >
                    Edit
                  </Button>
                )}
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                      Square Footage
                    </label>
                    {editing ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={measurements}
                          onChange={(e) => setMeasurements(e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#121212] border border-[#F5F5F0]/20 text-[#F5F5F0] text-sm focus:border-[#FF5722] focus:outline-none"
                        />
                        <Button 
                          size="sm" 
                          className="bg-[#FF5722] hover:bg-[#FF5722]/90 text-white rounded-none"
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setEditing(false)}
                          className="border-[#F5F5F0]/20 text-[#F5F5F0] hover:bg-[#F5F5F0]/10 rounded-none"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-2xl font-bold text-[#F5F5F0]">
                        {job.measurements ? `${job.measurements.toFixed(2)} sq ft` : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                      Confidence Score
                    </label>
                    <p className="mt-2 text-2xl font-bold text-[#F5F5F0]">
                      {confidencePercent !== null ? `${confidencePercent}%` : '-'}
                    </p>
                    {job.confidence && (
                      <div className="mt-2 h-1 w-full bg-[#F5F5F0]/10">
                        <div 
                          className="h-full bg-[#FF5722]"
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Analysis Notes */}
            <section className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
              <div className="border-b border-[#F5F5F0]/10 px-6 py-4">
                <h2 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase">
                  Analysis Notes
                </h2>
              </div>
              <div className="p-6">
                {job.notes ? (
                  <p className="text-[#F5F5F0]/80 text-sm leading-relaxed">{job.notes}</p>
                ) : (
                  <p className="text-[#F5F5F0]/40 text-sm italic">No analysis notes available</p>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar - Right Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Job Status Card */}
            <section className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
              <div className="border-b border-[#F5F5F0]/10 px-6 py-4">
                <h2 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase">
                  Job Status
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className={`flex items-start gap-3 p-3 border ${statusConfig.borderColor} ${statusConfig.bgColor}`}>
                  <StatusIcon className="w-5 h-5 mt-0.5" style={{ color: statusConfig.color }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: statusConfig.color }}>
                      {statusConfig.label}
                    </p>
                    <p className="text-xs text-[#F5F5F0]/50 mt-1">{statusConfig.description}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Job Details Card */}
            <section className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
              <div className="border-b border-[#F5F5F0]/10 px-6 py-4">
                <h2 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase">
                  Job Details
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Job ID
                  </label>
                  <p className="mt-1 text-sm font-mono text-[#F5F5F0]">{job.id}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Created
                  </label>
                  <p className="mt-1 text-sm text-[#F5F5F0]">{formatTimestamp(job.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Last Updated
                  </label>
                  <p className="mt-1 text-sm text-[#F5F5F0]">{formatTimestamp(job.updatedAt)}</p>
                </div>
              </div>
            </section>

            {/* Actions */}
            <section className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
              <div className="border-b border-[#F5F5F0]/10 px-6 py-4">
                <h2 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase">
                  Actions
                </h2>
              </div>
              <div className="p-6 space-y-3">
                <Button 
                  className="w-full bg-[#FF5722] hover:bg-[#FF5722]/90 text-white rounded-none"
                  disabled={job.status !== 'complete'}
                >
                  Export Blueprint
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-[#F5F5F0]/20 text-[#F5F5F0] hover:bg-[#F5F5F0]/10 rounded-none"
                  disabled={job.status !== 'complete'}
                >
                  Download Report
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

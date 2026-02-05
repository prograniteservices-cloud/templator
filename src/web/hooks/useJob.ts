import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Job } from '@/types/job';
import { firestoreReadLimiter } from '@/lib/rate-limit';
import { sanitizeJobData } from '@/lib/validation';
import { getAuth } from 'firebase/auth';

export function useJob(id: string) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const fetchJob = useCallback(async () => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    
    if (!id) return;
    
    if (!userId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Check rate limit
    try {
      await firestoreReadLimiter.checkLimit(`job_detail_${userId}_${id}`);
      setRateLimited(false);
    } catch (err) {
      setRateLimited(true);
      setError('Too many requests. Please wait a moment.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const jobRef = doc(db, 'jobs', id);
    
    const unsubscribe = onSnapshot(
      jobRef,
      (docSnap) => {
        try {
          if (docSnap.exists()) {
            // Verify ownership before setting state
            const data = docSnap.data();
            if (data.createdBy !== userId) {
              setError('Access denied. You do not have permission to view this job.');
              setJob(null);
              setLoading(false);
              return;
            }

            // Sanitize data before using
            const sanitized = sanitizeJobData({
              id: docSnap.id,
              ...data
            });
            setJob(sanitized as Job);
          } else {
            setError('Job not found');
            setJob(null);
          }
          setLoading(false);
        } catch (parseError) {
          console.error('Error parsing job data:', parseError);
          setError('Failed to process job data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching job:', err);
        
        // Provide specific error messages based on error type
        if (err.code === 'permission-denied') {
          setError('Access denied. Please check your permissions.');
        } else if (err.code === 'resource-exhausted') {
          setError('Rate limit exceeded. Please try again later.');
          setRateLimited(true);
        } else {
          setError('Failed to load job. Please try again.');
        }
        
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    fetchJob().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchJob]);

  return { 
    job, 
    loading, 
    error,
    rateLimited,
    retry: fetchJob 
  };
}

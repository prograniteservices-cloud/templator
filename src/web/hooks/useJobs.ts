"use client";

import { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, where, QueryConstraint, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Job, JobStatus, JobFilters } from '@/types/job';
import { firestoreReadLimiter } from '@/lib/rate-limit';
import { sanitizeJobData } from '@/lib/validation';
import { getAuth } from 'firebase/auth';

// Maximum number of jobs to fetch (prevents excessive reads)
const MAX_JOBS_LIMIT = 100;

export function useJobs(filters: JobFilters = { status: 'all' }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const fetchJobs = useCallback(async () => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Check rate limit
    try {
      await firestoreReadLimiter.checkLimit(`jobs_list_${userId}`);
      setRateLimited(false);
    } catch (err) {
      setRateLimited(true);
      setError('Too many requests. Please wait a moment.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [
      orderBy('createdAt', 'desc'),
      limit(MAX_JOBS_LIMIT), // Prevent excessive reads
    ];

    if (filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    // Add ownership filter - only fetch jobs created by current user
    constraints.push(where('createdBy', '==', userId));

    const jobsQuery = query(collection(db, 'jobs'), ...constraints);

    const unsubscribe = onSnapshot(
      jobsQuery,
      (snapshot) => {
        try {
          const jobsData: Job[] = snapshot.docs.map((doc) => {
            // Sanitize data before using
            const sanitized = sanitizeJobData({
              id: doc.id,
              ...doc.data()
            });
            return sanitized as Job;
          });
          setJobs(jobsData);
          setLoading(false);
        } catch (parseError) {
          console.error('Error parsing job data:', parseError);
          setError('Failed to process job data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching jobs:', err);
        
        // Provide specific error messages based on error type
        if (err.code === 'permission-denied') {
          setError('Access denied. Please check your permissions.');
        } else if (err.code === 'resource-exhausted') {
          setError('Rate limit exceeded. Please try again later.');
          setRateLimited(true);
        } else {
          setError('Failed to load jobs. Please try again.');
        }
        
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters.status]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    fetchJobs().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchJobs]);

  return { 
    jobs, 
    loading, 
    error,
    rateLimited,
    retry: fetchJobs 
  };
}

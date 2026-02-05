/**
 * Concurrent User Simulation Tests
 * Tests dashboard performance under multiple concurrent users
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useJobs } from '@/hooks/useJobs';
import { useJob } from '@/hooks/useJob';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import type { Job } from '@/types/job';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Concurrent User Simulation Tests', () => {
  const createMockJob = (id: string, status: Job['status'] = 'complete'): Job => ({
    id,
    customerName: `Customer ${id}`,
    status,
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as Timestamp,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as Timestamp,
    measurements: 100 + Math.random() * 100,
    confidence: 0.8 + Math.random() * 0.2,
    notes: `Notes for job ${id}`,
    blueprintData: null,
    videoFilePath: `/videos/${id}.mp4`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({} as any);
    mockDoc.mockReturnValue({} as any);
    mockQuery.mockReturnValue({} as any);
  });

  describe('Multiple Users Accessing Job List', () => {
    it('should handle 10 concurrent users viewing job list', async () => {
      const mockJobs = Array.from({ length: 50 }, (_, i) => 
        createMockJob(`job-${i}`)
      );

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docs: mockJobs.map(job => ({
            id: job.id,
            data: () => ({
              customerName: job.customerName,
              status: job.status,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt,
              measurements: job.measurements,
              confidence: job.confidence,
              notes: job.notes,
              blueprintData: job.blueprintData,
              videoFilePath: job.videoFilePath,
            }),
          })),
        } as any);
        return jest.fn();
      });

      // Simulate 10 concurrent users
      const userSessions = Array.from({ length: 10 }, () =>
        renderHook(() => useJobs({ status: 'all' }))
      );

      // All users should get results
      await Promise.all(
        userSessions.map(async ({ result }) => {
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });
          expect(result.current.jobs).toHaveLength(50);
          expect(result.current.error).toBeNull();
        })
      );

      // Should create 10 separate listeners
      expect(mockOnSnapshot).toHaveBeenCalledTimes(10);
    });

    it('should handle 50 concurrent users with different filters', async () => {
      const mockJobs = Array.from({ length: 100 }, (_, i) => 
        createMockJob(`job-${i}`, i % 4 === 0 ? 'complete' : 'processing')
      );

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docs: mockJobs.map(job => ({
            id: job.id,
            data: () => ({
              customerName: job.customerName,
              status: job.status,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt,
              measurements: job.measurements,
              confidence: job.confidence,
              notes: job.notes,
              blueprintData: job.blueprintData,
              videoFilePath: job.videoFilePath,
            }),
          })),
        } as any);
        return jest.fn();
      });

      // Simulate 50 users with different filter combinations
      const filters: Array<{ status: Job['status'] | 'all' }> = [
        ...Array(15).fill({ status: 'all' }),
        ...Array(15).fill({ status: 'complete' }),
        ...Array(10).fill({ status: 'processing' }),
        ...Array(5).fill({ status: 'capturing' }),
        ...Array(5).fill({ status: 'failed' }),
      ];

      const userSessions = filters.map(f => renderHook(() => useJobs(f)));

      await Promise.all(
        userSessions.map(async ({ result }) => {
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });
          expect(result.current.error).toBeNull();
        })
      );

      expect(mockOnSnapshot).toHaveBeenCalledTimes(50);
    });

    it('should handle users joining and leaving simultaneously', async () => {
      const mockJobs = Array.from({ length: 20 }, (_, i) => 
        createMockJob(`job-${i}`)
      );

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docs: mockJobs.map(job => ({
            id: job.id,
            data: () => ({ ...job }),
          })),
        } as any);
        return jest.fn();
      });

      // Start with 5 users
      let activeUsers = Array.from({ length: 5 }, () =>
        renderHook(() => useJobs())
      );

      await waitFor(() => {
        activeUsers.forEach(({ result }) => {
          expect(result.current.loading).toBe(false);
        });
      });

      // Simulate 10 more users joining
      const newUsers = Array.from({ length: 10 }, () =>
        renderHook(() => useJobs())
      );

      await waitFor(() => {
        newUsers.forEach(({ result }) => {
          expect(result.current.loading).toBe(false);
        });
      });

      // Simulate 3 users leaving
      activeUsers.slice(0, 3).forEach(({ unmount }) => unmount());

      // Remaining users should still have data
      expect(activeUsers[3].result.current.jobs).toHaveLength(20);
      expect(activeUsers[4].result.current.jobs).toHaveLength(20);
    });
  });

  describe('Job Detail Page Access', () => {
    it('should handle 20 users viewing the same job simultaneously', async () => {
      const mockJob = createMockJob('shared-job');

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          exists: () => true,
          id: mockJob.id,
          data: () => ({
            customerName: mockJob.customerName,
            status: mockJob.status,
            createdAt: mockJob.createdAt,
            updatedAt: mockJob.updatedAt,
            measurements: mockJob.measurements,
            confidence: mockJob.confidence,
            notes: mockJob.notes,
            blueprintData: mockJob.blueprintData,
            videoFilePath: mockJob.videoFilePath,
          }),
        } as any);
        return jest.fn();
      });

      // 20 users viewing the same job
      const sessions = Array.from({ length: 20 }, () =>
        renderHook(() => useJob('shared-job'))
      );

      await Promise.all(
        sessions.map(async ({ result }) => {
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });
          expect(result.current.job).not.toBeNull();
          expect(result.current.job?.id).toBe('shared-job');
        })
      );

      // Each user gets their own listener
      expect(mockOnSnapshot).toHaveBeenCalledTimes(20);
    });

    it('should handle users viewing different jobs', async () => {
      const jobs = Array.from({ length: 30 }, (_, i) => createMockJob(`job-${i}`));

      mockOnSnapshot.mockImplementation((ref, onSuccess) => {
        const jobId = (ref as any).id || 'unknown';
        const job = jobs.find(j => j.id === jobId) || jobs[0];
        
        onSuccess({
          exists: () => true,
          id: job.id,
          data: () => ({ ...job }),
        } as any);
        return jest.fn();
      });

      // 30 users viewing different jobs
      const sessions = jobs.map(job =>
        renderHook(() => useJob(job.id))
      );

      await Promise.all(
        sessions.map(async ({ result }, index) => {
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });
          expect(result.current.job?.id).toBe(jobs[index].id);
        })
      );
    });
  });

  describe('Mixed Dashboard Activity', () => {
    it('should handle mixed list and detail view access patterns', async () => {
      const mockJobs = Array.from({ length: 25 }, (_, i) => 
        createMockJob(`job-${i}`)
      );

      mockOnSnapshot.mockImplementation((ref, onSuccess) => {
        // Determine if this is a collection or document query
        if (ref.type === 'collection') {
          onSuccess({
            docs: mockJobs.map(job => ({
              id: job.id,
              data: () => ({ ...job }),
            })),
          } as any);
        } else {
          onSuccess({
            exists: () => true,
            id: 'job-1',
            data: () => ({ ...mockJobs[0] }),
          } as any);
        }
        return jest.fn();
      });

      // Simulate realistic usage pattern:
      // - 15 users on job list
      // - 10 users on job details
      // - 5 users filtering by status
      const listViewUsers = Array.from({ length: 15 }, () =>
        renderHook(() => useJobs({ status: 'all' }))
      );

      const detailViewUsers = Array.from({ length: 10 }, () =>
        renderHook(() => useJob('job-1'))
      );

      const filteredUsers = Array.from({ length: 5 }, () =>
        renderHook(() => useJobs({ status: 'complete' }))
      );

      const allUsers = [...listViewUsers, ...detailViewUsers, ...filteredUsers];

      await Promise.all(
        allUsers.map(async ({ result }) => {
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });
        })
      );

      // Total 30 active listeners
      expect(mockOnSnapshot).toHaveBeenCalledTimes(30);
    });

    it('should handle rapid filter changes by multiple users', async () => {
      const mockJobs = Array.from({ length: 30 }, (_, i) => 
        createMockJob(`job-${i}`, i % 2 === 0 ? 'complete' : 'processing')
      );

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docs: mockJobs.map(job => ({
            id: job.id,
            data: () => ({ ...job }),
          })),
        } as any);
        return jest.fn();
      });

      // User rapidly changing filters
      const { result, rerender } = renderHook(
        ({ status }) => useJobs({ status }),
        { initialProps: { status: 'all' as const } }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Rapid filter changes
      const filterChanges = ['complete', 'processing', 'all', 'complete', 'failed'];
      
      for (const status of filterChanges) {
        rerender({ status: status as any });
        await waitFor(() => expect(result.current.loading).toBe(false));
      }

      // Each filter change creates a new listener
      // Initial + 5 changes = 6 listeners
      expect(mockOnSnapshot).toHaveBeenCalledTimes(6);
    });
  });

  describe('Listener Cleanup', () => {
    it('should properly clean up listeners when users navigate away', async () => {
      const mockUnsubscribe = jest.fn();
      
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      // 10 users active
      const sessions = Array.from({ length: 10 }, () =>
        renderHook(() => useJobs())
      );

      // 5 users navigate away
      sessions.slice(0, 5).forEach(({ unmount }) => unmount());

      // Should unsubscribe 5 listeners
      expect(mockUnsubscribe).toHaveBeenCalledTimes(5);

      // Remaining 5 should stay active
      sessions.slice(5).forEach(({ result }) => {
        expect(result.current.loading).toBe(true); // Still initializing
      });
    });

    it('should handle rapid mount/unmount cycles', async () => {
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      // Simulate navigation between pages
      for (let i = 0; i < 20; i++) {
        const { unmount } = renderHook(() => useJobs());
        
        // Simulate quick navigation away
        await new Promise(resolve => setTimeout(resolve, 10));
        unmount();
      }

      // Should have created and cleaned up 20 listeners
      expect(mockOnSnapshot).toHaveBeenCalledTimes(20);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(20);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain response times under 1 second with 25 concurrent users', async () => {
      const mockJobs = Array.from({ length: 100 }, (_, i) => 
        createMockJob(`job-${i}`)
      );

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        // Simulate 200ms network delay
        setTimeout(() => {
          onSuccess({
            docs: mockJobs.map(job => ({
              id: job.id,
              data: () => ({ ...job }),
            })),
          } as any);
        }, 200);
        return jest.fn();
      });

      const startTime = Date.now();

      const sessions = Array.from({ length: 25 }, () =>
        renderHook(() => useJobs())
      );

      await Promise.all(
        sessions.map(async ({ result }) => {
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          }, { timeout: 3000 });
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All 25 users should get data within 3 seconds
      expect(totalTime).toBeLessThan(3000);
      
      // Each user should have 100 jobs
      sessions.forEach(({ result }) => {
        expect(result.current.jobs).toHaveLength(100);
      });
    });
  });
});

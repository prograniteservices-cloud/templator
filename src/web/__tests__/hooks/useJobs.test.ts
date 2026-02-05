import { renderHook, waitFor } from '@testing-library/react'
import { useJobs } from '@/hooks/useJobs'
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore'
import type { Job, JobFilters } from '@/types/job'
import { Timestamp } from 'firebase/firestore'

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}))

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}))

const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>
const mockCollection = collection as jest.MockedFunction<typeof collection>
const mockQuery = query as jest.MockedFunction<typeof query>
const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>
const mockWhere = where as jest.MockedFunction<typeof where>

describe('useJobs Hook', () => {
  const mockJobsData: Job[] = [
    {
      id: 'job-1',
      customerName: 'Alice Smith',
      status: 'complete',
      createdAt: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
      updatedAt: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
      measurements: 120.5,
      confidence: 0.95,
      notes: 'Job 1 notes',
      blueprintData: null,
      videoFilePath: '/video1.mp4',
    },
    {
      id: 'job-2',
      customerName: 'Bob Johnson',
      status: 'processing',
      createdAt: { seconds: 1234567880, nanoseconds: 0 } as Timestamp,
      updatedAt: { seconds: 1234567880, nanoseconds: 0 } as Timestamp,
      measurements: null,
      confidence: null,
      notes: null,
      blueprintData: null,
      videoFilePath: '/video2.mp4',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockCollection.mockReturnValue({} as any)
    mockOrderBy.mockReturnValue({} as any)
    mockQuery.mockReturnValue({} as any)
  })

  it('should initialize with loading state', () => {
    mockOnSnapshot.mockImplementation(() => () => {})
    
    const { result } = renderHook(() => useJobs())
    
    expect(result.current.loading).toBe(true)
    expect(result.current.jobs).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should fetch and return all jobs successfully', async () => {
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        docs: mockJobsData.map(job => ({
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
      } as any)
      return jest.fn()
    })

    const { result } = renderHook(() => useJobs())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.jobs).toHaveLength(2)
    expect(result.current.jobs[0].customerName).toBe('Alice Smith')
    expect(result.current.jobs[1].customerName).toBe('Bob Johnson')
    expect(result.current.error).toBeNull()
  })

  it('should filter jobs by status', async () => {
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        docs: [{
          id: 'job-1',
          data: () => ({
            customerName: 'Alice Smith',
            status: 'complete',
            createdAt: { seconds: 1234567890, nanoseconds: 0 },
            updatedAt: { seconds: 1234567890, nanoseconds: 0 },
            measurements: 120.5,
            confidence: 0.95,
            notes: null,
            blueprintData: null,
            videoFilePath: '/video1.mp4',
          }),
        }],
      } as any)
      return jest.fn()
    })

    const filters: JobFilters = { status: 'complete' }
    const { result } = renderHook(() => useJobs(filters))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'complete')
    expect(result.current.jobs).toHaveLength(1)
    expect(result.current.jobs[0].status).toBe('complete')
  })

  it('should not apply status filter when status is "all"', async () => {
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        docs: mockJobsData.map(job => ({
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
      } as any)
      return jest.fn()
    })

    const filters: JobFilters = { status: 'all' }
    const { result } = renderHook(() => useJobs(filters))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockWhere).not.toHaveBeenCalled()
    expect(result.current.jobs).toHaveLength(2)
  })

  it('should order jobs by createdAt in descending order', async () => {
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        docs: mockJobsData.map(job => ({
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
      } as any)
      return jest.fn()
    })

    const { result } = renderHook(() => useJobs())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc')
  })

  it('should handle empty jobs list', async () => {
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        docs: [],
      } as any)
      return jest.fn()
    })

    const { result } = renderHook(() => useJobs())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.jobs).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should handle Firebase error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    mockOnSnapshot.mockImplementation((_, __, onError) => {
      onError(new Error('Permission denied'))
      return jest.fn()
    })

    const { result } = renderHook(() => useJobs())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.jobs).toEqual([])
    expect(result.current.error).toBe('Failed to load jobs')
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })

  it('should unsubscribe on unmount', () => {
    const mockUnsubscribe = jest.fn()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)

    const { unmount } = renderHook(() => useJobs())
    
    unmount()
    
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('should resubscribe when filters change', async () => {
    const mockUnsubscribe1 = jest.fn()
    const mockUnsubscribe2 = jest.fn()
    
    mockOnSnapshot
      .mockReturnValueOnce(mockUnsubscribe1)
      .mockReturnValueOnce(mockUnsubscribe2)

    const { rerender } = renderHook(
      ({ filters }) => useJobs(filters),
      { initialProps: { filters: { status: 'all' } as JobFilters } }
    )

    // Change the filter
    rerender({ filters: { status: 'processing' } })

    expect(mockUnsubscribe1).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'processing')
  })

  it('should handle all job statuses in filters', async () => {
    const statuses: Job['status'][] = ['capturing', 'processing', 'complete', 'failed']
    
    for (const status of statuses) {
      jest.clearAllMocks()
      
      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          docs: [{
            id: 'job-1',
            data: () => ({
              customerName: 'Test Customer',
              status,
              createdAt: { seconds: 1234567890, nanoseconds: 0 },
              updatedAt: { seconds: 1234567890, nanoseconds: 0 },
              measurements: null,
              confidence: null,
              notes: null,
              blueprintData: null,
              videoFilePath: null,
            }),
          }],
        } as any)
        return jest.fn()
      })

      const { result } = renderHook(() => useJobs({ status }))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockWhere).toHaveBeenCalledWith('status', '==', status)
    }
  })

  it('should handle jobs with all fields populated', async () => {
    const jobWithAllFields: Job = {
      id: 'job-full',
      customerName: 'Full Test Customer',
      status: 'complete',
      createdAt: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
      updatedAt: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
      measurements: 250.75,
      confidence: 0.98,
      notes: 'Detailed notes about the job',
      blueprintData: {
        edges: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 1,
      },
      videoFilePath: '/path/to/complete/video.mp4',
    }

    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        docs: [{
          id: jobWithAllFields.id,
          data: () => ({
            customerName: jobWithAllFields.customerName,
            status: jobWithAllFields.status,
            createdAt: jobWithAllFields.createdAt,
            updatedAt: jobWithAllFields.updatedAt,
            measurements: jobWithAllFields.measurements,
            confidence: jobWithAllFields.confidence,
            notes: jobWithAllFields.notes,
            blueprintData: jobWithAllFields.blueprintData,
            videoFilePath: jobWithAllFields.videoFilePath,
          }),
        }],
      } as any)
      return jest.fn()
    })

    const { result } = renderHook(() => useJobs())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.jobs[0]).toEqual(jobWithAllFields)
  })
})

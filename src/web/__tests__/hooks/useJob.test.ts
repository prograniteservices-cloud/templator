import { renderHook, waitFor } from '@testing-library/react'
import { useJob } from '@/hooks/useJob'
import { doc, onSnapshot } from 'firebase/firestore'
import type { Job } from '@/types/job'
import { Timestamp } from 'firebase/firestore'

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}))

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}))

const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>
const mockDoc = doc as jest.MockedFunction<typeof doc>

describe('useJob Hook', () => {
  const mockJobData: Job = {
    id: 'test-job-123',
    customerName: 'John Doe',
    status: 'complete',
    createdAt: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
    updatedAt: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
    measurements: 120.5,
    confidence: 0.95,
    notes: 'Test job notes',
    blueprintData: null,
    videoFilePath: '/path/to/video.mp4',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockDoc.mockReturnValue({} as any)
  })

  it('should initialize with loading state', () => {
    mockOnSnapshot.mockImplementation(() => () => {})
    
    const { result } = renderHook(() => useJob('test-job-123'))
    
    expect(result.current.loading).toBe(true)
    expect(result.current.job).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should return null job when id is empty', () => {
    const { result } = renderHook(() => useJob(''))
    
    expect(result.current.job).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('should fetch and return job data successfully', async () => {
    const mockUnsubscribe = jest.fn()
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        exists: () => true,
        id: 'test-job-123',
        data: () => ({
          customerName: 'John Doe',
          status: 'complete',
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
          measurements: 120.5,
          confidence: 0.95,
          notes: 'Test job notes',
          blueprintData: null,
          videoFilePath: '/path/to/video.mp4',
        }),
      } as any)
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useJob('test-job-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.job).toEqual(mockJobData)
    expect(result.current.error).toBeNull()
  })

  it('should handle job not found error', async () => {
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        exists: () => false,
        id: 'non-existent',
        data: () => null,
      } as any)
      return jest.fn()
    })

    const { result } = renderHook(() => useJob('non-existent'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.job).toBeNull()
    expect(result.current.error).toBe('Job not found')
  })

  it('should handle Firebase error', async () => {
    const mockError = new Error('Firebase connection failed')
    mockOnSnapshot.mockImplementation((_, __, onError) => {
      onError(mockError)
      return jest.fn()
    })

    const { result } = renderHook(() => useJob('test-job-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.job).toBeNull()
    expect(result.current.error).toBe('Firebase connection failed')
  })

  it('should unsubscribe on unmount', () => {
    const mockUnsubscribe = jest.fn()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)

    const { unmount } = renderHook(() => useJob('test-job-123'))
    
    unmount()
    
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('should resubscribe when id changes', async () => {
    const mockUnsubscribe1 = jest.fn()
    const mockUnsubscribe2 = jest.fn()
    
    mockOnSnapshot
      .mockReturnValueOnce(mockUnsubscribe1)
      .mockReturnValueOnce(mockUnsubscribe2)

    const { result, rerender } = renderHook(
      ({ id }) => useJob(id),
      { initialProps: { id: 'job-1' } }
    )

    // Change the job id
    rerender({ id: 'job-2' })

    expect(mockUnsubscribe1).toHaveBeenCalled()
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'jobs', 'job-2')
  })

  it('should handle job with all possible statuses', async () => {
    const statuses: Job['status'][] = ['capturing', 'processing', 'complete', 'failed']
    
    for (const status of statuses) {
      jest.clearAllMocks()
      const mockUnsubscribe = jest.fn()
      
      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          exists: () => true,
          id: 'test-job',
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
        } as any)
        return mockUnsubscribe
      })

      const { result } = renderHook(() => useJob('test-job'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.job?.status).toBe(status)
    }
  })

  it('should handle job with blueprint data', async () => {
    const blueprintData = {
      edges: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      dimensions: { width: 100, height: 0 },
      scale: 1,
    }

    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        exists: () => true,
        id: 'test-job',
        data: () => ({
          customerName: 'Test Customer',
          status: 'complete',
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
          measurements: 100,
          confidence: 0.9,
          notes: 'Test notes',
          blueprintData,
          videoFilePath: '/video.mp4',
        }),
      } as any)
      return jest.fn()
    })

    const { result } = renderHook(() => useJob('test-job'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.job?.blueprintData).toEqual(blueprintData)
  })
})

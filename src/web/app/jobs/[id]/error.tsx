"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#F5F5F0] mb-2">Something went wrong</h1>
        <p className="text-[#F5F5F0]/70 mb-6">
          {error.message || 'An unexpected error occurred while loading this job.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button 
            onClick={reset}
            className="bg-[#FF5722] hover:bg-[#FF5722]/90 text-white rounded-none"
          >
            Try Again
          </Button>
          <Link href="/">
            <Button 
              variant="outline" 
              className="border-[#F5F5F0]/20 text-[#F5F5F0] hover:bg-[#F5F5F0]/10 rounded-none"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

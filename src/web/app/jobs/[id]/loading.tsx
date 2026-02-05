import { RefreshCw } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-[#FF5722] animate-spin mx-auto mb-4" />
        <p className="text-[#F5F5F0]/70 font-mono text-sm tracking-wider">LOADING JOB DATA...</p>
      </div>
    </div>
  );
}

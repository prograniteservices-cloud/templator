"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useJobs } from "@/hooks/useJobs";
import { JobStatus, JobFilters } from "@/types/job";
import { Ruler, Plus, Search, Filter, Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

function formatDate(timestamp: any) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timestamp: any) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
      };
    case 'processing':
      return {
        color: '#F59E0B',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        icon: RefreshCw,
        label: 'Processing',
      };
    case 'complete':
      return {
        color: '#10B981',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        icon: CheckCircle,
        label: 'Complete',
      };
    case 'failed':
      return {
        color: '#EF4444',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: AlertCircle,
        label: 'Failed',
      };
    default:
      return {
        color: '#6B7280',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/30',
        icon: Clock,
        label: status,
      };
  }
}

const filters: Array<{ label: string; value: JobStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Capturing', value: 'capturing' },
  { label: 'Processing', value: 'processing' },
  { label: 'Complete', value: 'complete' },
  { label: 'Failed', value: 'failed' },
];

export default function DashboardPage() {
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { jobs, loading, error } = useJobs({ status: filter });

  const getStatusCount = (status: JobStatus | 'all') => {
    if (status === 'all') return jobs.length;
    return jobs.filter(job => job.status === status).length;
  };

  const filteredJobs = jobs.filter(job => 
    searchQuery === '' || 
    job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Header */}
      <header className="border-b border-[#F5F5F0]/10 bg-[#121212]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FF5722] flex items-center justify-center">
                  <Ruler className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-[#F5F5F0] tracking-tight">
                    TEMPLETOR V5
                  </h1>
                  <p className="text-[10px] text-[#F5F5F0]/50 font-mono tracking-wider">
                    ADMIN DASHBOARD
                  </p>
                </div>
              </div>
            </div>
            <nav className="flex items-center gap-2">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium text-[#F5F5F0] bg-[#FF5722]/10 border border-[#FF5722]/30 hover:bg-[#FF5722]/20 transition-colors"
              >
                Jobs
              </Link>
              <button
                className="px-4 py-2 text-sm font-medium text-[#F5F5F0]/70 hover:text-[#F5F5F0] hover:bg-[#F5F5F0]/10 transition-colors"
              >
                Settings
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#F5F5F0] tracking-tight">
              JOB DASHBOARD
            </h2>
            <p className="mt-1 text-sm text-[#F5F5F0]/50">
              Review and manage countertop measurement jobs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F5F0]/50" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#F5F5F0]/10 text-[#F5F5F0] text-sm placeholder:text-[#F5F5F0]/30 focus:border-[#FF5722] focus:outline-none w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#F5F5F0]/10 text-[#F5F5F0]/70 hover:text-[#F5F5F0] hover:bg-[#F5F5F0]/10 transition-colors text-sm">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5 mb-8">
          {filters.map(({ label, value }) => {
            const count = getStatusCount(value);
            const isActive = filter === value;
            
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`p-4 border text-left transition-colors ${
                  isActive 
                    ? 'border-[#FF5722] bg-[#FF5722]/10' 
                    : 'border-[#F5F5F0]/10 bg-[#1a1a1a] hover:border-[#F5F5F0]/20'
                }`}
              >
                <p className={`text-xs font-medium uppercase tracking-wider ${
                  isActive ? 'text-[#FF5722]' : 'text-[#F5F5F0]/50'
                }`}>
                  {label}
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  isActive ? 'text-[#FF5722]' : 'text-[#F5F5F0]'
                }`}>
                  {count}
                </p>
              </button>
            );
          })}
        </div>

        {/* Jobs Table */}
        <div className="border border-[#F5F5F0]/10 bg-[#1a1a1a]">
          <div className="border-b border-[#F5F5F0]/10 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase">
                Recent Jobs
              </h3>
              <span className="text-xs text-[#F5F5F0]/50 font-mono">
                {filteredJobs.length} jobs found
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F5F5F0]/10">
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Measurements
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#F5F5F0]/50 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F0]/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-[#F5F5F0]/50">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-mono">LOADING JOBS...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-red-500">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm">{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#F5F5F0]/50">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#F5F5F0]/10 flex items-center justify-center">
                          <Search className="w-6 h-6 text-[#F5F5F0]/30" />
                        </div>
                        <p className="text-sm">No jobs found</p>
                        <p className="text-xs text-[#F5F5F0]/30">
                          Jobs will appear here once they are created from the mobile app
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const statusConfig = getStatusConfig(job.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <tr 
                        key={job.id} 
                        className="hover:bg-[#F5F5F0]/5 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-[#F5F5F0]/70">
                            {job.id.slice(-8).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-[#F5F5F0]">
                            {job.customerName}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-[#F5F5F0]/70">
                            {formatDate(job.createdAt)}
                          </div>
                          <div className="text-xs text-[#F5F5F0]/40 font-mono">
                            {formatTime(job.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 border ${statusConfig.borderColor} ${statusConfig.bgColor}`}>
                            <StatusIcon className="w-4 h-4" style={{ color: statusConfig.color }} />
                            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: statusConfig.color }}>
                              {statusConfig.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {job.measurements ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-[#F5F5F0]">
                                {job.measurements.toFixed(2)}
                              </span>
                              <span className="text-xs text-[#F5F5F0]/40">sq ft</span>
                            </div>
                          ) : (
                            <span className="text-sm text-[#F5F5F0]/30">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#F5F5F0] border border-[#F5F5F0]/20 hover:border-[#FF5722] hover:text-[#FF5722] transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="border border-[#F5F5F0]/10 bg-[#1a1a1a] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase mb-2">
                  Mobile App
                </h3>
                <p className="text-xs text-[#F5F5F0]/50 mb-4">
                  Create new measurements using the mobile capture app
                </p>
              </div>
              <div className="w-10 h-10 bg-[#FF5722]/10 flex items-center justify-center">
                <Plus className="w-5 h-5 text-[#FF5722]" />
              </div>
            </div>
            <button className="w-full py-2 text-sm text-[#F5F5F0]/70 border border-[#F5F5F0]/10 hover:border-[#FF5722]/50 hover:text-[#F5F5F0] transition-colors">
              Launch App
            </button>
          </div>

          <div className="border border-[#F5F5F0]/10 bg-[#1a1a1a] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase mb-2">
                  Documentation
                </h3>
                <p className="text-xs text-[#F5F5F0]/50 mb-4">
                  View guides and best practices for measurements
                </p>
              </div>
              <div className="w-10 h-10 bg-[#F5F5F0]/10 flex items-center justify-center">
                <Ruler className="w-5 h-5 text-[#F5F5F0]/70" />
              </div>
            </div>
            <button className="w-full py-2 text-sm text-[#F5F5F0]/70 border border-[#F5F5F0]/10 hover:border-[#F5F5F0]/30 hover:text-[#F5F5F0] transition-colors">
              View Docs
            </button>
          </div>

          <div className="border border-[#F5F5F0]/10 bg-[#1a1a1a] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F5F5F0] tracking-wider uppercase mb-2">
                  System Status
                </h3>
                <p className="text-xs text-[#F5F5F0]/50 mb-4">
                  All systems operational. Last sync: Just now
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#F5F5F0]/10 bg-[#121212] mt-12">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#F5F5F0]/30 font-mono">
              TEMPLATE V5 ADMIN DASHBOARD
            </p>
            <p className="text-xs text-[#F5F5F0]/30">
              Version 1.0.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

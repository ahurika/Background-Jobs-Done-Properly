'use client';
import { useEffect, useState } from 'react';

export default function DeadLetterQueue() {
  const [deadJobs, setDeadJobs] = useState<any[]>([]);

  const fetchDeadJobs = async () => {
    const res = await fetch('/api/jobs/dead');
    const data = await res.json();
    setDeadJobs(data.jobs || []);
  };

  const handleRetry = async (id: string) => {
    await fetch(`/api/jobs/${id}/retry`, { method: 'POST' });
    fetchDeadJobs();
  };

  useEffect(() => {
    fetchDeadJobs();
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2em', fontWeight: 800, marginBottom: '20px', color: '#ef4444' }}>Dead Letter Queue</h1>
      
      <nav style={{ marginBottom: '30px' }}>
        <a href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>
          &larr; Back to Enqueue
        </a>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {deadJobs.length === 0 ? (
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center', color: '#6b7280' }}>
            No dead jobs currently.
          </div>
        ) : (
          deadJobs.map(job => (
            <div key={job.id} style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '20px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1em', fontFamily: 'monospace' }}>{job.id}</h3>
                <button 
                  onClick={() => handleRetry(job.id)}
                  style={{ padding: '6px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Retry Job
                </button>
              </div>
              <div style={{ fontSize: '0.9em', color: '#1f2937' }}>
                <p style={{ margin: '4px 0' }}><strong>Error:</strong> <span style={{ color: '#b91c1c' }}>{job.lastError}</span></p>
                <p style={{ margin: '4px 0' }}><strong>Attempts:</strong> {job.attempts}</p>
                <p style={{ margin: '4px 0', wordBreak: 'break-all' }}><strong>Payload:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>{job.payload}</code></p>
                <p style={{ margin: '4px 0' }}><strong>Died At:</strong> {new Date(job.finishedAt).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

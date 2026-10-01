'use client';
import { useState } from 'react';

export default function Home() {
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState<any>(null);
  
  const handleEnqueue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      to: formData.get('to'),
      subject: formData.get('subject'),
      body: formData.get('body'),
    };
    const reqBody = {
      userId: 'user-' + Date.now(),
      type: 'SEND_EMAIL',
      payload,
      idempotencyKey: formData.get('idempotencyKey'),
    };

    const res = await fetch('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(reqBody),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    setJobId(data.id);
    pollStatus(data.id);
  };

  const pollStatus = async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`);
    const data = await res.json();
    setStatus(data);
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2em', fontWeight: 800, marginBottom: '20px' }}>Mailroom Jobs</h1>
      
      <nav style={{ marginBottom: '30px' }}>
        <a href="/dead" style={{ color: '#ef4444', textDecoration: 'none', fontWeight: 'bold' }}>
          View Dead Letter Queue &rarr;
        </a>
      </nav>

      <section style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '24px', borderRadius: '8px', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.2em', marginBottom: '16px' }}>Enqueue New Email Job</h2>
        <form onSubmit={handleEnqueue} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input name="to" placeholder="Recipient (use fail@example.com for 100% failure test)" defaultValue="test@example.com" required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <input name="subject" placeholder="Subject" defaultValue="Background Job Test" required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <textarea name="body" placeholder="Body" defaultValue="This email was processed by a background worker." required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px' }} />
          <input name="idempotencyKey" placeholder="Idempotency Key" defaultValue={`email-demo-${Date.now()}`} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <button type="submit" style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Submit Job
          </button>
        </form>
      </section>

      {jobId && (
        <section style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '24px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2em', margin: 0 }}>Job Status</h2>
            <button onClick={() => pollStatus(jobId)} style={{ padding: '6px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Refresh Status
            </button>
          </div>
          <pre style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.9em' }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

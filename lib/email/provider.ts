const seenKeys = new Set<string>();

export async function sendEmail(payload: any) {
  console.log(`[EmailProvider] Sending email to ${payload.to} (Idempotency Key: ${payload.idempotencyKey})`);

  if (payload.idempotencyKey && seenKeys.has(payload.idempotencyKey)) {
    console.log(`[EmailProvider] Idempotency key recognized. Dropping duplicate transmission.`);
    return { success: true, messageId: 'msg-deduped', duplicate: true };
  }
  
  // Simulate network latency (200-500ms)
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  
  // Simulate explicit failure for the 100% failure break-it test
  if (payload.to === 'fail@example.com') {
    throw new Error('Simulated email provider rejection');
  }
  
  // Record successful work so repeated calls with the same idempotency key
  // are treated as duplicate transmissions by this mock provider.
  // A real external provider would be responsible for durable server-side
  // idempotency across worker/process restarts.
  if (payload.idempotencyKey) {
    seenKeys.add(payload.idempotencyKey);
  }

  console.log(`[EmailProvider] Successfully delivered to ${payload.to}`);
  return { success: true, messageId: 'msg-' + Date.now() };
}

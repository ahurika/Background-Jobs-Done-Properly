export async function sendEmail(payload: any) {
  console.log(`[EmailProvider] Sending email to ${payload.to} (Idempotency Key: ${payload.idempotencyKey})`);
  
  // Simulate network latency (200-500ms)
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  
  // Simulate explicit failure for the 100% failure break-it test
  if (payload.to === 'fail@example.com') {
    throw new Error('Simulated email provider rejection');
  }
  
  // The idempotency key ensures that if this work succeeded but the worker crashed 
  // before updating the DB, the provider won't send the email twice when retried.
  console.log(`[EmailProvider] Successfully delivered to ${payload.to}`);
  return { success: true, messageId: 'msg-' + Date.now() };
}

import { gradeSubmission, legacyPayload, SubmissionError } from './grading.mjs';
const legacyEndpoint = 'https://script.google.com/macros/s/AKfycbzyImNuPcy9wUTkx3XuKtw-jH4tjrokhIWcQD4aYqrXBSoRR-WIqgqtsyixmE03jFFktw/exec';
const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');

// Auth is intentionally public: academy courses remain accessible without membership.
// Only this server uses the service key. Database ingestion is never granted to anon/member roles.
export function createHandler({ admin, salt, fetcher = fetch }) {
  return async request => {
    const origin = request.headers.get('origin');
    const allowed = origin === 'https://muhamid9397827.github.io';
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed) return reply({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
    try {
      if (!salt) return reply({ error: 'خادم النتائج غير مهيأ.' }, 503);
      // Bound streamed bodies too; Content-Length alone is not a reliable limit.
      const reader = request.body?.getReader();
      if (!reader) throw new SubmissionError('بيانات المحاولة مفقودة.');
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); throw new SubmissionError('حجم الطلب أكبر من المسموح.', 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
      let payload;
      try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SubmissionError('صيغة الطلب غير صحيحة.'); }
      // Only the privileged Edge Function fetches marking keys; never return them.
      const {data:privateCatalog,error:keyError}=await admin.rpc('asf_private_academy_catalog');
      if(keyError||!privateCatalog||!Object.keys(privateCatalog).length)return reply({error:'خادم التصحيح غير متاح مؤقتاً؛ احتفظ بالمحاولة وأعد الحفظ.'},503);
      const result = gradeSubmission(payload,privateCatalog);
      const payloadHash = await hash(JSON.stringify(result));
      // Supabase's gateway supplies X-Forwarded-For; raw addresses are never stored.
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('cf-connecting-ip') || 'unknown';
      const clientHash = await hash(salt + ':' + ip);
      const { data: saved, error } = await admin.rpc('asf_store_academy_result', { p_result: result, p_payload_hash: payloadHash, p_client_hash: clientHash });
      if (error) {
        const message = error.message || '';
        if (message.includes('retake_wait')) return reply({ error: 'يمكن إعادة الاختبار بعد مرور 24 ساعة على آخر محاولة محفوظة.' }, 409);
        if (message.includes('rate_limit')) return reply({ error: 'طلبات كثيرة؛ حاول لاحقًا.' }, 429);
        if (message.includes('session_conflict')) return reply({ error: 'المحاولة محفوظة بإجابات مختلفة. تواصل مع الإدارة.' }, 409);
        return reply({ error: 'تعذر حفظ النتيجة؛ احتفظ بنسختك وأعد المحاولة.' }, 503);
      }
      if (!saved?.receipt || !saved?.received_at) return reply({ error: 'لم يؤكد الخادم حفظ النتيجة.' }, 503);
      let legacyStatus = saved.legacy_status;
      // Never blindly repeat an ambiguous legacy POST: that could duplicate rows.
      if (saved.inserted) {
        legacyStatus = 'unconfirmed';
        try {
          const response = await fetcher(legacyEndpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(legacyPayload(result, saved.receipt)), signal: AbortSignal.timeout(10000) });
          const text = (await response.text()).slice(0, 4096);
          let ack; try { ack = JSON.parse(text); } catch { /* An HTML/opaque success never confirms a Sheet write. */ }
          if (response.ok && (ack?.success === true || ack?.status === 'success') && ack.receipt === saved.receipt) legacyStatus = 'confirmed';
          else if (!response.ok) legacyStatus = 'failed';
        } catch { legacyStatus = 'unconfirmed'; }
        const { error: syncError } = await admin.rpc('asf_mark_academy_legacy_sync', { p_session: result.sessionId, p_status: legacyStatus });
        if (syncError) legacyStatus = 'pending';
      }
      return reply({ saved: true, receipt: saved.receipt, receivedAt: saved.received_at, legacyStatus,
        result: { score: result.score, total: result.total, percentage: result.percentage, passed: result.passed,
          passingPercentage: result.passingPercentage, assignedRank: result.assignedRank } });
    } catch (error) {
      return reply({ error: error instanceof SubmissionError ? error.message : 'تعذر معالجة المحاولة؛ أعد المحاولة لاحقًا.' }, error instanceof SubmissionError ? error.status : 500);
    }
  };
}

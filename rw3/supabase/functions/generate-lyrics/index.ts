import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!openaiKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Lyrics service is not configured. Add OPENAI_API_KEY and deploy the function again.' }, 500);
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Please sign in as an admin.' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = auth.slice(7);
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'Your admin session is invalid or expired. Please sign in again.' }, 401);

  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return json({ error: 'Access denied. Only admins can generate lyrics.' }, 403);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: 'Invalid multipart upload.' }, 400); }
  const audio = form.get('audio');
  const title = String(form.get('title') || '').trim();
  const artist = String(form.get('artist') || '').trim();
  if (!(audio instanceof File)) return json({ error: 'Choose an audio file first.' }, 400);
  if (audio.size > 25 * 1024 * 1024) return json({ error: 'Audio file is too large. Please use a file under 25 MB.' }, 413);
  if (!audio.type.startsWith('audio/')) return json({ error: 'Please select a valid audio file.' }, 400);

  try {
    const fd = new FormData();
    fd.append('file', audio, audio.name || 'audio.mp3');
    fd.append('model', 'whisper-1');
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'segment');
    fd.append('temperature', '0');
    fd.append('prompt', 'Transcribe song vocals accurately. Preserve Hindi words and English words. Do not invent missing words. Prefer Roman/Latin-script Hindi (Hinglish) when Hindi is sung, while keeping English words in English.');

    const tr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: fd,
    });
    const trText = await tr.text();
    if (!tr.ok) {
      let detail = trText;
      try { detail = JSON.parse(trText)?.error?.message || detail; } catch {}
      return json({ error: `Transcription failed: ${detail}` }, tr.status >= 500 ? 502 : tr.status);
    }
    const transcript = JSON.parse(trText);
    const segments = Array.isArray(transcript.segments) ? transcript.segments : [];
    if (!segments.length) return json({ error: 'No sung words were detected in this audio.' }, 422);

    // Keep timestamps from transcription and only normalize the text. This is much faster and avoids asking an LLM to invent timings.
    const input = segments.map((s: any, i: number) => ({ i, time: Number(s.start) || 0, text: String(s.text || '').trim() })).filter((s: any) => s.text);

    const prompt = `You are cleaning song-transcription lines for a music player.\nSong: ${title || 'Unknown'}\nArtist: ${artist || 'Unknown'}\n\nReturn ONLY valid JSON: {"lines":[{"i":0,"text":"..."}]}\nRules:\n- Keep the meaning and wording of the sung words; do not add verses, hooks, or words that are not present.\n- Output only English or Hinglish/Roman Hindi (Latin alphabet). If a Hindi phrase is written in Devanagari, transliterate it to natural Roman Hindi.\n- Keep English words as English.\n- Do not translate English into Hindi.\n- Do not censor or paraphrase.\n- Preserve every input line index exactly once.\n- Keep each line short enough for a music player.\nInput lines:\n${JSON.stringify(input)}`;

    const rr = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-luna', input: prompt, max_output_tokens: 4000 }),
    });
    const rrText = await rr.text();
    if (!rr.ok) {
      let detail = rrText;
      try { detail = JSON.parse(rrText)?.error?.message || detail; } catch {}
      // If normalization fails, return the timestamped transcription instead of failing the whole operation.
      return json({ lyrics: input.map((x: any) => ({ time: x.time, text: x.text })), warning: `Transcription succeeded, but language cleanup failed: ${detail}` });
    }
    const response = JSON.parse(rrText);
    const outputText = response.output_text || response.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === 'output_text')?.text || '';
    let cleaned: any = null;
    try { cleaned = JSON.parse(outputText); } catch {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (match) { try { cleaned = JSON.parse(match[0]); } catch {} }
    }

    const cleanMap = new Map<number, string>((cleaned?.lines || []).map((x: any) => [Number(x.i), String(x.text || '').trim()]));
    const lyrics = input.map((x: any) => ({ time: x.time, text: cleanMap.get(x.i) || x.text })).filter((x: any) => x.text);
    return json({ lyrics, language: 'English/Hinglish', duration: Number(transcript.duration) || null });
  } catch (err) {
    console.error(err);
    return json({ error: `Lyrics generation failed: ${err instanceof Error ? err.message : 'Unexpected server error.'}` }, 500);
  }
});

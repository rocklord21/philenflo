'use strict';

// Subjects/phrases that indicate an automated message — skip Claude entirely
const AUTO_REPLY_SUBJECT_PATTERNS = [
  /^auto(matic(al)?ly)?[\s:]/i,
  /^out[ -]of[ -]office/i,
  /^abwesenheitsnotiz/i,        // German
  /^automatische antwort/i,     // German
  /^automatisch antwoord/i,     // Dutch
  /^réponse automatique/i,      // French
  /^respuesta automática/i,     // Spanish
  /^risposta automatica/i,      // Italian
  /^automatiskt svar/i,         // Swedish
  /^fraværsassistent/i,         // Danish/Norwegian
];

const AUTO_REPLY_BODY_PATTERNS = [
  /this is an auto(mated)? (reply|response|message)/i,
  /i (am|will be) out of( the)? office/i,
  /ich bin (derzeit )?nicht (im büro|erreichbar)/i,  // German
  /ik ben (momenteel )?niet op (kantoor|mijn werk)/i, // Dutch
  /je suis (actuellement )?absent/i,                  // French
];

// Markers that indicate the start of a quoted/forwarded thread
const THREAD_STRIP_PATTERNS = [
  /^on .{5,80} wrote:/im,
  /^-----+\s*original message\s*-----+/im,
  /^von:.*\n/im,          // German "From:"
  /^van:.*\n/im,          // Dutch "From:"
  /^de:.*\n/im,           // French/Spanish "From:"
  /^da:.*\n/im,           // Italian "From:"
];

/**
 * Detects whether an email is an automated out-of-office / auto-reply.
 * Checks subject first (cheaper), then body.
 *
 * @param {string} subject
 * @param {string} body
 * @returns {boolean}
 */
function isAutoReply(subject, body) {
  const subj = (subject || '').trim();
  if (AUTO_REPLY_SUBJECT_PATTERNS.some((re) => re.test(subj))) return true;
  const text = (body || '').slice(0, 500); // only check the top of the body
  return AUTO_REPLY_BODY_PATTERNS.some((re) => re.test(text));
}

/**
 * Strips quoted thread content from an email body, leaving only the newest reply.
 *
 * @param {string} text
 * @returns {string}
 */
function stripQuotedThread(text) {
  if (!text) return '';
  let stripped = text;
  for (const pattern of THREAD_STRIP_PATTERNS) {
    const match = stripped.search(pattern);
    if (match !== -1) {
      stripped = stripped.slice(0, match);
    }
  }
  // Also strip lines that start with ">" (standard quoted-reply marker)
  stripped = stripped
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n')
    .trim();
  return stripped;
}

/**
 * Validates and normalises the incoming webhook request body.
 * Returns { ok: true, data } or { ok: false, status, error }.
 *
 * @param {object} body - Raw request body from Express
 * @returns {{ ok: boolean, data?: object, status?: number, error?: string }}
 */
function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Request body must be a JSON object' };
  }

  const { reply_text, sender_email } = body;

  if (!sender_email || typeof sender_email !== 'string') {
    return { ok: false, status: 400, error: 'Missing required field: sender_email' };
  }

  if (!reply_text || typeof reply_text !== 'string') {
    return { ok: false, status: 400, error: 'Missing required field: reply_text' };
  }

  const subject = (body.reply_subject || '').trim();
  const strippedReply = stripQuotedThread(reply_text);

  // Auto-reply detection — skip Claude, return immediately
  if (isAutoReply(subject, reply_text)) {
    return {
      ok: true,
      autoReply: true,
      data: {
        intent: 'out_of_office',
        language: 'en',
        language_name: 'English',
        confidence: 1.0,
        intent_signals: ['auto-reply detected from subject or body patterns'],
        response_text: '',
        should_auto_send: false,
        metadata: { auto_detected: true, skipped_claude: true },
      },
    };
  }

  if (strippedReply.length < 5) {
    return { ok: false, status: 400, error: 'reply_too_short: reply text is empty after stripping quoted thread' };
  }

  return {
    ok: true,
    autoReply: false,
    data: {
      replyText: strippedReply,
      replySubject: subject,
      senderEmail: sender_email,
      senderName: body.sender_name || '',
      campaignName: body.campaign_name || '',
      originalEmail: body.original_email_text || '',
      leadContext: body.lead_context || {},
    },
  };
}

module.exports = { validateRequest, stripQuotedThread, isAutoReply };

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, buildUserMessage } = require('./prompts');

const MODEL = 'claude-sonnet-4-6';
const TIMEOUT_MS = 25_000;

const VALID_INTENTS = new Set([
  'interested',
  'booked_a_call',
  'not_interested',
  'soft_objection',
  'neutral',
  'out_of_office',
  'referral',
]);

let _client = null;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Attempts to extract a JSON object from a string that may have extra text around it.
 *
 * @param {string} text
 * @returns {object|null}
 */
function extractJson(text) {
  // Happy path: the whole string is valid JSON
  try {
    return JSON.parse(text);
  } catch (_) {
    // fall through
  }
  // Fallback: extract the first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Validates and normalises the JSON returned by Claude.
 * If required fields are missing or invalid, fills in safe defaults.
 *
 * @param {object} parsed
 * @returns {object}
 */
function normaliseResponse(parsed) {
  const intent = VALID_INTENTS.has(parsed.intent) ? parsed.intent : 'neutral';
  const noReplyIntents = new Set(['out_of_office', 'neutral', 'referral']);
  return {
    intent,
    language: typeof parsed.language === 'string' ? parsed.language : 'en',
    language_name: typeof parsed.language_name === 'string' ? parsed.language_name : 'English',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    intent_signals: Array.isArray(parsed.intent_signals) ? parsed.intent_signals : [],
    response_text: typeof parsed.response_text === 'string' ? parsed.response_text : '',
    should_auto_send:
      typeof parsed.should_auto_send === 'boolean'
        ? parsed.should_auto_send
        : !noReplyIntents.has(intent),
  };
}

/**
 * Calls Claude to analyze an email reply and generate a multilingual response.
 *
 * @param {object} params - Validated request data from validate.js
 * @returns {Promise<object>} - Structured analysis result
 */
async function analyzeReply(params) {
  const startMs = Date.now();

  const userMessage = buildUserMessage({
    replyText: params.replyText,
    replySubject: params.replySubject,
    senderName: params.senderName,
    campaignName: params.campaignName,
    originalEmail: params.originalEmail,
    leadContext: params.leadContext,
    companyBlurb: process.env.COMPANY_BLURB,
    senderSignature: [process.env.SENDER_NAME, process.env.SENDER_TITLE]
      .filter(Boolean)
      .join(', '),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let rawContent;
  try {
    const message = await getClient().messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal }
    );
    rawContent = message.content[0]?.text ?? '';
  } finally {
    clearTimeout(timeoutId);
  }

  const parsed = extractJson(rawContent);

  if (!parsed) {
    // Claude returned something unparseable — return a safe fallback so Zapier
    // always gets a valid JSON response and can route to human review.
    return {
      intent: 'neutral',
      language: 'en',
      language_name: 'English',
      confidence: 0.1,
      intent_signals: [],
      response_text: '',
      should_auto_send: false,
      metadata: {
        error: 'parse_failure',
        model: MODEL,
        processing_time_ms: Date.now() - startMs,
      },
    };
  }

  const result = normaliseResponse(parsed);
  result.metadata = {
    model: MODEL,
    processing_time_ms: Date.now() - startMs,
  };
  return result;
}

module.exports = { analyzeReply };

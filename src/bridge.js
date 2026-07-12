// This file is injected into the page context via a <script> tag.
// It must NOT use optional chaining (?.) because TypeScript's template literal
// parser can't handle it inside string interpolation.

(function() {
  'use strict';

  window.__fillwrightNanoReady = false;
  window.__fillwrightNanoResult = null;
  window.__fillwrightNanoCallbacks = {};

  var LM = window.LanguageModel;
  if (!LM && window.ai) {
    LM = window.ai.languageModel || (window.ai.originTrial && window.ai.originTrial.languageModel);
  }
  console.log('[Fillwright BRIDGE] LanguageModel:', typeof LM);

  if (LM) {
    window.__fillwrightNanoReady = true;

    window.__fillwrightNanoCheck = async function() {
      try {
        if (typeof LM.availability === 'function') {
          return await LM.availability();
        }
        return 'available';
      } catch(e) {
        return 'unavailable';
      }
    };

    window.__fillwrightNanoRun = async function(schemaJson, profileJson) {
      var status = 'available';
      if (typeof LM.availability === 'function') {
        status = await LM.availability();
      }
      if (status !== 'available') {
        return { ok: false, error: 'Model status: ' + status };
      }

      var session;
      if (typeof LM.create === 'function') {
        session = await LM.create({
          systemPrompt: 'You are a form-filling assistant. You map profile data to form fields.\n\nRules:\n1. Return ONLY a JSON array of fill steps. No prose, no markdown fences.\n2. Each step: { "tool": "fill_field"|"select_option"|"toggle", "field_id": "...", "value": "...", "confidence": 0.0-1.0 }\n3. For select_option, match by visible label or value.\n4. For toggle, use "true" or "false" as value.\n5. Split full name into given/family as needed.\n6. Normalize dates to each field\'s pattern.\n7. Normalize country names to match select options.\n8. If confidence < 0.5, omit from the plan.\n9. Do not guess. Leave empty rather than guess.\n10. Do not include fields not present in the schema.',
          outputLanguage: 'en'
        });
      } else {
        return { ok: false, error: 'No create method available' };
      }

      var prompt = 'Given this form schema:\n' + schemaJson + '\n\nAnd this user profile:\n' + profileJson + '\n\nMap profile data to form fields. Return a JSON array of fill steps.';
      console.log('[Fillwright BRIDGE] Prompting Gemini Nano...');
      var raw = await session.prompt(prompt);
      if (typeof session.destroy === 'function') session.destroy();
      console.log('[Fillwright BRIDGE] Raw:', raw);

      var cleaned = raw.trim();
      // Strip markdown code fences if present
      var fence = '```';
      if (cleaned.indexOf(fence) === 0) {
        cleaned = cleaned.slice(3);
        if (cleaned.indexOf('json') === 0) cleaned = cleaned.slice(4);
      }
      if (cleaned.length > 3 && cleaned.slice(-3) === fence) {
        cleaned = cleaned.slice(0, -3);
      }

      var parsed = JSON.parse(cleaned.trim());
      if (!Array.isArray(parsed)) return { ok: false, error: 'Not an array' };

      var VALID = { fill_field: 1, select_option: 1, toggle: 1 };
      var valid = parsed.filter(function(s) {
        return VALID[s.tool] && typeof s.field_id === 'string' && typeof s.value === 'string' && typeof s.confidence === 'number';
      });

      return { ok: true, plan: valid, source: 'nano' };
    };

    console.log('[Fillwright BRIDGE] Ready');
  } else {
    console.log('[Fillwright BRIDGE] LanguageModel not found');
    window.__fillwrightNanoCheck = async function() { return 'unavailable'; };
    window.__fillwrightNanoRun = async function() { return { ok: false, error: 'LanguageModel not available' }; };
  }
})();

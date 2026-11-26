import { leadClickRequestSchema, type LeadClickRequest } from '@pusatk3/shared';

// Lead helpers of the web app (#28, ADR 0022), pure so they can be tested without the runtime.
// The API does every check again (rule 1); these only shape what the browser sent.

/** A beacon is a few bytes; anything bigger is not ours. */
export const CLICK_BODY_MAX_BYTES = 1024;

/** Body of a WhatsApp click beacon → API body, or null when it is not a valid click. */
export function parseClickBeacon(text: string): LeadClickRequest | null {
  if (text.length > CLICK_BODY_MAX_BYTES) return null;
  try {
    const parsed = leadClickRequestSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Question form fields as posted by the browser (FormData) → API body (validated by the API). */
export function questionFromForm(form: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  return {
    scheduleId: text('scheduleId'),
    name: text('name'),
    phone: text('phone'),
    email: text('email'),
    message: text('message'),
    // An unticked checkbox is absent: the API then refuses the lead (consent is mandatory).
    consent: form.get('consent') === 'on',
    turnstileToken: text('cf-turnstile-response'),
  };
}

export type QuestionOutcome = 'sent' | 'invalid' | 'blocked' | 'unavailable' | 'busy' | 'gone';

/** API status of a question → what the visitor is told. */
export function questionOutcome(status: number): QuestionOutcome {
  if (status === 201) return 'sent';
  if (status === 422 || status === 400 || status === 413 || status === 415) return 'invalid';
  if (status === 403) return 'blocked';
  if (status === 404) return 'gone';
  if (status === 429) return 'busy';
  return 'unavailable';
}

import { describe, it, expect } from 'vitest';
import { EaseRuleSchema, FitRulesetSchema, firstIssueMessage, ruleIssueMessage } from './rule-schema';
import { t } from '@/lib/i18n/strings';

const VALID = { tightBelow: -1, goodFrom: 1, goodTo: 5 };

describe('ruleIssueMessage', () => {
  it('maps the goodFrom refine key to its string, in either language', () => {
    const err = EaseRuleSchema.safeParse({ tightBelow: 0, goodFrom: -1, goodTo: 5 }).error!;
    expect(ruleIssueMessage(err, 'en')).toBe(t.fitRuleOrderGoodFrom.en);
    expect(ruleIssueMessage(err, 'th')).toBe(t.fitRuleOrderGoodFrom.th);
  });

  it('maps the goodTo refine key to its string', () => {
    const err = EaseRuleSchema.safeParse({ tightBelow: 0, goodFrom: 3, goodTo: 3 }).error!;
    expect(ruleIssueMessage(err, 'en')).toBe(t.fitRuleOrderGoodTo.en);
  });

  it('turns a range failure into the generic message, never zod English', () => {
    const err = EaseRuleSchema.safeParse({ tightBelow: 0, goodFrom: 1, goodTo: 60 }).error!;
    expect(ruleIssueMessage(err, 'en')).toBe(t.fitRuleInvalid.en);
  });

  it('names the dimension by its label, never its key', () => {
    const err = FitRulesetSchema.safeParse({
      perDimension: { chest_cm: { tightBelow: 0, goodFrom: 1, goodTo: 60 } },
    }).error!;
    expect(ruleIssueMessage(err, 'en')).toBe(`${t.fitRuleInvalid.en} (Chest)`);
    expect(ruleIssueMessage(err, 'th').endsWith('(รอบอก)')).toBe(true);
  });

  it('hides an unknown dimension key', () => {
    const err = FitRulesetSchema.safeParse({ perDimension: { foo_cm: VALID } }).error!;
    const msg = ruleIssueMessage(err, 'th');
    expect(msg).toBe(t.fitRuleInvalid.th);
    expect(msg).not.toContain('foo_cm');
  });

  it('firstIssueMessage is the Thai version', () => {
    const err = EaseRuleSchema.safeParse({ tightBelow: 0, goodFrom: -1, goodTo: 5 }).error!;
    expect(firstIssueMessage(err)).toBe(ruleIssueMessage(err, 'th'));
  });
});

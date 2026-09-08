import test from 'ava';
import slugify from '../../src/util/slugify';

test('lowercases and hyphenates a plain name', (t) => {
  t.is(slugify('My Workflow'), 'my-workflow');
});

test('collapses runs of separators', (t) => {
  t.is(slugify('My   Workflow -- Two'), 'my-workflow-two');
});

test('keeps underscores and digits', (t) => {
  t.is(slugify('step_1 of 2'), 'step_1-of-2');
});

test('trims leading and trailing separators', (t) => {
  t.is(slugify('  ...My Workflow!  '), 'my-workflow');
});

test('keeps accented latin characters', (t) => {
  t.is(slugify('café'), 'café');
  t.is(slugify('résumé'), 'résumé');
});

test('keeps a whole accented phrase readable', (t) => {
  t.is(slugify("Vérifier l'état du patient"), 'vérifier-l-état-du-patient');
});

test('keeps non-latin scripts instead of collapsing to an empty string', (t) => {
  t.is(slugify('患者確認'), '患者確認');
  t.is(slugify('проверка пациента'), 'проверка-пациента');
  t.is(slugify('التحقق من المريض'), 'التحقق-من-المريض');
});

test('still drops characters which are neither letters nor digits', (t) => {
  t.is(slugify('deploy 🚀 now'), 'deploy-now');
});

test('handles empty and nullish input', (t) => {
  t.is(slugify(''), '');
  t.is(slugify(undefined as unknown as string), '');
});

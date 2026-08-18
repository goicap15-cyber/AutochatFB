const NORMALIZED_PHONE_STATUS = 'da co so';

function normalizeStatusName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getPhoneAutomationRecommendation(statuses = []) {
  const status = (Array.isArray(statuses) ? statuses : []).find(
    (candidate) => normalizeStatusName(candidate?.name) === NORMALIZED_PHONE_STATUS
  );
  return status
    ? { policy: 'stop_remaining', statusId: String(status.id), statusName: status.name }
    : { policy: 'continue', statusId: '', statusName: '' };
}

export function preservePhoneAutomationDraft(draft, recommendation, hasOperatorEdited) {
  if (hasOperatorEdited) return draft;
  return { policy: recommendation.policy, statusId: recommendation.statusId };
}

/**
 * Who the documents speak for. These are details of a person or a company, so they are not in the repository:
 * the build of the site gets them from VITE_LEGAL_OPERATOR, VITE_LEGAL_DETAILS and VITE_LEGAL_EMAIL.
 * What is not set shows as a plain gap in the text, so that nobody launches the pages without them by mistake.
 */
export function legalContact(env: Record<string, string | undefined> = import.meta.env) {
  return {
    operator:
      env['VITE_LEGAL_OPERATOR'] ??
      '[не указано: VITE_LEGAL_OPERATOR, имя или наименование правообладателя]',
    details:
      env['VITE_LEGAL_DETAILS'] ?? '[не указано: VITE_LEGAL_DETAILS, ИНН, ОГРН или ОГРНИП, адрес]',
    email: env['VITE_LEGAL_EMAIL'] ?? '[не указано: VITE_LEGAL_EMAIL]',
  };
}

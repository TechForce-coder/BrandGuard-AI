export const WORKSPACE_ROLES = ['Creator', 'Manager', 'Admin'];
export const PREVIEW_ROLE_STORAGE_KEY = 'brandguard-preview-role';

export const WORKSPACE_CONFIG = {
  Creator: {
    dashboardLabel: 'CREATOR WORKSPACE',
    dashboardTitle: 'My Content Workspace',
    dashboardDescription: 'Keep brand standards in view from first draft through final approval.',
    contentTitle: 'Your content',
    contentDescription: 'Open an item to see its status and continue the workflow.',
    navigation: [
      { to: '/', label: 'Dashboard' },
      { to: '/drafts', label: 'My Drafts' },
      { to: '/drafts/new', label: 'Submit Content' }
    ]
  },
  Manager: {
    dashboardLabel: 'MANAGER WORKSPACE',
    dashboardTitle: 'Governance Overview',
    dashboardDescription: 'Monitor workflow progress and content status across the workspace.',
    contentTitle: 'Governed content',
    contentDescription: 'Review content status and open an item to continue the workflow.',
    navigation: [
      { to: '/', label: 'Dashboard' },
      { to: '/review', label: 'Approval Workflow' },
      { to: '/rulebook', label: 'Guideline Library' },
      { to: '/facts', label: 'Facts' },
      { to: '/audit', label: 'Privacy & Audit Log' }
    ]
  },
  Admin: {
    dashboardLabel: 'ADMIN WORKSPACE',
    dashboardTitle: 'Administration Overview',
    dashboardDescription: 'Monitor content governance, policy findings, and workflow status.',
    contentTitle: 'Content overview',
    contentDescription: 'Review content status and open an item to continue the workflow.',
    navigation: [
      { to: '/', label: 'Dashboard' },
      { to: '/drafts', label: 'Content' },
      { to: '/rulebook', label: 'Guideline Library' },
      { to: '/facts', label: 'Facts' },
      { to: '/audit', label: 'Audit Log' },
      { to: '/settings', label: 'Administration' }
    ]
  }
};

export function isWorkspacePreviewEnabled(isDevelopment, isProduction, configurationValue, hostname) {
  if (arguments.length <= 2 || typeof isProduction === 'string') {
    const configVal = typeof isProduction === 'string' ? isProduction : configurationValue;
    return Boolean(isDevelopment) && configVal === 'true';
  }

  const isLoopbackHost = ['localhost', '127.0.0.1', '::1', '[::1]']
    .includes(String(hostname || '').toLowerCase());

  return (isDevelopment === true || isProduction === true) &&
    configurationValue === 'true' &&
    isLoopbackHost;
}

export function isWorkspacePreviewSelectorDisabled(isBusy, previewEnabled) {
  return isBusy || !previewEnabled;
}

export function normalizeWorkspaceRole(role) {
  return WORKSPACE_ROLES.find(item => item.toLowerCase() === String(role || '').toLowerCase()) || null;
}

export function resolveWorkspaceSelection(actualRole, selectedRole, previewEnabled) {
  const authorizedRole = normalizeWorkspaceRole(actualRole);
  const requestedRole = normalizeWorkspaceRole(selectedRole);
  const previewMode = Boolean(
    previewEnabled &&
    authorizedRole &&
    requestedRole &&
    requestedRole !== authorizedRole
  );

  return {
    actualRole: authorizedRole,
    workspaceRole: previewMode ? requestedRole : authorizedRole,
    previewMode
  };
}

export function canMutateInWorkspace(previewMode) {
  return !previewMode;
}
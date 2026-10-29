
import { useCallback, useEffect, useState } from 'react';
import {
  LockKeyhole,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  RefreshCw
} from 'lucide-react';

import { api } from '../api/api.js';

const ROLES = ['creator', 'reviewer', 'manager', 'admin'];

function SettingRow({ icon: Icon, title, children }) {
  return (
    <div className="flex gap-3.5 border-b border-slate-100 py-5 last:border-0 last:pb-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
        <Icon size={18} />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">{children}</p>
      </div>
    </div>
  );
}

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.getUsers();
      setUsers(result);
    } catch (err) {
      setError(err.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(userId, role) {
    const currentUser = users.find(
      (user) => String(user._id || user.id) === String(userId)
    );

    if (!currentUser || currentUser.role === role) return;

    const previousRole = currentUser.role;
    setSavingId(userId);
    setError('');
    setMessage('');

    try {
      const result = await api.updateUserRole(userId, role);

      setUsers((current) =>
        current.map((user) =>
          String(user._id || user.id) === String(userId)
            ? { ...user, role: result.user.role }
            : user
        )
      );

      setMessage(`Role updated to ${result.user.role}.`);
    } catch (err) {
      setError(err.message || 'Unable to update user role.');
      setUsers((current) =>
        current.map((user) =>
          String(user._id || user.id) === String(userId)
            ? { ...user, role: previousRole }
            : user
        )
      );
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="max-w-5xl space-y-7">
      <header>
        <p className="section-kicker">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Workspace Administration
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Manage workspace users and their access roles.
        </p>
      </header>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
              <Users size={19} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">User Management</h2>
              <p className="mt-1 text-xs text-slate-500">
                Users in your organisation: {users.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-sm text-slate-500">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="py-8 text-sm text-slate-500">
            No users found in this organisation.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const userId = String(user._id || user.id);

                  return (
                    <tr key={userId} className="border-b border-slate-50">
                      <td className="py-4 pr-4 font-medium text-slate-900">
                        {user.name}
                      </td>
                      <td className="py-4 pr-4 text-slate-600">
                        {user.email}
                      </td>
                      <td className="py-4">
                        <select
                          aria-label={`Role for ${user.name}`}
                          className="field min-w-32"
                          value={String(user.role || 'creator').toLowerCase()}
                          disabled={savingId === userId}
                          onChange={(event) =>
                            handleRoleChange(userId, event.target.value)
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                          ))}
                        </select>
                        {savingId === userId && (
                          <span className="ml-2 text-xs text-slate-500">Saving...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
            <SettingsIcon size={19} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Workspace configuration</h2>
            <p className="mt-1 text-xs text-slate-500">Security and environment details</p>
          </div>
        </div>

        <SettingRow icon={ShieldCheck} title="Authentication and authorization">
          Role changes are validated by the backend. Only authenticated administrators can manage users.
        </SettingRow>

        <SettingRow icon={LockKeyhole} title="Environment configuration">
          Never put database credentials, JWT secrets, or private API keys in frontend code.
        </SettingRow>
      </section>
    </div>
  );
}

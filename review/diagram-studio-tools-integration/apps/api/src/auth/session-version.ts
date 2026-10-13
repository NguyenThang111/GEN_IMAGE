export function isCurrentSession(payload: { sessionVersion?: number }, user: { sessionVersion?: number }) {
  // Legacy JWTs belong to version zero; revoking one account does not log out others.
  return (payload.sessionVersion ?? 0) === (user.sessionVersion ?? 0);
}

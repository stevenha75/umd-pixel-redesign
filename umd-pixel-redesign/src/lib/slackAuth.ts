const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function isLocalhost(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname);
}

export function getSlackRedirectUri() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI || "";
  }

  if (isLocalhost(window.location.hostname)) {
    return (
      process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI_LOCAL ||
      `${window.location.origin}/auth/callback`
    );
  }

  return (
    process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI ||
    `${window.location.origin}/auth/callback`
  );
}

export function buildSlackAuthUrl(clientId: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    user_scope: "identity.basic,identity.email,identity.avatar",
    redirect_uri: redirectUri,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

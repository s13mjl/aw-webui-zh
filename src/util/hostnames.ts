export function preferKnownHostnames(hosts: string[]): string[] {
  const knownHosts = hosts.filter(host => host !== 'unknown');
  return knownHosts.length > 0
    ? [...knownHosts, ...hosts.filter(host => host === 'unknown')]
    : hosts;
}

// Hosts to offer in device pickers: everything except the "unknown" pseudo-host
// (e.g. the stopwatch bucket), unless no real host exists.
export function deviceHostnames(hosts: string[]): string[] {
  const known = hosts.filter(host => Boolean(host) && host !== 'unknown');
  return known.length > 0 ? known : hosts;
}

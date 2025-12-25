export function shouldResolve(resolve: boolean): boolean {
  const resolveEnabled = process.env['GHREPLY_RESOLVE'] !== 'false';
  
  if (resolve && !resolveEnabled) {
    // eslint-disable-next-line no-console
    console.error('Warning: --resolve is disabled by GHREPLY_RESOLVE=false');
    return false;
  }
  
  return resolve;
}

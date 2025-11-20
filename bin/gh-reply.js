#!/usr/bin/env node
// Load the compiled ESM bundle using dynamic import so this shim works
// regardless of package "type". This avoids require() in ESM scope.
(async () => {
  await import('../dist/index.js');
})();

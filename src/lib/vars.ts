export type VarContext = Record<string, string>;

export function expandMagicVars(template: string, ctx: VarContext) {
  if (!template) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    let v = '';
    if (Object.prototype.hasOwnProperty.call(ctx, key)) v = ctx[key];
    return v;
  });
}

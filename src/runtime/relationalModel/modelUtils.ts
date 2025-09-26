export function isRelatedField(fieldType: string): boolean {
  return fieldType === "many2one" || fieldType === "one2many" || fieldType === "many2many";
}
export function isX2ManyField(fieldType: string): boolean {
  return fieldType === "one2many" || fieldType === "many2many";
}
export function isOne2ManyField(fieldType: string): boolean {
  return fieldType === "one2many";
}
export function isMany2OneField(fieldType: string): boolean {
  return fieldType === "many2one";
}

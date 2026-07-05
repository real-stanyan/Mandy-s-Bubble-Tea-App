// lib/doodle/types.ts
// Shared doodle types. Imported by cart/selection/payload modules so we
// can rewrite cartToSlots without breaking these types' consumers.

export type SvgPath = { d: string; stroke: string; width: number }

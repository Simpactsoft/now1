# Validation Failed - Diagnostic Guide

**Error Message:**
```
Validation failed
```

---

## 🛑 Common Causes & Fixes

### Cause #1: Zod `.default()` doesn't work with `undefined`

**Symptom:**
Client sends `undefined` for an optional field that has `.default()`.

**Why it fails:**
```typescript
const schema = z.object({
  field: z.string().default("default_value")
});

schema.safeParse({ field: undefined });
// ❌ Fails! Zod's .default() doesn't handle undefined in safeParse()
```

**Fix:**
```typescript
const schema = z.object({
  field: z.string().optional()  // ✅ Use .optional() instead
});

// Handle default in code if needed:
const value = validatedData.field || "default_value";
```

---

### Cause #2: `.optional()` vs `.nullable()`

**Symptom:**
Client sends `null` but schema expects `undefined`.

**The Difference:**
- `.optional()` = accepts `undefined` or missing
- `.nullable()` = accepts `null`
- `.nullable().optional()` = accepts `null`, `undefined`, or missing

**Fix:**
```typescript
// If client might send null:
const schema = z.object({
  field: z.string().nullable().optional()
});
```

**Common Scenario:**
```typescript
// Form sends null when empty:
sourceCategoryId: null  // ← Client sends this

// Wrong schema:
sourceCategoryId: z.string().uuid().optional()  // ❌ Doesn't accept null!

// Correct schema:
sourceCategoryId: z.string().uuid().nullable().optional()  // ✅
```

---

### Cause #3: Missing required field in validation

**Symptom:**
Field is in database schema but not in Zod schema.

**Example:**
```typescript
// Server action validates:
const validation = optionGroupSchema.safeParse({
  name: params.name,
  // ❌ Missing templateId!
});

// But schema requires it:
export const optionGroupSchema = z.object({
  templateId: z.string().uuid(),  // ← Required!
  name: z.string(),
});
```

**Fix:**
```typescript
const validation = optionGroupSchema.safeParse({
  templateId: templateId,  // ✅ Include all required fields
  name: params.name,
});
```

---

### Cause #4: Type mismatch (string vs number, etc.)

**Symptom:**
Client sends string, schema expects number (or vice versa).

**Example:**
```typescript
// Client sends:
{ quantity: "5" }  // ← String

// Schema expects:
quantity: z.number()  // ← Number

// Fix 1: Coerce in schema
quantity: z.coerce.number()  // ✅ Converts string to number

// Fix 2: Transform in client
quantity: parseInt(quantity)  // ✅ Convert before sending
```

---

## 🔧 Debugging Steps

### Step 1: Add detailed logging

```typescript
const validationData = {
  templateId,
  name: params.name,
  // ... all fields
};

console.log('🔍 Validation data:', validationData);

const validation = schema.safeParse(validationData);

if (!validation.success) {
  console.error('❌ Validation errors:', validation.error.errors);
  // Log the full error object to see exactly what failed
}
```

### Step 2: Check Zod error details

```typescript
if (!validation.success) {
  validation.error.errors.forEach(err => {
    console.log('Field:', err.path);
    console.log('Code:', err.code);
    console.log('Message:', err.message);
    console.log('Received:', (err as any).received);
    console.log('---');
  });
}
```

### Step 3: Verify client-server data match

**In client component:**
```typescript
console.log('📤 Sending to server:', params);
```

**In server action:**
```typescript
console.log('📥 Received from client:', params);
```

Compare the two!

---

## 📚 Zod Patterns Cheat Sheet

```typescript
// String patterns
z.string()                           // Required string
z.string().optional()                // Optional (can be undefined or missing)
z.string().nullable()                // Nullable (can be null)
z.string().nullable().optional()     // Can be null, undefined, or missing
z.string().default("default")        // ❌ Don't use with safeParse!
z.string().email()                   // Email validation
z.string().uuid()                    // UUID validation
z.string().min(1).max(200)          // Length constraints

// Number patterns
z.number()                           // Required number
z.coerce.number()                    // Coerce string to number
z.number().int()                     // Integer only
z.number().positive()                // Must be > 0
z.number().min(0).max(100)          // Range

// Boolean patterns
z.boolean()                          // true or false
z.boolean().default(false)           // ❌ Don't use with safeParse!
z.boolean().optional()               // Optional boolean

// Enum patterns
z.enum(["a", "b", "c"])             // One of these values
z.enum(["a", "b"]).optional()       // Optional enum

// Object patterns
z.object({                           // Nested object
  field: z.string()
})

// Array patterns
z.array(z.string())                  // Array of strings
z.array(z.object({...}))            // Array of objects
```

---

## 🎯 Quick Reference

| Client Sends | Schema Should Use |
|-------------|-------------------|
| `undefined` | `.optional()` |
| `null` | `.nullable()` |
| `null` or `undefined` | `.nullable().optional()` |
| `"5"` (string number) | `.coerce.number()` |
| `""` (empty string) | `.min(1)` to reject, or `.optional()` |
| Missing field | `.optional()` |

---

## 📚 Related Docs

- [Server Action Template](file:///Users/itzhakbenari/Documents/GitHub/now/templates/server-action-template.ts)
- [RLS Policy Guide](./new_row_violates_rls_policy.md)

---

**Last Updated:** 2026-02-16

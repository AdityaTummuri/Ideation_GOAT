export interface SchemaRule {
  type: 'int' | 'float' | 'bool' | 'str' | 'list' | 'dict' | any; // supports both string identifiers and constructor classes
  default?: any;
  required?: boolean;
  choices?: string[];
}

export type ExpectedSchema = Record<string, SchemaRule>;

export interface HealedResult {
  healed_params: Record<string, any>;
  audit_log: Record<string, string>;
}

export function healParameterSchema(rawArgs: Record<string, any>, expectedSchema: ExpectedSchema): HealedResult {
  const healedParams: Record<string, any> = {};
  const auditLog: Record<string, string> = {};

  for (const [field, rules] of Object.entries(expectedSchema)) {
    const rawType = rules.type;
    const defaultVal = rules.default;
    const choices = rules.choices;
    const required = rules.required || false;

    // Normalize type identifier
    let typeName = '';
    if (typeof rawType === 'string') {
      typeName = rawType.toLowerCase();
    } else if (rawType === Number) {
      typeName = 'float'; // or int
    } else if (rawType === String) {
      typeName = 'str';
    } else if (rawType === Boolean) {
      typeName = 'bool';
    } else if (rawType === Array) {
      typeName = 'list';
    } else if (rawType === Object) {
      typeName = 'dict';
    } else {
      typeName = String(rawType).toLowerCase();
    }

    // Check if field exists
    if (!(field in rawArgs)) {
      if (required) {
        healedParams[field] = defaultVal;
        auditLog[field] = `Missing required parameter. Applied default: '${defaultVal}'.`;
      } else {
        if (defaultVal !== undefined) {
          healedParams[field] = defaultVal;
          auditLog[field] = `Applied optional default: '${defaultVal}'.`;
        }
      }
      continue;
    }

    const val = rawArgs[field];

    if (typeName === 'int') {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        healedParams[field] = parsed;
        if (typeof val !== 'number' || !Number.isInteger(val)) {
          auditLog[field] = `Coerced '${val}' (${typeof val}) to integer.`;
        }
      } else {
        healedParams[field] = defaultVal !== undefined ? defaultVal : 0;
        auditLog[field] = `Failed to coerce '${val}' to integer. Replaced with fallback '${healedParams[field]}'.`;
      }
    } else if (typeName === 'float' || typeName === 'number') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        healedParams[field] = parsed;
        if (typeof val !== 'number') {
          auditLog[field] = `Coerced '${val}' (${typeof val}) to float.`;
        }
      } else {
        healedParams[field] = defaultVal !== undefined ? defaultVal : 0.0;
        auditLog[field] = `Failed to coerce '${val}' to float. Replaced with fallback '${healedParams[field]}'.`;
      }
    } else if (typeName === 'bool' || typeName === 'boolean') {
      if (typeof val === 'string') {
        const valClean = val.toLowerCase().trim();
        if (['true', '1', 'yes', 'on', 't'].includes(valClean)) {
          healedParams[field] = true;
          auditLog[field] = `Coerced string '${val}' to True.`;
        } else if (['false', '0', 'no', 'off', 'f'].includes(valClean)) {
          healedParams[field] = false;
          auditLog[field] = `Coerced string '${val}' to False.`;
        } else {
          healedParams[field] = defaultVal !== undefined ? defaultVal : false;
          auditLog[field] = `Ambiguous boolean string '${val}'. Set to default '${healedParams[field]}'.`;
        }
      } else {
        healedParams[field] = Boolean(val);
        if (typeof val !== 'boolean') {
          auditLog[field] = `Coerced '${val}' to boolean.`;
        }
      }
    } else if (typeName === 'str' || typeName === 'string') {
      const strVal = String(val);
      healedParams[field] = strVal;

      if (choices && choices.length > 0) {
        const valClean = strVal.trim().toLowerCase();
        const choicesLower = choices.map((c) => c.toLowerCase());

        const idx = choicesLower.indexOf(valClean);
        if (idx !== -1) {
          healedParams[field] = choices[idx];
        } else {
          // Typo search (fuzzy match / substring match)
          let matchedChoice: string | null = null;
          for (const c of choices) {
            const cLower = c.toLowerCase();
            if (cLower.includes(valClean) || valClean.includes(cLower)) {
              matchedChoice = c;
              break;
            }
          }

          if (matchedChoice) {
            healedParams[field] = matchedChoice;
            auditLog[field] = `Corrected typo/value '${val}' to match choices option '${matchedChoice}'.`;
          } else {
            healedParams[field] = defaultVal !== undefined ? defaultVal : choices[0];
            auditLog[field] = `Invalid option '${val}' not in choices. Reset to fallback '${healedParams[field]}'.`;
          }
        }
      }
    } else if (typeName === 'list' || typeName === 'array') {
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            healedParams[field] = parsed;
            auditLog[field] = 'Parsed JSON string into list.';
          } else {
            healedParams[field] = [val];
            auditLog[field] = 'Encapsulated string value into list container.';
          }
        } catch {
          // Comma separated fallback
          healedParams[field] = val.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
          auditLog[field] = 'Split comma-separated string value into list.';
        }
      } else if (Array.isArray(val)) {
        healedParams[field] = val;
      } else {
        healedParams[field] = [val];
        auditLog[field] = 'Encapsulated value into list container.';
      }
    } else if (typeName === 'dict' || typeName === 'object') {
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            healedParams[field] = parsed;
            auditLog[field] = 'Parsed JSON string into dict.';
          } else {
            healedParams[field] = {};
            auditLog[field] = 'Failed to convert string to dict. Replaced with empty dict.';
          }
        } catch {
          healedParams[field] = {};
          auditLog[field] = 'Failed to parse JSON string. Replaced with empty dict.';
        }
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        healedParams[field] = val;
      } else {
        healedParams[field] = {};
        auditLog[field] = `Cannot coerce type ${typeof val} to dict. Replaced with empty dict.`;
      }
    } else {
      healedParams[field] = val;
    }
  }

  return { healed_params: healedParams, audit_log: auditLog };
}

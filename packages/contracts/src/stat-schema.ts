export interface StatField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean';
  min?: number;
  max?: number;
  defaultValue?: number | string | boolean;
}

export interface StatGroup {
  key: string;
  label: string;
  fields: StatField[];
}

export interface StatSchema {
  groups: StatGroup[];
}

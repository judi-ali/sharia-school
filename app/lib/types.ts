// Shared by server actions and client forms
export type State = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

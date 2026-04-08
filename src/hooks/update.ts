export interface UpdateResult {
  ok: boolean;
  from?: string;
  to?: string;
  setup?: string;
  doctor?: string;
  upToDate?: boolean;
  version?: string;
  dryRun?: boolean;
  current?: string;
  latest?: string;
  error?: string;
  stderr?: string;
  guidance?: string;
  doctor_issues?: string;
}

interface UpdateOptions {
  dryRun?: boolean;
}

export async function runUpdate(_options?: UpdateOptions): Promise<UpdateResult> {
  return { ok: false, error: "not implemented" };
}

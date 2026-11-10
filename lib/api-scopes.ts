export interface ApiScope {
  id: string;
  label: string;
  routes: string;
  icon: string;
  risk?: "high" | "broad";
  note?: string;
}

/** Scope catalogue mirrored from the live QASyn API-token screen. */
export const API_SCOPES: ApiScope[] = [
  { id: "TEST_CASE_READ", label: "View Test Cases", routes: "GET /test_cases · GET /test_cases/{test_case_id}", icon: "visibility" },
  { id: "TEST_CASE_WRITE", label: "Create & Edit Test Cases", routes: "POST /test_cases · PUT /test_cases/{test_case_id}", icon: "edit" },
  { id: "TEST_CASE_RESULTS_READ", label: "View Test Case Results", routes: "GET /test_case_results · GET /test_case_results/{test_case_result_id}", icon: "fact_check" },
  { id: "TEST_PLAN_READ", label: "View Test Plans", routes: "GET /test_plans · GET /test_plans/{test_plan_id}", icon: "visibility" },
  { id: "TEST_PLAN_WRITE", label: "Create & Edit Test Plans", routes: "POST /test_plans · PUT /test_plans/{test_plan_id}", icon: "edit" },
  { id: "TEST_PLAN_EXECUTE", label: "Execute Test Plans", routes: "GET /test_plans/{test_plan_id}/execution", icon: "play_arrow" },
  { id: "TEST_PLAN_RESULTS_READ", label: "View Test Plan Results", routes: "GET /test_plan_results · GET /test_plan_results/{test_plan_result_id}", icon: "fact_check" },
  { id: "TEST_SUITE_READ", label: "View Test Suites", routes: "GET /test_suites · GET /test_suites/{test_suite_id}", icon: "visibility" },
  { id: "TEST_SUITE_WRITE", label: "Create & Edit Test Suites", routes: "POST /test_suites · PUT /test_suites/{test_suite_id}", icon: "edit" },
  { id: "TEST_SUITE_RESULTS_READ", label: "View Test Suite Results", routes: "GET /test_suite_results · GET /test_suite_results/{test_suite_result_id}", icon: "fact_check" },
  { id: "TEST_STEP_READ", label: "View Test Steps", routes: "GET /test_steps · GET /test_steps/{test_step_id}", icon: "visibility" },
  { id: "TEST_STEP_WRITE", label: "Create & Edit Test Steps", routes: "POST /test_steps · PUT /test_steps/{test_step_id}", icon: "edit" },
  { id: "TEST_STEP_RESULTS_READ", label: "View Test Step Results", routes: "GET /test_step_results · GET /test_step_results/{test_step_result_id}", icon: "fact_check" },
  { id: "EMAIL_SEND", label: "Send Email", routes: "POST /api/email/send", icon: "mail", risk: "high", note: "High abuse risk" },
  { id: "SYSTEM_AUDIT_READ", label: "View System Audit", routes: "GET /api/v1/system-audits", icon: "history" },
  { id: "MEDIA_UPLOAD", label: "Upload Media", routes: "GET /test_plans/build_upload_url", icon: "upload" },
  { id: "FULL_ACCESS", label: "Full Access", routes: "Every scope above except EMAIL_SEND", icon: "all_inclusive", risk: "broad", note: "Broad" },
];

export function scopeLabel(id: string): string {
  return API_SCOPES.find((scope) => scope.id === id)?.label ?? id;
}

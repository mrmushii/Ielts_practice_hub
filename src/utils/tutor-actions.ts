export type TutorAction = {
  id: string;
  type: "navigate_module" | "open_tutor_workspace" | "start_module_flow";
  module: string;
  route: string;
  label: string;
  description: string;
  start_action?: string;
  requires_confirmation: boolean;
};

export type TutorResponseMeta = {
  intent: string;
  confidence: number;
  reason: string;
  session_id?: string | null;
};

export type TutorChatResponse = {
  response: string;
  actions?: TutorAction[];
  meta?: TutorResponseMeta;
};

export function buildTutorRoute(route: string, sessionId: string): string {
  if (!sessionId) return route;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}tutor_session=${encodeURIComponent(sessionId)}`;
}

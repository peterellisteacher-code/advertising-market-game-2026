export type AdvertisingGameRoute =
  | { readonly kind: "redirect"; readonly location: "/student" }
  | { readonly kind: "student" }
  | { readonly kind: "teacher-dashboard" }
  | { readonly kind: "teacher-playtest" }
  | { readonly kind: "not-found" };

export interface AdvertisingGameRouteActions {
  readonly replace: (location: "/student") => void;
  readonly bootStudent: () => void;
  readonly bootTeacherDashboard: () => void;
  readonly bootTeacherPlaytest: () => void;
  readonly renderNotFound: () => void;
}

function removeOneTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

export function resolveAdvertisingGameRoute(pathname: string): AdvertisingGameRoute {
  const normalised = removeOneTrailingSlash(pathname);
  switch (normalised) {
    case "/":
      return { kind: "redirect", location: "/student" };
    case "/student":
      return { kind: "student" };
    case "/teacher":
      return { kind: "teacher-dashboard" };
    case "/teacher/playtest":
      return { kind: "teacher-playtest" };
    default:
      return { kind: "not-found" };
  }
}

export function runAdvertisingGameRoute(
  pathname: string,
  actions: AdvertisingGameRouteActions
): AdvertisingGameRoute {
  const route = resolveAdvertisingGameRoute(pathname);
  switch (route.kind) {
    case "redirect":
      actions.replace(route.location);
      break;
    case "student":
      actions.bootStudent();
      break;
    case "teacher-dashboard":
      actions.bootTeacherDashboard();
      break;
    case "teacher-playtest":
      actions.bootTeacherPlaytest();
      break;
    case "not-found":
      actions.renderNotFound();
      break;
  }
  return route;
}

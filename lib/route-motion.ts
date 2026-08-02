const ROUTE_EXIT_DURATION_MS = 300;

export function navigateWithRouteExit(navigate: () => void) {
  const main = document.querySelector("main");
  if (!main) {
    navigate();
    return;
  }

  document.body.dataset.routeTransition = "return";
  main.classList.remove("profile-route-enter", "page-route-enter");
  main.classList.add("page-route-exit");

  window.setTimeout(navigate, ROUTE_EXIT_DURATION_MS);
}

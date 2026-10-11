import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  const origGetMatchedRoutes = router.getMatchedRoutes.bind(router);
  (router as any).getMatchedRoutes = (pathname: string) => {
    const res: any = origGetMatchedRoutes(pathname);
    if (res && typeof res === "object" && !res[Symbol.iterator]) {
      res[Symbol.iterator] = function* () {
        yield res.matchedRoutes;
        yield res.routeParams;
        yield res.foundRoute;
      };
    }
    return res;
  };

  let _serverSsr: any = undefined;
  Object.defineProperty(router, "serverSsr", {
    configurable: true,
    enumerable: true,
    get() {
      return _serverSsr;
    },
    set(val) {
      if (val && typeof val === "object") {
        if (!val.isDehydrated) val.isDehydrated = () => true;
        if (!val.isSerializationFinished) val.isSerializationFinished = () => true;
        if (!val.reserveStreamFastPath) val.reserveStreamFastPath = () => false;
        if (!val.setRenderFinished) val.setRenderFinished = () => {};
        if (!val.onInjectedHtml) val.onInjectedHtml = () => () => {};
        if (!val.onRenderFinished) val.onRenderFinished = () => {};
        if (!val.onCleanup) val.onCleanup = () => {};
        if (!val.onSerializationFinished) val.onSerializationFinished = () => () => {};
        if (!val.takeBufferedScripts) val.takeBufferedScripts = () => undefined;
        if (!val.takeBufferedHtml) val.takeBufferedHtml = () => undefined;
        if (!val.liftScriptBarrier) val.liftScriptBarrier = () => {};
      }
      _serverSsr = val;
    },
  });

  return router;
};

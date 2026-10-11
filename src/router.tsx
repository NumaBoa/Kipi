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

  let _stores: any = (router as any).stores;
  Object.defineProperty(router, "stores", {
    configurable: true,
    enumerable: true,
    get() {
      if (_stores && !_stores.ids) {
        _stores.ids = _stores.matchesId ?? { get: () => [] };
      }
      return _stores;
    },
    set(s: any) {
      if (s && !s.ids) {
        s.ids = s.matchesId ?? { get: () => [] };
      }
      _stores = s;
    },
  });
  if (_stores && !_stores.ids) {
    _stores.ids = _stores.matchesId ?? { get: () => [] };
  }

  const origUpdate = router.update.bind(router);
  router.update = (newOptions: any) => {
    origUpdate(newOptions);
    if ((router as any).stores && !(router as any).stores.ids) {
      (router as any).stores.ids = (router as any).stores.matchesId ?? { get: () => [] };
    }
    return router;
  };

  let _ssr: any = (router as any).ssr;
  Object.defineProperty(router, "ssr", {
    configurable: true,
    enumerable: true,
    get() {
      if (!_ssr) {
        _ssr = { manifest: { routes: new Proxy({}, { get: () => ({ assets: [], scripts: [] }) }) } };
      } else if (!_ssr.manifest) {
        _ssr.manifest = { routes: new Proxy({}, { get: () => ({ assets: [], scripts: [] }) }) };
      } else if (!_ssr.manifest.routes) {
        _ssr.manifest.routes = new Proxy({}, { get: () => ({ assets: [], scripts: [] }) });
      }
      return _ssr;
    },
    set(s: any) {
      if (!s) {
        s = { manifest: { routes: new Proxy({}, { get: () => ({ assets: [], scripts: [] }) }) } };
      } else if (!s.manifest) {
        s = { ...s, manifest: { routes: new Proxy({}, { get: () => ({ assets: [], scripts: [] }) }) } };
      } else if (!s.manifest.routes) {
        s.manifest = { ...s.manifest, routes: new Proxy({}, { get: () => ({ assets: [], scripts: [] }) }) };
      }
      _ssr = s;
    },
  });

  // Polyfill HMR chunk replacement if invoked by Vite plugin
  if (!(router as any)._replaceRouteChunk) {
    (router as any)._replaceRouteChunk = () => {};
  }

  // Prevent _displayPending from freezing the client tree to a blank screen
  const origUpdateMatch = router.updateMatch.bind(router);
  router.updateMatch = (id: string, updater: any) => {
    return origUpdateMatch(id, (prev: any) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      if (updated && updated._displayPending) {
        updated._displayPending = undefined;
      }
      return updated;
    });
  };

  // On client, prefill window.$_TSR with exact matched routes before hydrate() checks isSpaMode
  if (typeof window !== "undefined") {
    try {
      const pathname = window.location.pathname || "/";
      const targetRoute = pathname === "/" ? "/_authenticated/" : `/_authenticated${pathname.replace(/\/$/, "")}`;
      const lastId = targetRoute;
      const initialMatches = [
        { i: "__root__", s: "success", ssr: true, u: Date.now() },
        { i: "/_authenticated", s: "success", ssr: true, u: Date.now() },
        { i: lastId, s: "success", ssr: true, u: Date.now() },
      ];
      if ((window as any).$_TSR && (window as any).$_TSR.router) {
        (window as any).$_TSR.router.matches = initialMatches;
        (window as any).$_TSR.router.lastMatchId = lastId;
      }
    } catch {}
  }

  return router;
};

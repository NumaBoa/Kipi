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
  (router.options as any).defaultSsr = false;

  // Compatibility between TanStack Router 1.170 and TanStack Start 1.168
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

  // Provide robust serverSsr interface between React Router 1.170 and Start 1.168
  let _serverSsr: any = undefined;
  Object.defineProperty(router, "serverSsr", {
    configurable: true,
    enumerable: true,
    get() {
      return _serverSsr;
    },
    set(val) {
      if (val && typeof val === "object") {
        if (!val.reserveStreamFastPath) val.reserveStreamFastPath = () => false;
        if (!val.takeBufferedScripts) val.takeBufferedScripts = () => undefined;
        if (!val.takeBufferedHtml) val.takeBufferedHtml = () => undefined;
        if (!val.liftScriptBarrier) val.liftScriptBarrier = () => {};
        if (!val.onInjectedHtml) val.onInjectedHtml = () => () => {};
        if (!val.onSerializationFinished) val.onSerializationFinished = () => () => {};
        if (!val.onRenderFinished) val.onRenderFinished = () => {};
        if (!val.onCleanup) val.onCleanup = () => {};
        if (!val.setRenderFinished) val.setRenderFinished = () => {};
        if (!val.isSerializationFinished) val.isSerializationFinished = () => true;

        const origCleanup = val.cleanup?.bind(val);
        val.cleanup = () => {
          setTimeout(() => {
            try { origCleanup?.(); } catch {}
          }, 3000);
        };
      }
      _serverSsr = val;
    },
  });

  // TanStack Start 1.168 reads router.stores.ids (renamed to matchesId in 1.170)
  let _stores: any = (router as any).stores;
  Object.defineProperty(router, "stores", {
    configurable: true,
    enumerable: true,
    get() {
      if (_stores && !_stores.ids) {
        _stores.ids = _stores.matchesId;
      }
      return _stores;
    },
    set(s: any) {
      if (s && !s.ids) {
        s.ids = s.matchesId;
      }
      _stores = s;
    },
  });
  if (_stores && !_stores.ids) {
    _stores.ids = _stores.matchesId;
  }

  // TanStack Start 1.168 reads router.ssr.manifest
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

  // Prevent _displayPending or _forcePending from freezing the client tree to a blank screen
  const origUpdateMatch = (router as any).updateMatch?.bind(router);
  if (origUpdateMatch) {
    (router as any).updateMatch = (id: string, updater: any) => {
      return origUpdateMatch(id, (prev: any) => {
        const updated = typeof updater === "function" ? updater(prev) : updater;
        if (updated) {
          if (updated._displayPending) updated._displayPending = undefined;
          if (updated._forcePending) updated._forcePending = undefined;
          if (updated._nonReactive?.displayPendingPromise) {
            updated._nonReactive.displayPendingPromise = undefined;
          }
        }
        return updated;
      });
    };
  }

  const origMatchRoutes = router.matchRoutes.bind(router);
  (router as any).matchRoutes = (...args: any[]) => {
    const res = (origMatchRoutes as any)(...args);
    if (Array.isArray(res)) {
      res.forEach((m: any) => {
        if (m) {
          m._displayPending = undefined;
          m._forcePending = undefined;
          if (m._nonReactive) {
            m._nonReactive.dehydrated = undefined;
            m._nonReactive.displayPendingPromise = undefined;
          }
        }
      });
    }
    return res;
  };

  // On client, prefill window.$_TSR with exact matched routes before hydrate() checks isSpaMode
  if (typeof window !== "undefined") {
    try {
      const currentMatches = router.matchRoutes(router.stores.location.get());
      const lastMatch = currentMatches[currentMatches.length - 1];
      if (lastMatch) {
        const safeRoutes = new Proxy({}, { get: () => ({ assets: [], scripts: [] }) });
        const tsr = (window as any).$_TSR = (window as any).$_TSR || {};
        tsr.router = tsr.router || {};
        tsr.router.manifest = tsr.router.manifest || { routes: safeRoutes };
        tsr.router.lastMatchId = lastMatch.id;
        tsr.router.matches = currentMatches.map((m: any) => ({
          i: m.id,
          s: "success",
          ssr: true,
          u: Date.now(),
        }));
      }
    } catch (e) {
      console.warn("Could not align SSR matches:", e);
    }
  }

  return router;
};


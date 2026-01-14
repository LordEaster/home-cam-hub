import { useState, CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Video, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants";

export function NavBottom() {
  const { pathname } = useLocation();
  const [bounceTarget, setBounceTarget] = useState<string | null>(null);

  const triggerBounce = (key: string) => {
    setBounceTarget(key);
    setTimeout(() => setBounceTarget(null), 400);
  };

  const safeAreaStyle: CSSProperties = {
    paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)",
    height: "calc(max(env(safe-area-inset-bottom, 0px), 1rem) + 4rem)",
  };

  const isRouteActive = (target: string) => {
    if (target === "/") {
      return pathname === "/";
    }
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  const baseLinkClasses = "flex flex-col items-center justify-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary focus:text-primary transition-colors";
  
  const activeStates = {
    playback: isRouteActive(ROUTES.PLAYBACK),
    home: isRouteActive(ROUTES.HOME),
    settings: isRouteActive(ROUTES.SETTINGS),
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex w-full items-center justify-around bg-background pt-2 shadow-[0_-2px_4px_rgba(0,0,0,0.1)] md:hidden border-t"
      style={safeAreaStyle}
    >
      {/* Playback - Left */}
      <Link
        to={ROUTES.PLAYBACK}
        onClick={() => triggerBounce("playback")}
        className={cn(
          baseLinkClasses,
          activeStates.playback && "text-primary font-semibold"
        )}
      >
        <Video
          className={cn(
            "h-6 w-6 nav-fade-scale",
            activeStates.playback ? "nav-active fill-primary/20" : "nav-inactive",
            bounceTarget === "playback" && "icon-bounce"
          )}
        />
        <span className="text-xs">Playback</span>
      </Link>

      {/* Home - Center (Large Circular Button) */}
      <Link
        to={ROUTES.HOME}
        onClick={() => triggerBounce("home")}
        className={cn(
          baseLinkClasses,
          "-translate-y-4",
          activeStates.home && "text-primary font-semibold"
        )}
      >
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-muted-foreground",
            "shadow transition-colors",
            activeStates.home && "bg-primary text-primary-foreground shadow-lg"
          )}
        >
          <Home
            className={cn(
              "h-8 w-8 nav-fade-scale",
              activeStates.home ? "nav-active text-primary-foreground" : "nav-inactive",
              bounceTarget === "home" && "scan-pop"
            )}
          />
        </div>
        <span className="text-xs">Home</span>
      </Link>

      {/* Settings - Right */}
      <Link
        to={ROUTES.SETTINGS}
        onClick={() => triggerBounce("settings")}
        className={cn(
          baseLinkClasses,
          activeStates.settings && "text-primary font-semibold"
        )}
      >
        <Settings
          className={cn(
            "h-6 w-6 nav-fade-scale",
            activeStates.settings ? "nav-active fill-primary/20" : "nav-inactive",
            bounceTarget === "settings" && "icon-bounce"
          )}
        />
        <span className="text-xs">Settings</span>
      </Link>
    </nav>
  );
}

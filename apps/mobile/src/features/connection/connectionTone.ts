import type { StatusTone } from "../../components/StatusPill";
import type { ActivityTone } from "../../components/ui/StatusDot";
import type { RemoteClientConnectionState } from "../../lib/connection";

/** A connection phase in the shared status-dot colours: a failure asks for the user, a retry is work. */
export function connectionActivityTone(state: RemoteClientConnectionState): ActivityTone {
  switch (state) {
    case "connected":
      return "idle";
    case "connecting":
    case "reconnecting":
      return "working";
    case "error":
    case "unsupported":
      return "attention";
    case "offline":
    case "available":
      return "offline";
  }
}

export function connectionTone(state: RemoteClientConnectionState): StatusTone {
  switch (state) {
    case "connected":
      return {
        label: "Connected",
        pillClassName: "bg-adaptive-emerald-500-a12-a16",
        textClassName: "text-adaptive-emerald-700-300",
      };
    case "reconnecting":
      return {
        label: "Reconnecting",
        pillClassName: "bg-warning",
        textClassName: "text-warning-foreground",
      };
    case "connecting":
      return {
        label: "Connecting",
        pillClassName: "bg-update",
        textClassName: "text-update-foreground",
      };
    case "unsupported":
      return {
        label: "Client not supported",
        pillClassName: "bg-subtle",
        textClassName: "text-foreground-secondary",
      };
    case "error":
      return {
        label: "Connection failed",
        pillClassName: "bg-danger",
        textClassName: "text-danger-foreground",
      };
    case "offline":
      return {
        label: "Offline",
        pillClassName: "bg-danger",
        textClassName: "text-danger-foreground",
      };
    case "available":
      return {
        label: "Available",
        pillClassName: "bg-subtle",
        textClassName: "text-foreground-secondary",
      };
  }
}

// Icons from the Lucide library (https://lucide.dev), turned into inline SVG
// strings so they can be used inside template literals.
// Only the icons imported here end up in the bundle.
import {
  ArrowRight, Ban, CalendarClock, ChevronDown, CircleAlert, CircleCheck, Clock,
  EyeOff, FastForward, FileCheck, FileCode, FileUp, FlaskConical, Gavel, HandCoins,
  Handshake, HardDrive, Hourglass, Inbox, Link, Loader, Lock, Radio, Scale, Send,
  ShieldAlert, ShieldCheck, TriangleAlert, Type, Unplug, Upload, User, Wallet, X,
  Fingerprint, Check, Circle, ListTodo, Sun, Moon, Monitor,
} from "lucide";

const ICONS = {
  "arrow-right": ArrowRight, ban: Ban, "calendar-clock": CalendarClock, "chevron-down": ChevronDown,
  "circle-alert": CircleAlert, "circle-check": CircleCheck, clock: Clock, "eye-off": EyeOff,
  "fast-forward": FastForward, "file-check": FileCheck, "file-code": FileCode, "file-up": FileUp,
  "flask-conical": FlaskConical, gavel: Gavel, "hand-coins": HandCoins, handshake: Handshake,
  "hard-drive": HardDrive, hourglass: Hourglass, inbox: Inbox, link: Link, loader: Loader, lock: Lock,
  radio: Radio, scale: Scale, send: Send, "shield-alert": ShieldAlert, "shield-check": ShieldCheck,
  "triangle-alert": TriangleAlert, type: Type, unplug: Unplug, upload: Upload, user: User,
  wallet: Wallet, x: X, fingerprint: Fingerprint, check: Check, circle: Circle, "list-todo": ListTodo,
  sun: Sun, moon: Moon, monitor: Monitor,
};

/** Returns the <svg> markup of an icon, e.g. icons("lock"). */
export function icons(name, extraClass = "") {
  const node = ICONS[name];
  if (!node) return "";
  const children = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
}

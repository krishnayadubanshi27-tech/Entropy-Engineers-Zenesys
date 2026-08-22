import { useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { KeyRound, Mail, Phone } from "lucide-react";
import { OTPInput, type SlotProps } from "input-otp";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/services/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const redirect = search["redirect"];
    return { redirect: typeof redirect === "string" ? redirect : undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in — EnContract" },
      {
        name: "description",
        content: "Sign in to EnContract to analyze contracts, manage workspaces, and track compliance.",
      },
      { property: "og:title", content: "Sign in — EnContract" },
      {
        property: "og:description",
        content: "Sign in to EnContract to analyze contracts, manage workspaces, and track compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
      />
    </svg>
  );
}

function OtpSlot(props: SlotProps) {
  return (
    <div
      className={`grid size-11 place-items-center rounded-lg border bg-background/60 text-lg font-semibold text-foreground transition-colors ${
        props.isActive ? "border-ring ring-1 ring-ring" : "border-input"
      }`}
    >
      {props.char ?? (props.hasFakeCaret ? <span className="animate-pulse text-primary">|</span> : null)}
    </div>
  );
}

function AuthPage() {
  const { user, ready, signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [method, setMethod] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Sanitize the redirect target to known internal routes.
  const dest = redirect === "/" ? "/" : "/dashboard";

  if (ready && user) {
    return <Navigate to={dest} />;
  }

  const destination = () => navigate({ to: dest });

  const submitEmail = () => {
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    signInWithEmail(name, email);
    toast.success(`Welcome, ${name.trim()}!`);
    destination();
  };

  const backendNotice =
    "This provider activates once your own backend is connected — see docs/backend-api.md. Use email sign-in for now.";

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex flex-col items-center gap-1">
          <Logo markClassName="size-11 rounded-xl" className="[&>span:last-child]:text-2xl" />
          <span className="text-xs text-muted-foreground">
            your own contract and compliance manager
          </span>
        </Link>

        <div className="glass-strong animate-rise rounded-2xl p-6">
          <h1 className="font-display text-xl font-semibold text-foreground">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in or create your account to analyze contracts.
          </p>

          <Button
            variant="outline"
            className="mt-6 w-full py-2.5"
            onClick={() => toast.info(backendNotice)}
          >
            <GoogleMark />
            Sign in with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or continue with
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-secondary/50 p-1">
            <button
              onClick={() => setMethod("email")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                method === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="size-3.5" />
              Email
            </button>
            <button
              onClick={() => setMethod("phone")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                method === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Phone className="size-3.5" />
              Phone number
            </button>
          </div>

          {method === "email" ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="auth-name" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Your name
                </label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="auth-email" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Email address
                </label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                />
              </div>
              <Button className="w-full py-2.5" onClick={submitEmail}>
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="auth-phone" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Phone number
                </label>
                <Input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                />
              </div>
              {!otpSent ? (
                <Button
                  className="w-full py-2.5"
                  disabled={phone.trim().length < 8}
                  onClick={() => {
                    setOtpSent(true);
                    toast.info(backendNotice);
                  }}
                >
                  <KeyRound className="size-4" />
                  Send OTP
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    SMS delivery needs your own backend with an SMS provider (e.g. Twilio). The OTP
                    flow below is ready to wire up — see docs/backend-api.md.
                  </div>
                  <div className="flex justify-center">
                    <OTPInput
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      containerClassName="flex gap-2"
                      render={({ slots }) => (
                        <>
                          {slots.map((slot, i) => (
                            <OtpSlot key={i} {...slot} />
                          ))}
                        </>
                      )}
                    />
                  </div>
                  <Button
                    className="w-full py-2.5"
                    disabled={otp.length !== 6}
                    onClick={() => toast.info(backendNotice)}
                  >
                    Verify OTP
                  </Button>
                  <button
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                    }}
                  >
                    Use a different number
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground/70">
          Local session mode — your account lives in this browser until a backend is connected.
        </p>
      </div>
    </div>
  );
}

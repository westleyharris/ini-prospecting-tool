import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ALLOWED_DOMAINS = ["ii-automation.com", "ime-us.com", "integratec.hn"];

export default function RegisterPage() {
  const { user, loading: authLoading, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const domain = email.trim().toLowerCase().split("@")[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      setError("Registration is limited to company email addresses.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-brand-navy" />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen bg-brand-navy flex items-center justify-center px-4 py-10">
      {/* Dot-grid backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/brand/logo-horizontal-white.svg" alt="I&I Automation" className="h-12 w-auto" />
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-brand-lime">
            Internal Platform
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl px-8 py-8">
          <h1 className="text-lg font-bold text-brand-navy mb-5">Create your account</h1>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ii-automation.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime focus:border-transparent"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Company email addresses only.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-lime text-brand-navy rounded-lg py-2.5 text-sm font-bold hover:bg-brand-lime-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-navy font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-6">
          I&amp;I Automation · Control Engineering
        </p>
      </div>
    </div>
  );
}

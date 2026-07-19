import { Link } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <img src="/brand/icon-robot-lime.svg" alt="" className="w-20 h-auto mb-6 opacity-90" />
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">Error 404</p>
      <h1 className="text-2xl font-bold text-brand-navy">Page not found</h1>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy-700"
      >
        <HiArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}

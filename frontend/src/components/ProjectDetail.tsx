import { useState, useEffect } from "react";
import {
  fetchProject,
  uploadProjectFile,
  updateProject,
  convertToCommissioning,
  getProjectFileUrl,
  type Project,
  type ProjectFile,
} from "../api/projects";
import { fetchCommissionings } from "../api/commissionings";

interface ProjectDetailProps {
  project: Project;
  plantName?: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ProjectDetail({ project, plantName, onClose, onUpdate }: ProjectDetailProps) {
  const [proj, setProj] = useState<Project>(project);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [hasCommissioning, setHasCommissioning] = useState(false);
  const [fileType, setFileType] = useState("quotation");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProject(project.id);
      setProj(data);
      const comms = await fetchCommissionings();
      const found = comms.some((c) => c.project_id === project.id);
      setHasCommissioning(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [project.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadProjectFile(project.id, file, fileType);
      setProj((prev) => ({
        ...prev,
        files: [...(prev.files ?? []), uploaded],
      }));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      const updated = await updateProject(project.id, { status: newStatus });
      setProj(updated);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToCommissioning = async () => {
    if (!confirm("Create commissioning for this project? This assigns a COMM number.")) return;
    setConverting(true);
    try {
      const result = await convertToCommissioning(project.id);
      setHasCommissioning(true);
      alert(`Commissioning created: ${result.comm_number}`);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to create commissioning");
    } finally {
      setConverting(false);
    }
  };

  const files = proj.files ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {proj.pr_number} — {plantName ?? "Project"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={proj.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={saving}
                  className="rounded border-gray-300 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              {proj.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <p className="text-sm text-gray-600">{proj.notes}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project folder (files)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="rounded border-gray-300 text-sm"
                  >
                    <option value="quotation">Quotation</option>
                    <option value="po">PO</option>
                    <option value="other">Other</option>
                  </select>
                  <label className="px-4 py-2 bg-gray-100 rounded-md text-sm cursor-pointer hover:bg-gray-200">
                    {uploading ? "Uploading..." : "Upload file"}
                    <input
                      type="file"
                      className="hidden"
                      accept=".doc,.docx,.pdf,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {files.length === 0 ? (
                  <p className="text-sm text-gray-500">No files yet. Upload quotation, PO, etc.</p>
                ) : (
                  <ul className="space-y-1">
                    {files.map((f: ProjectFile) => (
                      <li key={f.id}>
                        <a
                          href={getProjectFileUrl(project.id, f.filename)}
                          download={f.original_name}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          📄 {f.original_name} ({f.file_type})
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200">
                {hasCommissioning ? (
                  <p className="text-sm text-green-600 font-medium">✓ Commissioning created for this project</p>
                ) : (
                  <button
                    onClick={handleConvertToCommissioning}
                    disabled={converting}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {converting ? "Creating..." : "Receive PO → Create commissioning"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

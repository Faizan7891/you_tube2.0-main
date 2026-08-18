import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";

interface Report {
  _id: string;
  reason: string;
  status: string;
  createdAt: string;
  commentId?: {
    _id: string;
    commentbody: string;
    usercommented?: string;
  };
  reporterId?: {
    name?: string;
    username?: string;
  };
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const { user } = useUser();
  const loadReports = async () => {
    try {
      setError("");

      const res = await axiosInstance.get(
        "/comment/admin/reports"
      );

      setReports(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (user) {
    loadReports();
  }
}, [user]);

  const dismissReport = async (reportId: string) => {
    try {
      await axiosInstance.patch(
        `/comment/admin/reports/${reportId}/dismiss`
      );

      setReports((prev) =>
        prev.map((report) =>
          report._id === reportId
            ? {
                ...report,
                status: "dismissed",
              }
            : report
        )
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          "Unable to dismiss report."
      );
    }
  };

  const reviewReport = async (reportId: string) => {
  try {
    await axiosInstance.patch(
      `/comment/admin/reports/${reportId}/review`
    );

    setReports((prev) =>
      prev.map((report) =>
        report._id === reportId
          ? {
              ...report,
              status: "reviewed",
            }
          : report
      )
    );
  } catch (err: any) {
    alert(
      err?.response?.data?.message ||
        "Unable to review report."
    );
  }
};
  const deleteComment = async (reportId: string) => {
    const confirmed = window.confirm(
      "Delete this reported comment?"
    );

    if (!confirmed) return;

    try {
      await axiosInstance.delete(
        `/comment/admin/reports/${reportId}/comment`
      );

      setReports((prev) =>
        prev.map((report) =>
          report._id === reportId
            ? {
                ...report,
                status: "reviewed",
              }
            : report
        )
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          "Unable to delete comment."
      );
    }
  };

  if (!user) {
  return (
    <div className="p-6 text-black">
      Checking authentication...
    </div>
  );
}

  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-bold">
          Comment Moderation
        </h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-600">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="rounded-lg border p-6 text-gray-500">
            No reports found.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report._id}
                className="rounded-lg border p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold">
                    Report: {report.reason}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                    {report.status}
                  </span>
                </div>

                <div className="mb-3 rounded-md bg-gray-50 p-3">
                  <p className="text-sm text-gray-500">
                    Comment
                  </p>

                  <p className="mt-1">
                    {report.commentId?.commentbody ||
                      "Comment deleted"}
                  </p>
                </div>

                <p className="mb-1 text-sm text-gray-600">
                  Reported by:{" "}
                  {report.reporterId?.username ||
                    report.reporterId?.name ||
                    "Unknown user"}
                </p>

                <p className="mb-4 text-xs text-gray-400">
                  {new Date(
                    report.createdAt
                  ).toLocaleString()}
                </p>

                {report.status === "pending" && (
                 <div className="flex gap-3">
  <button
    onClick={() =>
      reviewReport(report._id)
    }
    className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100"
  >
    Review
  </button>

  <button
    onClick={() =>
      dismissReport(report._id)
    }
    className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100"
  >
    Dismiss
  </button>

  <button
    onClick={() =>
      deleteComment(report._id)
    }
    className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
  >
    Delete Comment
  </button>
</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
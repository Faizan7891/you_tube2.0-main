import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";

const Downloads = () => {
  const { user } = useUser();

  const [downloads, setDownloads] = useState<any[]>([]);
  const [plan, setPlan] = useState("free");
  const [dailyLimit, setDailyLimit] = useState(1);
  const [monthlyLimit, setMonthlyLimit] = useState(30);
  const [remainingDaily, setRemainingDaily] = useState(1);
  const [remainingMonthly, setRemainingMonthly] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDownloads = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await axiosInstance.get("/download/my");

        setDownloads(response.data.downloads || []);
        setPlan(response.data.subscriptionPlan || "free");
        setDailyLimit(response.data.dailyDownloadLimit || 1);
        setMonthlyLimit(response.data.monthlyDownloadLimit || 30);
        setRemainingDaily(response.data.remainingDailyQuota || 0);
        setRemainingMonthly(response.data.remainingMonthlyQuota || 0);
      } catch (error) {
        console.error("Failed to fetch downloads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDownloads();
  }, [user]);

  if (!user) {
    return (
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold">Downloads</h1>

        <p className="mt-4 text-gray-600">
          Please login to view your downloads.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 p-6">
        <p>Loading downloads...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Downloads</h1>

        {/* Quota information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Subscription</p>

            <p className="text-xl font-semibold capitalize">{plan}</p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Daily quota</p>

            <p className="text-xl font-semibold">
              {remainingDaily} / {dailyLimit}
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Monthly quota</p>

            <p className="text-xl font-semibold">
              {remainingMonthly} / {monthlyLimit}
            </p>
          </div>
        </div>

        {downloads.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-gray-500">No downloads yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {downloads.map((item) => (
              <div key={item._id} className="border rounded-lg p-4 flex gap-4">
                {/* Video preview */}
                <div className="w-40 h-24 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  {item.videoId?.thumbnail ? (
                    <img
src={`${process.env.BACKEND_URL}${item.videoId.thumbnail}`}                      alt={item.videoId?.videotitle || "Video thumbnail"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No thumbnail
                    </div>
                  )}
                </div>

                {/* Download information */}
                <div className="flex-1">
                  <h2 className="font-semibold">
                    {item.videoId?.videotitle || "Unknown video"}
                  </h2>

                  <div className="text-sm text-gray-500 mt-2 space-y-1">
                    <p>
                      Downloaded: {new Date(item.downloadDate).toLocaleString()}
                    </p>

                    <p>File size: {item.fileSize || "Unknown"}</p>

                    <p>
                      Plan:{" "}
                      <span className="capitalize">
                        {item.subscriptionPlan}
                      </span>
                    </p>

                    <p>
                      Status: <span className="capitalize">{item.status}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Downloads;

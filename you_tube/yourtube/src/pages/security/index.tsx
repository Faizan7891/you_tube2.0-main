import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";

const Security = () => {
  const [loginHistory, setLoginHistory] =
    useState<any[]>([]);

  const [trustedDevices, setTrustedDevices] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const fetchSecurityInfo = async () => {
    try {
      const response =
        await axiosInstance.get(
          "/security"
        );

      setLoginHistory(
        response.data.loginHistory || []
      );

      setTrustedDevices(
        response.data.trustedDevices || []
      );
    } catch (error) {
      console.error(
        "Security information error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityInfo();
  }, []);

  const revokeDevice = async (
    deviceId: string
  ) => {
    const confirmed =
      window.confirm(
        "Remove this trusted device?"
      );

    if (!confirmed) return;

    try {
      await axiosInstance.delete(
        `/security/trusted-device/${deviceId}`
      );

      setTrustedDevices(
        (devices) =>
          devices.filter(
            (device) =>
              device.deviceId !== deviceId
          )
      );

      alert(
        "Trusted device removed."
      );
    } catch (error) {
      console.error(
        "Remove device error:",
        error
      );

      alert(
        "Unable to remove trusted device."
      );
    }
  };

  if (loading) {
    return (
      <main className="flex-1 p-6">
        Loading security information...
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto max-w-6xl">

        <h1 className="text-3xl font-bold">
          Account Security
        </h1>

        <p className="mt-2 text-gray-500">
          Review your login activity and
          trusted devices.
        </p>

        {/* TRUSTED DEVICES */}

        <section className="mt-8">

          <h2 className="text-xl font-bold">
            Trusted Devices
          </h2>

          <div className="mt-4 space-y-4">

            {trustedDevices.length === 0 ? (
              <p className="text-gray-500">
                No trusted devices.
              </p>
            ) : (
              trustedDevices.map(
                (device) => (
                  <div
                    key={device.deviceId}
                    className="rounded-xl border p-5"
                  >

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                      <div>

                        <p className="font-semibold">
                          {device.browser ||
                            "Unknown Browser"}
                        </p>

                        <p className="text-sm text-gray-500">
                          Device:{" "}
                          {device.deviceType ||
                            "Unknown"}
                        </p>

                        <p className="text-sm text-gray-500">
                          IP:{" "}
                          {device.ipAddress ||
                            "Unknown"}
                        </p>

                        <p className="text-sm text-gray-500">
                          Trusted until:{" "}
                          {device.trustedUntil
                            ? new Date(
                                device.trustedUntil
                              ).toLocaleString()
                            : "Unknown"}
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          revokeDevice(
                            device.deviceId
                          )
                        }
                        className="rounded-lg border border-red-500 px-4 py-2 text-red-500 hover:bg-red-50"
                      >
                        Remove
                      </button>

                    </div>

                  </div>
                )
              )
            )}

          </div>

        </section>

        {/* LOGIN HISTORY */}

        <section className="mt-10">

          <h2 className="text-xl font-bold">
            Login History
          </h2>

          <div className="mt-4 space-y-4">

            {loginHistory.length === 0 ? (
              <p className="text-gray-500">
                No login history available.
              </p>
            ) : (
              loginHistory.map(
                (login) => (
                  <div
                    key={login._id}
                    className="rounded-xl border p-5"
                  >

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                      <div>
                        <p className="text-sm text-gray-500">
                          Status
                        </p>

                        <p className="font-semibold capitalize">
                          {login.status ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          Browser
                        </p>

                        <p className="font-semibold">
                          {login.browser ||
                            "Unknown"}{" "}
                          {login.browserVersion ||
                            ""}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          Operating System
                        </p>

                        <p className="font-semibold">
                          {login.operatingSystem ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          Device
                        </p>

                        <p className="font-semibold">
                          {login.deviceType ||
                            "Unknown"}
                        </p>

                        <p className="text-sm text-gray-500">
                          {login.deviceModel ||
                            ""}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          IP Address
                        </p>

                        <p className="font-semibold">
                          {login.ipAddress ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          Location
                        </p>

                        <p className="font-semibold">
                          {login.location ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          City
                        </p>

                        <p className="font-semibold">
                          {login.city ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          State
                        </p>

                        <p className="font-semibold">
                          {login.state ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          Country
                        </p>

                        <p className="font-semibold">
                          {login.country ||
                            "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          Login Time
                        </p>

                        <p className="font-semibold">
                          {login.loginTimestamp
                            ? new Date(
                                login.loginTimestamp
                              ).toLocaleString()
                            : "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          OTP Required
                        </p>

                        <p className="font-semibold">
                          {login.otpRequired
                            ? "Yes"
                            : "No"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">
                          OTP Verified
                        </p>

                        <p className="font-semibold">
                          {login.otpVerified
                            ? "Yes"
                            : "No"}
                        </p>
                      </div>

                    </div>

                  </div>
                )
              )
            )}

          </div>

        </section>

      </div>
    </main>
  );
};

export default Security;
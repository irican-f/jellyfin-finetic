import { cookies } from "next/headers";
import { Jellyfin } from "@jellyfin/sdk";

// Function to get device ID from cookie (server-side only)
async function getDeviceId(): Promise<string> {
    const cookieStore = await cookies();
    const existingDeviceId = cookieStore.get("jellyfin-device-id");

    if (existingDeviceId?.value) {
        return existingDeviceId.value;
    }

    // Fallback: generate new device ID if none exists
    return crypto.randomUUID();
}

// Create Jellyfin SDK instance with device ID from cookie (server-side only)
export async function createJellyfinInstance() {
    const deviceId = await getDeviceId();

    return new Jellyfin({
        clientInfo: {
            name: "Finetic",
            version: "1.0.0",
        },
        deviceInfo: {
            name: "Finetic Web Client",
            id: deviceId,
        },
    });
}

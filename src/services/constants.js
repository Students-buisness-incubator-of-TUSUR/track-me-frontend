import { getBackendUri } from "../utils/runtime-env";
export const backendURL = getBackendUri() || "http://localhost:8081";
export const backendURLSSO = backendURL + "/sso";
export const backendURLBackend = backendURL + "/backend";
export const backendURLMeeting = backendURL + "/meeting";
export const superadminRoleName = "SUPER_ADMIN";
export const adminRoleName = "ADMIN";
export const trackerRoleName = "TRACKER";

